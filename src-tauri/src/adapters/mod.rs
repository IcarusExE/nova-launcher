mod linux;
mod windows;

use serde::Serialize;

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum Installation {
    Detected,
    NotFound,
    Unsupported,
    Unknown,
}

#[derive(Debug, Serialize)]
pub struct Capabilities {
    pub detect: bool,
    pub launch: bool,
}

#[derive(Debug, Serialize)]
pub struct LauncherStatus {
    pub id: &'static str,
    pub name: &'static str,
    pub platform: &'static str,
    pub installation: Installation,
    pub location: Option<String>,
    pub detail: String,
    pub capabilities: Capabilities,
}

/// Native integration boundary. Launch remains explicitly unsupported until a
/// separately verified implementation exists for each platform.
pub trait RobloxAdapter {
    fn detect_installation(&self) -> LauncherStatus;
    fn read_status(&self) -> LauncherStatus {
        self.detect_installation()
    }
    fn capabilities(&self) -> Capabilities;
    fn launch(&self, _place_id: &str) -> Result<(), &'static str> {
        Err("Roblox launching is not implemented in this milestone.")
    }
}

pub fn statuses() -> Vec<LauncherStatus> {
    vec![
        windows::WindowsRobloxAdapter.read_status(),
        linux::LinuxSoberAdapter.read_status(),
    ]
}

// Kept as a native boundary for future integration. It is deliberately not
// exposed as an IPC command or connected to a frontend launch button.
pub fn launch_disabled(adapter: &str, place_id: &str) -> Result<(), &'static str> {
    match adapter {
        "windows" => windows::WindowsRobloxAdapter.launch(place_id),
        "sober" => linux::LinuxSoberAdapter.launch(place_id),
        _ => Err("Unknown platform adapter."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_adapter_advertises_or_performs_launching() {
        for status in statuses() {
            assert!(!status.capabilities.launch);
            assert!(launch_disabled(status.id, "2753915549").is_err());
        }
        assert!(launch_disabled("invalid", "1").is_err());
    }

    #[test]
    fn detection_capability_is_platform_specific() {
        let statuses = statuses();
        assert_eq!(statuses[0].capabilities.detect, cfg!(target_os = "windows"));
        assert_eq!(statuses[1].capabilities.detect, cfg!(target_os = "linux"));
    }
}
