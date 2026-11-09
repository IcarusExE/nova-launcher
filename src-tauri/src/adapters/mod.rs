mod linux;
mod windows;
#[cfg(target_os = "windows")]
pub(crate) use windows::open_url as windows_open_url;

use crate::launch::{DispatchError, ErrorCode};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AdapterId {
    Windows,
    Sober,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum Installation {
    Detected,
    NotFound,
    Unsupported,
    Unknown,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    pub detect: bool,
    pub launch: bool,
    pub direct_join: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherStatus {
    pub id: AdapterId,
    pub name: &'static str,
    pub platform: &'static str,
    pub installation: Installation,
    pub location: Option<String>,
    pub detail: String,
    pub capabilities: Capabilities,
    pub runtime_verified: bool,
}

pub trait RobloxAdapter {
    fn detect_installation(&self) -> LauncherStatus;
    fn read_status(&self) -> LauncherStatus {
        self.detect_installation()
    }
    fn capabilities(&self) -> Capabilities;
    /// Accept a standalone client request. No game ID, authentication, or client flags.
    fn launch(&self) -> Result<(), DispatchError>;
}

pub fn statuses() -> Vec<LauncherStatus> {
    vec![
        windows::WindowsRobloxAdapter.read_status(),
        linux::LinuxSoberAdapter.read_status(),
    ]
}

pub fn launch_client(adapter: AdapterId) -> Result<(), DispatchError> {
    match adapter {
        AdapterId::Windows => windows::WindowsRobloxAdapter.launch(),
        AdapterId::Sober => linux::LinuxSoberAdapter.launch(),
    }
}

pub(crate) fn unsupported() -> DispatchError {
    DispatchError::new(ErrorCode::UnsupportedPlatform, "This client is unavailable on this operating system. Choose the native client in Settings.")
}
