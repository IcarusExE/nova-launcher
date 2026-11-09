use nova_launcher_lib::storage::{self, Accent, Theme};
use rusqlite::{params, Connection};

#[test]
fn legacy_preferences_gain_defaults_without_losing_data_or_history() {
    let mut db = Connection::open_in_memory().unwrap();
    storage::migrate(&db).unwrap();
    let legacy = r#"{"compactCards":true,"reduceMotion":true,"startPage":"library","preferredAdapter":"sober"}"#;
    db.execute(
        "INSERT INTO preferences(id,value) VALUES(1,?1)",
        params![legacy],
    )
    .unwrap();
    db.execute(
        "INSERT INTO favorites(game_id,position) VALUES('123',0)",
        [],
    )
    .unwrap();
    db.execute("INSERT INTO launch_requests(action,adapter,place_id,accepted_at) VALUES('launchClient','sober',NULL,1)", []).unwrap();
    let mut data = storage::load(&db).unwrap();
    assert_eq!(data.preferences.theme, Theme::Dark);
    assert_eq!(data.preferences.accent, Accent::Violet);
    assert!(data.preferences.compact_cards && data.preferences.reduce_motion);
    assert_eq!(data.favorites, ["123"]);
    data.preferences.theme = Theme::System;
    data.preferences.accent = Accent::Teal;
    storage::save(&mut db, &data).unwrap();
    storage::migrate(&db).unwrap();
    assert_eq!(storage::load(&db).unwrap(), data);
    assert_eq!(storage::load_requests(&db).unwrap().len(), 1);
    assert_eq!(
        db.query_row("PRAGMA user_version", [], |r| r.get::<_, u32>(0))
            .unwrap(),
        2
    );
}

#[test]
fn appearance_survives_database_close_and_reopen_for_every_option() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("nova.sqlite3");
    for theme in [Theme::Dark, Theme::Light, Theme::System] {
        for accent in [Accent::Violet, Accent::Blue, Accent::Teal, Accent::Amber] {
            let mut db = Connection::open(&path).unwrap();
            storage::migrate(&db).unwrap();
            let mut data = storage::load(&db).unwrap();
            data.preferences.theme = theme.clone();
            data.preferences.accent = accent;
            data.preferences.compact_cards = true;
            data.preferences.reduce_motion = true;
            storage::save(&mut db, &data).unwrap();
            drop(db);
            let db = Connection::open(&path).unwrap();
            assert_eq!(storage::load(&db).unwrap(), data);
        }
    }
}

#[test]
fn failed_preference_transaction_preserves_previous_values() {
    let mut db = Connection::open_in_memory().unwrap();
    storage::migrate(&db).unwrap();
    let previous = storage::load(&db).unwrap();
    storage::save(&mut db, &previous).unwrap();
    db.execute_batch("CREATE TRIGGER reject_preferences BEFORE UPDATE ON preferences BEGIN SELECT RAISE(ABORT, 'Preferences are read-only'); END;").unwrap();
    let mut next = previous.clone();
    next.favorites = vec!["123".into()];
    next.preferences.theme = Theme::Light;
    next.preferences.accent = Accent::Amber;
    assert!(storage::save(&mut db, &next)
        .unwrap_err()
        .contains("read-only"));
    assert_eq!(storage::load(&db).unwrap(), previous);
}

#[test]
fn invalid_saved_appearance_is_reported_without_rewriting_it() {
    let db = Connection::open_in_memory().unwrap();
    storage::migrate(&db).unwrap();
    for patch in [r#""theme":"neon""#, r#""accent":"red""#] {
        let json = format!(
            r#"{{"compactCards":false,"reduceMotion":false,"startPage":"home","preferredAdapter":"auto",{patch}}}"#
        );
        db.execute(
            "INSERT OR REPLACE INTO preferences(id,value) VALUES(1,?1)",
            [&json],
        )
        .unwrap();
        assert!(storage::load(&db).is_err());
        assert_eq!(
            db.query_row("SELECT value FROM preferences", [], |r| r
                .get::<_, String>(0))
                .unwrap(),
            json
        );
    }
}
