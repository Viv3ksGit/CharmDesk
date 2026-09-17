const handle = document.getElementById("dragHandle");
const stage = document.getElementById("stage");
const charmPhoto = document.getElementById("charmPhoto");
let ritualPlaying = false;
let petalsEnabled = true;

// Images are natively draggable in Chromium (ghost-image drag-and-drop),
// which fights with our own custom window-drag below and can eat the
// mouseup event - leaving the window stuck following the cursor forever.
document.addEventListener("dragstart", (event) => event.preventDefault());

// High-contrast marigold/jasmine tones so petals read clearly against the charm.
const PETAL_COLORS = ["#ff9a3d", "#ffcf5c", "#fffaf0", "#ff6f4d", "#ffe08a"];
const DEFAULT_CHARM_SRC = "charm-ganesha.png";

function showerPetals(count = 16) {
  for (let i = 0; i < count; i++) {
    const petal = document.createElement("div");
    petal.className = "petal";
    petal.style.left = `${5 + Math.random() * 90}%`;
    petal.style.setProperty("--drift", `${(Math.random() - 0.5) * 70}px`);
    petal.style.setProperty("--dur", `${1.8 + Math.random() * 1.3}s`);
    petal.style.background = PETAL_COLORS[i % PETAL_COLORS.length];
    petal.style.animationDelay = `${Math.random() * 0.5}s`;
    stage.appendChild(petal);
    petal.addEventListener("animationend", () => petal.remove());
    // Safety net in case the animationend listener is ever missed.
    window.setTimeout(() => petal.remove(), 4500);
  }
}

function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [660, 990, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12 / (i + 1), now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.5);
    });
  } catch {
    // Web Audio may be unavailable in some contexts; the ritual still plays visually.
  }
}

function performRitual() {
  if (ritualPlaying) return;
  ritualPlaying = true;
  handle.classList.add("ritual");
  chime();
  if (petalsEnabled) showerPetals();
  window.setTimeout(() => {
    handle.classList.remove("ritual");
    ritualPlaying = false;
  }, 2500);
}

// Dragging is driven from here (not CSS -webkit-app-region: drag) because on
// Windows that region is treated as a titlebar at the OS level, which
// hijacks right-click into the native system menu instead of our own.
const DRAG_THRESHOLD = 4;
let dragStart = null;
let dragMoved = false;

handle.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;
  dragStart = { x: event.screenX, y: event.screenY };
  dragMoved = false;
});

window.addEventListener("mousemove", (event) => {
  if (!dragStart) return;
  const dx = event.screenX - dragStart.x;
  const dy = event.screenY - dragStart.y;
  if (!dragMoved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
    dragMoved = true;
    if (window.charmdesk) window.charmdesk.startDrag();
  }
});

window.addEventListener("mouseup", (event) => {
  if (event.button !== 0 || !dragStart) return;
  if (dragMoved && window.charmdesk) window.charmdesk.endDrag();
  dragStart = null;
});

handle.addEventListener("click", () => {
  if (dragMoved) {
    dragMoved = false;
    return;
  }
  performRitual();
});

handle.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  if (window.charmdesk) window.charmdesk.showContextMenu();
});

if (window.charmdesk) {
  window.charmdesk.onPerformRitual(performRitual);
  // Manual "Shower petals" menu action always fires, regardless of the toggle.
  window.charmdesk.onShowerPetals(() => showerPetals());
  window.charmdesk.onPetalsEnabled((enabled) => {
    petalsEnabled = enabled;
  });
  window.charmdesk.onSetCharmImage(({ src }) => {
    charmPhoto.src = src || DEFAULT_CHARM_SRC;
  });
}
