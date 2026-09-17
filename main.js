const { app, BrowserWindow, Tray, Menu, screen, globalShortcut, nativeImage, ipcMain, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
let updateStatus = "Up to date";

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
let dragInterval = null;
let dragOffset = { x: 0, y: 0 };
const DRAG_SAFETY_TIMEOUT_MS = 15000; // guards against a lost mouseup leaving this running forever

function startWindowDrag() {
  if (!win || dragInterval) return;
  const cursor = screen.getCursorScreenPoint();
  const bounds = win.getBounds();
  dragOffset = { x: cursor.x - bounds.x, y: cursor.y - bounds.y };
  const startedAt = Date.now();
  dragInterval = setInterval(() => {
    if (Date.now() - startedAt > DRAG_SAFETY_TIMEOUT_MS) {
      endWindowDrag();
      return;
    }
    const cur = screen.getCursorScreenPoint();
    win.setPosition(cur.x - dragOffset.x, cur.y - dragOffset.y);
  }, 16);
}

function endWindowDrag() {
  if (dragInterval) {
    clearInterval(dragInterval);
    dragInterval = null;
    saveSettings();
  }
}

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

function setUpdateStatus(status) {
  updateStatus = status;
  updateTrayMenu();
}

function checkForUpdates({ manual = false } = {}) {
  if (!app.isPackaged) {
    if (manual) {
      dialog.showMessageBox(win, {
        type: "info",
        message: "Updates only work in the installed app, not when running from source.",
      });
    }
    return;
  }
  setUpdateStatus("Checking for updates…");
  autoUpdater.checkForUpdates().catch((err) => {
    setUpdateStatus("Update check failed");
    if (manual) {
      dialog.showMessageBox(win, {
        type: "error",
        message: "Couldn't check for updates.",
        detail: String(err?.message || err),
      });
    }
  });
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;

  autoUpdater.on("checking-for-update", () => setUpdateStatus("Checking for updates…"));
  autoUpdater.on("update-not-available", () => setUpdateStatus("Up to date"));
  autoUpdater.on("update-available", (info) => setUpdateStatus(`Downloading v${info.version}…`));
  autoUpdater.on("error", () => setUpdateStatus("Update check failed"));
  autoUpdater.on("update-downloaded", (info) => {
    setUpdateStatus(`v${info.version} ready — restart to install`);
    dialog
      .showMessageBox(win, {
        type: "info",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        message: `CharmDesk v${info.version} has been downloaded.`,
        detail: "Restart now to finish installing it, or it'll install next time you quit.",
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  checkForUpdates();
  setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
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

  if (!app.isPackaged) {
    win.webContents.on("console-message", (_event, _level, message) => {
      console.log("[renderer]", message);
    });
  }

  win.webContents.on("did-finish-load", () => {
    sendCharmImage();
    win.webContents.send("petals-enabled", petalsEnabled);
  });

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
  const template = [
    { label: `CharmDesk v${app.getVersion()}`, enabled: false },
    { type: "separator" },
  ];
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
    { label: `Updates: ${updateStatus}`, enabled: false },
    { label: "Check for updates", click: () => checkForUpdates({ manual: true }) },
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
  setupAutoUpdater();

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

  ipcMain.on("window-drag-start", startWindowDrag);
  ipcMain.on("window-drag-end", endWindowDrag);
});

app.on("window-all-closed", (e) => {
  // A tray app has no reason to quit just because the widget window closed.
  e.preventDefault();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
