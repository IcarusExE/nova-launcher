# Milestone 02.1 — appearance and settings stability

Verified on November 9, 2026, on the CachyOS Linux development host.

## Root causes and evidence

| Issue                             | Cause in the previous implementation                                                                                                                                                          | Evidence and correction                                                                                                                                                                                                                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color theme could not be changed  | `Settings.tsx` rendered a static span, with no input or handler. Neither TypeScript nor Rust preferences contained a theme. Most component colors were hardcoded for dark mode.               | Replaced the placeholder with a labeled native select, typed persisted values, and semantic palettes shared across the existing pages.                                                                                                                                                                                |
| Accent was a single static swatch | The swatch was a div without interaction, a preference field, or a shared palette. Purple colors were repeated throughout the stylesheet.                                                     | Added an accessible radio group with keyboard navigation and four centralized accent palettes. Navigation, selected controls, buttons, switches, and focus indicators use those tokens. The Nova brand artwork retains its identity.                                                                                  |
| Switch flicker and lost focus     | `useLibrary.commit` awaited storage before publishing the new value. `Settings` disabled every control whenever `library.saving` was true. The global disabled style reduced opacity to 0.45. | A Playwright reproduction with a 700 ms IPC delay measured the old value, disabled=true, opacity=0.45, and lost focus during a save. The original switch and settings panel were still the same DOM nodes. Controls now update immediately and stay enabled while saving.                                             |
| Lost rapid interactions           | The `writing.current` early return discarded every update while another write was pending. Each write carried a whole library snapshot.                                                       | One queue serializes favorites and preference operations, building each write from the last acknowledged snapshot. Pending preference patches are applied immediately and rebased after each result. Later intent survives an earlier failure; failed patches roll back. Favorites retain acknowledged-only behavior. |
| Hydration races                   | Reloads and writes were independent. An older load could replace newer data, and explicit reload could run while a write was pending.                                                         | Reload waits for the writer, blocks new edits until it finishes, and uses a generation guard to discard stale reads. Normal saves never trigger a reload or loading screen.                                                                                                                                           |
| Incomplete compact density        | Compact grid rules already existed, but list artwork retained fixed 125×90 dimensions.                                                                                                        | Grid behavior is retained; compact list artwork becomes 96×64, with denser copy and aligned favorite buttons. Browser tests compare actual grid/list heights; the native test also compares real WebKit grid heights.                                                                                                 |
| Reduce motion appeared unreliable | Reduced-motion CSS and the OS media query already existed. The shared delayed-save/disable behavior made the switch lag and fade.                                                             | Preserved both motion rules, fixed the write path, clarified the OS behavior, and tested transition suppression with either the setting or OS preference. Loading text remains available even when spinners stop.                                                                                                     |
| Startup appearance                | React previously rendered default preferences before asynchronous SQLite hydration, and the native window was immediately visible.                                                            | The desktop window starts hidden and is revealed after hydration and token application, including a visible error fallback. Browser preview loads the same palette CSS and a local blocking bootstrap before React. No CSP relaxation or native localStorage authority was introduced.                                |

There were no settings-triggered React key changes or actual settings-page
remounts. Mount-only loading was not rerunning after every save. The fix does not
force remounts, reload the page, reset scroll, or add a new state-management library.
React still reconciles the active page when preferences change; unrelated DOM
nodes remain intact.

## Behavior and persistence

- Themes: Nova Dark (default), Light, System. System mode subscribes to operating
  system color-scheme changes without changing the stored `system` preference.
- Accents: Nova Violet (default), Blue, Teal, Amber. Radio controls support Tab,
  arrows, Home/End, Space, and Enter with visible selection and focus indicators.
- All non-artwork colors live in `public/appearance.css` as semantic tokens.
  Dark artwork overlays have separate tokens so light mode remains readable.
- Theme/accent fields are added to the existing JSON preference row. Rust uses
  per-field defaults for legacy rows. Schema version stays **2**; existing
  migrations, favorite order, adapter preferences, legacy recents, and native
  launch history are preserved. Invalid explicit values are reported, not reset.
- Preferences update optimistically. A stable saving status accompanies pending
  writes. A failure shows the existing actionable error banner and `Save failed`,
  restores acknowledged values for the failed patch, and retains later patches.
  Reload waits for all pending writes before reading SQLite.
- Compact density and reduced motion use CSS on the existing component tree.
  The OS reduced-motion preference is always respected, even with the switch off.
- The native `reveal_main_window` command accepts a typed theme and sets the
  background before showing the calling window. It does not accept scripts,
  paths, executable names, or URLs. It does not wait for animation-frame callbacks
  while the WebKit window is hidden.
- Browser preview continues to use explicitly labeled browser storage. Desktop
  settings remain in SQLite. No credentials or authentication data are involved.

## Changed files

| Area                                     | Files                                                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Controls and application integration     | `src/pages/Settings.tsx`, `src/App.tsx`, new `src/hooks/useAppearance.ts`                                                              |
| State and typed storage                  | `src/hooks/useLibrary.ts`, `src/lib/types.ts`, `src/lib/storage.ts`, `src-tauri/src/storage.rs`                                        |
| Shared palettes and first paint          | `src/styles.css`, new `public/appearance.css`, new `public/appearance-bootstrap.js`, `index.html`                                      |
| Native window startup                    | `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`                                                                                    |
| Frontend tests and test setup            | new `src/hooks/useLibrary.test.tsx`, `src/lib/storage.test.ts`, `src/launch.test.tsx`, `src/test-setup.ts`                             |
| Interaction and native integration tests | new `e2e/settings.spec.ts`, `e2e/launcher.spec.ts`, new `src-tauri/tests/appearance_storage.rs`, new `scripts/test-native-settings.py` |
| Documentation                            | `README.md`, `docs/architecture.md`, this report                                                                                       |

