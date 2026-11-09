use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ErrorCode {
    InvalidInput,
    Offline,
    Timeout,
    RateLimited,
    Forbidden,
    NotFound,
    InvalidResponse,
    Unavailable,
    Cache,
    Busy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiError {
    pub code: ErrorCode,
    pub message: String,
    pub retry_after_seconds: Option<u64>,
}
impl ApiError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            retry_after_seconds: None,
        }
    }
    pub fn invalid_response() -> Self {
        Self::new(ErrorCode::InvalidResponse, "Roblox returned an unsupported data format. Its public API may have changed. Try again later.")
    }
    pub fn cache() -> Self {
        Self::new(ErrorCode::Cache, "The Roblox metadata cache is unavailable. Check application data permissions. Your library has not been changed.")
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "action", rename_all = "camelCase", deny_unknown_fields)]
pub enum ApiRequest {
    Catalog,
    CachedCatalog,
    LookupUniverse {
        #[serde(rename = "universeId")]
        universe_id: String,
    },
    LookupUsername {
        username: String,
    },
    LookupUser {
        #[serde(rename = "userId")]
        user_id: String,
    },
    SearchUsers {
        keyword: String,
        cursor: Option<String>,
    },
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "data", rename_all = "camelCase")]
pub enum ApiResponse {
    Catalog(Catalog),
    Experience(ExperienceResult),
    Profile(Option<Profile>),
    Users(UserPage),
}

/// id is always the root Place ID, preserving the launcher's existing stored IDs.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Experience {
    pub id: String,
    pub universe_id: String,
    pub name: String,
    pub description: String,
    pub creator: String,
    pub creator_id: String,
    pub creator_type: String,
    pub category: Option<String>,
    pub icon_url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub players: Option<u64>,
    pub up_votes: Option<u64>,
    pub down_votes: Option<u64>,
    pub observed_at: i64,
    pub cached: bool,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExperienceResult {
    pub experience: Experience,
    pub warnings: Vec<ApiError>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub experiences: Vec<Experience>,
    pub starting_place_ids: Vec<String>,
    pub warnings: Vec<ApiError>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub description: String,
    pub created_at: String,
    pub is_banned: bool,
    pub verified: bool,
    pub avatar_url: Option<String>,
    pub observed_at: i64,
    pub warnings: Vec<ApiError>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSummary {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub verified: bool,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserPage {
    pub users: Vec<UserSummary>,
    pub next_cursor: Option<String>,
    pub retry_after_seconds: u64,
}

#[derive(Debug, Deserialize)]
pub struct Data<T> {
    pub data: Vec<T>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameWire {
    pub id: u64,
    pub root_place_id: u64,
    pub name: String,
    pub description: String,
    pub creator: CreatorWire,
    pub playing: Option<u64>,
    pub genre: Option<String>,
    #[serde(rename = "genre_l1")]
    pub genre_l1: Option<String>,
}
#[derive(Debug, Deserialize)]
pub struct CreatorWire {
    pub id: u64,
    pub name: String,
    pub r#type: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoteWire {
    pub id: u64,
    pub up_votes: u64,
    pub down_votes: u64,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageWire {
    pub target_id: u64,
    pub state: String,
    pub image_url: Option<String>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailsWire {
    pub universe_id: u64,
    pub thumbnails: Vec<ImageWire>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserWire {
    pub id: u64,
    pub name: String,
    pub display_name: String,
    #[serde(default)]
    pub has_verified_badge: bool,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileWire {
    pub id: u64,
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub created: String,
    pub is_banned: bool,
    #[serde(default)]
    pub has_verified_badge: bool,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserPageWire {
    pub data: Vec<UserWire>,
    pub next_page_cursor: Option<String>,
}

pub fn numeric_id(value: &str) -> Result<u64, ApiError> {
    if value.is_empty()
        || value.len() > 20
        || value.starts_with('0')
        || !value.bytes().all(|b| b.is_ascii_digit())
    {
        return Err(ApiError::new(
            ErrorCode::InvalidInput,
            "Enter a positive numeric Roblox ID, without spaces, a URL, or leading zeroes.",
        ));
    }
    value.parse().map_err(|_| {
        ApiError::new(
            ErrorCode::InvalidInput,
            "The Roblox ID exceeds the supported 64-bit range.",
        )
    })
}
pub fn username(value: &str) -> Result<(), ApiError> {
    if !(3..=20).contains(&value.len())
        || !value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_')
    {
        return Err(ApiError::new(
            ErrorCode::InvalidInput,
            "Use a Roblox username with 3–20 letters, numbers, or underscores.",
        ));
    }
    Ok(())
}
pub fn cursor(value: &str) -> Result<(), ApiError> {
    if value.is_empty() || value.len() > 2048 || value.chars().any(char::is_control) {
        return Err(ApiError::new(
            ErrorCode::InvalidInput,
            "The search cursor is invalid. Start a new search.",
        ));
    }
    Ok(())
}
pub fn text(value: &str, maximum: usize) -> bool {
    !value.trim().is_empty() && value.len() <= maximum
}

/// Only official CDN images, never frontend-supplied arbitrary URLs.
pub fn cdn_url(value: &str) -> Option<String> {
    let url = reqwest::Url::parse(value).ok()?;
    let host = url.host_str()?;
    (url.scheme() == "https"
        && host.ends_with(".rbxcdn.com")
        && host.len() > ".rbxcdn.com".len()
        && url.username().is_empty()
        && url.password().is_none()
        && url.port().is_none()
        && url.fragment().is_none()
        && value.len() <= 2048)
        .then(|| url.to_string())
}
pub fn completed_image(image: &ImageWire) -> Option<String> {
    if image.state != "Completed" {
        return None;
    }
    image.image_url.as_deref().and_then(cdn_url)
}
pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(i64::MAX as u128) as i64
}
