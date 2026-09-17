# CharmDesk

CharmDesk is a lightweight desktop companion that keeps a small,
always-on-top charm on your screen. The current charm is Ganesha: click him
to perform a ritual — a diya circles him with a soft chime and a shower of
petals. Built with Electron, so the same codebase runs on both Windows and
macOS.

The charm collection is designed to grow. [charms/charms.js](charms/charms.js)
defines the available charms as a simple list; adding a new one is a matter
of supplying new artwork and a ritual, following the pattern Ganesha already
establishes.

## Installation

### Windows

1. Download `CharmDesk Setup <version>.exe` from the [Releases](../../releases) page.
2. Run the installer. Windows SmartScreen may show "Windows protected your
   PC" because the build isn't code-signed — select **More info → Run
   anyway** to continue.
3. Complete the install wizard. CharmDesk launches automatically and adds a
   Start Menu shortcut.

### macOS

1. Download `CharmDesk-<version>.dmg` from the [Releases](../../releases) page.
2. Open the disk image and drag **CharmDesk.app** into **Applications**.
3. On first launch, right-click the app and choose **Open** — the app isn't
   notarized, so a direct double-click is blocked by Gatekeeper once.
4. If macOS instead reports **"CharmDesk" is damaged and can't be opened**,
   that's Gatekeeper's quarantine flag on an unsigned download, not actual
   corruption. Clear it from Terminal, then open the app normally:
   ```bash
   xattr -cr /Applications/CharmDesk.app
   ```

### Run from source

Requires [Node.js](https://nodejs.org) 18 or later and git.

```bash
git clone https://github.com/Viv3ksGit/CharmDesk.git
cd CharmDesk
npm install
npm start
```

On first launch the charm appears near the top-right of the primary display;
its position is remembered afterward.

## Usage

- **Click** the charm to perform its ritual.
- **Drag** the charm to reposition it anywhere on screen.
- **Right-click** the charm, or use the **system tray icon** (Windows) /
  **menu bar icon** (macOS), to access: Show/Hide, Perform ritual, toggle
  petal animation, resize, change the charm image, Start with Windows/at
  Login, and Quit.
- **Global shortcuts**: `Ctrl+Shift+D` toggles visibility, `Ctrl+Shift+R`
  performs the ritual, `Ctrl+Shift+=` / `Ctrl+Shift+-` resize the charm.

## Building installers

Packaging uses [electron-builder](https://www.electron.build/).

```bash
npm run dist:win   # -> dist/CharmDesk Setup <version>.exe (build on Windows)
npm run dist:mac   # -> dist/CharmDesk-<version>.dmg (build on macOS)
```

Neither build is code-signed, which triggers the SmartScreen/Gatekeeper
warnings above — expected behavior for an unsigned application, not an
indication of a problem.

### Automated releases

[.github/workflows/release.yml](.github/workflows/release.yml) builds both
installers on GitHub-hosted Windows and macOS runners and publishes them to
a GitHub Release automatically. It triggers on any tag matching `v*.*.*`:

```bash
npm version patch   # bumps package.json and creates a git tag, e.g. v0.1.1
git push --follow-tags
```

Both installers appear under [Releases](../../releases) a few minutes later.

## Project structure

| File | Description |
|---|---|
| `main.js` | Electron main process: window/tray/context menu, global shortcuts, size and charm-image settings, window position persistence |
| `preload.js` | Bridges main-process events (ritual, petals, image changes) to the renderer |
| `renderer/index.html` | Application markup |
| `renderer/style.css` | Styles and ritual/petal animations |
| `renderer/app.js` | Click handling, synthesized chime (Web Audio API), petal shower logic |
| `renderer/charm-ganesha.png` | Default charm artwork (replaceable at runtime via "Change charm image…") |
| `charms/charms.js` | Charm collection metadata |
| `assets/tray-icon.png` | Tray/menu-bar icon |

## Notes

- No network calls, accounts, or telemetry.
- The chime is synthesized with the Web Audio API; no audio assets are used.
- Respects `prefers-reduced-motion` for ritual animations.
