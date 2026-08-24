/* ============================================================================
   BIT BUILDER — loop, rendering, input and UI wiring
   ========================================================================== */

const STEP_MS = 145;          // one engine step
const VIEW = 11;              // tiles visible across the board
const LOGICAL = 528;          // css pixels of the square board
const TILE = LOGICAL / VIEW;
const STORE_KEY = "bitbuilder.v1";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

let game = null;
let levelIndex = 0;
let mode = "intro";           // intro | playing | paused | dead | won | complete
let acc = 0;
let lastFrame = 0;
let animT = 0;
let elapsedMs = 0;
const held = [];
let buffered = null;

/* ------------------------------------------------------------------ saving */
function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (raw && typeof raw.unlocked === "number") return { unlocked: raw.unlocked, best: raw.best || {} };
  } catch (e) { /* first run, or storage disabled */ }
  return { unlocked: 1, best: {} };
}
function saveProgress(p) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) { /* private mode */ }
}
let progress = loadProgress();

/* ------------------------------------------------------------------- sound */
const Sound = {
  on: true,
  ac: null,
  ensure() {
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ac = new AC();
    }
    if (this.ac && this.ac.state === "suspended") this.ac.resume();
    return this.ac;
  },
  tone(freq, when, dur, type = "square", vol = 0.05) {
    const ac = this.ac;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + when);
    gain.gain.setValueAtTime(vol, ac.currentTime + when);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + when + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(ac.currentTime + when);
    osc.stop(ac.currentTime + when + dur + 0.02);
  },
  play(name) {
    if (!this.on || !this.ensure()) return;
    const seq = {
      pickup: [[880, 0, .07], [1320, .05, .07]],
      door: [[220, 0, .09, "sawtooth"]],
      socket: [[440, 0, .08], [660, .07, .1]],
      ready: [[660, 0, .08], [880, .08, .08], [1180, .16, .14]],
      push: [[120, 0, .09, "triangle"]],
      splash: [[300, 0, .12, "sine"], [180, .08, .14, "sine"]],
      burn: [[200, 0, .14, "sawtooth"]],
      teleport: [[500, 0, .06], [900, .05, .06], [1400, .1, .08]],
      toggle: [[520, 0, .06], [400, .06, .08]],
      scrub: [[400, 0, .1, "sawtooth"], [200, .1, .16, "sawtooth"]],
      boom: [[90, 0, .2, "sawtooth", .08]],
      die: [[440, 0, .12, "sawtooth"], [300, .12, .14, "sawtooth"], [160, .26, .3, "sawtooth"]],
      win: [[660, 0, .1], [880, .1, .1], [1100, .2, .1], [1320, .3, .25]],
      step: [[150, 0, .03, "triangle", .02]]
    }[name];
    if (!seq) return;
    for (const [f, w, d, type, vol] of seq) this.tone(f, w, d, type || "square", vol || 0.05);
  }
};

/* --------------------------------------------------------------- rendering */
function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = LOGICAL * dpr;
  canvas.height = LOGICAL * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function lerp(a, b, t) { return a + (b - a) * t; }

function cameraOrigin(px, py) {
  const span = VIEW - 1;
  const ox = game.w <= VIEW ? -(VIEW - game.w) / 2 : Math.min(Math.max(px - span / 2, 0), game.w - VIEW);
  const oy = game.h <= VIEW ? -(VIEW - game.h) / 2 : Math.min(Math.max(py - span / 2, 0), game.h - VIEW);
  return { ox, oy };
}

