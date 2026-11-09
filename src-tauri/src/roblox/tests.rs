use super::*;
use http::{Response, Transport};
use std::{
    collections::VecDeque,
    sync::Mutex,
    time::{Duration, SystemTime},
};

type RecordedCall = (Endpoint, Vec<(String, String)>);
struct Fake {
    responses: Mutex<VecDeque<Result<Response, ApiError>>>,
    calls: Mutex<Vec<RecordedCall>>,
    waits: Mutex<Vec<Duration>>,
}
impl Fake {
    fn new(responses: Vec<Response>) -> Arc<Self> {
        Arc::new(Self {
            responses: Mutex::new(responses.into_iter().map(Ok).collect()),
            calls: Mutex::new(vec![]),
            waits: Mutex::new(vec![]),
        })
    }
}
impl Transport for Fake {
    fn send(&self, request: &Request) -> Result<Response, ApiError> {
        self.calls
            .lock()
            .unwrap()
            .push((request.endpoint, request.query.clone()));
        self.responses
            .lock()
            .unwrap()
            .pop_front()
            .expect("unexpected HTTP request")
    }
    fn wait(&self, duration: Duration) {
        self.waits.lock().unwrap().push(duration);
    }
}
fn response(status: u16, value: serde_json::Value) -> Response {
    Response {
        status,
        body: serde_json::to_vec(&value).unwrap(),
        retry_after: None,
        exhausted_reset: None,
    }
}
fn metadata() -> serde_json::Value {
    json!({"data":[{"id":994732206,"rootPlaceId":2753915549u64,"name":"Verified test experience","description":"A test response, not production data.","creator":{"id":1,"name":"Creator","type":"User"},"playing":42,"genre_l1":"RPG"}]})
}
fn images(target: u64) -> serde_json::Value {
    json!({"data":[{"targetId":target,"state":"Completed","imageUrl":"https://tr.rbxcdn.com/test.png"}]})
}
fn game_responses() -> Vec<Response> {
    vec![
        response(200, metadata()),
        response(
            200,
            json!({"data":[{"id":994732206,"upVotes":8,"downVotes":2}]}),
        ),
        response(200, images(994732206)),
        response(
            200,
            json!({"data":[{"universeId":994732206,"thumbnails":[{"targetId":12,"state":"Pending","imageUrl":null}]}]}),
        ),
    ]
}
fn request() -> ApiRequest {
    ApiRequest::LookupUniverse {
        universe_id: "994732206".into(),
    }
}

