//! Integration tests across validation, dispatch, migration, and native-owned SQLite history.
use nova_launcher_lib::{
    adapters::{self, AdapterId},
    launch::{
        execute_with_database, DispatchError, ErrorCode, LaunchBackend, LaunchRequest,
        NativeBackend, PlaceId,
    },
    storage::{self, AdapterSelection},
};
use rusqlite::Connection;
use std::cell::Cell;

struct Backend {
    calls: Cell<usize>,
    failure: Option<ErrorCode>,
}
impl Backend {
    fn new(failure: Option<ErrorCode>) -> Self {
        Self {
            calls: Cell::new(0),
            failure,
        }
    }
    fn dispatch(&self) -> Result<(), DispatchError> {
        self.calls.set(self.calls.get() + 1);
        self.failure.map_or(Ok(()), |code| {
            Err(DispatchError::new(code, "Test dispatch rejected"))
        })
    }
}
impl LaunchBackend for Backend {
    fn launch_client(&self, _: AdapterSelection) -> Result<AdapterId, DispatchError> {
        self.dispatch()?;
        Ok(AdapterId::Sober)
    }
    fn open_experience(&self, _: &PlaceId) -> Result<(), DispatchError> {
        self.dispatch()
    }
}
fn database() -> Connection {
    let c = Connection::open_in_memory().unwrap();
    storage::migrate(&c).unwrap();
    c
}
fn client() -> LaunchRequest {
    LaunchRequest::LaunchClient {
        adapter: AdapterSelection::Auto,
    }
}
fn experience(id: &str) -> LaunchRequest {
    LaunchRequest::OpenExperience {
        place_id: id.into(),
    }
}

#[test]
fn accepted_process_and_browser_requests_round_trip_without_play_claims() {
    let c = database();
    let backend = Backend::new(None);
    let a = execute_with_database(&backend, client(), &c).unwrap();
    let b = execute_with_database(&backend, experience("2753915549"), &c).unwrap();
    assert!(a.history_saved && b.history_saved);
    assert_eq!(a.request.place_id, None);
    assert_eq!(b.request.adapter, None);
    assert_eq!(backend.calls.get(), 2);
    assert_eq!(
        storage::load_requests(&c).unwrap(),
        vec![b.request, a.request]
    );
    assert!(storage::load(&c).unwrap().recent.is_empty());
}
#[test]
fn rejected_process_uri_missing_client_and_unsupported_requests_never_enter_history() {
    for code in [
        ErrorCode::DispatchFailed,
        ErrorCode::ClientMissing,
        ErrorCode::UnsupportedPlatform,
    ] {
        let c = database();
        let backend = Backend::new(Some(code));
        assert_eq!(
            execute_with_database(&backend, client(), &c)
                .unwrap_err()
                .code,
            code
        );
        assert_eq!(
            execute_with_database(&backend, experience("1"), &c)
                .unwrap_err()
                .code,
            code
        );
        assert!(storage::load_requests(&c).unwrap().is_empty());
    }
}
#[test]
fn invalid_place_ids_are_rejected_before_dispatch_and_persistence() {
    let c = database();
    let backend = Backend::new(None);
    for id in [
        "",
        "0",
        "01",
        "-1",
        "1.2",
        " 1",
        "1 ",
        "１２",
        "1&start=evil",
        "https://www.roblox.com/games/1",
        "18446744073709551616",
        "1\0",
    ] {
        assert_eq!(
            execute_with_database(&backend, experience(id), &c)
                .unwrap_err()
                .code,
            ErrorCode::InvalidPlaceId
        );
    }
    assert_eq!(backend.calls.get(), 0);
    assert!(storage::load_requests(&c).unwrap().is_empty());
    assert_eq!(
        PlaceId::parse("18446744073709551615").unwrap().url(),
        "https://www.roblox.com/games/18446744073709551615"
    );
}
#[test]
fn ipc_rejects_extra_fields_and_arbitrary_paths_urls_commands_or_adapters() {
    for json in [
        r#"{"action":"launchClient","adapter":"auto","path":"/tmp/player"}"#,
        r#"{"action":"launchClient","adapter":"/tmp/player"}"#,
        r#"{"action":"openExperience","placeId":"1","url":"file:///tmp/player"}"#,
        r#"{"action":"execute","command":"flatpak"}"#,
    ] {
        assert!(serde_json::from_str::<LaunchRequest>(json).is_err());
    }
}
#[test]
fn database_failure_after_acceptance_returns_warning_without_retrying_dispatch() {
    let c = database();
    c.execute_batch("PRAGMA query_only = ON;").unwrap();
    let backend = Backend::new(None);
    let receipt = execute_with_database(&backend, client(), &c).unwrap();
    assert!(!receipt.history_saved);
    assert!(receipt.warning.is_some());
    assert_eq!(backend.calls.get(), 1);
    assert!(storage::load_requests(&c).unwrap().is_empty());
}
#[test]
fn history_read_failure_is_propagated_and_failed_prune_rolls_back_insert() {
    let c = database();
    let backend = Backend::new(None);
    c.execute_batch("CREATE TRIGGER reject_prune BEFORE DELETE ON launch_requests BEGIN SELECT RAISE(ABORT, 'test storage failure'); END;").unwrap();
    for _ in 0..100 {
        assert!(
            execute_with_database(&backend, client(), &c)
                .unwrap()
                .history_saved
        );
    }
    assert!(
        !execute_with_database(&backend, client(), &c)
            .unwrap()
            .history_saved
    );
    assert_eq!(storage::load_requests(&c).unwrap().len(), 100);
    c.execute_batch("DROP TABLE launch_requests;").unwrap();
    assert!(storage::load_requests(&c).is_err());
}
#[test]
fn migration_preserves_v1_data_and_library_writes_cannot_change_requests() {
    let mut c = Connection::open_in_memory().unwrap();
    c.execute_batch("CREATE TABLE favorites(game_id TEXT PRIMARY KEY, position INTEGER NOT NULL); INSERT INTO favorites VALUES ('1', 0); CREATE TABLE recent_games(game_id TEXT PRIMARY KEY, launched_at TEXT NOT NULL); INSERT INTO recent_games VALUES ('2', '2026-01-01T00:00:00Z'); PRAGMA user_version=1;").unwrap();
    storage::migrate(&c).unwrap();
    let original = storage::load(&c).unwrap();
    assert_eq!(original.favorites, vec!["1"]);
    assert_eq!(original.recent[0].game_id, "2");
    let backend = Backend::new(None);
    let receipt = execute_with_database(&backend, client(), &c).unwrap();
    storage::save(&mut c, &original).unwrap();
    assert_eq!(storage::load_requests(&c).unwrap(), vec![receipt.request]);
    storage::migrate(&c).unwrap();
    assert_eq!(storage::load(&c).unwrap(), original);
}
#[test]
fn foreign_platform_adapter_is_unavailable_and_does_not_dispatch() {
    #[cfg(target_os = "linux")]
    let foreign = AdapterId::Windows;
    #[cfg(not(target_os = "linux"))]
    let foreign = AdapterId::Sober;
    assert_eq!(
        adapters::launch_client(foreign).unwrap_err().code,
        ErrorCode::UnsupportedPlatform
    );
}

