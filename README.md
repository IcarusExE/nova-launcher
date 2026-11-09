<img src="public/nova.svg" width="52" height="52" alt="Nova">

# Nova Launcher

An independent, open-source desktop home for Roblox experiences, targeting
Windows 10/11 and Linux with CachyOS as the initial development platform.

Milestone 02 adds native standalone Sober dispatch, a constrained Windows desktop
Player launch path, official experience-page fallback, and SQLite request history
to the existing five-page launcher. **Linux OS dispatch has been tested locally;
Windows runtime verification is outstanding, so Milestone 02 is not signed off as
complete.** A successful request is not proof of client startup or game entry.
Live Roblox data, Discord RPC, automatic updates, FastFlags, and multi-instance
features remain unavailable.

Milestone 02.1 adds persisted Nova Dark/Light/System themes, four accent colors,
functional card density, and stable settings saves with immediate feedback and
failure rollback. See the [settings verification report](docs/milestone-02.1-verification.md)
for root causes, regression coverage, native Linux checks, and manual steps.

## Run on CachyOS

Use Node.js 22.12+ (24 LTS recommended), npm, and current stable Rust. Install
Tauri's desktop prerequisites with your package manager:

```bash
sudo pacman -S --needed base-devel curl wget file openssl webkit2gtk-4.1 librsvg
```

If Rust is already installed with rustup, make Cargo available to this shell:

```bash
source "$HOME/.cargo/env"
npm ci
npm run tauri dev
```

For Rust installation, use the official instructions at <https://rustup.rs>.
No global npm packages are required. Linux client launching requires Flatpak and
an existing `org.vinegarhq.Sober` installation. Nova detects and runs that installed
app; it does not install Sober or modify its configuration. `xdg-open` and a default
browser provide the experience-page fallback. No account credentials are collected.

To run the UI alone:

```bash
npm run dev
```

Open <http://127.0.0.1:1420>. The web preview explicitly uses browser storage and
does not claim to detect desktop installations. The desktop app uses SQLite.

## Build and verify

```bash
npm run format:check
npm run check
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings
npm run tauri build -- --no-bundle
```

The native Linux executable is `src-tauri/target/release/nova-launcher`. Optional
installer packaging uses `npm run tauri build` and may require additional
distribution-specific tools. The Windows config selects NSIS installers.

Browser interaction tests:

```bash
npx playwright install chromium --only-shell
npm run test:e2e
```

Playwright uses a fallback Chromium build on Arch/CachyOS. Tests start and stop
their own local Vite server and save screenshots in the system temporary directory.
Native checks require GTK and WebKit on Linux. Windows builds require Microsoft
C++ Build Tools and WebView2; Windows execution must be validated on Windows
before release.

Optional real native appearance test (graphical Linux session, Python GI/AT-SPI):

```bash
python3 scripts/test-native-settings.py
```

It drives the built Tauri application with actual SQLite IPC in a temporary data
directory, including restart and forced-save failure checks. It does not touch
your library or launch external clients.

## Project layout

```text
src/
  components/       Shared shell, game UI, and installation panel
  pages/            Home, Discover, Library, Profile, Settings
  data/             Explicitly labeled development catalog
  hooks/            Persistence, detection, and launch request state
  lib/              Types and the browser/native service boundary
src-tauri/src/
  adapters/         WindowsRobloxAdapter and LinuxSoberAdapter
  storage.rs        SQLite schema, transactions, validation, tests
  launch.rs         Validated native requests and structured receipts
  lib.rs            Narrow Tauri command registration
e2e/                Browser interaction and resizing checks
docs/               Architecture, fixture, and security boundaries
```

Desktop storage is `nova.sqlite3` inside Tauri's platform-specific application
data directory for `io.novalauncher.desktop` (on Linux, normally
`~/.local/share/io.novalauncher.desktop/`). Favorites and preferences persist
across restarts. Schema v2 preserves v1 data and adds the newest 100 accepted
client/browser requests. History is written only by Rust after accepted dispatch;
it does not imply game entry or playtime, and is never fabricated or seeded.

Catalog rankings, player counts, and profile previews are **development fixtures**.
Profile search supports the sample username `Roblox`; other names show an empty
state. Public links open the real Roblox website. No login is required.

See [architecture and security](docs/architecture.md) for adapter behavior and
integration boundaries, and [Milestone 02 verification](docs/milestone-02-verification.md)
for documented mechanisms, real-hardware coverage, limitations, and manual steps. Reference artwork has separate
[provenance and redistribution limitations](public/artwork/README.md).
The application code is MIT licensed. Nova is not affiliated with Roblox or Sober.