function drawTerrain(ch, sx, sy, gx, gy) {
  switch (ch) {
    case T.WALL: Sprites.wall(ctx, sx, sy, TILE); break;
    case T.COOLANT: Sprites.coolant(ctx, sx, sy, TILE, animT, gx, gy); break;
    case T.OVERHEAT: Sprites.overheat(ctx, sx, sy, TILE, animT, gx, gy); break;
    case T.ICE: Sprites.ice(ctx, sx, sy, TILE, null); break;
    case "1": case "2": case "3": case "4": Sprites.ice(ctx, sx, sy, TILE, ch); break;
    case T.BUS_L: Sprites.bus(ctx, sx, sy, TILE, "left", animT); break;
    case T.BUS_R: Sprites.bus(ctx, sx, sy, TILE, "right", animT); break;
    case T.BUS_U: Sprites.bus(ctx, sx, sy, TILE, "up", animT); break;
    case T.BUS_D: Sprites.bus(ctx, sx, sy, TILE, "down", animT); break;
    case T.SOCKET: Sprites.socket(ctx, sx, sy, TILE, game.partsDone(), animT); break;
    case T.EXIT: Sprites.exit(ctx, sx, sy, TILE, animT); break;
    case T.HINT: Sprites.hint(ctx, sx, sy, TILE); break;
    case T.SURGE: Sprites.surge(ctx, sx, sy, TILE, animT); break;
    case T.SCRUBBER: Sprites.scrubber(ctx, sx, sy, TILE, animT); break;
    case T.PORT: Sprites.port(ctx, sx, sy, TILE, animT); break;
    case T.SWITCH: Sprites.toggleSwitch(ctx, sx, sy, TILE); break;
    case T.TOGGLE_SHUT: Sprites.toggleWall(ctx, sx, sy, TILE, false); break;
    case T.TOGGLE_OPEN: Sprites.toggleWall(ctx, sx, sy, TILE, true); break;
    case "R": case "B": case "Y": case "G": Sprites.door(ctx, sx, sy, TILE, ch.toLowerCase()); break;
    default: Sprites.floor(ctx, sx, sy, TILE, gx, gy);
  }
}

function drawItem(ch, sx, sy, gx, gy) {
  if (ch === "c") Sprites.hardware(ctx, sx, sy, TILE, partKind(gx, gy, true), animT);
  else if (ch === "s") Sprites.software(ctx, sx, sy, TILE, partKind(gx, gy, false), animT);
  else if ("rbyg".includes(ch)) Sprites.card(ctx, sx, sy, TILE, ch);
  else Sprites.tool(ctx, sx, sy, TILE, ch);
}

function render(alpha) {
  const p = game.player;
  const px = lerp(p.prevX, p.x, alpha);
  const py = lerp(p.prevY, p.y, alpha);
  const { ox, oy } = cameraOrigin(px, py);

  ctx.fillStyle = "#05080d";
  ctx.fillRect(0, 0, LOGICAL, LOGICAL);

  const x0 = Math.floor(ox) - 1, y0 = Math.floor(oy) - 1;
  for (let gy = y0; gy <= y0 + VIEW + 1; gy++) {
    for (let gx = x0; gx <= x0 + VIEW + 1; gx++) {
      if (!game.inBounds(gx, gy)) continue;
      const sx = (gx - ox) * TILE, sy = (gy - oy) * TILE;
      drawTerrain(game.grid[gy][gx], sx, sy, gx, gy);
      const item = game.items[gy][gx];
      if (item) drawItem(item, sx, sy, gx, gy);
    }
  }

  for (const b of game.blocks) {
    Sprites.crate(ctx, (lerp(b.prevX, b.x, alpha) - ox) * TILE, (lerp(b.prevY, b.y, alpha) - oy) * TILE, TILE);
  }
  for (const m of game.monsters) {
    if (!m.alive) continue;
    Sprites.monster(ctx, (lerp(m.prevX, m.x, alpha) - ox) * TILE, (lerp(m.prevY, m.y, alpha) - oy) * TILE,
      TILE, m.type, m.dir, animT);
  }
  if (game.state !== "dead") Sprites.player(ctx, (px - ox) * TILE, (py - oy) * TILE, TILE, p.dir, animT);

  const vig = ctx.createRadialGradient(LOGICAL / 2, LOGICAL / 2, LOGICAL * 0.3, LOGICAL / 2, LOGICAL / 2, LOGICAL * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, LOGICAL, LOGICAL);
}

/* --------------------------------------------------------------------- HUD */
const el = id => document.getElementById(id);

function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function chipCanvas(draw) {
  const c = document.createElement("canvas");
  c.width = c.height = 44;
  const cx = c.getContext("2d");
  draw(cx, 44);
  return c;
}

