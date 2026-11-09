//! Opt-in read-only contract verification against real official endpoints.
use nova_launcher_lib::roblox::{
    models::{ApiRequest, ApiResponse},
    Service,
};

#[test]
#[ignore = "Read-only network verification: explicitly run when Roblox is reachable"]
fn verified_public_api_contracts_on_real_network() {
    let directory = tempfile::tempdir().unwrap();
    let service = Service::new(&directory.path().join("cache.sqlite3")).unwrap();
    let ApiResponse::Catalog(catalog) = service.execute(ApiRequest::Catalog).unwrap() else {
        panic!()
    };
    assert_eq!(catalog.experiences.len(), 4);
    for game in &catalog.experiences {
        assert_ne!(game.id, game.universe_id);
        assert!(!game.name.is_empty() && !game.creator.is_empty());
        assert!(game.players.is_some() && game.up_votes.is_some() && game.down_votes.is_some());
        assert!(game.icon_url.is_some() && game.thumbnail_url.is_some());
        assert!(!game.cached);
        println!(
            "Verified Universe {} -> Place {} · {}",
            game.universe_id, game.id, game.name
        );
    }
    assert!(catalog.warnings.is_empty(), "{:?}", catalog.warnings);
    let ApiResponse::Profile(Some(profile)) = service
        .execute(ApiRequest::LookupUsername {
            username: "Roblox".into(),
        })
        .unwrap()
    else {
        panic!()
    };
    assert_eq!(profile.id, "1");
    assert_eq!(profile.username, "Roblox");
    assert!(profile.avatar_url.is_some());
    assert!(profile.warnings.is_empty());
    println!(
        "Verified username resolution, profile and avatar for User {}",
        profile.id
    );
    let ApiResponse::Users(users) = service
        .execute(ApiRequest::SearchUsers {
            keyword: "Roblox".into(),
            cursor: None,
        })
        .unwrap()
    else {
        panic!()
    };
    assert!(!users.users.is_empty());
    assert!(users.next_cursor.is_some());
    println!(
        "Verified {} public search results and opaque next cursor; cooldown {}s",
        users.users.len(),
        users.retry_after_seconds
    );
    // Honor the server's actual reset before one continuation request. No flood
    // or quota bypass, and no unbounded waiting when a service policy changes.
    assert!(users.retry_after_seconds <= 60);
    std::thread::sleep(std::time::Duration::from_secs(
        users.retry_after_seconds + 1,
    ));
    let ApiResponse::Users(next) = service
        .execute(ApiRequest::SearchUsers {
            keyword: "Roblox".into(),
            cursor: users.next_cursor,
        })
        .unwrap()
    else {
        panic!()
    };
    assert!(!next.users.is_empty());
    assert!(next
        .users
        .iter()
        .any(|next| !users.users.iter().any(|first| first.id == next.id)));
    println!(
        "Verified real public user continuation page: {} results",
        next.users.len()
    );
    drop(service);
    let restarted = Service::new(&directory.path().join("cache.sqlite3")).unwrap();
    let ApiResponse::Catalog(saved) = restarted.execute(ApiRequest::CachedCatalog).unwrap() else {
        panic!()
    };
    assert_eq!(saved.experiences.len(), 4);
    assert!(saved.experiences.iter().all(|g| g.cached));
}