#[test]
fn ids_are_canonical_distinct_and_urls_are_restricted() {
    for value in [
        "",
        "0",
        "01",
        " 1",
        "-1",
        "１２",
        "https://roblox.com",
        "18446744073709551616",
    ] {
        assert!(numeric_id(value).is_err());
    }
    assert_eq!(numeric_id("2753915549").unwrap(), 2753915549);
    for value in [
        "http://tr.rbxcdn.com/a",
        "https://evil.com/a",
        "https://tr.rbxcdn.com.evil.com/a",
        "https://u:p@tr.rbxcdn.com/a",
        "https://tr.rbxcdn.com:444/a",
        "file:///x",
        "javascript:alert(1)",
    ] {
        assert!(cdn_url(value).is_none(), "{value}");
    }
    assert!(cdn_url("https://tr.rbxcdn.com/a.png").is_some());
    for value in [
        json!({"action":"lookupUniverse","universeId":"1","url":"https://evil.com"}),
        json!({"action":"lookupUser","userId":"1","cookie":"secret"}),
        json!({"action":"execute","command":"x"}),
    ] {
        assert!(serde_json::from_value::<ApiRequest>(value).is_err());
    }
}
#[test]
fn parses_verified_metadata_maps_universe_to_place_and_caches_without_refetching() {
    let dir = tempfile::tempdir().unwrap();
    let transport = Fake::new(game_responses());
    let service =
        Service::with_transport(&dir.path().join("cache.sqlite3"), transport.clone()).unwrap();
    let ApiResponse::Experience(first) = service.execute(request()).unwrap() else {
        panic!()
    };
    assert_eq!(first.experience.id, "2753915549");
    assert_eq!(first.experience.universe_id, "994732206");
    assert_eq!(first.experience.category.as_deref(), Some("RPG"));
    assert_eq!(first.experience.players, Some(42));
    assert_eq!(first.experience.up_votes, Some(8));
    assert!(first.experience.thumbnail_url.is_none());
    let ApiResponse::Experience(second) = service.execute(request()).unwrap() else {
        panic!()
    };
    assert_eq!(first.experience.observed_at, second.experience.observed_at);
    assert_eq!(transport.calls.lock().unwrap().len(), 4);
    assert!(transport
        .calls
        .lock()
        .unwrap()
        .iter()
        .all(|(_, q)| !q.iter().any(|(key, _)| key == "placeIds")));
}
#[test]
fn optional_statistics_and_images_fail_without_fabricating_data() {
    let dir = tempfile::tempdir().unwrap();
    let transport = Fake::new(vec![
        response(200, metadata()),
        response(403, json!({})),
        response(
            200,
            json!({"data":[{"targetId":994732206,"state":"Completed","imageUrl":"https://evil.com/a"}]}),
        ),
        response(200, json!({"data":[]})),
    ]);
    let service = Service::with_transport(&dir.path().join("cache"), transport).unwrap();
    let ApiResponse::Experience(result) = service.execute(request()).unwrap() else {
        panic!()
    };
    assert!(
        result.experience.icon_url.is_none()
            && result.experience.up_votes.is_none()
            && result.experience.down_votes.is_none()
    );
    assert_eq!(result.warnings[0].code, ErrorCode::Forbidden);
}
#[test]
fn rejects_wrong_universe_ids_and_malformed_external_data() {
    for data in [
        json!({"data":"not-an-array"}),
        json!({"data":[{"id":1,"rootPlaceId":2,"name":"Wrong ID","description":"","creator":{"id":1,"name":"A","type":"User"}}]}),
        json!({"data":[{"id":994732206,"rootPlaceId":0,"name":"No Place","description":"","creator":{"id":1,"name":"A","type":"User"}}]}),
    ] {
        let dir = tempfile::tempdir().unwrap();
        let service = Service::with_transport(
            &dir.path().join("cache"),
            Fake::new(vec![response(200, data)]),
        )
        .unwrap();
        assert_eq!(
            service.execute(request()).unwrap_err().code,
            ErrorCode::InvalidResponse
        );
    }
}
#[test]
fn retries_are_bounded_and_honor_short_retry_after() {
    let mut limited = response(429, json!({}));
    limited.retry_after = Some("1".into());
    let transport = Fake::new(vec![limited, response(200, json!({"data":[]}))]);
    let http = Http::new(transport.clone());
    let _: Data<VoteWire> = http.json(Request::get(Endpoint::Votes, &[])).unwrap();
    assert_eq!(*transport.waits.lock().unwrap(), [Duration::from_secs(1)]);
    assert_eq!(transport.calls.lock().unwrap().len(), 2);
    let transport = Fake::new(vec![response(503, json!({})), response(503, json!({}))]);
    let http = Http::new(transport.clone());
    assert_eq!(
        http.json::<Data<VoteWire>>(Request::get(Endpoint::Votes, &[]))
            .unwrap_err()
            .code,
        ErrorCode::Unavailable
    );
    assert_eq!(transport.calls.lock().unwrap().len(), 2);
}
#[test]
fn long_rate_limits_create_cooldown_without_sleep_or_more_requests() {
    let mut limited = response(429, json!({}));
    limited.retry_after = Some("60".into());
    let transport = Fake::new(vec![limited]);
    let http = Http::new(transport.clone());
    let error = http
        .json::<UserPageWire>(Request::get(Endpoint::UserSearch, &[]))
        .unwrap_err();
    assert_eq!(error.retry_after_seconds, Some(60));
    assert_eq!(
        http.json::<UserPageWire>(Request::get(Endpoint::UserSearch, &[]))
            .unwrap_err()
            .code,
        ErrorCode::RateLimited
    );
    assert!(transport.waits.lock().unwrap().is_empty());
    assert_eq!(transport.calls.lock().unwrap().len(), 1);
    let date = SystemTime::UNIX_EPOCH + Duration::from_secs(1_700_000_000);
    assert_eq!(
        http::retry_after(
            &httpdate::fmt_http_date(date + Duration::from_secs(30)),
            date
        ),
        Some(30)
    );
}
#[test]
fn public_user_pagination_encodes_opaque_cursors_and_caches_pages() {
    let dir = tempfile::tempdir().unwrap();
    let transport = Fake::new(vec![
        response(
            200,
            json!({"data":[{"id":1,"name":"Roblox","displayName":"Roblox"}],"nextPageCursor":"opaque+/="}),
        ),
        response(
            200,
            json!({"data":[{"id":2,"name":"Builder","displayName":"Builder"}],"nextPageCursor":null}),
        ),
    ]);
    let service = Service::with_transport(&dir.path().join("cache"), transport.clone()).unwrap();
    let ApiResponse::Users(first) = service
        .execute(ApiRequest::SearchUsers {
            keyword: "Roblox".into(),
            cursor: None,
        })
        .unwrap()
    else {
        panic!()
    };
    let ApiResponse::Users(second) = service
        .execute(ApiRequest::SearchUsers {
            keyword: "Roblox".into(),
            cursor: first.next_cursor.clone(),
        })
        .unwrap()
    else {
        panic!()
    };
    assert_eq!(first.users[0].id, "1");
    assert_eq!(second.users[0].id, "2");
    assert!(second.next_cursor.is_none());
    service
        .execute(ApiRequest::SearchUsers {
            keyword: "Roblox".into(),
            cursor: first.next_cursor,
        })
        .unwrap();
    assert_eq!(transport.calls.lock().unwrap().len(), 2);
    assert!(transport.calls.lock().unwrap()[1]
        .1
        .contains(&("cursor".into(), "opaque+/=".into())));
}
#[test]
fn cache_survives_restart_and_does_not_touch_existing_library() {
    let dir = tempfile::tempdir().unwrap();
    let library_path = dir.path().join("nova.sqlite3");
    let mut db = rusqlite::Connection::open(&library_path).unwrap();
    crate::storage::migrate(&db).unwrap();
    let mut data = crate::storage::load(&db).unwrap();
    data.favorites = vec!["2753915549".into(), "123".into()];
    data.preferences.theme = crate::storage::Theme::Light;
    crate::storage::save(&mut db, &data).unwrap();
    let path = dir.path().join("roblox-cache.sqlite3");
    Service::with_transport(&path, Fake::new(game_responses()))
        .unwrap()
        .execute(request())
        .unwrap();
    let offline = Fake::new(vec![]);
    offline.responses.lock().unwrap().extend([
        Err(ApiError::new(ErrorCode::Offline, "Offline")),
        Err(ApiError::new(ErrorCode::Offline, "Offline")),
    ]);
    let service = Service::with_transport(&path, offline).unwrap();
    let ApiResponse::Experience(cached) = service.execute(request()).unwrap() else {
        panic!()
    };
    assert!(cached.experience.cached);
    assert_eq!(cached.warnings[0].code, ErrorCode::Offline);
    assert_eq!(crate::storage::load(&db).unwrap(), data);
    assert_eq!(
        db.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        2
    );
}
#[test]
fn metadata_cache_failures_are_reported_and_transactions_do_not_erase_old_values() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("cache");
    let transport = Fake::new(game_responses());
    let service = Service::with_transport(&path, transport).unwrap();
    service.execute(request()).unwrap();
    let db = rusqlite::Connection::open(&path).unwrap();
    db.execute_batch("CREATE TRIGGER reject_cache BEFORE UPDATE ON metadata BEGIN SELECT RAISE(ABORT,'test cache failure'); END").unwrap();
    let ApiResponse::Experience(result) = service.execute(request()).unwrap() else {
        panic!()
    };
    assert_eq!(result.warnings.last().unwrap().code, ErrorCode::Cache);
    assert_eq!(service.load_cache().unwrap().len(), 1);
    db.execute("UPDATE metadata SET value='corrupt'", [])
        .unwrap_err();
    db.execute_batch("DROP TRIGGER reject_cache; UPDATE metadata SET value='corrupt'")
        .unwrap();
    assert_eq!(service.load_cache().unwrap_err().code, ErrorCode::Cache);
}

