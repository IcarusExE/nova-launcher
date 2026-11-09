# Nova architecture

React owns navigation and local interaction state. The existing visual system,
five pages, development catalog, favorites, and saved preferences remain in place.
`src/lib/storage.ts` provides the library boundary; `src/lib/launcher.ts` provides
the launch boundary. Desktop calls use typed Tauri IPC. Browser preview uses
labeled localStorage for library state and disables native launch requests.

## Appearance and settings

`useLibrary` owns hydration and a single serial queue for local library writes.
Preferences apply immediately; pending patches are rebased on acknowledged data
after each success or failure. Favorites remain acknowledged-only. Reload waits
for queued writes and uses a generation guard against stale hydration. Settings
controls stay enabled during saves and retain DOM identity, focus, and scroll.
Failures restore consistent saved values and show an actionable error.

`public/appearance.css` centralizes semantic light/dark and accent palettes.
`useAppearance` applies the stored preference and subscribes to system color
scheme changes. Compact density and reduced motion use CSS on the existing
component tree, with the OS motion preference always respected. The native
window starts hidden; after hydration the typed `reveal_main_window` command
sets its background and shows it. Browser preview loads palette CSS and a local
blocking bootstrap before React; its localStorage is never used as native
appearance authority. Corrupt preference loads still reveal a readable error UI.
New theme/accent fields default individually for legacy JSON rows; no schema
migration or history rewrite is needed. See the
[02.1 verification report](milestone-02.1-verification.md) for evidence and tests.

## Native actions

`RobloxAdapter` separates detection, status, capabilities, and standalone client
launching. Windows and Linux implementations compile their native integration
only on the matching OS. Other platforms return an actionable unsupported error.
Capabilities describe standalone dispatch; `directJoin` is false for both clients.
`runtimeVerified` identifies the platform path exercised on the reference host,
not a health check of a particular client session or proof of startup.

The `launch_request` command accepts a tagged enum with exactly two actions:

- `launchClient`, with the `auto`, `sober`, or `windows` adapter selection.
- `openExperience`, with a positive canonical unsigned 64-bit numeric Place ID.

Unknown actions, fields, and adapter values are rejected during deserialization.
IDs reject spaces, signs, leading zeroes, non-ASCII digits, URLs, flags, zero, and
overflow. Rust constructs `https://www.roblox.com/games/{placeId}` itself. No
frontend-controlled executable, argument list, shell command, or URL is accepted
by the launch command. Experience pages can be opened even if the client is absent.

`launch.rs` defines structured error codes and receipts and injects a
`LaunchBackend` in integration tests. Production execution stays in Rust. A native
mutex rejects overlapping dispatches; the UI also disables requests while one is
pending. Detection and dispatch run on blocking workers outside the UI thread.
No client output or authentication material is captured or logged by dispatch.

On Linux, fixed argument arrays invoke `flatpak info --show-location
org.vinegarhq.Sober`, then `flatpak run org.vinegarhq.Sober` for a client request.
Missing Flatpak, missing Sober, metadata errors, spawn failures, and early nonzero
exits produce separate actionable errors. Browser requests use `xdg-open` with
only the validated official HTTPS page. The helper is observed for up to 300 ms
for immediate rejection; longer-lived processes are reaped asynchronously. Later
client/browser failure cannot be inferred from dispatch acceptance.

On Windows, the adapter reads the conventional per-user installer shortcut at
`%APPDATA%/Microsoft/Windows/Start Menu/Programs/Roblox/Roblox Player.lnk` through
`IShellLinkW` / `IPersistFile`, without rewriting it. Its canonical target must be
`%LOCALAPPDATA%/Roblox/Versions/version-*/RobloxPlayerBeta.exe`. `WinVerifyTrust`
checks Authenticode trust using cached certificate data; the verified signer's
display name must be `Roblox Corporation`. Nova passes the shortcut's existing
arguments unchanged to `ShellExecuteW`. It does not invent Roblox flags or
manufacture protocol/authentication tickets. Missing shortcuts, custom targets,
Store installations, and unverifiable signatures are explicitly unsupported.
Windows browser requests use `ShellExecuteW` with the native-built HTTPS URL.
A return value above 32 means Windows accepted the request, not that Roblox started.
Windows runtime behavior remains unverified and is identified in the UI.

## Native persistence

`storage.rs` stores favorites and preferences with parameterized SQLite queries
and atomic transactions. Favorite order is preserved; preferences reject unknown
values and fields. Schema v2 transactionally adds `launch_requests` to the v1
`favorites`, `recent_games`, and `preferences` tables. Existing v1 rows are
preserved without reclassifying legacy recents as verified activity. Newer
schemas are rejected without downgrade. Migration failures roll back.

