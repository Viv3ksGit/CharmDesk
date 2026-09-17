# CharmDesk

A small always-on-top desktop charm that sits on your screen — inspired by
[Lucky Dangle](https://luckydangle.app). Right now it's Ganesha: click him to
offer a flame (a little diya circles him with a soft chime). Built with
Electron so the same code runs on Windows and Mac.

The charm collection is structured to grow — [charms/charms.js](charms/charms.js)
is a plain list. Adding another charm later means dropping in new art plus a
ritual, the same pattern Ganesha already follows.

## Install

### Windows (just want to run it, no dev tools)

1. Go to the [Releases](../../releases) page and download
   `CharmDesk.Setup.<version>.exe`.
2. Run it. Windows SmartScreen will likely warn "Windows protected your PC"
   because the installer isn't code-signed (that costs a paid certificate) —
   click **More info → Run anyway**.
3. Follow the install wizard. CharmDesk launches automatically and adds
   itself to your Start Menu.

### Mac

1. Go to the [Releases](../../releases) page and download `CharmDesk-<version>.dmg`.
2. Open it, drag **CharmDesk.app** into **Applications**.
3. First launch: right-click the app → **Open** (it's unsigned/not notarized,
   so a plain double-click gets blocked by Gatekeeper the first time only).

### Run from source (any platform, for development)

Requires [Node.js](https://nodejs.org) (18 or later) and git.

```bash
git clone https://github.com/Viv3ksGit/CharmDesk.git
cd CharmDesk
npm install
npm start
```

That launches the widget. It appears near the top-right of your primary
screen the first time; after that it remembers wherever you last dragged it.

## Using it

- **Click** the charm to perform its ritual.
- **Drag** it anywhere on screen.
- **System tray icon** (bottom-right near the clock on Windows, menu bar on
  Mac) — Show/Hide, "Perform ritual", "Start with Windows", and Quit.
- **Global shortcuts** — `Ctrl+Shift+D` toggles visibility, `Ctrl+Shift+R`
  performs the ritual, from anywhere.

## Building the installer yourself

Packaging is done with [electron-builder](https://www.electron.build/).

```bash
npm run dist:win   # -> dist/CharmDesk Setup <version>.exe (build on Windows)
npm run dist:mac   # -> dist/CharmDesk-<version>.dmg (must be built on macOS)
```

Neither build is code-signed (that needs a paid certificate per platform),
which is why SmartScreen/Gatekeeper flag them on first run — normal for a
small unsigned app, not a sign anything's wrong.

### Releasing a new version automatically

[.github/workflows/release.yml](.github/workflows/release.yml) builds both
installers on GitHub's own Windows and Mac runners and attaches them to a
GitHub Release. It fires on any tag matching `v*.*.*`:

```bash
npm version patch   # bumps package.json + creates a git tag, e.g. v0.1.1
git push --follow-tags
```

A few minutes later both installers show up under
[Releases](../../releases). This exists because building the Mac installer
needs an actual Mac, and this project's installers are too large to reliably
upload from some networks by hand.

## Files

| File | What it is |
|---|---|
| `main.js` | Electron main process — window creation, tray, global shortcuts, remembers window position |
| `preload.js` | Bridges the main process's "perform ritual" signal into the renderer |
| `renderer/index.html` | Markup + the SVG charm artwork |
| `renderer/style.css` | Styles and the ritual animation |
| `renderer/app.js` | Click handling, the synthesized chime (Web Audio, no audio assets) |
| `charms/charms.js` | The charm collection list (metadata for what's available) |
| `assets/tray-icon.png` | Tray/menu-bar icon |

## Notes

- No network calls, no accounts, no telemetry.
- The chime is synthesized with the Web Audio API — no audio files.
- Respects `prefers-reduced-motion` for the ritual animation.