The Windows/Sober adapters and dispatch implementation are unchanged. No new npm
or Rust dependencies were added. The AT-SPI test uses optional system Python/GI
packages already installed on the development host.

## Automated checks

| Check                                                                        | Result                                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Prettier (`npm run format:check`)                                            | Passed                                                        |
| TypeScript (`npm run check`)                                                 | Passed                                                        |
| Frontend unit/regression suite (`npm test`)                                  | 24 passed                                                     |
| Frontend production build (`npm run build`)                                  | Passed                                                        |
| Rust formatting                                                              | Passed                                                        |
| Rust tests (`cargo test --locked`)                                           | 22 passed; 2 explicit app/browser launch tests remain ignored |
| Strict Clippy (`--all-targets -- -D warnings`)                               | Passed                                                        |
| Playwright (`npm run test:e2e`)                                              | 7 passed, including the 2 existing launcher flows             |
| Optimized native build (`npm run tauri build -- --no-bundle`)                | Passed                                                        |
| Real native settings integration (`python3 scripts/test-native-settings.py`) | Passed: all 4 native scenario groups                          |

Playwright covers all themes and accents, keyboard selection, live system media
changes, preview restart, delayed IPC, 14 rapid/mixed changes with one writer,
rollback with later successful intent, focus/scroll/bounds/DOM identity stability,
actual grid/list density, user/OS reduced motion, and bootstrap before React.
Contrast checks cover accent button text, accent text on selected surfaces,
secondary text, and focus color in both palettes and all four accents (at least
4.5:1 in the tested combinations). This is targeted contrast coverage, not a full
accessibility certification.

The native integration script drives the actual optimized Tauri/WebKit application
through Linux AT-SPI, exercises real commands and SQLite writes, closes/restarts
the app, and forces a SQLite trigger rejection to test UI rollback and recovery.
It uses a temporary `XDG_DATA_HOME`, enables accessibility only for its own process,
and terminates only that process. Its history/favorite fixtures exist only in
that disposable database. It does not launch Sober/Roblox or open external sites.

## Hardware coverage and limitations

- Real CachyOS native coverage: window visibility after hydration, theme selection,
  accent changes, rapid switches, grid density, SQLite failure/recovery, restart
  restoration, corrupt-preference startup fallback, and preservation of isolated
  favorite/history rows and schema version.
- Dynamic OS light/dark and reduced-motion changes are covered with browser media
  emulation. Live changes in the CachyOS desktop settings and visual first-frame
  inspection remain manual checks; the automation does not provide a pixel-level
  startup recording.
- Windows was not run on real hardware for this milestone. Windows launch support
  remains subject to the existing Milestone 02 runtime verification gate.
- WebKitWebDriver and tauri-driver are unavailable on this host; the native test
  uses AT-SPI instead of mocked browser IPC. Slow saves/races are deliberately
  injected in browser/unit tests because real local SQLite normally finishes fast.
- Native GTK may emit a nonfatal popup-unmapping warning when the accessibility
  test closes a window after interacting with the platform select popup.
- Installer bundles were not generated; the optimized executable was built.
  Existing explicit real-client/browser launch tests were not rerun, since this
  task changes appearance rather than dispatch and those tests open external apps.

## Manual verification on CachyOS

1. Run `source "$HOME/.cargo/env"` if needed, then `npm run tauri dev`. For the
   optimized build, run `npm run tauri build -- --no-bundle` and launch
   `src-tauri/target/release/nova-launcher`.
2. Open Settings → Appearance. Select Light, Nova Dark, and System. Inspect Home,
   Discover, Library, Profile, and Settings, including detail dialogs, inputs,
   selected navigation, icons, errors, and window controls.
3. In System mode, change the desktop's application color scheme between light
   and dark. Nova should follow without reopening; explicit Light/Nova Dark should
   stay fixed. Choose each accent and check selected navigation, buttons, switches,
   filters, selections, and focus rings. Use arrow/Home/End keys in the swatch group.
4. Toggle Compact game cards rapidly, then inspect Home, Discover, and Library in
   both grid and list views. The artwork/copy should become denser. Return to
   Settings and toggle both switches with Space while scrolling the settings
   pane. Focus and scroll should remain stable during saves.
5. Toggle Reduce motion and check the switch transition. With it off, enable the
   desktop reduced-motion preference and check again. Selection/loading feedback
   should remain understandable without motion.
6. Choose Light + Teal (or any combination), enable compact cards and reduced
   motion, wait for `Saved on this device`, close Nova, and reopen. Preferences
   should be restored, with no visible dark content flash before light mode.
7. To reproduce safe native failure/restart checks without touching your library,
   run `python3 scripts/test-native-settings.py` after building. It requires a
   graphical session, Python GI, and the Atspi 2.0 typelib (on CachyOS/Arch these
   are provided by `python-gobject` and `at-spi2-core`). It temporarily opens Nova
   windows and uses a disposable database; do not edit your personal database to
   force failures.
