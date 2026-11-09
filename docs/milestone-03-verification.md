# Milestone 03 — public Roblox data verification

Verified on CachyOS Linux, November 9, 2026. Scope is the documented anonymous
subset, exposed as **Public Roblox API preview**, preserving the existing UI,
appearance settings, launch adapters and SQLite schema v2. General experience
search remains blocked; this is not full global Roblox discovery or stable Open
Cloud integration.

## Implemented behavior

- Home loads four curated Universe IDs from Roblox, showing real metadata,
  creator, icons/thumbnails and available player/vote snapshots. Curated ordering
  is explicitly not a popularity ranking. No fixture name, statistic, description
  or artwork is substituted on failure. Ratings require a nonzero verified vote
  total. Missing values and pending/blocked/failed images remain unavailable.
- Discover filters the fetched metadata by name/creator and returned genre,
  sorts the loaded results, and resolves an explicit numeric **Universe ID**.
  General keyword discovery links to the official Roblox Discover website.
  Experience links/launch requests always use the verified **root Place ID**.
- Profile resolves exact usernames, renders public name/display name, biography,
  creation date, ID, public flags and avatar, and links to the official profile.
  Explicit user search supports 10-result pages with opaque continuation cursors.
  Search cooldowns are visible; editing, clearing or replacing a query invalidates
  older responses. No per-keystroke networking or account login exists.
- Favorites and history retain existing Place IDs. Unknown favorites stay visible
  as `Place {id}` with a safe official page link and explicit remove action.
  Unknown/noncanonical IDs are not reinterpreted or silently removed. Metadata
  from an explicit Universe lookup can resolve a favorite when its root Place ID
  matches. Non-root Place IDs remain unresolved because anonymous arbitrary
  Place-to-Universe resolution was not verified.
- `roblox-cache.sqlite3` is a separate bounded, disposable metadata/mapping cache.
  Cached content is timestamped and labeled; profiles/search are memory-only.
  Existing `nova.sqlite3`, migrations, favorite/history records, serialized
  preference fields and launcher adapters are preserved. A broken metadata cache
  reports errors without disabling independent profile requests or changing the
  library. It does not automatically delete a corrupt file.
- Browser preview honestly requires the desktop app for public data. Vitest and
  Playwright fixtures are isolated test inputs, never production fallback data.

## Verified endpoints and restrictions

