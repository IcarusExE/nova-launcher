# Milestone 02: implementation and verification

Verification date: November 9, 2026, Europe/Istanbul. This is a development
preview. **Milestone 02 is not signed off as complete: real Windows runtime
verification remains outstanding.**

## Launch mechanisms and evidence

| Path               | Implementation                                                                                                                                                | Evidence and limit                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Linux standalone   | `flatpak run org.vinegarhq.Sober`, no Sober flags or Place ID                                                                                                 | Documented Flatpak app dispatch; real installed Sober request accepted on CachyOS.                                                   |
| Windows standalone | Read installer shortcut, constrain target to conventional desktop Player, verify trust and Roblox publisher, `ShellExecuteW` with existing shortcut arguments | Documented Windows APIs; adapter checked against a Windows target without linking. No Windows machine/runtime test available.        |
| Experience request | Validate numeric Place ID, construct official HTTPS page in Rust, `xdg-open` / `ShellExecuteW`                                                                | Real Linux browser dispatch accepted; Windows runtime unverified. Opening a page is not joining a game.                              |
| Direct URI join    | Disabled                                                                                                                                                      | Scheme registration alone does not verify an unauthenticated join format or game entry. No fabricated launch/authentication tickets. |

Primary sources consulted:

- [Flatpak `run` reference source](https://github.com/flatpak/flatpak/blob/main/doc/flatpak-run.xml):
  `REF` names the installed app; additional arguments would be forwarded to it.
  Nova supplies no application arguments.
- [Sober Flathub manifest](https://github.com/flathub/org.vinegarhq.Sober/blob/master/org.vinegarhq.Sober.yml):
  application ID, default `sober` command, and installation of its desktop entry.
- Installed `/var/lib/flatpak/exports/share/applications/org.vinegarhq.Sober.desktop`:
  `MimeType=x-scheme-handler/roblox;x-scheme-handler/roblox-player;` and Flatpak
  URI forwarding in its `Exec` entry. `xdg-mime query default
x-scheme-handler/roblox-player` returned `org.vinegarhq.Sober.desktop` on this
  host. This establishes registration, not a ticket-free join URI contract.
- [XDG OpenURI portal](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.OpenURI.html):
  URI opening is a request with asynchronous response, not game-state feedback.
  Nova currently runs as a host desktop application and uses the desktop's
  `xdg-open` HTTPS dispatch. It does not issue a custom portal request or change
  MIME/portal registrations. Portal-mediated dispatch depends on the desktop and
  packaging; sandboxed Nova/portal integration needs separate runtime testing.
- [Windows `IShellLinkW`](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-ishelllinkw),
  [`IPersistFile::Load`](https://learn.microsoft.com/en-us/windows/win32/api/objidl/nf-objidl-ipersistfile-load),
  [`ShellExecuteW`](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shellexecutew),
  and [`WinVerifyTrust`](https://learn.microsoft.com/en-us/windows/win32/api/wintrust/nf-wintrust-winverifytrust):
  inspect existing shortcut configuration, verify signed software, and ask the
  Windows shell to open it. No Roblox-specific undocumented arguments are created.

Sober's general documentation and Roblox's help page were also attempted, but
access was intermittently denied (HTTP 403). No unsupported URI format was inferred
from unavailable pages. Registered `roblox-player` mechanisms commonly carry
client-specific launch context; this milestone does not generate that context.

## Real hardware coverage

Reference host: CachyOS Linux, Wayland desktop, Flatpak Sober **1.8.0**, stable
x86_64, `org.gnome.Platform/x86_64/51`, installed system-wide. Installed Sober
commit: `a611b863277f7d33c448111a728c857b8a92cac006da0d33f6d053b1e585106a`
(2026-11-05 build).

The ignored manual integration tests were explicitly run on this host using the
production native backend and SQLite. Both a real `flatpak run` request and a
real `xdg-open` request for Place `2753915549` returned accepted receipts and
persisted records in an in-memory test database. Sober was already running when
this test began. Nova did not terminate it or edit its configuration. This test
verifies OS dispatch and persistence, not cold-start readiness, sign-in, successful
game entry, rendering/audio, or client survival after dispatch. The browser test
opens a real page but does not press Play or authenticate.

No Windows runtime, Store installation, Windows signature/publisher behavior,
installer-shortcut arguments, or Windows default-browser dispatch has been
verified on hardware. The Windows adapter passed an isolated Windows GNU target
compile and strict Clippy check against its actual source. That is not a full
Windows Tauri build or runtime test. A Windows CI job now covers application
build/tests on future runs; that job was not run from this Linux session and
will not have an installed Roblox client by default.

## Automated coverage

- Frontend: original favorite/settings/profile/navigation/storage tests, plus
  native-IPC simulations for standalone dispatch, missing installation, browser
  fallback, structured failure, pending-state duplicate prevention, and accepted
  dispatch with a history-save warning.
- Rust unit tests: Flatpak installation/missing executable/missing Sober cases,
  dispatch rejection, real trivial process spawn/exit failure handling, original
  library validation and transaction tests.
- Rust integration tests: validation before dispatch, unknown IPC fields/actions,
  accepted client/browser requests, rejected/unsupported requests, history ordering,
  v1 migration preservation, file close/reopen persistence, history write protection, read-only SQLite failure,
  atomic retention rollback, and history read errors.
- Browser: original navigation/favorite persistence/dialog/filter/resize flow plus
  a separate **simulated native IPC** flow for loading, failure, retry, accepted
  browser fallback, and request history. This browser test does not execute Rust
  or Roblox; real dispatch is covered separately above.
- Manual integration tests are ignored in routine runs and CI because they open
  real desktop applications. They are run only explicitly.

## Local check results

| Check                                                 | Result                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| Prettier and TypeScript                               | Passed                                                             |
| Frontend unit/integration tests                       | 18 passed                                                          |
| Rust automated unit/integration tests                 | 18 passed; 2 manual dispatch tests ignored by default              |
| Explicit real Linux dispatch tests                    | 2 passed: Sober and official-page browser requests                 |
| Rust formatting and strict Clippy                     | Passed                                                             |
| Playwright browser flows                              | 2 passed, including simulated native IPC and 390–1440 px layouts   |
| Vite production build                                 | Passed                                                             |
| Optimized Linux Tauri build (`--no-bundle`)           | Passed                                                             |
| Optimized native startup with isolated app data       | Passed; schema v2 initialized; no fabricated requests              |
| Isolated Windows adapter target check / strict Clippy | Passed; no Windows linking or execution                            |
| Full Windows application build / client runtime       | Not run locally; Windows hardware verification remains outstanding |

The optimized Linux startup emitted the previously documented GTK warning
`gtk_window_set_titlebar() called on a realized window`. Initialization and the
startup smoke check succeeded. Installer packaging (AppImage/deb/rpm/NSIS) was
not exercised; the optimized native executable was built directly.

## Reproduce and manually verify

Run the app on Linux with `source "$HOME/.cargo/env"` then `npm run tauri dev`.
For an optimized build, use `npm run tauri build -- --no-bundle` and run
`src-tauri/target/release/nova-launcher`.

1. In Settings → Launcher, rescan. Confirm the matching installed client is shown;
   Windows should be unavailable on Linux. Select Auto or Sober. A foreign or
   missing selection must keep Launch Roblox disabled.
2. With a desktop session available, use Launch Roblox. Confirm the pending state,
   then inspect the actual Sober window yourself. An accepted-request notice alone
   does not establish startup. Check Home / Library → Recent requests and restart
   Nova to confirm SQLite persistence. Avoid repeated launches while the client
   is starting. Nova does not provide a multi-instance mode.
3. Open a fixture game's details and choose Open experience page. Confirm the
   default browser opens exactly `https://www.roblox.com/games/{placeId}`. The UI
   must identify this as a browser request. Joining, if desired, is a separate
   action on Roblox's website. The catalog metadata remains a fixture.
4. Test missing dependencies on an isolated machine/profile without Flatpak or
   Sober; do not uninstall or alter a working client to test this. Rescan should
   explain the missing dependency and disable client launching. Browser fallback
   remains independent. Automated tests cover these cases without modifying PATH.
5. In an isolated writable test database, verify accepted requests survive restart.
   Use the automated read-only/rollback tests for storage failures; do not corrupt
   your real library. A post-dispatch storage failure must warn without claiming
   the launch failed or prompting an automatic retry.

Explicit real dispatch smoke tests (open applications; never part of CI):

```bash
cargo test --manifest-path src-tauri/Cargo.toml --test launch_flow real_native_client_dispatch -- --ignored --nocapture
cargo test --manifest-path src-tauri/Cargo.toml --test launch_flow real_browser_dispatch -- --ignored --nocapture
```

For Windows 10 and 11, install the official per-user desktop Player from Roblox
and verify the installer-created Start Menu shortcut exists. Build with the
normal Windows Rust/MSVC and Tauri prerequisites, then run all checks. Verify
rescan resolves the active Player, accepts its current Roblox publisher
certificate, preserves its installer-supplied launch arguments, opens the client
and default-browser page, and saves accepted requests across restart. Check absent
shortcut, removed executable, unsupported Store/custom installations, and rejected
shell dispatch. Signature verification is deliberately fail-closed and uses cached
trust information; offline/certificate-store behavior needs explicit testing.
Do not remove the Windows runtime caveat or sign off Milestone 02 until these
checks have evidence from real Windows installations.