Only native dispatch can write `launch_requests`. A record contains action,
optional adapter or Place ID, and the acceptance timestamp. The newest 100 are
kept in an atomic insert/prune transaction. Requests enter history only after
accepted dispatch. Failed/invalid requests do not enter history. A persistence
failure after dispatch returns a successful receipt with `historySaved: false`
and a warning; it does not invite retrying an action already sent to the OS.
`load_launch_history` is separate from library saving, so a stale favorite or
preference write cannot replace request history. History is displayed as requests,
without inferred playtime, game entry, or session tracking.

Database access is serialized with a mutex. Startup errors stop initialization
with a diagnostic. Read errors surface with a retry action, and failed library
writes do not appear successful. Nova does not replace or reset corrupt data.

## Public Roblox data

`roblox_data` is a tagged, typed native command. React supplies only an action and
validated identifier/search cursor; Rust selects fixed official HTTPS endpoints.
No frontend URL, authorization header, API key, cookie or process input is accepted.
Blocking HTTPS runs off the UI thread, with system TLS, redirects disabled, a 1 MiB
response limit, 3-second connection / 8-second request timeouts and at most two
attempts. Retry-After supports delta seconds and HTTP dates. Long waits become
endpoint cooldowns rather than sleeping workers; successful exhausted quotas also
set cooldowns. Caches are bounded (128 HTTP entries, four active requests), and
explicit UI search plus request deduplication avoid per-render traffic. Profiles
and search results expire in memory; experience metadata expires for refresh but
also remains available as a timestamped offline snapshot in a separate disposable
SQLite cache, capped at 256 experiences. Per-endpoint TTLs are 60–300 seconds.

`CatalogProvider` loads cached metadata then refreshes the four curated Universe
IDs. React generation guards prevent stale searches from overwriting current UI.
All API names/descriptions/creators/stats originate from verified responses. The
only production starting data is the four IDs, not rankings or fabricated counts.
Nullable metrics and unavailable images are explicit; zero-vote approval is absent.
No development fixture is imported by production. Browser preview reports that
live data needs the desktop app; tests replace the service explicitly.

Experience `id` is the root Place ID, while `universeId` is a separate field. Only
metadata responses establish their mapping. `nova.sqlite3`, schema v2, preferences,
favorites and history are unchanged; a separate `roblox-cache.sqlite3` stores the
metadata, with revalidated identifiers and image URLs on reads. Unknown legacy
Place favorites remain visible with an official page link and explicit remove
action. The launcher never guesses a Universe ID from a Place ID or rewrites
existing favorite/history IDs. Metadata cache failures don't reset the library.

API stability, observed limits, authentication decisions and blocked features are
recorded in [the API research](milestone-03-api-research.md). Experimental public
contracts are labeled as preview; no hosted backend or new authentication exists.

## Desktop security and scope

- No password, cookie, authentication ticket, or session-token collection/storage.
- No executable modification, injection, anti-cheat interaction, Sober configuration
  changes, FastFlags, or multi-instance feature.
- No HTTP, shell, or unrestricted filesystem plugin exposed to the frontend.
- Existing public links use Tauri opener scoped to `https://www.roblox.com/*`.
  Native launch commands do not take URLs through that interface.
- Production CSP permits local assets, IPC and validated HTTPS `*.rbxcdn.com`
  images. Remote scripts, fonts, frames and browser API requests remain blocked.
  Images send no referrer; native HTTP has no authentication or cookie jar.
- Window controls are limited to the existing window operations, with surfaced
  errors. The native frame has a 900 × 640 minimum; browser layouts adapt further.
- Discord RPC, automatic updates and startup services are absent.

Dependencies remain locked. Unused reference artwork should be excluded or cleared for redistribution before packaging. See [Milestone 02 verification](milestone-02-verification.md)
for source evidence, hardware coverage, and the outstanding Windows release gate.

## Locale and search identity (Milestone 03.1)

A stable `I18nProvider` resolves `preferences.language` (`system`, `tr`, `en`),
with native OS locale detection through `system_locale` and browser navigator
fallback. Language is a backwards-compatible JSON preference, not a new SQLite
schema. The existing write queue owns persistence and rollback. English defines
the typed resource contract; Turkish must implement it completely. Named
interpolation/plural rules and Intl formatting are centralized. Original Roblox
content is never translated; known error codes select translated summaries and
verbatim diagnostics remain inspectable. Bootstrap/native reveal wait for the
selected language. Component keys and state IDs remain independent of labels.

Discover selection is restricted to filtered results and lookup generations follow
user intent. Profiles clear prior data on input edits, and continuations carry
explicit query ownership. Stale result data is ignored while consumed search
cooldowns are retained. Catalog merges prefer the newest observed snapshot and
do not modify favorites or history. See [03.1 verification](milestone-03.1-verification.md)
for root causes, precise test boundaries and native/Windows limitations.
