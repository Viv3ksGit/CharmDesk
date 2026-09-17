const handle = document.getElementById("dragHandle");
let ritualPlaying = false;

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
  window.setTimeout(() => {
    handle.classList.remove("ritual");
    ritualPlaying = false;
  }, 2500);
}

handle.addEventListener("click", performRitual);

if (window.charmdesk) {
  window.charmdesk.onPerformRitual(performRitual);
}
