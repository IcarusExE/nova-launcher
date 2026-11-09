use super::{AdapterId, Capabilities, Installation, LauncherStatus, RobloxAdapter};
use crate::launch::DispatchError;

pub struct WindowsRobloxAdapter;
impl RobloxAdapter for WindowsRobloxAdapter {
    fn capabilities(&self) -> Capabilities {
        Capabilities {
            detect: cfg!(target_os = "windows"),
            launch: cfg!(target_os = "windows"),
            direct_join: false,
        }
    }
    fn detect_installation(&self) -> LauncherStatus {
        #[allow(unused_mut)]
        let mut status = LauncherStatus {
            id: AdapterId::Windows,
            name: "Windows Player",
            platform: "Windows 10 / 11",
            installation: Installation::Unsupported,
            location: None,
            detail: "Windows Player is available only on Windows.".into(),
            capabilities: self.capabilities(),
            runtime_verified: false,
        };
        #[cfg(target_os = "windows")]
        match native::installed_player() {
            Ok(player) => {
                status.installation = Installation::Detected;
                status.location = Some(player.target.to_string_lossy().into_owned());
                status.detail = "Signed Roblox desktop Player and installer shortcut found. Windows runtime verification is still required. Store and custom installations are unsupported.".into();
            }
            Err(error) => {
                status.installation = match error.code {
                    crate::launch::ErrorCode::ClientMissing => Installation::NotFound,
                    crate::launch::ErrorCode::UnsupportedInstallation => Installation::Unsupported,
                    _ => Installation::Unknown,
                };
                status.detail = error.message;
                status.capabilities.launch = false;
            }
        }
        status
    }
    fn launch(&self) -> Result<(), DispatchError> {
        #[cfg(target_os = "windows")]
        {
            let player = native::installed_player()?;
            native::shell_open(&player.target, Some(&player.arguments))
        }
        #[cfg(not(target_os = "windows"))]
        Err(super::unsupported())
    }
}

#[cfg(target_os = "windows")]
pub(crate) use native::open_url;

#[cfg(target_os = "windows")]
mod native {
    use crate::launch::{DispatchError, ErrorCode};
    use std::{
        os::windows::ffi::OsStrExt,
        path::{Path, PathBuf},
    };
    use windows::{
        core::{Interface, PCWSTR},
        Win32::{
            Foundation::HWND,
            Security::{
                Cryptography::{CertGetNameStringW, CERT_NAME_SIMPLE_DISPLAY_TYPE},
                WinTrust::*,
            },
            System::Com::{
                CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile,
                CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, STGM_READ,
            },
            UI::{
                Shell::{IShellLinkW, ShellExecuteW, ShellLink, SLGP_RAWPATH},
                WindowsAndMessaging::SW_SHOWNORMAL,
            },
        },
    };

    pub(super) struct InstalledPlayer {
        pub target: PathBuf,
        pub arguments: Vec<u16>,
    }
    fn unsupported(message: &str) -> DispatchError {
        DispatchError::new(ErrorCode::UnsupportedInstallation, message)
    }
    fn wide(path: &Path) -> Vec<u16> {
        path.as_os_str().encode_wide().chain(Some(0)).collect()
    }
    fn from_wide(buffer: &[u16]) -> PathBuf {
        use std::os::windows::ffi::OsStringExt;
        std::ffi::OsString::from_wide(
            &buffer[..buffer.iter().position(|c| *c == 0).unwrap_or(buffer.len())],
        )
        .into()
    }
    struct Apartment;
    impl Drop for Apartment {
        fn drop(&mut self) {
            unsafe { CoUninitialize() };
        }
    }

