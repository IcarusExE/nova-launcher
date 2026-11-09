<img src="public/nova.svg" width="52" height="52" alt="Nova">

# Nova Launcher

An independent, open-source desktop home for Roblox experiences. Milestone 01
targets Windows 10/11 and Linux, with CachyOS as the initial development platform.

This milestone provides five navigable pages, a local development catalog,
favorites, library grid/list views, profile-search previews, persisted settings,
and read-only installation detection. **Roblox launching, live Roblox data,
Discord RPC, and automatic updates are not implemented.**

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
No global npm packages are required. Flatpak is optional and is used only to
inspect `org.vinegarhq.Sober`. Nova does not install or run Sober. The minimal
stable Rust toolchain was installed during this development task.

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

## Project layout

```text
src/
  components/       Shared shell, game UI, and installation panel
  pages/            Home, Discover, Library, Profile, Settings
  data/             Explicitly labeled development catalog
  hooks/            Persistence state and write handling
  lib/              Types and the browser/native service boundary
src-tauri/src/
  adapters/         WindowsRobloxAdapter and LinuxSoberAdapter
  storage.rs        SQLite schema, transactions, validation, tests
  lib.rs            Narrow Tauri command registration
e2e/                Browser interaction and resizing checks
docs/               Architecture, fixture, and security boundaries
```

Desktop storage is `nova.sqlite3` inside Tauri's platform-specific application
data directory for `io.novalauncher.desktop` (on Linux, normally
`~/.local/share/io.novalauncher.desktop/`). Favorites and preferences persist
across restarts. The launch-history table is reserved for future verified native
launches; no history is fabricated or seeded.

Catalog rankings, player counts, and profile previews are **development fixtures**.
Profile search supports the sample username `Roblox`; other names show an empty
state. Public links open the real Roblox website. No login is required.

See [architecture and security](docs/architecture.md) for adapter behavior and
integration boundaries. Reference artwork has separate
[provenance and redistribution limitations](public/artwork/README.md).
The application code is MIT licensed. Nova is not affiliated with Roblox or Sober.
# nova-launcher
