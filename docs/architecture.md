# Milestone 01 architecture

React owns navigation and local interaction state. `src/lib/storage.ts` is the
service boundary: Tauri IPC in the desktop app, explicitly labeled localStorage
in the browser preview. A failed write never appears as a successful favorite or
setting change. Invalid browser data is preserved, with an error and retry action.

## Native persistence

`storage.rs` stores favorites and preferences in SQLite using parameterized
queries and atomic transactions. Favorite order is preserved. Typed preferences
reject unknown enum values and fields. Schema version 1 creates `favorites`,
`recent_games`, and `preferences`; newer schemas are rejected without downgrade.
Launch history cannot be edited through the frontend save command. Database
access is serialized with a mutex. Setup errors stop startup with an explicit
diagnostic; the app never silently replaces a damaged database.

## Adapter contract

`RobloxAdapter` defines installation detection, status reads, capabilities, and
launching. Both adapters return an unsupported error for every launch request.
No launch command is registered with Tauri.

- `WindowsRobloxAdapter` compiles its filesystem check only on Windows. It reads
  `%LOCALAPPDATA%/Roblox/Versions/*/RobloxPlayerBeta.exe` without opening or modifying
  executables. Microsoft Store and nonstandard installations are not detected.
- `LinuxSoberAdapter` compiles its metadata check only on Linux. It runs
  `flatpak info --show-location org.vinegarhq.Sober` without a shell. Missing
  Flatpak or an explicit not-installed response means not found; other failures
  report unknown. Detection runs off the UI thread.
- Adapters report unsupported on other platforms. The browser reports unknown
  and explains that detection requires the desktop app.

Detection does not imply launch support or compatibility. Launch controls remain
disabled. Verified platform-specific launch methods require a separate milestone.

## Public data and fixtures

There is no Roblox API client. Catalog counts, ratings, ordering, and descriptions
are labeled samples. Profile search loads a local sample only for `Roblox`, linked
to `/users/1/profile`. Avatar art, account statistics, and live lookup are absent.
No unsupported endpoints have been introduced.

Discover and Profile have labeled loading/error preview controls. Empty states
follow from search results or an empty library. Discord and update settings
explain their unavailable status without fake connections or active toggles.

Before production distribution, replace cropped reference artwork with authorized
assets, verify public API contracts, and test Windows behavior.

## Desktop security

- No credential, authentication cookie, or password access.
- No executable modification, injection, or anti-cheat interaction.
- No HTTP, shell, or filesystem plugin exposed to the frontend.
- Tauri opener permits only `https://www.roblox.com/*` in the system browser.
- Production CSP permits local assets and IPC, with no remote scripts, fonts,
  images, frames, or data requests.
- Window controls are limited to dragging, minimizing, maximizing, and closing
  the main window. Errors are surfaced in the interface.
- The custom desktop frame has a 900 × 640 minimum size. The UI also adapts to
  smaller browser previews.
- Discord RPC, automatic updates, and startup services are absent.

Dependencies are locked in `package-lock.json` and `src-tauri/Cargo.lock`.

## CachyOS runtime note

The optimized Linux executable passed a startup smoke check and initialized a
version 1 SQLite database in an isolated temporary application data directory.
GTK emitted `gtk_window_set_titlebar() called on a realized window` during
startup with the custom frame. This warning did not stop startup or database
initialization. Native window behavior and Windows execution still need broader
platform testing before release.
