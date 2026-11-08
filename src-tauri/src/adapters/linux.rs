use super::{Capabilities, Installation, LauncherStatus, RobloxAdapter};

pub struct LinuxSoberAdapter;

impl RobloxAdapter for LinuxSoberAdapter {
    fn capabilities(&self) -> Capabilities {
        Capabilities {
            detect: cfg!(target_os = "linux"),
            launch: false,
        }
    }

    fn detect_installation(&self) -> LauncherStatus {
        #[cfg_attr(not(target_os = "linux"), allow(unused_mut))]
        let mut status = LauncherStatus {
            id: "sober",
            name: "Sober",
            platform: "Linux · Flatpak",
            installation: Installation::Unsupported,
            location: None,
            detail: "Sober detection is available only on Linux.".into(),
            capabilities: self.capabilities(),
        };
        #[cfg(target_os = "linux")]
        {
            // Only inspect Flatpak metadata. Never execute Sober or Roblox.
            let output = std::process::Command::new("flatpak")
                .args(["info", "--show-location", "org.vinegarhq.Sober"])
                .env("LC_ALL", "C")
                .output();
            match output {
                Ok(output) if output.status.success() => {
                    let location = String::from_utf8_lossy(&output.stdout).trim().to_owned();
                    if location.is_empty() {
                        status.installation = Installation::Unknown;
                        status.detail =
                            "Flatpak returned an empty installation location. Rescan to retry."
                                .into();
                    } else {
                        status.installation = Installation::Detected;
                        status.location = Some(location);
                        status.detail =
                            "org.vinegarhq.Sober is installed. Launching is not enabled.".into();
                    }
                }
                Ok(output) => {
                    let message = String::from_utf8_lossy(&output.stderr);
                    if message.contains("not installed") {
                        status.installation = Installation::NotFound;
                        status.detail = "The org.vinegarhq.Sober Flatpak is not installed.".into();
                    } else {
                        status.installation = Installation::Unknown;
                        status.detail =
                            "Flatpak could not inspect the Sober installation. Rescan to retry."
                                .into();
                    }
                }
                Err(error) => {
                    status.installation = if error.kind() == std::io::ErrorKind::NotFound {
                        Installation::NotFound
                    } else {
                        Installation::Unknown
                    };
                    status.detail = if error.kind() == std::io::ErrorKind::NotFound {
                        "Flatpak was not found on PATH.".into()
                    } else {
                        "Could not run the read-only Flatpak detection command.".into()
                    };
                }
            }
        }
        status
    }
}
