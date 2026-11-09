use super::{AdapterId, Capabilities, Installation, LauncherStatus, RobloxAdapter};
use crate::launch::DispatchError;
#[cfg(target_os = "linux")]
use crate::launch::{dispatch_process, ErrorCode};

pub struct LinuxSoberAdapter;
#[cfg(target_os = "linux")]
const APP_ID: &str = "org.vinegarhq.Sober";

#[cfg(target_os = "linux")]
trait Flatpak {
    fn inspect(&self) -> std::io::Result<std::process::Output>;
    fn run(&self) -> Result<(), DispatchError>;
}
#[cfg(target_os = "linux")]
struct SystemFlatpak;
#[cfg(target_os = "linux")]
impl Flatpak for SystemFlatpak {
    fn inspect(&self) -> std::io::Result<std::process::Output> {
        std::process::Command::new("flatpak")
            .args(["info", "--show-location", APP_ID])
            .env("LC_ALL", "C")
            .output()
    }
    fn run(&self) -> Result<(), DispatchError> {
        dispatch_process("flatpak", &["run", APP_ID])
    }
}

#[cfg(target_os = "linux")]
fn probe(flatpak: &impl Flatpak) -> Result<String, DispatchError> {
    match flatpak.inspect() {
        Ok(output) if output.status.success() => {
            let location = String::from_utf8_lossy(&output.stdout).trim().to_owned();
            if location.is_empty() { Err(DispatchError::new(ErrorCode::DetectionFailed, "Flatpak returned an empty Sober location. Rescan to retry.")) }
            else { Ok(location) }
        }
        Ok(output) if String::from_utf8_lossy(&output.stderr).contains("not installed") =>
            Err(DispatchError::new(ErrorCode::ClientMissing, "Sober is not installed. Install org.vinegarhq.Sober from its official Flathub listing, then rescan.")),
        Ok(_) => Err(DispatchError::new(ErrorCode::DetectionFailed, "Flatpak could not inspect Sober. Check that Flatpak works in your desktop session, then rescan.")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Err(DispatchError::new(ErrorCode::FlatpakMissing, "Flatpak was not found. Install Flatpak and Sober, then restart Nova and rescan.")),
        Err(_) => Err(DispatchError::new(ErrorCode::DetectionFailed, "Flatpak could not be executed. Check its permissions and rescan.")),
    }
}
#[cfg(target_os = "linux")]
fn launch_with(flatpak: &impl Flatpak) -> Result<(), DispatchError> {
    probe(flatpak)?;
    flatpak.run()
}

impl RobloxAdapter for LinuxSoberAdapter {
    fn capabilities(&self) -> Capabilities {
        Capabilities {
            detect: cfg!(target_os = "linux"),
            launch: cfg!(target_os = "linux"),
            direct_join: false,
        }
    }
    fn detect_installation(&self) -> LauncherStatus {
        #[allow(unused_mut)]
        let mut status = LauncherStatus {
            id: AdapterId::Sober,
            name: "Sober",
            platform: "Linux · Flatpak",
            installation: Installation::Unsupported,
            location: None,
            detail: "Sober is available only on Linux.".into(),
            capabilities: self.capabilities(),
            runtime_verified: cfg!(target_os = "linux"),
        };
        #[cfg(target_os = "linux")]
        match probe(&SystemFlatpak) {
            Ok(location) => {
                status.installation = Installation::Detected;
                status.location = Some(location);
                status.detail = "org.vinegarhq.Sober is installed. Launch Roblox opens Sober; experience requests open the Roblox website.".into();
            }
            Err(error) => {
                status.installation = match error.code {
                    ErrorCode::FlatpakMissing | ErrorCode::ClientMissing => Installation::NotFound,
                    _ => Installation::Unknown,
                };
                status.detail = error.message;
                status.capabilities.launch = false;
            }
        }
        status
    }
    fn launch(&self) -> Result<(), DispatchError> {
        #[cfg(target_os = "linux")]
        return launch_with(&SystemFlatpak);
        #[cfg(not(target_os = "linux"))]
        Err(super::unsupported())
    }
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    use std::{
        cell::Cell,
        os::unix::process::ExitStatusExt,
        process::{ExitStatus, Output},
    };
    struct Fake {
        missing_flatpak: bool,
        installed: bool,
        fail_launch: bool,
        calls: Cell<usize>,
    }
    impl Flatpak for Fake {
        fn inspect(&self) -> std::io::Result<Output> {
            if self.missing_flatpak {
                return Err(std::io::ErrorKind::NotFound.into());
            }
            Ok(Output {
                status: ExitStatus::from_raw(if self.installed { 0 } else { 256 }),
                stdout: if self.installed {
                    b"/var/lib/flatpak/sober\n".to_vec()
                } else {
                    vec![]
                },
                stderr: if self.installed {
                    vec![]
                } else {
                    b"error: app is not installed".to_vec()
                },
            })
        }
        fn run(&self) -> Result<(), DispatchError> {
            self.calls.set(self.calls.get() + 1);
            if self.fail_launch {
                Err(DispatchError::new(ErrorCode::DispatchFailed, "rejected"))
            } else {
                Ok(())
            }
        }
    }
    fn fake() -> Fake {
        Fake {
            missing_flatpak: false,
            installed: true,
            fail_launch: false,
            calls: Cell::new(0),
        }
    }
    #[test]
    fn installed_sober_dispatches_without_game_id() {
        let f = fake();
        assert!(probe(&f).is_ok());
        assert!(launch_with(&f).is_ok());
        assert_eq!(f.calls.get(), 1);
    }
    #[test]
    fn missing_flatpak_or_sober_never_dispatches() {
        let mut f = fake();
        f.missing_flatpak = true;
        assert_eq!(launch_with(&f).unwrap_err().code, ErrorCode::FlatpakMissing);
        f.missing_flatpak = false;
        f.installed = false;
        assert_eq!(launch_with(&f).unwrap_err().code, ErrorCode::ClientMissing);
        assert_eq!(f.calls.get(), 0);
    }
    #[test]
    fn process_rejection_is_returned() {
        let mut f = fake();
        f.fail_launch = true;
        assert_eq!(launch_with(&f).unwrap_err().code, ErrorCode::DispatchFailed);
    }
}
