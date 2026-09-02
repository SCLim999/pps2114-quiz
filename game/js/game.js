/**
 * ======================= GAME =======================
 * Rendering, HUD and input for the lemmings-like game.
 * All simulation lives in engine.js — this file only draws Engine.state and
 * feeds player input back into it.
 * ====================================================
 */
(function () {
  "use strict";

  const W = Engine.W, H = Engine.H, TPS = Engine.TPS, MAT = Engine.MAT;
  const SKILL_LABEL = {
    CLIMBER: "Climber", FLOATER: "Floater", BOMBER: "Bomber", BLOCKER: "Blocker",
    BUILDER: "Builder", BASHER: "Basher", MINER: "Miner", DIGGER: "Digger"
  };
  const PROGRESS_KEY = "lemmings-progress";

  const canvas = document.getElementById("screen");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  /* ------------------------------------------------------- terrain paint */

  const terrainCanvas = document.createElement("canvas");
  terrainCanvas.width = W; terrainCanvas.height = H;
  const tctx = terrainCanvas.getContext("2d");
  const terrainImg = tctx.createImageData(W, H);
  const terrainPx = new Uint32Array(terrainImg.data.buffer);

  const noise = new Uint8Array(W * H);
  (function seedNoise() {
    for (let i = 0; i < noise.length; i++) {
      let h = (i * 2654435761) ^ (i >> 7);
      noise[i] = (h >>> 3) & 7;
    }
  })();

  function word(r, g, b) {
    return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  function shades(r, g, b) {
    const out = new Uint32Array(8);
    for (let s = 0; s < 8; s++) {
      const d = (s - 3.5) * 3;
      out[s] = word(
        Math.max(0, Math.min(255, Math.round(r + d))),
        Math.max(0, Math.min(255, Math.round(g + d))),
        Math.max(0, Math.min(255, Math.round(b + d)))
      );
    }
    return out;
  }

  // PAL[material] = [surface, just-below-surface, deep]
  const PAL = [];
  PAL[MAT.DIRT] = [shades(96, 176, 72), shades(72, 132, 56), shades(124, 86, 52)];
  PAL[MAT.ROCK] = [shades(150, 156, 170), shades(118, 124, 138), shades(94, 99, 112)];
  PAL[MAT.STEEL] = [shades(190, 198, 212), shades(150, 158, 176), shades(126, 134, 152)];
  PAL[MAT.BRICK] = [shades(236, 150, 104), shades(214, 118, 78), shades(198, 98, 60)];
  const RIVET = word(214, 222, 236);

  function repaintTerrain() {
    const mask = Engine.state.mask, mat = Engine.state.mat;
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const i = row + x;
        if (!mask[i]) { terrainPx[i] = 0; continue; }
        const m = mat[i] || MAT.DIRT;
        const depth = (y > 0 && !mask[i - W]) ? 0 : ((y > 1 && !mask[i - 2 * W]) ? 1 : 2);
        if (m === MAT.STEEL && depth === 2 && (x & 7) === 4 && (y & 7) === 4) {
          terrainPx[i] = RIVET;
        } else {
          terrainPx[i] = PAL[m][depth][noise[i]];
        }
      }
    }
    tctx.putImageData(terrainImg, 0, 0);
    Engine.state.dirty = false;
  }

  /* ------------------------------------------------------------- sprites */

  const C = {
    hair: "#2fbf4f", hairDark: "#1d8c39", body: "#3b5bd6", bodyDark: "#2a41a0",
    skin: "#f2c79c", dark: "#101828", brick: "#e08a52",
    climb: "#39d0e8", float: "#ffb020", fuse: "#ffe066", blood: "#c0392b"
  };

  function px(color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function drawLem(l) {
    const x = Math.round(l.x), y = Math.round(l.y);

    if (!l.alive) {
      const t = l.dying;
      if (t >= 24) return;
      ctx.globalAlpha = 1 - t / 24;
      if (l.act === "SPLAT") {
        px(C.blood, x - 4, y - 2, 9, 2);
        px(C.body, x - 3, y - 4, 6, 2);
      } else if (l.act === "EXIT") {
        const s = Math.max(0, 1 - t / 12);
        px(C.hair, x - 2 * s, y - 9 * s, 4 * s, 9 * s);
      }
      ctx.globalAlpha = 1;
      return;
    }

    const wiggle = (l.anim >> 2) & 1;

    // fuse countdown floats above the head
    if (l.fuse > 0) {
      ctx.fillStyle = C.fuse;
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(Math.ceil(l.fuse / TPS)), x, y - 12);
      ctx.textAlign = "left";
    }

    switch (l.act) {
      case "BLOCKER":
        px(C.hairDark, x - 2, y - 9, 4, 3);
        px(C.body, x - 2, y - 6, 4, 4);
        px(C.bodyDark, x - 4, y - 6, 2, 2);            // arms out
        px(C.bodyDark, x + 2, y - 6, 2, 2);
        px(C.dark, x - 2, y - 2, 4, 2);
        px("#ff4d4d", x - 4, y - 11, 8, 1);
        break;

      case "DIGGER":
        px(C.hair, x - 2, y - 7, 4, 3);
        px(C.body, x - 3, y - 4, 6, 3);
        px(C.dark, x - 4, y - 1, 8, 1);
        break;

      case "SHRUG":
        px(C.hair, x - 2, y - 8, 4, 3);
        px(C.body, x - 2, y - 5, 4, 3);
        px(C.skin, x - 4, y - 8, 2, 2);              // arms thrown up
        px(C.skin, x + 2, y - 8, 2, 2);
        px(C.dark, x - 2, y - 2, 4, 2);
        break;

      case "BUILDER":
        px(C.hair, x - 2, y - 9, 4, 3);
        px(C.body, x - 2, y - 6, 4, 4);
        px(C.dark, x - 2, y - 2, 4, 2);
        px(C.brick, l.dir > 0 ? x + 2 : x - 6, y - 5, 4, 2);
        break;

      case "CLIMBER":
        px(C.hair, x - 1, y - 9, 3, 3);
        px(C.body, x - 1, y - 6, 3, 4);
        px(C.skin, l.dir > 0 ? x + 2 : x - 2, y - 8, 1, 2);
        px(C.dark, x - 1, y - 2, 3, 2);
        break;

      case "BASHER":
      case "MINER":
        px(C.hair, x - 2, y - 9, 4, 3);
        px(C.body, x - 2, y - 6, 4, 4);
        px(C.skin, l.dir > 0 ? x + 2 : x - 4, y - 6 + (wiggle ? 1 : 0), 2, 2);
        px(C.dark, x - 2, y - 2, 4, 2);
        break;

      case "FALLER":
        px(C.hair, x - 2, y - 9, 4, 3);
        px(C.body, x - 2, y - 6, 4, 4);
        px(C.skin, x - 4, y - 7, 2, 1);
        px(C.skin, x + 2, y - 7, 2, 1);
        px(C.dark, x - 2, y - 2, 4, 2);
        if (l.floater && l.fall > 6) {               // umbrella
          ctx.strokeStyle = C.float;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x + 0.5, y - 12.5, 5, Math.PI, 0);
          ctx.stroke();
          px(C.float, x, y - 12, 1, 3);
        }
        break;

      default: // WALKER
        px(C.hair, x - 2, y - 9, 4, 3);
        px(C.skin, x - 1 + (l.dir > 0 ? 1 : -1), y - 7, 1, 1);
        px(C.body, x - 2, y - 6, 4, 4);
        px(C.dark, x - 2 + (wiggle ? 0 : 1), y - 2, 2, 2);
        px(C.dark, x + (wiggle ? 1 : 0), y - 2, 1, 2);
        break;
    }

    if (l.climber) px(C.climb, x - 3, y - 10, 1, 1);
    if (l.floater) px(C.float, x + 2, y - 10, 1, 1);
  }

  function drawHatch(t) {
    const e = Engine.state.level.entrance;
    px("#8a5a2b", e.x - 18, e.y - 24, 36, 6);
    px("#c08040", e.x - 16, e.y - 18, 32, 4);
    px("#1b1f2a", e.x - 12, e.y - 14, 24, 14);
    px("#ffd166", e.x - 12, e.y - 14, 24, 2);
    const open = Engine.state.spawned < Engine.state.level.count;
    if (open) {
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t / 200);
      px("#ffd166", e.x - 10, e.y - 12, 20, 10);
      ctx.globalAlpha = 1;
    }
  }

  function drawExit(t) {
    const e = Engine.state.level.exit;
    px("#2b2f3d", e.x - 9, e.y - 20, 18, 20);
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t / 160);
    px("#5ce1e6", e.x - 6, e.y - 16, 12, 16);
    ctx.globalAlpha = 1;
    px("#9fe9ff", e.x - 9, e.y - 22, 18, 3);
    px("#ffffff", e.x - 2, e.y - 12, 4, 4);
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0d1b3a");
    g.addColorStop(0.6, "#1c3566");
    g.addColorStop(1, "#39598f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---------------------------------------------------------------- HUD  */

  const hud = {
    skills: document.getElementById("skill-bar"),
    rate: document.getElementById("rate-value"),
    out: document.getElementById("stat-out"),
    saved: document.getElementById("stat-saved"),
    time: document.getElementById("stat-time"),
    levelName: document.getElementById("level-name"),
    hint: document.getElementById("level-hint"),
    speed: document.getElementById("btn-speed"),
    pause: document.getElementById("btn-pause"),
    nuke: document.getElementById("btn-nuke"),
    sound: document.getElementById("btn-sound"),
    menu: document.getElementById("menu"),
    levelList: document.getElementById("level-list"),
    result: document.getElementById("result"),
    resultTitle: document.getElementById("result-title"),
    resultText: document.getElementById("result-text"),
    btnNext: document.getElementById("btn-next"),
    toast: document.getElementById("toast")
  };

  const skillButtons = {};
  Engine.SKILLS.forEach(function (s, i) {
    const b = document.createElement("button");
    b.className = "skill";
    b.dataset.skill = s;
    b.innerHTML = '<span class="key">' + (i + 1) + '</span>' +
      '<span class="name">' + SKILL_LABEL[s] + '</span>' +
      '<span class="count">0</span>';
    b.addEventListener("click", function () { selectSkill(s); });
    hud.skills.appendChild(b);
    skillButtons[s] = b;
  });

  function updateHud() {
    const st = Engine.state;
    Engine.SKILLS.forEach(function (s) {
      const b = skillButtons[s];
      const n = st.skills[s] || 0;
      b.querySelector(".count").textContent = n;
      b.classList.toggle("empty", n === 0);
      b.classList.toggle("active", s === selected);
    });
    hud.rate.textContent = st.rate;
    hud.out.textContent = Engine.aliveCount();
    hud.saved.textContent = st.saved + "/" + st.level.need;
    const secs = Math.ceil(st.timeLeft / TPS);
    hud.time.textContent = Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0");
    hud.time.classList.toggle("warn", secs <= 30);
  }

  let toastTimer = 0;
  function toast(msg) {
    hud.toast.textContent = msg;
    hud.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { hud.toast.classList.remove("show"); }, 1800);
  }

  /* --------------------------------------------------------------- sound */

  const Sfx = {
    actx: null, muted: false,
    ensure: function () {
      if (!this.actx && window.AudioContext) this.actx = new AudioContext();
      return this.actx;
    },
    play: function (kind) {
      if (this.muted) return;
      const a = this.ensure();
      if (!a) return;
      const t = a.currentTime;
      const o = a.createOscillator(), g = a.createGain();
      o.connect(g); g.connect(a.destination);
      if (kind === "assign") { o.type = "square"; o.frequency.setValueAtTime(880, t); g.gain.setValueAtTime(0.05, t); }
      else if (kind === "saved") { o.type = "triangle"; o.frequency.setValueAtTime(660, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.12); g.gain.setValueAtTime(0.07, t); }
      else if (kind === "splat") { o.type = "sawtooth"; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.15); g.gain.setValueAtTime(0.08, t); }
      else { o.type = "sawtooth"; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.25); g.gain.setValueAtTime(0.12, t); }
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.start(t); o.stop(t + 0.32);
    }
  };

  /* ------------------------------------------------------------- session */

  let selected = "DIGGER";
  let levelIndex = 0;
  let paused = false, speed = 1, running = false;
  let pointer = { x: -99, y: -99, inside: false };
  let nukeArmed = 0;

  function progress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) { /* private mode */ }
  }

  function selectSkill(s) {
    selected = s;
    updateHud();
  }

  function startLevel(i) {
    levelIndex = i;
    Engine.load(LEVELS[i]);
    repaintTerrain();
    paused = false; speed = 1; nukeArmed = 0;
    running = true;
    hud.speed.textContent = "×1";
    hud.pause.textContent = "Pause";
    hud.levelName.textContent = (i + 1) + ". " + LEVELS[i].name;
    hud.hint.textContent = LEVELS[i].hint;
    hud.menu.classList.add("hidden");
    hud.result.classList.add("hidden");
    selected = firstAvailableSkill();
    updateHud();
  }

  function firstAvailableSkill() {
    const st = Engine.state;
    for (let i = 0; i < Engine.SKILLS.length; i++) {
      const s = Engine.SKILLS[i];
      if (st.skills[s] > 0) return s;
    }
    return "DIGGER";
  }

  function showMenu() {
    running = false;
    hud.result.classList.add("hidden");
    hud.menu.classList.remove("hidden");
    buildLevelList();
  }

  function buildLevelList() {
    const p = progress();
    hud.levelList.innerHTML = "";
    LEVELS.forEach(function (lv, i) {
      const done = p[lv.name];
      const b = document.createElement("button");
      b.className = "level-card" + (done ? " done" : "");
      b.innerHTML = '<span class="num">' + (i + 1) + '</span>' +
        '<span class="title">' + lv.name + '</span>' +
        '<span class="meta">Save ' + lv.need + ' of ' + lv.count +
        ' &middot; ' + lv.minutes + ' min' + (done ? ' &middot; best ' + done : '') + '</span>';
      b.addEventListener("click", function () { startLevel(i); });
      hud.levelList.appendChild(b);
    });
  }

  function finishLevel() {
    running = false;
    const st = Engine.state;
    const lv = LEVELS[levelIndex];
    if (st.won) {
      const p = progress();
      if (!p[lv.name] || p[lv.name] < st.saved) { p[lv.name] = st.saved; saveProgress(p); }
    }
    hud.resultTitle.textContent = st.won ? "Level complete!" : "Not this time";
    hud.resultText.textContent = "You saved " + st.saved + " of " + lv.count +
      " lemmings — " + (st.won ? lv.need + " were needed." : "you needed " + lv.need + ".");
    hud.btnNext.classList.toggle("hidden", !st.won || levelIndex >= LEVELS.length - 1);
    hud.result.classList.remove("hidden");
  }

  /* --------------------------------------------------------------- input */

  function toLevelCoords(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - r.left) * W / r.width),
      y: Math.round((e.clientY - r.top) * H / r.height)
    };
  }

  canvas.addEventListener("mousemove", function (e) {
    const p = toLevelCoords(e);
    pointer.x = p.x; pointer.y = p.y; pointer.inside = true;
  });
  canvas.addEventListener("mouseleave", function () { pointer.inside = false; });

  canvas.addEventListener("click", function (e) {
    if (!running) return;
    Sfx.ensure();
    const p = toLevelCoords(e);
    pointer.x = p.x; pointer.y = p.y; pointer.inside = true;
    const l = Engine.pick(p.x, p.y, selected);
    if (!l) return;
    if (!Engine.assign(l, selected)) {
      if (!Engine.state.skills[selected]) toast("No " + SKILL_LABEL[selected] + "s left");
      return;
    }
    updateHud();
  });

  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  document.addEventListener("keydown", function (e) {
    if (e.key >= "1" && e.key <= "8") { selectSkill(Engine.SKILLS[+e.key - 1]); return; }
    switch (e.key.toLowerCase()) {
      case " ": e.preventDefault(); togglePause(); break;
      case "f": cycleSpeed(); break;
      case "n": requestNuke(); break;
      case "r": if (Engine.state.level) startLevel(levelIndex); break;
      case "escape": showMenu(); break;
      case "-": case "_": Engine.setRate(Engine.state.rate - 5); updateHud(); break;
      case "+": case "=": Engine.setRate(Engine.state.rate + 5); updateHud(); break;
    }
  });

  function togglePause() {
    if (!running) return;
    paused = !paused;
    hud.pause.textContent = paused ? "Resume" : "Pause";
  }

  function cycleSpeed() {
    speed = speed === 1 ? 2 : (speed === 2 ? 4 : 1);
    hud.speed.textContent = "×" + speed;
  }

  function requestNuke() {
    if (!running || Engine.state.nuking) return;
    const now = Date.now();
    if (now - nukeArmed > 2000) {
      nukeArmed = now;
      toast("Press nuke again to confirm");
      return;
    }
    Engine.nuke();
    toast("Nuke!");
  }

  hud.pause.addEventListener("click", togglePause);
  hud.speed.addEventListener("click", cycleSpeed);
  hud.nuke.addEventListener("click", requestNuke);
  hud.sound.addEventListener("click", function () {
    Sfx.muted = !Sfx.muted;
    hud.sound.textContent = Sfx.muted ? "Sound off" : "Sound on";
  });
  document.getElementById("btn-rate-down").addEventListener("click", function () { Engine.setRate(Engine.state.rate - 5); updateHud(); });
  document.getElementById("btn-rate-up").addEventListener("click", function () { Engine.setRate(Engine.state.rate + 5); updateHud(); });
  document.getElementById("btn-menu").addEventListener("click", showMenu);
  document.getElementById("btn-retry").addEventListener("click", function () { startLevel(levelIndex); });
  document.getElementById("btn-result-menu").addEventListener("click", showMenu);
  hud.btnNext.addEventListener("click", function () { startLevel(Math.min(levelIndex + 1, LEVELS.length - 1)); });

  /* ---------------------------------------------------------------- loop */

  let acc = 0, last = 0;

  function frame(now) {
    const dt = Math.min(120, now - last || 16);
    last = now;

    if (running && !paused) {
      acc += dt * speed;
      const step = 1000 / TPS;
      let guard = 0;
      while (acc >= step && guard++ < 8) {
        Engine.tick();
        acc -= step;
        Engine.state.events.forEach(function (ev) { Sfx.play(ev); });
        if (Engine.state.over) { finishLevel(); break; }
      }
      updateHud();
    }

    draw(now);
    requestAnimationFrame(frame);
  }

  function draw(now) {
    drawBackground();
    if (!Engine.state.level) return;
    if (Engine.state.dirty) repaintTerrain();

    drawExit(now);
    ctx.drawImage(terrainCanvas, 0, 0);
    drawHatch(now);

    const st = Engine.state;
    for (let i = 0; i < st.lems.length; i++) drawLem(st.lems[i]);

    ctx.fillStyle = "#ffd166";
    for (let i = 0; i < st.particles.length; i++) {
      const p = st.particles[i];
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }

    // cursor: box around the lemming that would take the skill
    if (pointer.inside && running) {
      const l = Engine.pick(pointer.x, pointer.y, selected);
      ctx.strokeStyle = l ? (Engine.canAssign(l, selected) ? "#7CFF7C" : "#ff7676") : "rgba(255,255,255,.35)";
      ctx.lineWidth = 1;
      if (l) ctx.strokeRect(Math.round(l.x) - 5.5, Math.round(l.y) - Engine.LEM_H - 2.5, 11, Engine.LEM_H + 4);
      else ctx.strokeRect(pointer.x - 5.5, pointer.y - 5.5, 11, 11);
    }

    if (paused && running) {
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", W / 2, H / 2);
      ctx.textAlign = "left";
    }
  }

  /* ---------------------------------------------------------------- boot */

  Engine.load(LEVELS[0]);
  repaintTerrain();
  hud.levelName.textContent = "1. " + LEVELS[0].name;
  hud.hint.textContent = LEVELS[0].hint;
  updateHud();
  showMenu();
  requestAnimationFrame(frame);
})();
