//! Validated native actions. Frontend input cannot select programs, flags, or URLs.
use crate::adapters::{self, AdapterId};
use crate::storage::{self, AdapterSelection};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
#[cfg(target_os = "linux")]
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ErrorCode {
    InvalidPlaceId,
    UnsupportedPlatform,
    FlatpakMissing,
    ClientMissing,
    DetectionFailed,
    UnsupportedInstallation,
    DispatchFailed,
    Busy,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DispatchError {
    pub code: ErrorCode,
    pub message: String,
}
impl DispatchError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "action", rename_all = "camelCase", deny_unknown_fields)]
pub enum LaunchRequest {
    LaunchClient {
        adapter: AdapterSelection,
    },
    OpenExperience {
        #[serde(rename = "placeId")]
        place_id: String,
    },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RequestAction {
    LaunchClient,
    OpenExperience,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AcceptedRequest {
    pub action: RequestAction,
    pub adapter: Option<AdapterId>,
    pub place_id: Option<String>,
    pub accepted_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchReceipt {
    pub request: AcceptedRequest,
    pub history_saved: bool,
    pub warning: Option<String>,
}

/// A positive, canonical unsigned 64-bit Place ID. No whitespace, signs, URLs, or flags.
pub struct PlaceId(String);
impl PlaceId {
    pub fn parse(value: &str) -> Result<Self, DispatchError> {
        if value.is_empty()
            || value.len() > 20
            || value.starts_with('0')
            || !value.bytes().all(|b| b.is_ascii_digit())
            || value.parse::<u64>().is_err()
        {
            return Err(DispatchError::new(ErrorCode::InvalidPlaceId, "Enter a positive numeric Roblox Place ID (up to 64 bits), without spaces or a URL."));
        }
        Ok(Self(value.into()))
    }
    pub fn url(&self) -> String {
        format!("https://www.roblox.com/games/{}", self.0)
    }
}

pub trait LaunchBackend {
    fn launch_client(&self, selection: AdapterSelection) -> Result<AdapterId, DispatchError>;
    fn open_experience(&self, place: &PlaceId) -> Result<(), DispatchError>;
}

pub struct NativeBackend;
impl LaunchBackend for NativeBackend {
    fn launch_client(&self, selection: AdapterSelection) -> Result<AdapterId, DispatchError> {
        let adapter = match selection {
            AdapterSelection::Sober => AdapterId::Sober,
            AdapterSelection::Windows => AdapterId::Windows,
            AdapterSelection::Auto if cfg!(target_os = "linux") => AdapterId::Sober,
            AdapterSelection::Auto if cfg!(target_os = "windows") => AdapterId::Windows,
            AdapterSelection::Auto => return Err(adapters::unsupported()),
        };
        adapters::launch_client(adapter)?;
        Ok(adapter)
    }
    fn open_experience(&self, place: &PlaceId) -> Result<(), DispatchError> {
        #[cfg(target_os = "linux")]
        return dispatch_process("xdg-open", &[&place.url()]);
        #[cfg(target_os = "windows")]
        return crate::adapters::windows_open_url(&place.url());
        #[cfg(not(any(target_os = "linux", target_os = "windows")))]
        {
            let _ = place;
            Err(adapters::unsupported())
        }
    }
}

/// Detect immediate launcher rejection, then reap the client asynchronously.
/// A successful return means OS dispatch acceptance, never game entry or playtime.
#[cfg(target_os = "linux")]
pub(crate) fn dispatch_process(program: &str, args: &[&str]) -> Result<(), DispatchError> {
    use std::process::{Command, Stdio};
    let mut child = Command::new(program).args(args).stdin(Stdio::null())
        .stdout(Stdio::null()).stderr(Stdio::null()).spawn().map_err(|e| {
            DispatchError::new(ErrorCode::DispatchFailed, format!("Could not start {program}: {e}. Check the installation and your desktop session, then retry."))
        })?;
    // Bounded poll: never wait for the lifetime of a graphical application.
    for _ in 0..15 {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => return Ok(()),
            Ok(Some(status)) => return Err(DispatchError::new(ErrorCode::DispatchFailed,
                format!("{program} rejected the request ({status}). Try launching it from your desktop and rescan Nova."))),
            Ok(None) => std::thread::sleep(Duration::from_millis(20)),
            Err(e) => {
                std::thread::spawn(move || { let _ = child.wait(); });
                return Err(DispatchError::new(ErrorCode::DispatchFailed, format!("Could not check launch acceptance: {e}. The client may already be starting; check it before retrying.")));
            }
        }
    }
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

/// Persist only after dispatch. A storage failure must not turn an accepted action
/// into a retryable dispatch error, which could launch a second client/browser.
pub fn execute(
    backend: &impl LaunchBackend,
    request: LaunchRequest,
    persist: impl FnOnce(&AcceptedRequest) -> Result<(), String>,
) -> Result<LaunchReceipt, DispatchError> {
    let (action, adapter, place_id) = match request {
        LaunchRequest::LaunchClient { adapter } => (
            RequestAction::LaunchClient,
            Some(backend.launch_client(adapter)?),
            None,
        ),
        LaunchRequest::OpenExperience { place_id } => {
            let place = PlaceId::parse(&place_id)?;
            backend.open_experience(&place)?;
            (RequestAction::OpenExperience, None, Some(place.0))
        }
    };
    let accepted = AcceptedRequest {
        action,
        adapter,
        place_id,
        accepted_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64,
    };
    let warning = persist(&accepted).err().map(|_| "The operating system accepted the request, but Nova could not save its history. Check local storage before retrying; the action may already be running.".into());
    Ok(LaunchReceipt {
        history_saved: warning.is_none(),
        request: accepted,
        warning,
    })
}

pub fn execute_with_database(
    backend: &impl LaunchBackend,
    request: LaunchRequest,
    connection: &Connection,
) -> Result<LaunchReceipt, DispatchError> {
    execute(backend, request, |accepted| {
        storage::record_request(connection, accepted)
    })
}

#[cfg(all(test, target_os = "linux"))]
mod process_tests {
    use super::*;
    #[test]
    fn actual_process_spawn_success_missing_executable_and_nonzero_exit() {
        assert!(dispatch_process("/usr/bin/true", &[]).is_ok());
        assert_eq!(
            dispatch_process("/usr/bin/false", &[]).unwrap_err().code,
            ErrorCode::DispatchFailed
        );
        assert_eq!(
            dispatch_process("/nonexistent/nova-test-launcher", &[])
                .unwrap_err()
                .code,
            ErrorCode::DispatchFailed
        );
    }
}
