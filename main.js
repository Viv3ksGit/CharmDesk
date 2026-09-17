const { app, BrowserWindow, Tray, Menu, screen, globalShortcut, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");

const WIN_WIDTH = 180;
const WIN_HEIGHT = 210;
const POS_FILE = path.join(app.getPath("userData"), "position.json");

let win = null;
let tray = null;

function loadPosition() {
  try {
    return JSON.parse(fs.readFileSync(POS_FILE, "utf8"));
  } catch {
    return null;
  }
}

function savePosition() {
  if (!win) return;
  try {
    fs.writeFileSync(POS_FILE, JSON.stringify(win.getBounds()));
  } catch {
    // best effort; not worth surfacing to the user
  }
}

function createWindow() {
  const saved = loadPosition();
  const display = screen.getPrimaryDisplay();
  const defaultX = display.workArea.x + display.workArea.width - WIN_WIDTH - 40;
  const defaultY = display.workArea.y + 60;

  win = new BrowserWindow({
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    x: saved?.x ?? defaultX,
    y: saved?.y ?? defaultY,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile("renderer/index.html");

  win.on("move", savePosition);
  win.on("closed", () => {
    win = null;
  });
}

function toggleWindow() {
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    win.show();
  }
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;
  const visible = win ? win.isVisible() : false;
  const contextMenu = Menu.buildFromTemplate([
    { label: visible ? "Hide Ganesha" : "Show Ganesha", click: toggleWindow },
    { label: "Perform ritual", click: () => win && win.webContents.send("perform-ritual") },
    { type: "separator" },
    { label: "Start with Windows", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin, click: (item) => {
      app.setLoginItemSettings({ openAtLogin: item.checked });
    } },
    { type: "separator" },
    { label: "Quit CharmDesk", click: () => app.quit() },
  ]);
  tray.setContextMenu(contextMenu);
}

function createTray() {
  const iconPath = path.join(__dirname, "assets", "tray-icon.png");
  let image = nativeImage.createFromPath(iconPath);
  if (!image.isEmpty()) {
    image = image.resize({ width: 16, height: 16 });
  }
  tray = new Tray(image);
  tray.setToolTip("CharmDesk");
  tray.on("click", toggleWindow);
  updateTrayMenu();
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  globalShortcut.register("Control+Shift+D", toggleWindow);
  globalShortcut.register("Control+Shift+R", () => {
    win && win.webContents.send("perform-ritual");
  });

  win.on("show", updateTrayMenu);
  win.on("hide", updateTrayMenu);
});

app.on("window-all-closed", (e) => {
  // A tray app has no reason to quit just because the widget window closed.
  e.preventDefault();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
