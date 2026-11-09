# Milestone 03.1 — localization, search consistency and UI polish

Baseline: `ce9e234` (Milestone 03). Implementation and verification on CachyOS
Linux, November 9, 2026. No commit or push was performed. The existing Tauri 2,
React/TypeScript, Rust and SQLite architecture, design tokens, launcher adapters,
public-data service and accepted-request history remain in place.

## Root causes and resulting behavior

| Issue                                 | Exact baseline cause                                                                                                                                                                                                        | Change and regression evidence                                                                                                                                                                                                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| English-only interface                | Owned text lived in JSX, label arrays and interpolated templates. `Preferences` had no language field. Compact metrics explicitly used English; other dates used implicit browser formatting.                               | One typed resource contract and complete English/Turkish resources; persisted language and explicit locale-aware Intl formatting. Resource parity, placeholder/plural, source-coverage and locale tests.                                                                                                                                |
| Discover details outside filters      | Selection used `catalog.experiences.find(selectedId) ?? results[0]`, so a selected item could survive even when absent from `results`. The fallback was not committed as the current selection.                             | Selection resolves only inside filtered results, with a committed valid fallback or null. Valid selections survive sorting, refresh and locale changes; removed selections cannot reappear when filters clear. Unit and browser tests cover these states.                                                                               |
| Late Universe lookup overrides intent | `lookupVersion` changed for Universe input, submission and unmount only. Changing a local filter or clicking another card left the old request eligible to clear filters and replace selection.                             | New search/filter/sort/favorites/card intent invalidates the pending UI request. Layout-phase invalidation also handles externally updated search state. Latest accepted explicit lookups reveal and select the returned root Place ID; late responses cannot change newer intent. Concurrent and reversed-completion tests cover this. |
| Metadata response ordering            | Cache hydration used `setCatalog(saved)` and lookup/refresh merges could replace a newer observation with an older response.                                                                                                | Bounded existing native caching stays unchanged; the frontend merge retains the newest observed metadata per Place ID and prefers fresh over cached data at equal timestamps. Delayed-response tests cover preservation. This does not claim server data is newer than its observation time.                                            |
| Old profile mistaken for edited input | Editing incremented a request version and reset status/error, but retained `profile`, `page` and `searched`. The old More users button could start a new request using old `searched` while the input showed another query. | Editing/clearing consistently removes prior profile and pagination. Editable input, submitted identity and each page's query are separate. Continuations must belong to the active submitted query; selected-user, search and continuation responses share an intent guard.                                                             |
| Profile cooldown after stale search   | The version guard returned before processing an old search's quota information. A discarded result could still have consumed the native endpoint quota.                                                                     | Search cooldown metadata is retained even when its result is discarded; unrelated exact-profile quotas do not disable user search. Timers stop at expiry/unmount. Tests prove old results stay hidden while the current input respects the search cooldown.                                                                             |
| Modal keyboard escape from content    | The baseline relied on native dialog behavior, with no explicit edge handling for Tab and no close/focus cleanup when React removed the dialog. Playwright reproduced Shift+Tab leaving the modal content.                  | Visible enabled controls wrap at Tab edges. Closing restores the connected opener without scrolling. Ctrl/Cmd+K closes a game dialog before focusing Discover. Locale updates do not reopen the dialog. Real browser keyboard tests cover wrapping, Escape, opener focus and the shortcut.                                              |

Cached catalog refresh now keeps its spinner inside the existing refresh control,
so completing the request does not remove a separate loading block. Profile
pagination keeps the current list in place with a compact busy indicator instead
of inserting a full loading panel above it. A browser geometry regression checks
the heading does not jump while a continuation is pending. Initial profile states
share a minimum result-panel height; asynchronous results may still legitimately
increase the space needed for original content.

The existing serialized preference queue was retained. Language changes apply as
optimistic patches, rebase with later changes, and share the same failure rollback
as appearance changes. Components and React keys use stable IDs, never translated
labels. Language selection changes text without remounting the app, settings
panel, select or game cards. Browser tests assert DOM identity, keyboard focus,
scroll position and persisted appearance. A source regression guards against
translated React keys.

## Localization architecture and persistence

- `src/i18n/en.ts` defines the canonical typed message-key contract. Turkish
  `tr.ts` must satisfy exactly that resource shape. Source-English message IDs
  keep the original copy recognizable; they are stable identifiers, not runtime
  attempts to translate fetched text. Both resources are bundled locally.
- A small context provider exposes typed `t`, number/percent/date formatting and
  relative time. Translation supports named interpolation and one/other plural
  resources selected by `Intl.PluralRules`. Dates, compact counts, percentages,
  sorting and request-relative times use the active locale through Intl. No new
  npm or runtime service dependency was introduced.
- `preferences.language` accepts `system`, `tr`, `en`. Missing old JSON fields
  default to `system` in both Rust and frontend validation; unknown/null values
  are errors, not silent replacements. Schema version remains **2**. Loading an
  old preference row does not rewrite it; the field is serialized on a normal
  explicit save through the existing transaction/queue.