function updateHUD() {
  el("level-no").textContent = `Level ${levelIndex + 1} of ${LEVELS.length}`;
  el("level-name").textContent = game.level.name;
  el("time-left").textContent = fmtTime(game.timeLeft);
  el("time-left").parentElement.classList.toggle("warn", game.timeLeft < 20000);
  el("hw-count").textContent = `${game.collected.hw}/${game.required.hw}`;
  el("sw-count").textContent = `${game.collected.sw}/${game.required.sw}`;

  const ready = game.partsDone();
  const socket = el("socket-state");
  socket.classList.toggle("ready", ready);
  socket.textContent = ready
    ? "Socket open — get to the power button"
    : "Socket locked — parts still missing";

  const inv = el("inventory");
  inv.innerHTML = "";
  for (const card of "rbyg") {
    if (!game.keys[card]) continue;
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.appendChild(chipCanvas((c, s) => Sprites.card(c, 0, 0, s, card)));
    chip.append(CARD_INFO[card].name);
    if (card !== "g") { const b = document.createElement("b"); b.textContent = `×${game.keys[card]}`; chip.appendChild(b); }
    inv.appendChild(chip);
  }
  for (const tool of "FHKM") {
    if (!game.tools[tool]) continue;
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.appendChild(chipCanvas((c, s) => Sprites.tool(c, 0, 0, s, tool)));
    chip.append(TOOL_INFO[tool].name);
    inv.appendChild(chip);
  }
  if (!inv.children.length) inv.innerHTML = '<span class="empty">nothing yet</span>';

  const box = el("hint-box");
  box.classList.toggle("live", game.onHint);
  box.querySelector("h3").textContent = game.onHint ? "Help terminal" : "Objective";
  el("hint-text").textContent = game.onHint
    ? game.level.hint
    : `Collect ${game.required.hw} hardware and ${game.required.sw} software parts, then reach the power button through the assembly socket.`;
}

let toastTimer = null;
function toast(msg) {
  const t = el("toast");
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = "0"; }, 1600);
}

/* ---------------------------------------------------------------- overlays */
function showOverlay(title, text, stats, primary, secondary) {
  el("ov-title").textContent = title;
  el("ov-text").textContent = text;
  el("ov-stats").innerHTML = stats || "";
  const p = el("ov-primary"), s = el("ov-secondary");
  p.textContent = primary.label;
  p.onclick = primary.action;
  if (secondary) { s.classList.remove("hidden"); s.style.display = ""; s.textContent = secondary.label; s.onclick = secondary.action; }
  else { s.style.display = "none"; }
  el("overlay").classList.remove("hidden");
}
function hideOverlay() { el("overlay").classList.add("hidden"); }

function introOverlay() {
  mode = "intro";
  showOverlay(
    `Level ${levelIndex + 1} — ${game.level.name}`,
    game.level.hint,
    `<span>Hardware <b>${game.required.hw}</b></span><span>Software <b>${game.required.sw}</b></span><span>Clock <b>${fmtTime(game.timeLeft)}</b></span>`,
    { label: "Start", action: startPlaying },
    { label: "Levels", action: () => el("levels-dialog").showModal() }
  );
}

function startPlaying() {
  hideOverlay();
  mode = "playing";
  acc = 0;
  Sound.ensure();
}

function deathOverlay() {
  mode = "dead";
  Sound.play("die");
  showOverlay("Assembly failed", game.deathReason,
    `<span>Hardware <b>${game.collected.hw}/${game.required.hw}</b></span><span>Software <b>${game.collected.sw}/${game.required.sw}</b></span>`,
    { label: "Try again", action: () => loadLevel(levelIndex) },
    { label: "Levels", action: () => el("levels-dialog").showModal() });
}

function winOverlay() {
  mode = "won";
  Sound.play("win");
  const name = game.level.name;
  const seconds = Math.round(elapsedMs / 1000);
  const best = progress.best[name];
  const record = !best || seconds < best.time;
  if (record) progress.best[name] = { time: seconds, moves: game.moves };
  progress.unlocked = Math.max(progress.unlocked, Math.min(levelIndex + 2, LEVELS.length));
  saveProgress(progress);
  buildLevelList();

  const last = levelIndex === LEVELS.length - 1;
  showOverlay(
    last ? "All systems assembled!" : "Machine booted!",
    last
      ? "Every rig is built and running. You can replay any level for a faster time."
      : `${name} is complete — the next bench is unlocked.`,
    `<span>Time <b>${seconds}s</b></span><span>Moves <b>${game.moves}</b></span>` +
    `<span>Clock left <b>${fmtTime(game.timeLeft)}</b></span>` + (record ? "<span><b>New best</b></span>" : ""),
    last
      ? { label: "Replay level", action: () => loadLevel(levelIndex) }
      : { label: "Next level", action: () => loadLevel(levelIndex + 1) },
    { label: "Levels", action: () => el("levels-dialog").showModal() }
  );
}

