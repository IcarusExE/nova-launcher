use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

pub struct Database(pub Mutex<Connection>);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Page {
    Home,
    Discover,
    Library,
    Profile,
    Settings,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AdapterSelection {
    Auto,
    Windows,
    Sober,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Preferences {
    pub compact_cards: bool,
    pub reduce_motion: bool,
    pub start_page: Page,
    pub preferred_adapter: AdapterSelection,
}
impl Default for Preferences {
    fn default() -> Self {
        Self {
            compact_cards: false,
            reduce_motion: false,
            start_page: Page::Home,
            preferred_adapter: AdapterSelection::Auto,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RecentGame {
    pub game_id: String,
    pub launched_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LibraryData {
    pub favorites: Vec<String>,
    pub recent: Vec<RecentGame>,
    pub preferences: Preferences,
}

pub fn migrate(connection: &Connection) -> Result<(), String> {
    let version: i64 = connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    if version > 1 {
        return Err(
            "This library was created by a newer Nova version. It has not been changed.".into(),
        );
    }
    connection.execute_batch("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
        BEGIN;
        CREATE TABLE IF NOT EXISTS favorites (game_id TEXT PRIMARY KEY, position INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS recent_games (game_id TEXT PRIMARY KEY, launched_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS preferences (id INTEGER PRIMARY KEY CHECK(id = 1), value TEXT NOT NULL);
        PRAGMA user_version = 1;
        COMMIT;").map_err(|e| e.to_string())
}

pub fn load(connection: &Connection) -> Result<LibraryData, String> {
    let mut statement = connection
        .prepare("SELECT game_id FROM favorites ORDER BY position")
        .map_err(|e| e.to_string())?;
    let favorites = statement
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| e.to_string())?;
    let mut statement = connection
        .prepare("SELECT game_id, launched_at FROM recent_games ORDER BY launched_at DESC")
        .map_err(|e| e.to_string())?;
    let recent = statement
        .query_map([], |row| {
            Ok(RecentGame {
                game_id: row.get(0)?,
                launched_at: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let mut statement = connection
        .prepare("SELECT value FROM preferences WHERE id = 1")
        .map_err(|e| e.to_string())?;
    let preferences = match statement.query_row([], |row| row.get::<_, String>(0)) {
        Ok(value) => serde_json::from_str(&value).map_err(|_| {
            "Saved preferences are invalid. Existing data has not been overwritten.".to_owned()
        })?,
        Err(rusqlite::Error::QueryReturnedNoRows) => Preferences::default(),
        Err(error) => return Err(error.to_string()),
    };
    Ok(LibraryData {
        favorites,
        recent,
        preferences,
    })
}

pub fn save(connection: &mut Connection, data: &LibraryData) -> Result<(), String> {
    if data.favorites.len() > 5000
        || data
            .favorites
            .iter()
            .any(|id| id.is_empty() || id.len() > 20 || !id.bytes().all(|b| b.is_ascii_digit()))
    {
        return Err("Favorites must contain valid numeric game IDs (maximum 5000).".into());
    }
    // Recents can only be recorded by a future verified native launch flow.
    if load(connection)?.recent != data.recent {
        return Err("Launch history cannot be changed by the frontend.".into());
    }
    let preferences = serde_json::to_string(&data.preferences).map_err(|e| e.to_string())?;
    let transaction = connection.transaction().map_err(|e| e.to_string())?;
    transaction
        .execute("DELETE FROM favorites", [])
        .map_err(|e| e.to_string())?;
    for (position, id) in data.favorites.iter().enumerate() {
        transaction
            .execute(
                "INSERT INTO favorites (game_id, position) VALUES (?1, ?2)",
                params![id, position as i64],
            )
            .map_err(|e| e.to_string())?;
    }
    transaction.execute("INSERT INTO preferences (id, value) VALUES (1, ?1) ON CONFLICT(id) DO UPDATE SET value = excluded.value", params![preferences]).map_err(|e| e.to_string())?;
    transaction.commit().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn database() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        migrate(&c).unwrap();
        c
    }
    #[test]
    fn favorites_and_preferences_round_trip() {
        let mut connection = database();
        let mut data = load(&connection).unwrap();
        assert!(data.favorites.is_empty() && data.recent.is_empty());
        data.favorites = vec!["2753915549".into(), "4924922222".into()];
        data.preferences.compact_cards = true;
        data.preferences.start_page = Page::Library;
        save(&mut connection, &data).unwrap();
        assert_eq!(load(&connection).unwrap(), data);
        migrate(&connection).unwrap();
        assert_eq!(load(&connection).unwrap(), data);
    }
    #[test]
    fn failed_write_rolls_back_previous_library() {
        let mut connection = database();
        let mut data = load(&connection).unwrap();
        data.favorites = vec!["123".into()];
        save(&mut connection, &data).unwrap();
        let previous = data.clone();
        data.favorites = vec!["456".into(), "456".into()];
        assert!(save(&mut connection, &data).is_err());
        assert_eq!(load(&connection).unwrap(), previous);
        data.favorites = vec!["invalid".into()];
        assert!(save(&mut connection, &data).is_err());
        assert_eq!(load(&connection).unwrap(), previous);
    }
    #[test]
    fn frontend_cannot_fabricate_launch_history() {
        let mut connection = database();
        let mut data = load(&connection).unwrap();
        data.recent.push(RecentGame {
            game_id: "1".into(),
            launched_at: "2026-01-01T00:00:00Z".into(),
        });
        assert!(save(&mut connection, &data).is_err());
        assert!(load(&connection).unwrap().recent.is_empty());
    }
    #[test]
    fn newer_database_is_not_downgraded() {
        let connection = database();
        connection.pragma_update(None, "user_version", 2).unwrap();
        assert!(migrate(&connection).is_err());
    }
}