- Manual Turkish/English selection overrides automatic detection. Browser preview
  uses the primary navigator language and follows `languagechange`. Native startup
  uses the narrow `system_locale` command: Linux environment precedence is
  `LC_ALL`, `LC_MESSAGES`, `LANGUAGE` (first entry), then `LANG`; Windows uses
  `GetUserDefaultLocaleName`. Turkish locale variants resolve to `tr`, all others
  to `en`. Native OS locale is read at startup; restart after changing the OS
  language. No machine locale setting is modified.
- Browser bootstrap applies saved/manual or detected document language before
  React loads. The existing hidden native window is revealed only after SQLite,
  selected locale and appearance hydration. React keeps the root pending during
  initialization. Document `lang`, localized title and description metadata update
  with the active language. There is no translated app key or document reload.

## Translation coverage and diagnostic policy

Both locales contain **299 typed message keys**. English and Turkish cover all application-owned navigation, headings, copy,
controls, option labels, placeholders, tooltips, accessible labels, dialogs,
loading/empty/offline states, notices, save states and error summaries. Build-time
resource typing and regression tests check identical keys, nonempty translations,
placeholder parity and plural forms. A TypeScript AST audit of App, pages and
shared components guards new untranslated JSX text and accessible/control labels.

Proper names (Nova Launcher, Roblox, Sober, platform/technology names), language
self-names, version numbers, keyboard notation and numeric IDs stay unchanged.
Roblox names, creator names, descriptions, genres, usernames and biographies are
original external content; none is submitted to the translator.

`LocalizedError` maps every known public API and launch error code to a localized
message, including Retry-After countdown interpolation. Unknown codes use a
localized fallback. Native/storage operation context selects actionable fallback
messages. Original diagnostic text and structured error codes remain available
under localized Technical details; they are intentionally verbatim and are not
presented as translated application copy. Adapter diagnostics/paths are similarly
preserved. No arbitrary server-returned string is guessed to be a translation
key. **No application-owned translation is knowingly missing**; verbatim external
content and technical diagnostics are intentional exceptions.

## Files changed

| Area                      | Files                                                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Translation system        | `src/i18n/{en,tr,types,core}.ts`, `src/i18n/index.tsx`, `src/i18n/i18n.test.tsx`                                                                                                         |
| App/bootstrap             | `src/App.tsx`, `public/appearance-bootstrap.js`                                                                                                                                          |
| Existing pages            | `src/pages/{Home,Discover,Library,Profile,Settings}.tsx`                                                                                                                                 |
| Shared UI                 | `src/components/{Shell,ui,InstallationPanel,RequestHistory,LaunchFeedback}.tsx`, new `LocalizedError.tsx`, `src/styles.css`                                                              |
| Frontend boundaries/state | `src/lib/{types,storage,roblox}.ts`, `src/hooks/useCatalog.tsx`, `src/hooks/useLibrary.ts`, `src/hooks/useLauncher.tsx`                                                                  |
| Native                    | `src-tauri/src/{lib,storage}.rs`, new `locale.rs`, `src-tauri/Cargo.toml` (existing Windows crate locale feature only)                                                                   |
| Tests                     | `src/lib/storage.test.ts`, `src/test-setup.ts`, `src/search-consistency.test.tsx`, `src-tauri/tests/appearance_storage.rs`, `e2e/public-data{,.spec}.ts`, new `e2e/localization.spec.ts` |
| Native harnesses/docs     | `scripts/test-native-settings.py` (deterministic subprocess locale and bilingual close), new `scripts/test-native-localization.py`, this report and README/architecture notes            |

The launcher adapter implementations, native dispatch, SQLite tables/migrations,
public API endpoints and HTTP policy, stored favorite/history ID meaning and
shared theme/accent tokens are unchanged. No production fixture switch or hosted
backend was added.

## Checks and results

| Check                                                         | Final result                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Strict TypeScript                                             | Passed                                                                                  |
| Prettier                                                      | Passed                                                                                  |
| Rustfmt / Clippy with warnings denied                         | Passed                                                                                  |
| Vitest                                                        | 43 passed, 8 files                                                                      |
| Playwright                                                    | 14 passed, including 5 new Turkish/localization/identity/keyboard flows                 |
| Rust unit/integration                                         | 36 passed; two external-launch tests remain opt-in; public API test executed separately |
| Vite production / optimized Linux Tauri build (`--no-bundle`) | Passed; final assets rebuilt after UI changes                                           |
| Actual Linux Tauri language/SQLite harness                    | Passed                                                                                  |
| Existing native appearance and public-data harnesses          | Passed                                                                                  |
| Actual read-only Roblox API contract and pagination           | Passed after honoring server cooldown; first live run returned an empty search result   |

An initial Vitest run had a worker-startup timeout while checks were running;
subsequent complete runs finished without unhandled errors. The new modal
keyboard regression initially failed and passed after the focus fix. Native
language testing initially waited for the old System option label after the UI
had already switched languages; its driver now verifies the real SQLite value and
new accessible label rather than the obsolete text.