See [official API research](milestone-03-api-research.md) for the per-endpoint
source links, auth/security alternatives, stability labels, observed limits,
response hashes and safe probes. Primary authority is Roblox's
[current OpenAPI](https://create.roblox.com/docs/cloud/openapi.json), also re-fetched
and hash-verified during implementation (789 paths).

Integrated anonymous operations: Games `/v1/games`, `/v1/games/votes`; Thumbnails
`/v1/games/icons`, `/v1/games/multiget/thumbnails`,
`/v1/users/avatar-headshot`; Users `/v1/usernames/users`, `/v1/users/{userId}`,
`/v1/users/search`.

The metadata, username resolution and user-search contracts are **EXPERIMENTAL**.
Profiles/votes have unspecified stability. Images are documented stable. Preview
labeling and strict typed parsers isolate that maintenance risk; an upstream auth
or response change yields an unavailable state, not an attempt to bypass it.

Blocked portions:

- No verified documented anonymous global experience keyword/popularity API was
  found. No internal website API, scraping, omni-search or third-party proxy is
  used. Recommendations returned empty data and were not promoted as a feed.
- Bulk Place metadata requires a Roblox cookie (actual 401 probe). An arbitrary
  anonymous mapping contract was not found in the official spec. No guessed
  Place/Universe conversions are made.
- Stable Open Cloud requires API-key/scoped OAuth authorization (actual anonymous
  403 universe probe). No shared secret, authentication feature or hosted backend
  was added. A future authenticated design/backend needs separate approval.

## Checks and real-hardware evidence

The final available checks passed as listed below. Real HTTP evidence is separate from deterministic mocked UI regressions.

| Check                                                | Result                                                                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Prettier / strict TypeScript / Vite production build | Passed                                                                                                                           |
| Frontend unit/integration regressions                | 32 passed                                                                                                                        |
| Playwright browser regressions                       | 9 passed                                                                                                                         |
| Rust unit/integration tests                          | 34 passed; two external-launch tests remain opt-in; public API test executed separately                                          |
| Rustfmt / Clippy with warnings denied                | Passed                                                                                                                           |
| Optimized Linux Tauri build (`--no-bundle`)          | Passed; final current-assets build completed                                                                                     |
| Real HTTP Rust contract test                         | Passed, including a distinct second user-search page after the server cooldown                                                   |
| Actual Linux Tauri/WebKit/SQLite appearance harness  | Passed: theme/accent, density/motion, rapid switches, write failure/recovery, restart, corruption and record preservation        |
| Actual Linux Tauri/WebKit public-data harness        | Passed: real HTTP/IPC and metadata cache, official Place link, unknown favorite, preserved appearance/history/schema and restart |

An initial real HTTP run failed with a connection reset while the developer's
network connection was unavailable. The developer restored connectivity; the same
Rust implementation then passed against the actual official endpoints, without
changing network, DNS, proxy or TLS policy. This exercised real metadata, votes,
icons/thumbnails, username resolution, profile/avatar and public user search.
A separate official CDN byte-range probe returned HTTP 206, a PNG signature and
anonymous CORS support. Mocked browser tests are not counted as live API evidence.

Native GUI text-entry automation was attempted, but this host's WebKit exposed no
AT-SPI EditableText interface and synthesized input did not reach the fields, including an XWayland attempt. The public-data GUI harness therefore
uses accessible button/link actions to verify real metadata and SQLite behavior;
it does not introduce a production test hook. **Native GUI typing/submission of
Profile search and Universe lookup remains manually unverified.** Their actual
Rust HTTP contracts (including profile/avatar and user pagination) passed on this
host; their form interactions/races are covered by isolated browser tests. This
limitation is not treated as live native GUI profile evidence. The native GUI harnesses emitted a nonfatal GTK popup-unmap warning while all assertions passed.

Existing opt-in real client/browser launch tests remain opt-in because they open
external applications. This milestone does not re-claim Windows runtime support;
Windows hardware verification and installer packaging are still outstanding.

## Security and maintenance boundaries

HTTP requests stay in Rust with fixed endpoint selection, system TLS, no redirects,
no cookie jar or authentication headers, bounded deadlines/retries/concurrency,
HTTP Retry-After/reset cooldowns and bounded caches. No external API URL, header,
executable or shell input is accepted from React. IDs cross IPC as strings; numeric
validation and mapping occur natively. React escapes external text. Image URLs
are restricted to HTTPS `*.rbxcdn.com`, revalidated on cache reads, requested with
anonymous CORS/no referrer and allowed by a narrowly expanded image CSP. Browser
API connections, remote scripts, fonts and frames remain blocked.

Quotas are observed IP/environment behavior, not contractual guarantees. Shared
networks, regions or upstream policy can make requests unavailable. Local refresh
may use the 60–300 second HTTP cache instead of issuing another request. Offline
snapshots can be old, and an evicted mapping may leave an intact favorite with
unavailable metadata. Experimental schemas need ongoing maintenance. No hosted
service, login, Discord, update service, FastFlags or multi-instance features were
introduced. Unused original reference artwork remains subject to its existing
redistribution notice; it is never used as live Roblox artwork.

## Changed files

| Area                          | Files                                                                                                                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native API                    | `src-tauri/src/roblox/{mod,models,http,cache,tests}.rs`, `src-tauri/tests/public_api.rs`                                                                                                            |
| Tauri wiring/dependencies     | `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, lockfile, `src-tauri/tauri.conf.json`                                                                                                               |
| Shared frontend service/state | `src/lib/roblox.ts`, `src/lib/types.ts`, `src/hooks/useCatalog.tsx`, `src/App.tsx`                                                                                                                  |
| Existing UI integration       | Home, Discover, Library, Profile, Settings preview label, shared UI, Shell preview label, RequestHistory, `src/styles.css`                                                                          |
| Isolated tests                | `src/test/fixtures.ts` replaces production `src/data/games.ts`; App/launch tests; `src/public-data.test.tsx`, `src/lib/roblox.test.ts`; existing Playwright suites and `e2e/public-data{,.spec}.ts` |
| Native GUI checks             | `scripts/test-native-settings.py`, `scripts/test-native-public-data.py`                                                                                                                             |
| Documentation                 | `README.md`, `docs/architecture.md`, this report and API research                                                                                                                                   |

The launcher adapters, launch dispatcher, main SQLite storage/migrations,
`useLibrary`, `useAppearance` and shared appearance tokens are unchanged.

## Manual verification on CachyOS

1. Ensure documented Tauri prerequisites and normal Roblox network access are
   available. Run `npm ci`, source the Rust environment if needed, then
   `npm run tauri dev`. The window should appear in its saved theme/accent without
   waiting for API requests. No credentials are requested.
2. Home should load actual current experience names, artwork and snapshot metrics.
   Open details to see the observed time, separate Place/Universe IDs, full public
   description and official page link. The native client button stays separate.
3. Discover: filter loaded games, change a returned genre/sort, then look up
   Universe `994732206`. Its official experience URL must use Place `2753915549`.
   Zero, whitespace, URLs and oversized IDs must fail validation; a valid missing
   Universe should show a not-found result. Global keyword search is unavailable.
4. Profile: enter `Roblox` and choose Search profile. Check the returned public
   identity/avatar/biography and official `/users/1/profile` link. Use Find users,
   wait for Roblox's displayed cooldown, then More users. Try another query before
   the first returns; late results must not replace it. No friends/followers counts
   are invented.
5. Favorite an experience, restart and check Library grid/list views. Existing
   unknown favorites should still appear by Place ID. Remove only an explicitly
   chosen record. Check recent launch requests remain intact and are not created
   by fetching data, favoriting, or ordinary website links.
6. Change theme/accent/density/motion and restart. Repeat with OS System theme and
   reduced-motion preference. Network completions must not remount settings,
   reset focus/scroll or revert preferences.
7. After a successful metadata load, disconnect normally and restart. Cached
   metadata should be labeled as saved snapshots and refresh should show Offline.
   Profiles without an in-memory cache should fail clearly. Restore connectivity
   and retry. In `npm run dev` browser preview, expect a desktop-required notice
   and no fixture catalog.

Automated read-only native checks, using temporary app data only:

```bash
source "$HOME/.cargo/env"
cargo test --manifest-path src-tauri/Cargo.toml --locked --test public_api -- --ignored --nocapture
CARGO_BUILD_JOBS=2 npm run tauri build -- --no-bundle
python3 scripts/test-native-settings.py
python3 scripts/test-native-public-data.py
```

The real-network Rust test honors the search cooldown before fetching one next
page. Do not run multiple copies concurrently. The Python harnesses require a
Linux graphical session, Python GI and AT-SPI, and terminate only their own app
processes. They do not change the user's app-data directory or launch Roblox.
