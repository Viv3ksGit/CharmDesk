const { app, BrowserWindow, Tray, Menu, screen, globalShortcut, nativeImage, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const WIN_WIDTH = 180;
const WIN_HEIGHT = 210;
const SETTINGS_FILE = path.join(app.getPath("userData"), "settings.json");
const SIZE_STEPS = [0.7, 0.85, 1, 1.15, 1.3, 1.5, 1.75];
const DEFAULT_SIZE_INDEX = SIZE_STEPS.indexOf(1);

let win = null;
let tray = null;
let sizeIndex = DEFAULT_SIZE_INDEX;
let petalsEnabled = true;
let customImagePath = null;

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveSettings() {
  if (!win) return;
  try {
    const bounds = win.getBounds();
    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify({ x: bounds.x, y: bounds.y, sizeIndex, petalsEnabled, customImagePath })
    );
  } catch {
    // best effort; not worth surfacing to the user
  }
}

function sendCharmImage() {
  if (!win) return;
  const usable = customImagePath && fs.existsSync(customImagePath);
  win.webContents.send("set-charm-image", {
    src: usable ? `file://${customImagePath.replace(/\\/g, "/")}` : null,
  });
}

function chooseCharmImage() {
  if (!win) return;
  dialog
    .showOpenDialog(win, {
      title: "Choose a charm image",
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      properties: ["openFile"],
    })
    .then((result) => {
      if (result.canceled || !result.filePaths[0]) return;
      const source = result.filePaths[0];
      const ext = path.extname(source) || ".png";
      const dest = path.join(app.getPath("userData"), `custom-charm${ext}`);
      const previous = customImagePath;
      fs.copyFileSync(source, dest);
      customImagePath = dest;
      if (previous && previous !== dest && fs.existsSync(previous)) {
        try {
          fs.unlinkSync(previous);
        } catch {
          // not worth surfacing - stale file, harmless
        }
      }
      saveSettings();
      sendCharmImage();
      updateTrayMenu();
    })
    .catch(() => {
      // user cancelled or dialog failed - nothing to do
    });
}

function resetToDefaultImage() {
  const previous = customImagePath;
  customImagePath = null;
  saveSettings();
  sendCharmImage();
  updateTrayMenu();
  if (previous && fs.existsSync(previous)) {
    try {
      fs.unlinkSync(previous);
    } catch {
      // not worth surfacing - stale file, harmless
    }
  }
}

function currentScale() {
  return SIZE_STEPS[sizeIndex];
}

function applySize({ keepCenter = true } = {}) {
  if (!win) return;
  const scale = currentScale();
  const width = Math.round(WIN_WIDTH * scale);
  const height = Math.round(WIN_HEIGHT * scale);
  const bounds = win.getBounds();
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const x = keepCenter ? Math.round(centerX - width / 2) : bounds.x;
  const y = keepCenter ? Math.round(centerY - height / 2) : bounds.y;
  win.setBounds({ x, y, width, height });
  saveSettings();
}

function changeSize(delta) {
  const next = sizeIndex + delta;
  if (next < 0 || next >= SIZE_STEPS.length) return;
  sizeIndex = next;
  applySize();
  updateTrayMenu();
}

function createWindow() {
  const saved = loadSettings();
  if (saved?.sizeIndex !== undefined && SIZE_STEPS[saved.sizeIndex] !== undefined) {
    sizeIndex = saved.sizeIndex;
  }
  if (typeof saved?.petalsEnabled === "boolean") {
    petalsEnabled = saved.petalsEnabled;
  }
  if (saved?.customImagePath && fs.existsSync(saved.customImagePath)) {
    customImagePath = saved.customImagePath;
  }
  const scale = currentScale();
  const width = Math.round(WIN_WIDTH * scale);
  const height = Math.round(WIN_HEIGHT * scale);

  const display = screen.getPrimaryDisplay();
  const defaultX = display.workArea.x + display.workArea.width - width - 40;
  const defaultY = display.workArea.y + 60;

  win = new BrowserWindow({
    width,
    height,
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

  win.webContents.on("did-finish-load", () => {
    sendCharmImage();
    win.webContents.send("petals-enabled", petalsEnabled);
  });

  win.on("move", saveSettings);
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

function buildMenuTemplate({ includeShowHide = true } = {}) {
  const visible = win ? win.isVisible() : false;
  const template = [];
  if (includeShowHide) {
    template.push({ label: visible ? "Hide Ganesha" : "Show Ganesha", click: toggleWindow });
  }
  template.push(
    { label: "Perform ritual", click: () => win && win.webContents.send("perform-ritual") },
    { label: "Shower petals", click: () => win && win.webContents.send("shower-petals") },
    { label: "Flower petals during ritual", type: "checkbox", checked: petalsEnabled, click: (item) => {
      petalsEnabled = item.checked;
      saveSettings();
      win && win.webContents.send("petals-enabled", petalsEnabled);
    } },
    { type: "separator" },
    { label: `Size: ${Math.round(currentScale() * 100)}%`, enabled: false },
    { label: "Increase size", enabled: sizeIndex < SIZE_STEPS.length - 1, click: () => changeSize(1) },
    { label: "Decrease size", enabled: sizeIndex > 0, click: () => changeSize(-1) },
    { label: "Reset size", enabled: sizeIndex !== DEFAULT_SIZE_INDEX, click: () => {
      sizeIndex = DEFAULT_SIZE_INDEX;
      applySize();
      updateTrayMenu();
    } },
    { type: "separator" },
    { label: "Change charm image…", click: chooseCharmImage },
    { label: "Reset to default image", enabled: Boolean(customImagePath), click: resetToDefaultImage },
    { type: "separator" },
    { label: "Start with Windows", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin, click: (item) => {
      app.setLoginItemSettings({ openAtLogin: item.checked });
    } },
    { type: "separator" },
    { label: "Quit CharmDesk", click: () => app.quit() }
  );
  return template;
}

function updateTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate(buildMenuTemplate()));
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
  globalShortcut.register("Control+Shift+=", () => changeSize(1));
  globalShortcut.register("Control+Shift+-", () => changeSize(-1));

  win.on("show", updateTrayMenu);
  win.on("hide", updateTrayMenu);

  ipcMain.on("show-context-menu", (event) => {
    const menu = Menu.buildFromTemplate(buildMenuTemplate({ includeShowHide: false }));
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
  });
});

app.on("window-all-closed", (e) => {
  // A tray app has no reason to quit just because the widget window closed.
  e.preventDefault();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