#[test]
#[ignore = "Manual desktop test: opens the installed native client; never run in CI"]
fn real_native_client_dispatch() {
    let statuses = adapters::statuses();
    assert!(statuses
        .iter()
        .any(|s| s.installation == adapters::Installation::Detected && s.capabilities.launch));
    println!(
        "Detected installations: {}",
        serde_json::to_string(&statuses).unwrap()
    );
    let c = database();
    let result = execute_with_database(&NativeBackend, client(), &c).unwrap();
    assert!(result.history_saved);
    assert_eq!(storage::load_requests(&c).unwrap().len(), 1);
    println!(
        "OS accepted client dispatch: {}",
        serde_json::to_string(&result).unwrap()
    );
}
#[test]
#[ignore = "Manual desktop test: opens an official experience page in the default browser"]
fn real_browser_dispatch() {
    let c = database();
    let result = execute_with_database(&NativeBackend, experience("2753915549"), &c).unwrap();
    assert!(result.history_saved);
    println!(
        "OS accepted browser dispatch, not game entry: {}",
        serde_json::to_string(&result).unwrap()
    );
}

#[test]
fn status_capabilities_match_host_platform_without_direct_join_claims() {
    let statuses = adapters::statuses();
    assert_eq!(statuses[0].capabilities.detect, cfg!(target_os = "windows"));
    assert_eq!(statuses[1].capabilities.detect, cfg!(target_os = "linux"));
    for status in statuses {
        assert!(!status.capabilities.direct_join);
        if !status.capabilities.detect {
            assert!(!status.capabilities.launch);
        }
        if status.capabilities.launch {
            assert_eq!(status.installation, adapters::Installation::Detected);
        }
    }
}

#[test]
fn sqlite_file_preserves_library_and_accepted_requests_after_reopen() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("nova.sqlite3");
    let accepted = {
        let mut c = Connection::open(&path).unwrap();
        storage::migrate(&c).unwrap();
        let mut library = storage::load(&c).unwrap();
        library.favorites = vec!["2753915549".into()];
        storage::save(&mut c, &library).unwrap();
        execute_with_database(&Backend::new(None), experience("2753915549"), &c)
            .unwrap()
            .request
    };
    let c = Connection::open(&path).unwrap();
    storage::migrate(&c).unwrap();
    assert_eq!(storage::load_requests(&c).unwrap(), vec![accepted]);
    assert_eq!(storage::load(&c).unwrap().favorites, vec!["2753915549"]);
}
