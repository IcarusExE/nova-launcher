use super::models::{now_ms, ApiError, ErrorCode};
use reqwest::{blocking::Client, redirect::Policy};
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::{
    collections::HashMap,
    io::Read,
    sync::{Arc, Mutex},
    time::{Duration, Instant, SystemTime},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Endpoint {
    Metadata,
    Votes,
    Icons,
    Thumbnails,
    Username,
    Profile,
    Avatar,
    UserSearch,
}
impl Endpoint {
    pub fn url(self, id: Option<u64>) -> String {
        match self {
            Self::Metadata => "https://games.roblox.com/v1/games".into(),
            Self::Votes => "https://games.roblox.com/v1/games/votes".into(),
            Self::Icons => "https://thumbnails.roblox.com/v1/games/icons".into(),
            Self::Thumbnails => "https://thumbnails.roblox.com/v1/games/multiget/thumbnails".into(),
            Self::Username => "https://users.roblox.com/v1/usernames/users".into(),
            Self::Profile => format!(
                "https://users.roblox.com/v1/users/{}",
                id.expect("validated user ID")
            ),
            Self::Avatar => "https://thumbnails.roblox.com/v1/users/avatar-headshot".into(),
            Self::UserSearch => "https://users.roblox.com/v1/users/search".into(),
        }
    }
    fn ttl(self) -> Duration {
        Duration::from_secs(match self {
            Self::Metadata | Self::Votes | Self::UserSearch => 60,
            Self::Icons | Self::Thumbnails | Self::Avatar => 120,
            Self::Username | Self::Profile => 300,
        })
    }
}
#[derive(Debug, Clone)]
pub struct Request {
    pub endpoint: Endpoint,
    pub id: Option<u64>,
    pub query: Vec<(String, String)>,
    pub body: Option<Value>,
}
impl Request {
    pub fn get(endpoint: Endpoint, query: &[(&str, String)]) -> Self {
        Self {
            endpoint,
            id: None,
            query: query
                .iter()
                .map(|(k, v)| (k.to_string(), v.clone()))
                .collect(),
            body: None,
        }
    }
    fn key(&self) -> String {
        format!(
            "{:?}:{:?}:{:?}:{:?}",
            self.endpoint, self.id, self.query, self.body
        )
    }
}
pub struct Response {
    pub status: u16,
    pub body: Vec<u8>,
    pub retry_after: Option<String>,
    pub exhausted_reset: Option<String>,
}
pub trait Transport: Send + Sync {
    fn send(&self, request: &Request) -> Result<Response, ApiError>;
    fn wait(&self, duration: Duration) {
        std::thread::sleep(duration);
    }
}
pub struct NativeTransport {
    client: Client,
}
impl NativeTransport {
    pub fn new() -> Result<Self, ApiError> {
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(3))
            .timeout(Duration::from_secs(8))
            .https_only(true)
            .redirect(Policy::none())
            .no_proxy()
            .user_agent("NovaLauncher/0.1 (public read-only data)")
            .build()
            .map_err(|_| {
                ApiError::new(
                    ErrorCode::Unavailable,
                    "Could not initialize secure Roblox requests. Check system certificates.",
                )
            })?;
        Ok(Self { client })
    }
}
impl Transport for NativeTransport {
    fn send(&self, request: &Request) -> Result<Response, ApiError> {
        let url = request.endpoint.url(request.id);
        let builder = if let Some(body) = &request.body {
            self.client.post(url).json(body)
        } else {
            self.client.get(url)
        };
        let response = builder
            .query(&request.query)
            .header("Accept", "application/json")
            .send()
            .map_err(|error| {
                if error.is_timeout() {
                    ApiError::new(
                        ErrorCode::Timeout,
                        "Roblox did not respond in time. Try again when your connection is stable.",
                    )
                } else {
                    ApiError::new(
                        ErrorCode::Offline,
                        "Could not reach Roblox. Check your connection and try again.",
                    )
                }
            })?;
        let status = response.status().as_u16();
        let retry_after = response
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned);
        let exhausted_reset = response
            .headers()
            .get("x-ratelimit-remaining")
            .and_then(|v| v.to_str().ok())
            .filter(|v| *v == "0")
            .and_then(|_| response.headers().get("x-ratelimit-reset"))
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned);
        if response
            .content_length()
            .is_some_and(|length| length > 1_048_576)
        {
            return Err(ApiError::invalid_response());
        }
        let mut body = Vec::new();
        response
            .take(1_048_577)
            .read_to_end(&mut body)
            .map_err(|_| {
                ApiError::new(
                    ErrorCode::Offline,
                    "The Roblox response was interrupted. Try again.",
                )
            })?;
        if body.len() > 1_048_576 {
            return Err(ApiError::invalid_response());
        }
        Ok(Response {
            status,
            body,
            retry_after,
            exhausted_reset,
        })
    }
}
struct Cached {
    body: Vec<u8>,
    expires: Instant,
    observed_at: i64,
}
#[derive(Default)]
struct State {
    cache: HashMap<String, Cached>,
    cooldowns: HashMap<Endpoint, Instant>,
    active: usize,
}
pub struct Http {
    transport: Arc<dyn Transport>,
    state: Mutex<State>,
}
impl Http {
    pub fn new(transport: Arc<dyn Transport>) -> Self {
        Self {
            transport,
            state: Mutex::new(State::default()),
        }
    }
    pub fn observed_at(&self, request: &Request) -> i64 {
        self.state
            .lock()
            .ok()
            .and_then(|state| {
                state
                    .cache
                    .get(&request.key())
                    .map(|cached| cached.observed_at)
            })
            .unwrap_or_else(now_ms)
    }
    pub fn cooldown(&self, endpoint: Endpoint) -> u64 {
        self.state
            .lock()
            .ok()
            .and_then(|state| state.cooldowns.get(&endpoint).map(|end| remaining(*end)))
            .unwrap_or(0)
    }
    pub fn json<T: DeserializeOwned>(&self, request: Request) -> Result<T, ApiError> {
        let key = request.key();
        {
            let mut state = self.state.lock().map_err(|_| {
                ApiError::new(ErrorCode::Busy, "Roblox requests are busy. Try again.")
            })?;
            state
                .cache
                .retain(|_, value| value.expires > Instant::now());
            if let Some(cached) = state.cache.get(&key) {
                return serde_json::from_slice(&cached.body)
                    .map_err(|_| ApiError::invalid_response());
            }
            if let Some(end) = state.cooldowns.get(&request.endpoint) {
                let seconds = remaining(*end);
                if seconds > 0 {
                    return Err(rate_limited(seconds));
                }
            }
            if state.active >= 4 {
                return Err(ApiError::new(
                    ErrorCode::Busy,
                    "Several Roblox requests are already pending. Wait for them to finish.",
                ));
            }
            state.active += 1;
        }
        let result = self.execute::<T>(&request, &key);
        if let Ok(mut state) = self.state.lock() {
            state.active = state.active.saturating_sub(1);
        }
        result
    }
    fn execute<T: DeserializeOwned>(&self, request: &Request, key: &str) -> Result<T, ApiError> {
        for attempt in 0..2 {
            let response = match self.transport.send(request) {
                Ok(response) => response,
                Err(error)
                    if attempt == 0
                        && matches!(error.code, ErrorCode::Offline | ErrorCode::Timeout) =>
                {
                    self.transport.wait(Duration::from_millis(500));
                    continue;
                }
                Err(error) => return Err(error),
            };
            if response.status == 429 {
                let seconds = response
                    .retry_after
                    .as_deref()
                    .and_then(|value| retry_after(value, SystemTime::now()))
                    .or_else(|| {
                        response
                            .exhausted_reset
                            .as_deref()
                            .and_then(|value| reset_seconds(value, SystemTime::now()))
                    })
                    .unwrap_or(2);
                self.set_cooldown(request.endpoint, seconds);
                // Honor long Retry-After without keeping a worker or the UI asleep.
                if attempt == 0 && seconds <= 1 {
                    self.transport.wait(Duration::from_secs(seconds.max(1)));
                    continue;
                }
                return Err(rate_limited(seconds));
            }
            if response.status >= 500 && attempt == 0 {
                self.transport.wait(Duration::from_millis(500));
                continue;
            }
            match response.status {
                200 => {
                    let value = serde_json::from_slice::<T>(&response.body).map_err(|_| ApiError::invalid_response())?;
                    if let Some(seconds) = response.exhausted_reset.as_deref().and_then(|v|reset_seconds(v, SystemTime::now())) { self.set_cooldown(request.endpoint, seconds); }
                    let mut state = self.state.lock().map_err(|_| ApiError::new(ErrorCode::Busy, "Roblox request cache is busy. Try again."))?;
                    if state.cache.len() >= 128 {
                        if let Some(oldest) = state.cache.iter().min_by_key(|(_,item)| item.expires).map(|(key,_)|key.clone()) { state.cache.remove(&oldest); }
                    }
                    state.cache.insert(key.into(), Cached { body: response.body, expires: Instant::now() + request.endpoint.ttl(), observed_at: now_ms() });
                    return Ok(value);
                }
                401 | 403 => return Err(ApiError::new(ErrorCode::Forbidden, "Roblox denied this public request. Nova will not request credentials or bypass the restriction.")),
                404 => return Err(ApiError::new(ErrorCode::NotFound, "This public Roblox resource is unavailable or no longer exists.")),
                400 => return Err(ApiError::new(ErrorCode::InvalidInput, "Roblox rejected the lookup. Check the ID or username; search terms can also be filtered by Roblox.")),
                _ => return Err(ApiError::new(ErrorCode::Unavailable, "Roblox's public data service is unavailable. Try again later.")),
            }
        }
        Err(ApiError::new(
            ErrorCode::Unavailable,
            "Roblox's public data service is unavailable. Try again later.",
        ))
    }
    fn set_cooldown(&self, endpoint: Endpoint, seconds: u64) {
        if let Ok(mut state) = self.state.lock() {
            if let Some(end) = Instant::now().checked_add(Duration::from_secs(seconds)) {
                state
                    .cooldowns
                    .entry(endpoint)
                    .and_modify(|old| *old = (*old).max(end))
                    .or_insert(end);
            }
        }
    }
}
fn remaining(end: Instant) -> u64 {
    end.saturating_duration_since(Instant::now())
        .as_millis()
        .div_ceil(1000) as u64
}
fn rate_limited(seconds: u64) -> ApiError {
    ApiError {
        code: ErrorCode::RateLimited,
        message: format!(
            "Roblox is limiting public requests. Try again in {} seconds.",
            seconds.max(1)
        ),
        retry_after_seconds: Some(seconds.max(1)),
    }
}
pub fn retry_after(value: &str, now: SystemTime) -> Option<u64> {
    value.trim().parse::<u64>().ok().or_else(|| {
        httpdate::parse_http_date(value).ok().map(|time| {
            time.duration_since(now)
                .unwrap_or_default()
                .as_secs()
                .max(1)
        })
    })
}
fn reset_seconds(value: &str, now: SystemTime) -> Option<u64> {
    let value = value.parse::<u64>().ok()?;
    let epoch = now.duration_since(SystemTime::UNIX_EPOCH).ok()?.as_secs();
    Some(if value > epoch { value - epoch } else { value }.max(1))
}