function togglePause() {
  if (mode === "playing") {
    mode = "paused";
    showOverlay("Paused", "The clock is stopped.", "", { label: "Resume", action: startPlaying }, null);
  } else if (mode === "paused") {
    startPlaying();
  }
}

/* ------------------------------------------------------------------- input */
const KEY_DIRS = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", a: "left", s: "down", d: "right", W: "up", A: "left", S: "down", D: "right"
};

function pressDir(dir) {
  if (!held.includes(dir)) held.unshift(dir);
  buffered = dir;
}
function releaseDir(dir) {
  const i = held.indexOf(dir);
  if (i >= 0) held.splice(i, 1);
}

document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  const dir = KEY_DIRS[e.key];
  if (dir) {
    e.preventDefault();
    pressDir(dir);
    if (mode === "intro") startPlaying();
    return;
  }
  if (e.key === "r" || e.key === "R") { loadLevel(levelIndex); return; }
  if (e.key === "p" || e.key === "P") { togglePause(); return; }
  if (e.key === "Enter" || e.key === " ") {
    if (!el("overlay").classList.contains("hidden")) {
      e.preventDefault();
      el("ov-primary").click();
    }
  }
});
document.addEventListener("keyup", e => {
  const dir = KEY_DIRS[e.key];
  if (dir) releaseDir(dir);
});

for (const btn of document.querySelectorAll(".dpad-btn")) {
  const dir = btn.dataset.dir;
  const down = e => { e.preventDefault(); pressDir(dir); if (mode === "intro") startPlaying(); };
  const up = e => { e.preventDefault(); releaseDir(dir); };
  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointerleave", up);
  btn.addEventListener("pointercancel", up);
}