#[test]
fn public_profile_parsing_optional_avatar_failure_and_username_misses() {
    let dir = tempfile::tempdir().unwrap();
    let transport = Fake::new(vec![
        response(
            200,
            json!({"data":[{"id":1,"name":"Roblox","displayName":"Roblox"}]}),
        ),
        response(
            200,
            json!({"id":1,"name":"Roblox","displayName":"Roblox","description":"Public biography","created":"2006-02-27T00:00:00Z","isBanned":false,"hasVerifiedBadge":true}),
        ),
        response(403, json!({})),
        response(200, json!({"data":[]})),
    ]);
    let service = Service::with_transport(&dir.path().join("cache"), transport.clone()).unwrap();
    let ApiResponse::Profile(Some(profile)) = service
        .execute(ApiRequest::LookupUsername {
            username: "Roblox".into(),
        })
        .unwrap()
    else {
        panic!()
    };
    assert_eq!(profile.id, "1");
    assert!(profile.verified && profile.avatar_url.is_none());
    assert_eq!(profile.warnings[0].code, ErrorCode::Forbidden);
    let ApiResponse::Profile(None) = service
        .execute(ApiRequest::LookupUsername {
            username: "NoSuchAccount".into(),
        })
        .unwrap()
    else {
        panic!()
    };
    assert_eq!(transport.calls.lock().unwrap().len(), 4);
}

