pub mod adapters;
pub mod launch;
pub mod roblox;
pub mod storage;

use storage::{Database, LibraryData};
use tauri::{Manager, State};

/// The window stays hidden until React has applied hydrated appearance tokens.
/// Only a typed palette is accepted; no frontend scripts or paths are evaluated.
#[tauri::command]
fn reveal_main_window(window: tauri::WebviewWindow, theme: storage::Theme) -> Result<(), String> {
    let color = match theme {
        storage::Theme::Light => tauri::window::Color(244, 244, 247, 255),
        _ => tauri::window::Color(17, 17, 21, 255),
    };
    let background = window.set_background_color(Some(color));
    window.show().map_err(|e| e.to_string())?;
    background.map_err(|e| e.to_string())
}

#[tauri::command]
async fn roblox_data(
    request: roblox::models::ApiRequest,
    service: State<'_, roblox::ApiState>,
) -> Result<roblox::models::ApiResponse, roblox::models::ApiError> {
    let service = service.0.clone()?;
    tauri::async_runtime::spawn_blocking(move || service.execute(request))
        .await
        .map_err(|_| {
            roblox::models::ApiError::new(
                roblox::models::ErrorCode::Unavailable,
                "The Roblox request worker stopped. Try again.",
            )
        })?
}

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

#[tauri::command]
fn load_launch_history(
    database: State<'_, Database>,
) -> Result<Vec<launch::AcceptedRequest>, String> {
    let connection = database
        .0
        .lock()
        .map_err(|_| "Local database is unavailable. Restart Nova to retry.".to_owned())?;
    storage::load_requests(&connection)
}

/// Serialize launch IPC, but release the lock while the UI reads library/history.
struct LaunchGuard(std::sync::Arc<std::sync::Mutex<()>>);

#[tauri::command]
async fn launch_request(
    app: tauri::AppHandle,
    request: launch::LaunchRequest,
    guard: State<'_, LaunchGuard>,
) -> Result<launch::LaunchReceipt, launch::DispatchError> {
    let gate = guard.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = gate.try_lock().map_err(|_| launch::DispatchError::new(launch::ErrorCode::Busy, "Another request is being dispatched. Wait for its result before trying again."))?;
        launch::execute(&launch::NativeBackend, request, |accepted| {
            let db = app.state::<Database>();
            let connection = db.0.lock().map_err(|_| "Local database is unavailable.".to_owned())?;
            storage::record_request(&connection, accepted)
        })
    }).await.map_err(|_| launch::DispatchError::new(launch::ErrorCode::DispatchFailed, "The launch worker stopped unexpectedly. Check whether the client or browser opened before retrying."))?
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(LaunchGuard(std::sync::Arc::new(std::sync::Mutex::new(()))))
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            let connection = rusqlite::Connection::open(directory.join("nova.sqlite3"))?;
            storage::migrate(&connection).map_err(std::io::Error::other)?;
            app.manage(Database(std::sync::Mutex::new(connection)));
            let cache_path = directory.join("roblox-cache.sqlite3");
            let service = std::thread::spawn(move || roblox::Service::new(&cache_path).map(std::sync::Arc::new)).join()
                .unwrap_or_else(|_| Err(roblox::models::ApiError::cache()));
            app.manage(roblox::ApiState(service));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![roblox_data, reveal_main_window, load_library, save_library, detect_installations, load_launch_history, launch_request])
        .run(tauri::generate_context!())
        .expect("Nova could not start. Check that its application data directory is writable and desktop dependencies are installed.");
}