let touchStart = null;
canvas.addEventListener("pointerdown", e => { touchStart = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener("pointerup", e => {
  if (!touchStart) return;
  const dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
  const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
  buffered = dir;
  if (mode === "intro") startPlaying();
});

/* -------------------------------------------------------------------- loop */
function takeStep() {
  let dir = held[0] || buffered;
  buffered = null;
  game.step(dir);
  for (const ev of game.drainEvents()) handleEvent(ev);
  if (game.state === "won") winOverlay();
  else if (game.state === "dead") deathOverlay();
  updateHUD();
}

function handleEvent(ev) {
  Sound.play(ev.name);
  if (ev.name === "pickup" && game.lastPickup) toast(`Picked up: ${game.lastPickup}`);
  if (ev.name === "door") toast("Access card used");
  if (ev.name === "scrub") toast("Scrubber wiped your tools!");
  if (ev.name === "ready") toast("All parts collected — socket unlocked");
  if (ev.name === "teleport") toast("Routed through the network");
}

function frame(now) {
  const dt = Math.min(120, now - lastFrame || 16);
  lastFrame = now;
  animT = now / 1000;

  if (mode === "playing") {
    game.advanceClock(dt);
    elapsedMs += dt;
    if (game.state === "dead") { deathOverlay(); updateHUD(); }
    else {
      acc += dt;
      while (acc >= STEP_MS && mode === "playing") { acc -= STEP_MS; takeStep(); }
    }
    el("time-left").textContent = fmtTime(game.timeLeft);
  }

  render(mode === "playing" ? Math.min(acc / STEP_MS, 1) : 1);
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ levels */
function loadLevel(i) {
  levelIndex = Math.max(0, Math.min(i, LEVELS.length - 1));
  game = new Game(LEVELS[levelIndex]);
  elapsedMs = 0;
  acc = 0;
  held.length = 0;
  buffered = null;
  updateHUD();
  introOverlay();
  const dlg = el("levels-dialog");
  if (dlg.open) dlg.close();
}

function buildLevelList() {
  const list = el("level-list");
  list.innerHTML = "";
  LEVELS.forEach((lv, i) => {
    const b = document.createElement("button");
    b.className = "level-card";
    b.disabled = i + 1 > progress.unlocked;
    const best = progress.best[lv.name];
    b.innerHTML = `<span class="n">Level ${i + 1}</span><span class="t">${b.disabled ? "Locked" : lv.name}</span>` +
      (best ? `<span class="best">best ${best.time}s · ${best.moves} moves</span>` : "");
    b.onclick = () => loadLevel(i);
    list.appendChild(b);
  });
}

/* ------------------------------------------------------------------ legend */
function buildLegend() {
  const items = [
    [(c, s) => Sprites.hardware(c, 0, 0, s, "cpu", 0), "Hardware part", "CPUs, RAM, drives, fans — collect them all"],
    [(c, s) => Sprites.software(c, 0, 0, s, "os", 0), "Software part", "OS images, drivers, compilers, antivirus"],
    [(c, s) => Sprites.socket(c, 0, 0, s, false, 0), "Assembly socket", "opens only when every part is on your belt"],
    [(c, s) => Sprites.exit(c, 0, 0, s, 0), "Power button", "reach it to finish the level"],
    [(c, s) => Sprites.card(c, 0, 0, s, "b"), "Access card", "opens one matching port (green root access is reusable)"],
    [(c, s) => Sprites.door(c, 0, 0, s, "b"), "Locked port", "needs the matching card"],
    [(c, s) => Sprites.coolant(c, 0, 0, s, 0, 1, 1), "Coolant spill", "deadly without the Coolant Seal"],
    [(c, s) => Sprites.overheat(c, 0, 0, s, 0, 1, 1), "Overheat zone", "deadly without the Heatsink"],
    [(c, s) => Sprites.ice(c, 0, 0, s, null), "Cryo ice", "you slide until something stops you"],
    [(c, s) => Sprites.bus(c, 0, 0, s, "right", 0), "Data bus", "carries you along — Mag Grips ignore it"],
    [(c, s) => Sprites.crate(c, 0, 0, s), "Crate", "push it; shoved into coolant it plugs the leak"],
    [(c, s) => Sprites.surge(c, 0, 0, s, 0), "Surge trap", "one-shot: destroys whatever steps on it"],
    [(c, s) => Sprites.scrubber(c, 0, 0, s, 0), "Scrubber", "wipes every tool off your belt"],
    [(c, s) => Sprites.port(c, 0, 0, s, 0), "Network port", "throws you out of the next port"],
    [(c, s) => Sprites.toggleSwitch(c, 0, 0, s), "Toggle switch", "flips every toggle wall on the map"],
    [(c, s) => Sprites.tool(c, 0, 0, s, "F"), "Tools", "Coolant Seal, Heatsink, Grip Pads, Mag Grips"],
    [(c, s) => Sprites.monster(c, 0, 0, s, "@", "down", 0), "Bug", "walks hugging the left-hand wall"],
    [(c, s) => Sprites.monster(c, 0, 0, s, "&", "down", 0), "Trojan", "hunts you down"]
  ];
  const box = el("legend");
  box.innerHTML = "";
  for (const [draw, title, desc] of items) {
    const row = document.createElement("div");
    row.className = "legend-item";
    const c = document.createElement("canvas");
    c.width = c.height = 48;
    draw(c.getContext("2d"), 48);
    row.appendChild(c);
    const span = document.createElement("span");
    span.innerHTML = `<b>${title}</b>${desc}`;
    row.appendChild(span);
    box.appendChild(row);
  }
}

/* -------------------------------------------------------------------- boot */
el("btn-restart").onclick = () => loadLevel(levelIndex);
el("btn-pause").onclick = togglePause;
el("btn-levels").onclick = () => el("levels-dialog").showModal();
el("btn-help").onclick = () => el("help-dialog").showModal();
el("btn-sound").onclick = e => {
  Sound.on = !Sound.on;
  e.target.textContent = `Sound: ${Sound.on ? "on" : "off"}`;
  e.target.setAttribute("aria-pressed", String(Sound.on));
  if (Sound.on) Sound.ensure();
};

setupCanvas();
window.addEventListener("resize", setupCanvas);
buildLevelList();
buildLegend();
loadLevel(Math.min(progress.unlocked - 1, LEVELS.length - 1));
requestAnimationFrame(frame);
