pub mod adapters;
mod storage;

use storage::{Database, LibraryData};
use tauri::{Manager, State};

#[tauri::command]
fn load_library(database: State<'_, Database>) -> Result<LibraryData, String> {
    let connection = database
        .0
        .lock()
        .map_err(|_| "Local database is busy. Restart Nova to retry.".to_owned())?;
    storage::load(&connection)
}

#[tauri::command]
fn save_library(database: State<'_, Database>, data: LibraryData) -> Result<(), String> {
    let mut connection = database
        .0
        .lock()
        .map_err(|_| "Local database is busy. Restart Nova to retry.".to_owned())?;
    storage::save(&mut connection, &data)
}

#[tauri::command]
async fn detect_installations() -> Result<Vec<adapters::LauncherStatus>, String> {
    tauri::async_runtime::spawn_blocking(adapters::statuses)
        .await
        .map_err(|_| "Installation detection failed. Please retry.".to_owned())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            let connection = rusqlite::Connection::open(directory.join("nova.sqlite3"))?;
            storage::migrate(&connection).map_err(std::io::Error::other)?;
            app.manage(Database(std::sync::Mutex::new(connection)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![load_library, save_library, detect_installations])
        .run(tauri::generate_context!())
        .expect("Nova could not start. Check that its application data directory is writable and desktop dependencies are installed.");
}