#[test]
fn offline_timeouts_forbidden_and_empty_metadata_are_actionable() {
    let transport = Fake::new(vec![]);
    transport.responses.lock().unwrap().extend([
        Err(ApiError::new(ErrorCode::Timeout, "Timeout")),
        Err(ApiError::new(ErrorCode::Offline, "Offline")),
    ]);
    let http = Http::new(transport.clone());
    assert_eq!(
        http.json::<Data<GameWire>>(Request::get(Endpoint::Metadata, &[]))
            .unwrap_err()
            .code,
        ErrorCode::Offline
    );
    assert_eq!(transport.calls.lock().unwrap().len(), 2);
    let dir = tempfile::tempdir().unwrap();
    let service = Service::with_transport(
        &dir.path().join("cache"),
        Fake::new(vec![response(200, json!({"data":[]}))]),
    )
    .unwrap();
    assert_eq!(
        service.execute(request()).unwrap_err().code,
        ErrorCode::NotFound
    );
}

#[test]
fn unavailable_metadata_cache_does_not_disable_independent_profile_requests() {
    let dir = tempfile::tempdir().unwrap();
    let service = Service::with_transport(dir.path(), Fake::new(vec![
        response(200, json!({"id":1,"name":"Roblox","displayName":"Roblox","description":"","created":"2006-02-27T00:00:00Z","isBanned":false})),
        response(200, images(1)),
    ])).unwrap();
    assert_eq!(
        service.execute(ApiRequest::CachedCatalog).unwrap_err().code,
        ErrorCode::Cache
    );
    let ApiResponse::Profile(Some(profile)) = service
        .execute(ApiRequest::LookupUser {
            user_id: "1".into(),
        })
        .unwrap()
    else {
        panic!()
    };
    assert_eq!(profile.id, "1");
    assert!(profile.avatar_url.is_some());
}