    pub(super) fn installed_player() -> Result<InstalledPlayer, DispatchError> {
        let root = std::env::var_os("LOCALAPPDATA").ok_or_else(|| unsupported("LOCALAPPDATA is unavailable. Only the official per-user desktop Player is supported."))?;
        let menu = std::env::var_os("APPDATA").ok_or_else(|| {
            unsupported("APPDATA is unavailable. The Roblox installer shortcut cannot be located.")
        })?;
        let shortcut = PathBuf::from(menu)
            .join("Microsoft/Windows/Start Menu/Programs/Roblox/Roblox Player.lnk");
        let versions = PathBuf::from(root).join("Roblox/Versions");
        if !versions.is_dir() {
            return Err(DispatchError::new(ErrorCode::ClientMissing, "Official per-user Roblox desktop Player was not found. Install it from roblox.com. Microsoft Store installations are unsupported."));
        }
        if !shortcut.is_file() {
            return Err(unsupported("The installer-created Roblox Player Start Menu shortcut is missing. Reinstall the desktop Player from roblox.com. Store, portable, and custom installations are unsupported."));
        }
        // Resolve, without modifying, the official installer-created launch configuration.
        // COM is initialized on the blocking worker; interfaces are dropped before uninitializing.
        let _apartment = unsafe {
            CoInitializeEx(None, COINIT_APARTMENTTHREADED)
                .ok()
                .map_err(|_| {
                    unsupported(
                        "Windows could not initialize shortcut inspection. Restart Nova and retry.",
                    )
                })?;
            Apartment
        };
        let link: IShellLinkW = unsafe { CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER) }
            .map_err(|_| unsupported("Windows could not inspect the Roblox shortcut."))?;
        let file: IPersistFile = link
            .cast()
            .map_err(|_| unsupported("Windows could not read the Roblox shortcut."))?;
        let mut target = vec![0_u16; 32768];
        let mut arguments = vec![0_u16; 32768];
        unsafe {
            file.Load(PCWSTR(wide(&shortcut).as_ptr()), STGM_READ)
                .map_err(|_| unsupported("The Roblox installer shortcut is unreadable. Reinstall the official desktop Player."))?;
            link.GetPath(&mut target, std::ptr::null_mut(), SLGP_RAWPATH.0 as u32)
                .map_err(|_| {
                    unsupported("The Roblox shortcut has no supported executable target.")
                })?;
            link.GetArguments(&mut arguments)
                .map_err(|_| unsupported("The Roblox shortcut arguments could not be read."))?;
        }
        let target = from_wide(&target).canonicalize().map_err(|_| {
            unsupported(
                "The Roblox shortcut points to a missing executable. Reinstall the desktop Player.",
            )
        })?;
        let versions = versions
            .canonicalize()
            .map_err(|_| unsupported("The Roblox Versions directory is unreadable."))?;
        // Reject Studio, Store, external targets, and unexpected directory layouts.
        let relative = target.strip_prefix(&versions).map_err(|_| {
            unsupported("The shortcut targets an unsupported Roblox installation location.")
        })?;
        let components: Vec<_> = relative.components().collect();
        if components.len() != 2
            || !components[0]
                .as_os_str()
                .to_string_lossy()
                .starts_with("version-")
            || !components[1]
                .as_os_str()
                .to_string_lossy()
                .eq_ignore_ascii_case("RobloxPlayerBeta.exe")
        {
            return Err(unsupported("Only the official desktop Player in Roblox/Versions/version-*/RobloxPlayerBeta.exe is supported."));
        }
        verify_publisher(&target)?;
        Ok(InstalledPlayer { target, arguments })
    }

    fn verify_publisher(target: &Path) -> Result<(), DispatchError> {
        let name = wide(target);
        let mut file = WINTRUST_FILE_INFO {
            cbStruct: std::mem::size_of::<WINTRUST_FILE_INFO>() as u32,
            pcwszFilePath: PCWSTR(name.as_ptr()),
            ..Default::default()
        };
        let mut data = WINTRUST_DATA {
            cbStruct: std::mem::size_of::<WINTRUST_DATA>() as u32,
            dwUIChoice: WTD_UI_NONE,
            dwUnionChoice: WTD_CHOICE_FILE,
            Anonymous: WINTRUST_DATA_0 { pFile: &mut file },
            dwStateAction: WTD_STATEACTION_VERIFY,
            dwProvFlags: WTD_CACHE_ONLY_URL_RETRIEVAL,
            ..Default::default()
        };
        let mut policy = WINTRUST_ACTION_GENERIC_VERIFY_V2;
        // All pointers are valid for the call and provider-owned pointers are read
        // only while verification state is live, before WTD_STATEACTION_CLOSE.
        let valid = unsafe {
            let result = WinVerifyTrust(
                HWND(-1_isize as *mut _),
                &mut policy,
                (&mut data as *mut WINTRUST_DATA).cast(),
            );
            let mut publisher = vec![0_u16; 512];
            let mut trusted = false;
            if result == 0 {
                let provider = WTHelperProvDataFromStateData(data.hWVTStateData);
                if !provider.is_null() {
                    let signer = WTHelperGetProvSignerFromChain(provider, 0, false, 0);
                    if !signer.is_null()
                        && (*signer).csCertChain > 0
                        && !(*signer).pasCertChain.is_null()
                    {
                        let cert = (*(*signer).pasCertChain).pCert;
                        if !cert.is_null() {
                            let length = CertGetNameStringW(
                                cert,
                                CERT_NAME_SIMPLE_DISPLAY_TYPE,
                                0,
                                None,
                                Some(&mut publisher),
                            );
                            trusted = length > 1
                                && length as usize <= publisher.len()
                                && String::from_utf16_lossy(&publisher[..length as usize - 1])
                                    == "Roblox Corporation";
                        }
                    }
                }
            }
            data.dwStateAction = WTD_STATEACTION_CLOSE;
            WinVerifyTrust(
                HWND(-1_isize as *mut _),
                &mut policy,
                (&mut data as *mut WINTRUST_DATA).cast(),
            );
            trusted
        };
        if valid {
            Ok(())
        } else {
            Err(unsupported("The Player's Authenticode signature or Roblox Corporation publisher could not be verified. Reinstall the official desktop client; Nova will not launch this file."))
        }
    }

    pub(super) fn shell_open(
        target: &Path,
        arguments: Option<&[u16]>,
    ) -> Result<(), DispatchError> {
        let target = wide(target);
        let verb = windows::core::w!("open");
        let result = unsafe {
            ShellExecuteW(
                None,
                verb,
                PCWSTR(target.as_ptr()),
                arguments.map_or(PCWSTR::null(), |a| PCWSTR(a.as_ptr())),
                PCWSTR::null(),
                SW_SHOWNORMAL,
            )
        };
        let code = result.0 as isize;
        if code > 32 {
            Ok(())
        } else {
            Err(DispatchError::new(ErrorCode::DispatchFailed, format!("Windows rejected the open request (ShellExecute code {code}). Check the client or default browser installation and retry.")))
        }
    }
    pub(crate) fn open_url(url: &str) -> Result<(), DispatchError> {
        shell_open(Path::new(url), None)
    }
}
