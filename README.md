# CharmDesk

A small always-on-top desktop charm that sits on your screen — inspired by
[Lucky Dangle](https://luckydangle.app). Right now it's Ganesha: click him to
offer a flame (a little diya circles him with a soft chime). Built with
Electron so the same code runs on Windows and Mac.

The charm collection is structured to grow — [charms/charms.js](charms/charms.js)
is a plain list. Adding another charm later means dropping in new art plus a
ritual, the same pattern Ganesha already follows.

## Install & run

Requires [Node.js](https://nodejs.org) (18 or later).

```bash
git clone <this-repo-url>
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

## Packaging a real installer (optional)

This repo runs from source via `npm start`. To produce a distributable
`.exe`/`.dmg` you'd add [electron-builder](https://www.electron.build/) or
[electron-forge](https://www.electronforge.io/) — not set up yet, since this
is still an early prototype.

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
