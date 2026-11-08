use super::{Capabilities, Installation, LauncherStatus, RobloxAdapter};

pub struct WindowsRobloxAdapter;

impl RobloxAdapter for WindowsRobloxAdapter {
    fn capabilities(&self) -> Capabilities {
        Capabilities {
            detect: cfg!(target_os = "windows"),
            launch: false,
        }
    }

    fn detect_installation(&self) -> LauncherStatus {
        #[cfg_attr(not(target_os = "windows"), allow(unused_mut))]
        let mut status = LauncherStatus {
            id: "windows",
            name: "Windows Player",
            platform: "Windows 10 / 11",
            installation: Installation::Unsupported,
            location: None,
            detail: "Windows Player detection is available only on Windows.".into(),
            capabilities: self.capabilities(),
        };
        #[cfg(target_os = "windows")]
        {
            // Read-only check for the conventional per-user desktop installation.
            // Microsoft Store and nonstandard locations are not inferred.
            match std::env::var_os("LOCALAPPDATA") {
                None => {
                    status.installation = Installation::Unknown;
                    status.detail =
                        "LOCALAPPDATA is unavailable; installation status is unknown.".into();
                }
                Some(root) => {
                    let versions = std::path::PathBuf::from(root)
                        .join("Roblox")
                        .join("Versions");
                    match std::fs::read_dir(&versions) {
                        Ok(entries) => {
                            let found = entries
                                .filter_map(Result::ok)
                                .map(|entry| entry.path().join("RobloxPlayerBeta.exe"))
                                .find(|path| path.is_file());
                            if let Some(path) = found {
                                status.installation = Installation::Detected;
                                status.location = Some(path.to_string_lossy().into_owned());
                                status.detail =
                                    "Desktop Player executable found. Launching is not enabled."
                                        .into();
                            } else {
                                status.installation = Installation::NotFound;
                                status.detail = "No Player executable found in the conventional per-user Versions directory. Store installations are not checked.".into();
                            }
                        }
                        Err(error) => {
                            status.installation = if error.kind() == std::io::ErrorKind::NotFound {
                                Installation::NotFound
                            } else {
                                Installation::Unknown
                            };
                            status.detail = "The conventional per-user Roblox directory is missing or unreadable. Store installations are not checked.".into();
                        }
                    }
                }
            }
        }
        status
    }
}
