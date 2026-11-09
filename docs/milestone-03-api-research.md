# Milestone 03 — official Roblox API research

Research and unauthenticated read-only probes: **November 9, 2026**, from the
CachyOS development host. No cookies, tokens, API keys, scraping, private endpoints,
or third-party proxies were used. The username POST below is a documented lookup,
not an account mutation.

## Primary sources and interpretation

- [Current combined official OpenAPI](https://create.roblox.com/docs/cloud/openapi.json)
- [Official Cloud API index](https://create.roblox.com/docs/cloud/llms.txt)
- [Universes](https://create.roblox.com/docs/cloud/reference/features/universes)
- [Users](https://create.roblox.com/docs/cloud/reference/features/users)
- [Public profiles](https://create.roblox.com/docs/cloud/reference/features/user-profiles)
- [Thumbnails](https://create.roblox.com/docs/cloud/reference/features/thumbnails)
- [Avatars](https://create.roblox.com/docs/cloud/reference/features/avatars)
- [Interactions / votes](https://create.roblox.com/docs/cloud/reference/features/interactions)
- [Places](https://create.roblox.com/docs/cloud/reference/features/places)
- Official endpoint Swagger: [Users](https://users.roblox.com/docs/json/v1),
  [Thumbnails](https://thumbnails.roblox.com/docs/json/v1).

The combined specification was inspected per operation. Its `security: [{}, ...]`
explicitly permits anonymous access for the operations used here. Some generated
Markdown pages label the entire legacy domain as cookie-authenticated and provide
cookie examples even for these operations. Nova uses the anonymous alternative
only; real probes confirmed it. If that alternative disappears, the feature must
become unavailable rather than acquiring cookies or falling back to scraping.

Roblox marks metadata and username/search operations **EXPERIMENTAL**. They are
not stable production contracts. Nova may expose this verified read-only subset
as an explicitly labeled public API preview, with strict parsing, bounded traffic,
and graceful failures. Missing stability metadata is recorded as unspecified,
not interpreted as stable. Stable Open Cloud alternatives do not grant anonymous
access and are not interchangeable with unrestricted public discovery.

## Endpoint decisions

All paths below use HTTPS on the named official host. Rates are **observed response
headers from one probe**, not guaranteed quotas or a license to send at that rate.
No numerical anonymous per-endpoint quota is specified in the inspected combined
OpenAPI. IP/shared-network and regional policies may differ. Honor `Retry-After`
and available reset headers; do not test the limit by flooding requests.

| Purpose / endpoint                                                                      | Auth and stability                                                                              | Probe and observed limit                         | Decision / restrictions                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Metadata: `games.roblox.com GET /v1/games?universeIds=...`                              | Anonymous permitted; EXPERIMENTAL                                                               | 200; 300/60 s                                    | Integrate as preview. At most 50 Universe IDs per documented batch; Nova uses four starting points or one explicit Universe ID. Root Place ID comes from this response. Names, descriptions, creator and current `playing` are public snapshots.           |
| Votes: `games.roblox.com GET /v1/games/votes?universeIds=...`                           | Anonymous permitted; stability unspecified                                                      | 200; 200/60 s                                    | Optional preview data. Keep up/down counts; derive approval only from verified nonzero totals. Missing data stays unavailable.                                                                                                                             |
| Icons: `thumbnails.roblox.com GET /v1/games/icons`                                      | Anonymous permitted; STABLE                                                                     | 200; 1200/60 s                                   | Use `returnPolicy=PlaceHolder`, Png, 256×256. Do not request privileged auto-generated policies. Accept only Completed images from validated Roblox CDN HTTPS URLs.                                                                                        |
| Experience thumbnails: `thumbnails.roblox.com GET /v1/games/multiget/thumbnails`        | Anonymous permitted; STABLE                                                                     | 200; 60/60 s                                     | One 768×432 image per Universe ID. Pending/blocked/error thumbnails remain unavailable, never replaced with fixture artwork.                                                                                                                               |
| Exact username: `users.roblox.com POST /v1/usernames/users`                             | Anonymous permitted; EXPERIMENTAL                                                               | 200; 500/60 s                                    | One username per lookup, `excludeBannedUsers=true`. May resolve former usernames; display the returned current username. No CSRF token is required by this read-only POST contract.                                                                        |
| User search: `users.roblox.com GET /v1/users/search`                                    | Anonymous permitted; EXPERIMENTAL                                                               | First page 200; continuation 200; **1/60 s**     | Explicit user action, fixed limit 10, opaque next cursor. Cache pages and enforce cooldown. Do not search on each keystroke. Filtering/short-keyword errors are actionable.                                                                                |
| Public profile: `users.roblox.com GET /v1/users/{userId}`                               | Anonymous permitted; stability unspecified                                                      | 200; 30/60 s                                     | Public name, display name, biography, created date and public flags only. No private birthday, account settings, friends or follower-count requests.                                                                                                       |
| Avatar: `thumbnails.roblox.com GET /v1/users/avatar-headshot`                           | Anonymous permitted; STABLE                                                                     | 200; 120/60 s                                    | One 420×420 headshot; same Completed-state/CDN validation as experience images.                                                                                                                                                                            |
| Related experiences: `games.roblox.com GET /v1/games/recommendations/game/{universeId}` | Anonymous permitted; EXPERIMENTAL                                                               | 200 with empty games and null next key; 200/60 s | Not integrated as a functional discovery feed: the probe did not verify useful results or pagination. Empty output is not evidence of working recommendations.                                                                                             |
| Bulk Place lookup: `games.roblox.com GET /v1/games/multiget-place-details`              | Cookie required; EXPERIMENTAL                                                                   | **401**, missing authentication                  | Blocked. Never acquire a session cookie. Existing unknown Place IDs remain visible and openable on Roblox; they are not treated as Universe IDs or deleted.                                                                                                |
| Open Cloud universe: `apis.roblox.com GET /cloud/v2/universes/{universe_id}`            | API key or scoped OAuth; STABLE                                                                 | **403**, invalid/missing authentication          | Not integrated. Documented 100/min per key owner / OAuth authorization. A shared key cannot be protected in a distributed desktop binary. Authorization is resource-scoped, not a general public-search entitlement.                                       |
| Open Cloud profile: `apis.roblox.com GET /cloud/v2/users/{user_id}`                     | API key or scoped OAuth; STABLE                                                                 | Not probed: auth requirement already verified    | Not needed for the anonymous public-profile subset. Docs list 1000/min per key owner and 10/min per OAuth authorization.                                                                                                                                   |
| General experience keyword search / global popularity discovery                         | No corresponding general search contract found in the inspected 789-path official specification | No undocumented service probed                   | Blocked. Do not use website/internal omni-search or explore services. Provide local filtering of fetched starting points and explicit Universe-ID lookup, plus the official Roblox Discover website. No claim of global search or live popularity ranking. |
| Anonymous arbitrary Place → Universe mapping                                            | No applicable documented anonymous operation found                                              | Auth-required bulk lookup rejected               | Blocked. Do not call the commonly circulated undocumented mapping URL. Verified mappings come only from `id` + `rootPlaceId` in documented metadata responses and are cached without rewriting favorite/history IDs.                                       |

## Safe product scope

No hosted backend is introduced. A future authenticated Cloud integration would
need a separately reviewed authorization design (for example user-delegated OAuth
with the appropriate public-client support and resource permissions, or an
approved hosted service holding its own secrets). It must not embed a shared
secret or expand the current no-login scope. Hosted infrastructure requires user
approval before implementation.

Starting points contain only known Universe IDs. Their display metadata is fetched
live; static names, rankings, player counts, descriptions and reference artwork
are removed from production data. This is a curated entry list, not a Roblox
ranking. The four probed Universe/Place mappings are:

| Universe ID | Root Place ID |
| ----------- | ------------- |
| 994732206   | 2753915549    |
| 1686885941  | 4924922222    |
| 4777817887  | 13772394625   |
| 3317771874  | 8737899170    |

All existing favorites and history remain Place IDs. The launcher always opens
Place URLs. A separate disposable SQLite metadata cache can retain verified
Universe/Place mappings without changing `nova.sqlite3`, its schema or records.
Unresolved IDs must remain represented in the UI with an explanation and official
page action. Offline cached content is explicitly timestamped and labeled.

## Probe evidence

Requests used a descriptive Nova User-Agent and Accept: application/json, without
authentication headers or cookie jars. There were no mutations and no rate-limit
stress tests. The continuation probe used the first response's opaque next cursor;
it returned a different second page. Full public response bodies were inspected
locally; they are not production fixtures. Hashes below identify the observed
snapshots, whose data naturally changes.

| Probe                    | HTTP | Response bytes | SHA-256                                                            |
| ------------------------ | ---- | -------------- | ------------------------------------------------------------------ |
| metadata                 | 200  | 6381           | `386caff4de4e7b544d03866d216ecd15068feda92d405b80257896e9aeaa9ec6` |
| votes                    | 200  | 122            | `a2f5fbe52be37149ba461ba6b342a784305db50d898009f9688a3486ae76c48f` |
| icons                    | 200  | 171            | `931f9d6a8ba12d61f1c82636d098fa08084dca0c59e3b5b6ddd7d047aafb083d` |
| thumbnails               | 200  | 230            | `c7353519eea80d4f77edea437356e0629657111caa03f27bc0cfd4e5ecb957ce` |
| username                 | 200  | 111            | `e0cf2c049c0f1ac7b37199be4958eab53a9bb7d3442a58023b1a022eb2e4911e` |
| profile                  | 200  | 601            | `ec871f3e17e8d34de4c56c53fe23c412e9208047a394648586d8a7d85ef6f889` |
| avatar                   | 200  | 190            | `eca06b19843a7d70314c80938a04dac06295f0da0e94ad695d8e66731ed69548` |
| user-search              | 200  | 1438           | `6578933bf40c3fcda765b71a462b8964b9f41f31ac11aaf90657777e4fc3787d` |
| recommendations          | 200  | 37             | `f3e8a81148db12078583d2ecc8df8362cb07e254d8f40a79aa94bd5119b5dcc8` |
| cloud-universe           | 403  | 73             | `6de58fa9e8ad268b6ac3e770502820e751c44bbdf8e443365cba1f4d6033af6e` |
| place-details-auth-check | 401  | 82             | `8370b63e3fd9051debe80af7b87df0f68ec8058297bbbc42659b7ca082f77d37` |
| user-search-page2        | 200  | 1598           | `ac5f33ce8d9a6dd3a04b8b9772d238bf4cf8f71f94059671b26a14abb9500a65` |

Combined OpenAPI SHA-256: `335c11d662630042aa0d6c41c6d3e61b48691fbdea6233038e8d31cb6181a217`.

## Implemented reliability and transport policy

Requests run in Rust against a fixed endpoint enum. The frontend cannot pass a
URL, credential, cookie, header or executable. Redirects and environment proxy
selection are disabled; Nova never configures the machine's network. The native
client uses system TLS trust, a descriptive user agent, 3-second connection and
8-second request deadlines, a 1 MiB body cap, four concurrent requests maximum,
and at most two attempts (500 ms backoff for connection/5xx failures). HTTP caches
are bounded to 128 entries, with per-endpoint 60–300 second TTLs. Original fetch
timestamps are retained on cache hits. HTTP 429 honors Retry-After (seconds/date),
with reset-header fallback, and creates an endpoint cooldown. Only delays of one
second or less are retried within a request; longer delays are returned to the UI.
Successful exhausted quotas also create cooldowns. User search is explicit, with
an on-screen cooldown and opaque continuation cursors. No requests run per render.

Only Completed images from HTTPS subdomains of `rbxcdn.com` are accepted; URLs
with credentials, unexpected ports or fragments are rejected. An actual official
CDN PNG was fetched with a byte-range request: HTTP 206, `image/Png`, valid PNG
signature, and `Access-Control-Allow-Origin: *` for `tauri://localhost`. Images use
anonymous CORS and no referrer. CSP allows only that image host family in addition
to local images; API HTTP remains native rather than opening browser connect-src.

The typed Rust service was subsequently exercised against the real network,
including all four metadata/vote/icon/thumbnail sets, username resolution, public
profile/avatar and user search. An initial run failed with connection resets while
the developer's network connection was unavailable. After the developer restored
connectivity, the same implementation passed without proxy, DNS, certificate or
security-policy changes. Exact final checks are in the verification report.