The first opt-in network run fetched real metadata/profile/avatar successfully,
but user search returned a valid empty result and the existing strict nonempty
assertion failed. A separate anonymous read returned 10 results and a continuation
cursor. After the reported reset, the **unchanged** strict native contract test
passed, including a distinct second page after its cooldown. No fixture was
substituted and no assertion was weakened. Experimental Roblox search availability
and result variability remain an upstream risk.

## Native CachyOS verification

The built Tauri/WebKit application was driven through AT-SPI using isolated
`XDG_DATA_HOME` directories, real Rust commands and actual SQLite files. No mocked
IPC was used for these native claims:

1. Empty native preferences plus Turkish OS message locale display Turkish.
2. Manual English applies immediately in the same accessible select, writes
   SQLite, and overrides a Turkish OS on restart.
3. System mode returns to Turkish; saved manual Turkish then overrides an English
   OS on restart; returning to System displays English.
4. Theme Light, Teal accent, compact cards and reduced motion survive locale
   changes/restarts. Favorites, accepted history, launcher/start-page preferences
   and schema version 2 remain intact.
5. Existing appearance tests still cover rapid switches, actual SQLite transaction
   rejection/rollback/recovery, restart and corrupt preference handling.
6. Existing public-data GUI tests still fetch actual experience metadata/artwork
   URLs/votes, persist the separate cache, show the correct official Place link,
   retain unknown legacy favorites and produce no fabricated launch history.

Baseline appearance/public-data harnesses force a C locale only for their own
subprocesses so their English selectors are reproducible. The language harness
explicitly overrides that subprocess environment. Nonfatal GTK popup-unmap
warnings were emitted while all assertions passed.

Native GUI **Profile and Universe text-entry submission and modal key synthesis**
remain unverified on this host: the previously documented WebKit/AT-SPI input
limitation remains. Those form, race and keyboard flows are tested in real
Chromium with isolated API fixtures, while real native HTTP contracts are verified
separately. Mocked browser IPC is not counted as native hardware evidence.

## Windows limitations and remaining work

Windows launch adapters were not rewritten. OS language detection uses the official
Win32 locale API, with its installed binding signature checked during development;
Windows runtime, locale changes, keyboard behavior and installer packaging were
not verified on Windows hardware. Linux builds and Clippy do not substitute for
that verification. The existing Windows runtime release gate remains.

No Milestone 03 API restriction was removed: global keyword experience discovery
and arbitrary anonymous Place-to-Universe resolution remain unavailable. Public
metadata/username/search contracts remain experimental. There is no login,
credential/cookie collection, client modification, injection, Discord RPC or
updater. Recommended next steps are Windows hardware verification, native WebKit
form/keyboard checks when a suitable driver is available, and ongoing monitoring
of the already documented Roblox API contracts. Do not add fallback scraping or
embed shared credentials to address unavailable results.

## Manual verification

Run `npm run tauri dev` after sourcing Cargo if necessary. In Settings → Appearance,
choose Language → System default / Türkçe / English. Verify the title, navigation,
all five pages, save state and accessible control names change immediately. Keep
the selector focused while switching; the panel, scroll and focus should remain.
Change theme/accent/density/motion, restart and confirm every preference remains.
Native System mode follows the process's OS message locale at startup.

Discover: select Blade Ball, filter to another game, then to no matches. The detail
panel must remain within the results or become empty. Start a Universe lookup and
immediately filter/select another card; its late completion must not reset that
intent. An accepted latest lookup of Universe `994732206` must open the official
Place `2753915549` page rather than treating the Universe ID as a Place ID.

Profile: submit `Roblox`, edit before/after completion and start another search.
Old profile/page data must disappear on editing; no old continuation may populate
the newer query. Use Find users only explicitly, respect the displayed cooldown,
and try More users. Test no-results/offline feedback and inspect Technical details
for unchanged diagnostics. Opening a website is not reported as joining a game.

Keyboard: open an experience dialog, cycle Tab/Shift+Tab, close with Escape and
check focus returns to its opener. Ctrl/Cmd+K should focus Discover search. Resize
to 900×640 and narrower browser previews in both languages; check long original
Roblox names, translations, compact cards, user/system reduced motion and scroll.

Reproducible commands:

```bash
npm run format:check
npm run check
npm test
npm run test:e2e
npm run build
source "$HOME/.cargo/env"
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml --locked -j2
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -j2 -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --locked -j2 --test public_api -- --ignored --nocapture
CARGO_BUILD_JOBS=2 npm run tauri build -- --no-bundle
python3 scripts/test-native-localization.py
python3 scripts/test-native-settings.py
python3 scripts/test-native-public-data.py
```

Run GUI harnesses sequentially in a graphical Linux session with Python GI/AT-SPI.
Run the real-network test one copy at a time; it respects public search cooldowns.
The external client/browser dispatch tests stay opt-in to avoid launching other
applications during localization checks.
