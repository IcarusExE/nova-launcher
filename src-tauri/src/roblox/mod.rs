//! Documented, anonymous Roblox APIs only. Experimental contracts stay isolated.
//! No cookies, authorization headers, arbitrary URLs, or hosted proxy service.
pub mod cache;
pub mod http;
pub mod models;

use cache::MetadataCache;
use http::{Endpoint, Http, NativeTransport, Request, Transport};
use models::*;
use serde_json::json;
use std::{collections::HashSet, path::Path, sync::Arc};

// Curated entry identifiers, not a popularity ranking or development game data.
pub const STARTING_UNIVERSES: [u64; 4] = [994732206, 1686885941, 4777817887, 3317771874];
pub struct Service {
    http: Http,
    cache: Result<MetadataCache, ApiError>,
}
pub struct ApiState(pub Result<Arc<Service>, ApiError>);
impl Service {
    pub fn new(path: &Path) -> Result<Self, ApiError> {
        Self::with_transport(path, Arc::new(NativeTransport::new()?))
    }
    pub fn with_transport(path: &Path, transport: Arc<dyn Transport>) -> Result<Self, ApiError> {
        Ok(Self {
            http: Http::new(transport),
            cache: MetadataCache::open(path),
        })
    }
    fn load_cache(&self) -> Result<Vec<Experience>, ApiError> {
        self.cache.as_ref().map_err(Clone::clone)?.load()
    }
    fn save_cache(&self, games: &[Experience]) -> Result<(), ApiError> {
        self.cache.as_ref().map_err(Clone::clone)?.save(games)
    }
    pub fn execute(&self, request: ApiRequest) -> Result<ApiResponse, ApiError> {
        match request {
            ApiRequest::CachedCatalog => self.cached_catalog().map(ApiResponse::Catalog),
            ApiRequest::Catalog => self.catalog().map(ApiResponse::Catalog),
            ApiRequest::LookupUniverse { universe_id } => self
                .lookup(numeric_id(&universe_id)?)
                .map(ApiResponse::Experience),
            ApiRequest::LookupUsername { username: name } => {
                username(&name)?;
                let users: Data<UserWire> = self.http.json(Request {
                    endpoint: Endpoint::Username,
                    id: None,
                    query: vec![],
                    body: Some(json!({"usernames":[name],"excludeBannedUsers":true})),
                })?;
                if users.data.len() > 1 {
                    return Err(ApiError::invalid_response());
                }
                let profile = users
                    .data
                    .first()
                    .map(|user| self.profile(user.id))
                    .transpose()?;
                Ok(ApiResponse::Profile(profile))
            }
            ApiRequest::LookupUser { user_id } => self
                .profile(numeric_id(&user_id)?)
                .map(|profile| ApiResponse::Profile(Some(profile))),
            ApiRequest::SearchUsers {
                keyword,
                cursor: page_cursor,
            } => self
                .search_users(&keyword, page_cursor.as_deref())
                .map(ApiResponse::Users),
        }
    }
    fn cached_catalog(&self) -> Result<Catalog, ApiError> {
        let experiences = self.load_cache()?;
        let starting_place_ids = STARTING_UNIVERSES
            .iter()
            .filter_map(|universe| {
                experiences
                    .iter()
                    .find(|g| g.universe_id == universe.to_string())
                    .map(|g| g.id.clone())
            })
            .collect();
        Ok(Catalog {
            experiences,
            starting_place_ids,
            warnings: vec![],
        })
    }
    fn catalog(&self) -> Result<Catalog, ApiError> {
        let mut warnings = vec![];
        let mut cached = match self.load_cache() {
            Ok(games) => games,
            Err(error) => {
                warnings.push(error);
                vec![]
            }
        };
        match self.games(&STARTING_UNIVERSES) {
            Ok((fresh, issues)) => {
                warnings.extend(issues);
                if let Err(error) = self.save_cache(&fresh) {
                    warnings.push(error);
                }
                let starting_place_ids = fresh.iter().map(|game| game.id.clone()).collect();
                cached.retain(|game| !fresh.iter().any(|other| other.id == game.id));
                let mut experiences = fresh;
                experiences.extend(cached);
                Ok(Catalog {
                    experiences,
                    starting_place_ids,
                    warnings,
                })
            }
            Err(error) if !cached.is_empty() => {
                warnings.push(error);
                let starting_place_ids = STARTING_UNIVERSES
                    .iter()
                    .filter_map(|universe| {
                        cached
                            .iter()
                            .find(|g| g.universe_id == universe.to_string())
                            .map(|g| g.id.clone())
                    })
                    .collect();
                Ok(Catalog {
                    experiences: cached,
                    starting_place_ids,
                    warnings,
                })
            }
            Err(error) => Err(error),
        }
    }
    fn lookup(&self, universe: u64) -> Result<ExperienceResult, ApiError> {
        match self.games(&[universe]) {
            Ok((mut games, mut warnings)) => {
                let game = games.pop().ok_or_else(||ApiError::new(ErrorCode::NotFound, "No public experience was returned for this Universe ID. A Place ID is a different identifier."))?;
                if let Err(error) = self.save_cache(std::slice::from_ref(&game)) {
                    warnings.push(error);
                }
                Ok(ExperienceResult {
                    experience: game,
                    warnings,
                })
            }
            Err(error) => {
                if let Some(game) = self
                    .load_cache()?
                    .into_iter()
                    .find(|g| g.universe_id == universe.to_string())
                {
                    Ok(ExperienceResult {
                        experience: game,
                        warnings: vec![error],
                    })
                } else {
                    Err(error)
                }
            }
        }
    }
    fn games(&self, universes: &[u64]) -> Result<(Vec<Experience>, Vec<ApiError>), ApiError> {
        let ids = universes
            .iter()
            .map(u64::to_string)
            .collect::<Vec<_>>()
            .join(",");
        let request = Request::get(Endpoint::Metadata, &[("universeIds", ids.clone())]);
        let wire: Data<GameWire> = self.http.json(request.clone())?;
        let observed_at = self.http.observed_at(&request);
        let mut seen = HashSet::new();
        let mut places = HashSet::new();
        let mut games = Vec::new();
        for game in wire.data {
            if !universes.contains(&game.id)
                || game.root_place_id == 0
                || game.creator.id == 0
                || !seen.insert(game.id)
                || !places.insert(game.root_place_id)
                || !text(&game.name, 1024)
                || game.description.len() > 100_000
                || !text(&game.creator.name, 1024)
                || !["User", "Group"].contains(&game.creator.r#type.as_str())
            {
                return Err(ApiError::invalid_response());
            }
            games.push(Experience {
                id: game.root_place_id.to_string(),
                universe_id: game.id.to_string(),
                name: game.name,
                description: game.description,
                creator: game.creator.name,
                creator_id: game.creator.id.to_string(),
                creator_type: game.creator.r#type,
                category: game
                    .genre_l1
                    .or(game.genre)
                    .filter(|genre| text(genre, 100) && genre != "All"),
                icon_url: None,
                thumbnail_url: None,
                players: game.playing,
                up_votes: None,
                down_votes: None,
                observed_at,
                cached: false,
            });
        }
        if games.is_empty() {
            return Ok((games, vec![]));
        }
        let mut warnings = vec![];
        match self.http.json::<Data<VoteWire>>(Request::get(
            Endpoint::Votes,
            &[("universeIds", ids.clone())],
        )) {
            Ok(votes) => {
                for vote in votes.data {
                    if let Some(game) = games
                        .iter_mut()
                        .find(|game| game.universe_id == vote.id.to_string())
                    {
                        if vote.up_votes.checked_add(vote.down_votes).is_some() {
                            game.up_votes = Some(vote.up_votes);
                            game.down_votes = Some(vote.down_votes);
                        }
                    }
                }
            }
            Err(error) => warnings.push(error),
        }
        match self.http.json::<Data<ImageWire>>(Request::get(
            Endpoint::Icons,
            &[
                ("universeIds", ids.clone()),
                ("size", "256x256".into()),
                ("format", "Png".into()),
                ("isCircular", "false".into()),
                ("returnPolicy", "PlaceHolder".into()),
            ],
        )) {
            Ok(images) => {
                for image in images.data {
                    if let Some(game) = games
                        .iter_mut()
                        .find(|game| game.universe_id == image.target_id.to_string())
                    {
                        game.icon_url = completed_image(&image);
                    }
                }
            }
            Err(error) => warnings.push(error),
        }
        match self.http.json::<Data<ThumbnailsWire>>(Request::get(
            Endpoint::Thumbnails,
            &[
                ("universeIds", ids),
                ("countPerUniverse", "1".into()),
                ("defaults", "true".into()),
                ("size", "768x432".into()),
                ("format", "Png".into()),
                ("isCircular", "false".into()),
            ],
        )) {
            Ok(images) => {
                for group in images.data {
                    if let Some(game) = games
                        .iter_mut()
                        .find(|game| game.universe_id == group.universe_id.to_string())
                    {
                        game.thumbnail_url = group.thumbnails.iter().find_map(completed_image);
                    }
                }
            }
            Err(error) => warnings.push(error),
        }
        // Preserve curated order, not the server's incidental array order.
        games.sort_by_key(|game| {
            universes
                .iter()
                .position(|id| id.to_string() == game.universe_id)
        });
        Ok((games, warnings))
    }
    fn profile(&self, id: u64) -> Result<Profile, ApiError> {
        if id == 0 {
            return Err(ApiError::invalid_response());
        }
        let request = Request {
            endpoint: Endpoint::Profile,
            id: Some(id),
            query: vec![],
            body: None,
        };
        let wire: ProfileWire = self.http.json(request.clone())?;
        let observed_at = self.http.observed_at(&request);
        if wire.id != id
            || !text(&wire.name, 100)
            || !text(&wire.display_name, 200)
            || wire.description.len() > 100_000
            || !text(&wire.created, 64)
        {
            return Err(ApiError::invalid_response());
        }
        let mut warnings = vec![];
        let avatar_url = match self.http.json::<Data<ImageWire>>(Request::get(
            Endpoint::Avatar,
            &[
                ("userIds", id.to_string()),
                ("size", "420x420".into()),
                ("format", "Png".into()),
                ("isCircular", "false".into()),
            ],
        )) {
            Ok(images) => images
                .data
                .iter()
                .find(|image| image.target_id == id)
                .and_then(completed_image),
            Err(error) => {
                warnings.push(error);
                None
            }
        };
        Ok(Profile {
            id: id.to_string(),
            username: wire.name,
            display_name: wire.display_name,
            description: wire.description,
            created_at: wire.created,
            is_banned: wire.is_banned,
            verified: wire.has_verified_badge,
            avatar_url,
            observed_at,
            warnings,
        })
    }
    fn search_users(&self, keyword: &str, page_cursor: Option<&str>) -> Result<UserPage, ApiError> {
        username(keyword)?;
        if let Some(value) = page_cursor {
            cursor(value)?;
        }
        let mut query = vec![("keyword", keyword.into()), ("limit", "10".into())];
        if let Some(value) = page_cursor {
            query.push(("cursor", value.into()));
        }
        let wire: UserPageWire = self.http.json(Request::get(Endpoint::UserSearch, &query))?;
        if wire.data.len() > 10 {
            return Err(ApiError::invalid_response());
        }
        if let Some(value) = &wire.next_page_cursor {
            cursor(value).map_err(|_| ApiError::invalid_response())?;
        }
        let mut ids = HashSet::new();
        let mut users = vec![];
        for user in wire.data {
            if user.id == 0
                || !ids.insert(user.id)
                || !text(&user.name, 100)
                || !text(&user.display_name, 200)
            {
                return Err(ApiError::invalid_response());
            }
            users.push(UserSummary {
                id: user.id.to_string(),
                username: user.name,
                display_name: user.display_name,
                verified: user.has_verified_badge,
            });
        }
        Ok(UserPage {
            users,
            next_cursor: wire.next_page_cursor,
            retry_after_seconds: self.http.cooldown(Endpoint::UserSearch),
        })
    }
}

#[cfg(test)]
mod tests;
