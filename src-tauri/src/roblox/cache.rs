use super::models::{cdn_url, numeric_id, text, ApiError, Experience};
use rusqlite::{params, Connection};
use std::{path::Path, sync::Mutex};

/// Disposable metadata only. Never writes nova.sqlite3 or rewrites favorite IDs.
pub struct MetadataCache(Mutex<Connection>);
impl MetadataCache {
    pub fn open(path: &Path) -> Result<Self, ApiError> {
        let connection = Connection::open(path).map_err(|_| ApiError::cache())?;
        connection.execute_batch("PRAGMA busy_timeout=3000;
            CREATE TABLE IF NOT EXISTS metadata(place_id TEXT PRIMARY KEY, universe_id TEXT NOT NULL, value TEXT NOT NULL, observed_at INTEGER NOT NULL);").map_err(|_| ApiError::cache())?;
        Ok(Self(Mutex::new(connection)))
    }
    pub fn load(&self) -> Result<Vec<Experience>, ApiError> {
        let connection = self.0.lock().map_err(|_| ApiError::cache())?;
        let mut query = connection.prepare("SELECT place_id,universe_id,value FROM metadata ORDER BY observed_at DESC LIMIT 256").map_err(|_| ApiError::cache())?;
        let rows = query
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                ))
            })
            .map_err(|_| ApiError::cache())?;
        rows.map(|row| {
            let (place, universe, value) = row.map_err(|_| ApiError::cache())?;
            let mut game: Experience =
                serde_json::from_str(&value).map_err(|_| ApiError::cache())?;
            if game.id != place
                || game.universe_id != universe
                || numeric_id(&place).is_err()
                || numeric_id(&universe).is_err()
                || !text(&game.name, 1024)
                || game.description.len() > 100_000
                || !text(&game.creator, 1024)
                || numeric_id(&game.creator_id).is_err()
                || !["User", "Group"].contains(&game.creator_type.as_str())
            {
                return Err(ApiError::cache());
            }
            // Revalidate cached URLs as well as fresh external responses.
            game.icon_url = game.icon_url.as_deref().and_then(cdn_url);
            game.thumbnail_url = game.thumbnail_url.as_deref().and_then(cdn_url);
            game.cached = true;
            Ok(game)
        })
        .collect()
    }
    pub fn save(&self, games: &[Experience]) -> Result<(), ApiError> {
        let mut connection = self.0.lock().map_err(|_| ApiError::cache())?;
        let tx = connection.transaction().map_err(|_| ApiError::cache())?;
        for game in games {
            let value = serde_json::to_string(game).map_err(|_| ApiError::cache())?;
            tx.execute("INSERT INTO metadata(place_id,universe_id,value,observed_at) VALUES(?1,?2,?3,?4) ON CONFLICT(place_id) DO UPDATE SET universe_id=excluded.universe_id,value=excluded.value,observed_at=excluded.observed_at",
                params![game.id,game.universe_id,value,game.observed_at]).map_err(|_| ApiError::cache())?;
        }
        tx.execute("DELETE FROM metadata WHERE place_id NOT IN (SELECT place_id FROM metadata ORDER BY observed_at DESC LIMIT 256)", []).map_err(|_| ApiError::cache())?;
        tx.commit().map_err(|_| ApiError::cache())
    }
}
