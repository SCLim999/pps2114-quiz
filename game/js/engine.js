/**
 * ======================= ENGINE =======================
 * Simulation for a Lemmings-like game: a destructible pixel terrain plus a
 * small state machine per lemming. Nothing in here draws anything — the
 * renderer in game.js reads Engine.state.
 * ======================================================
 */
const Engine = (function () {
  "use strict";

  const W = 640, H = 360;      // level size in pixels (also the canvas size)
  const TPS = 30;              // simulation ticks per second

  const MAT = { NONE: 0, DIRT: 1, ROCK: 2, STEEL: 3, BRICK: 4 };
  const MAT_BY_NAME = { dirt: MAT.DIRT, rock: MAT.ROCK, steel: MAT.STEEL, brick: MAT.BRICK };

  const LEM_H = 9;             // feet-to-head height
  const MAX_STEP = 6;          // tallest ledge a walker can step onto
  const FALL_SPEED = 2;
  const FLOAT_SPEED = 1;
  const MAX_FALL = 70;         // falling further than this is fatal
  const BUILD_BRICKS = 12;     // bricks a builder carries
  const BUILD_TICKS = 5;       // ticks between bricks
  const BRICK_W = 6, BRICK_STEP = 3;
  const FUSE_TICKS = 5 * TPS;
  const DIG_W = 9;             // width of a digger's shaft
  const BASH_W = 8;            // depth a basher chews per tick

  const SHRUG_TICKS = 24;      // pause after the last brick
  // actions that can be interrupted with a new job
  const WORKABLE = ["WALKER", "SHRUG"];

  const SKILLS = ["CLIMBER", "FLOATER", "BOMBER", "BLOCKER", "BUILDER", "BASHER", "MINER", "DIGGER"];

  /* ---------------------------------------------------------------- state */

  const state = {
    level: null,
    mask: new Uint8Array(W * H),   // 1 = solid
    mat: new Uint8Array(W * H),    // material id per solid pixel
    dirty: true,                   // terrain changed, renderer must repaint
    lems: [],
    particles: [],
    skills: {},                    // remaining uses per skill
    spawned: 0, saved: 0, dead: 0,
    ticks: 0, timeLeft: 0,
    rate: 50, spawnTimer: 0,
    nuking: false, nukeIndex: 0,
    over: false, won: false,
    events: []                     // sounds for the UI layer: 'assign','explode','saved','splat'
  };

  /* ------------------------------------------------------------- terrain */

  function idx(x, y) { return y * W + x; }

  /** Out-of-level sides count as wall; below the level is open air. */
  function solid(x, y) {
    if (x < 0 || x >= W) return true;
    if (y < 0) return false;
    if (y >= H) return false;
    return state.mask[idx(x, y)] === 1;
  }

  function anySolid(x0, y0, w, h) {
    for (let y = y0; y < y0 + h; y++) {
      if (y < 0 || y >= H) continue;
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || x >= W) continue;
        if (state.mask[idx(x, y)]) return true;
      }
    }
    return false;
  }

  /** Removes every non-steel pixel in the rectangle. */
  function digRect(x0, y0, w, h) {
    let removed = 0, steel = false;
    for (let y = y0; y < y0 + h; y++) {
      if (y < 0 || y >= H) continue;
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || x >= W) continue;
        const i = idx(x, y);
        if (!state.mask[i]) continue;
        if (state.mat[i] === MAT.STEEL) { steel = true; continue; }
        state.mask[i] = 0;
        removed++;
      }
    }
    if (removed) state.dirty = true;
    return { removed: removed, steel: steel };
  }

  /**
   * Blast crater. It is a wide, shallow ellipse rather than a circle so the
   * rim stays gentle enough for a walker to climb back out.
   */
  function digEllipse(cx, cy, rx, ry) {
    let removed = 0;
    for (let y = cy - ry; y <= cy + ry; y++) {
      if (y < 0 || y >= H) continue;
      for (let x = cx - rx; x <= cx + rx; x++) {
        if (x < 0 || x >= W) continue;
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        const i = idx(x, y);
        if (!state.mask[i] || state.mat[i] === MAT.STEEL) continue;
        state.mask[i] = 0;
        removed++;
      }
    }
    if (removed) state.dirty = true;
    return removed;
  }

  function fillRect(x0, y0, w, h, material) {
    for (let y = y0; y < y0 + h; y++) {
      if (y < 0 || y >= H) continue;
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || x >= W) continue;
        const i = idx(x, y);
        state.mask[i] = 1;
        state.mat[i] = material;
      }
    }
    state.dirty = true;
  }

  /** Paints the level shapes into mask/mat using an offscreen canvas. */
  function paintTerrain(level) {
    state.mask.fill(0);
    state.mat.fill(0);
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");

    ["dirt", "rock", "steel"].forEach(function (name) {
      const shapes = level.shapes.filter(function (s) { return s.mat === name; });
      if (!shapes.length) return;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      shapes.forEach(function (s) {
        ctx.beginPath();
        if (s.t === "rect") ctx.rect(s.x, s.y, s.w, s.h);
        else if (s.t === "circle") ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
        else if (s.t === "poly") {
          s.pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
          ctx.closePath();
        }
        ctx.fill();
      });
      const px = ctx.getImageData(0, 0, W, H).data;
      const id = MAT_BY_NAME[name];
      for (let i = 0; i < W * H; i++) {
        if (px[i * 4 + 3] > 128) { state.mask[i] = 1; state.mat[i] = id; }
      }
    });
    state.dirty = true;
  }

  /* ------------------------------------------------------------ lemmings */

  function makeLem(x, y) {
    return {
      id: state.spawned, x: x, y: y, dir: 1, act: "FALLER",
      fall: 0, sub: 0, anim: 0, bricks: 0, fuse: -1, wait: 0,
      climber: false, floater: false, alive: true, dying: 0
    };
  }

  function spawnInterval() {
    return Math.max(3, Math.round((105 - state.rate) / 3));
  }

  function aliveCount() {
    let n = 0;
    for (let i = 0; i < state.lems.length; i++) if (state.lems[i].alive) n++;
    return n;
  }

  function blockerAhead(l) {
    for (let i = 0; i < state.lems.length; i++) {
      const b = state.lems[i];
      if (b === l || !b.alive || b.act !== "BLOCKER") continue;
      if (Math.abs(b.y - l.y) > 10) continue;
      const dx = b.x - l.x;
      if (dx * l.dir > 0 && Math.abs(dx) <= 5) return true;
    }
    return false;
  }

  function atExit(l) {
    const e = state.level.exit;
    return l.x >= e.x - 7 && l.x <= e.x + 7 && l.y >= e.y - 18 && l.y <= e.y + 3;
  }

  function kill(l, how) {
    l.alive = false;
    l.act = how;
    state.dead++;
  }

  function explode(l) {
    digEllipse(l.x, l.y - 5, 17, 9);
    for (let i = 0; i < 14; i++) {
      state.particles.push({
        x: l.x, y: l.y - 4,
        vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4 - 1,
        life: 20 + Math.random() * 15
      });
    }
    state.events.push("explode");
    kill(l, "BOOM");
  }

  /* -------------------------------------------------- per-action updates */

  function walk(l) {
    if (!solid(l.x, l.y + 1)) { l.act = "FALLER"; l.fall = 0; return; }
    if (blockerAhead(l)) { l.dir = -l.dir; return; }

    const nx = l.x + l.dir;
    let step = 0;
    while (step <= MAX_STEP && solid(nx, l.y - step)) step++;

    if (step > MAX_STEP) {                       // a wall
      if (l.climber) { l.act = "CLIMBER"; l.sub = 0; return; }
      l.dir = -l.dir;
      return;
    }

    l.x = nx;
    l.y -= step;
    let down = 0;
    while (down < 3 && !solid(l.x, l.y + 1)) { l.y++; down++; }
    if (!solid(l.x, l.y + 1)) { l.act = "FALLER"; l.fall = 0; }
  }

  function fall(l) {
    const speed = (l.floater && l.fall > 6) ? FLOAT_SPEED : FALL_SPEED;
    for (let i = 0; i < speed; i++) {
      if (solid(l.x, l.y + 1)) {
        if (l.fall > MAX_FALL && !l.floater) { state.events.push("splat"); kill(l, "SPLAT"); return; }
        l.act = "WALKER";
        l.fall = 0;
        return;
      }
      l.y++;
      l.fall++;
    }
    if (l.y > H + 12) kill(l, "GONE");
  }

  function climb(l) {
    const wx = l.x + l.dir;
    if (solid(l.x, l.y - LEM_H)) {              // banged its head
      l.dir = -l.dir;
      l.act = "FALLER"; l.fall = 0;
      return;
    }
    if (!solid(wx, l.y - LEM_H + 1)) {          // over the top: pull up
      let ty = l.y - LEM_H + 1;
      while (ty < H && !solid(wx, ty)) ty++;
      l.x = wx;
      l.y = ty - 1;
      l.act = "WALKER";
      return;
    }
    l.y--;
    if (l.y < -LEM_H) { l.dir = -l.dir; l.act = "FALLER"; l.fall = 0; }
  }

  function build(l) {
    if (++l.sub < BUILD_TICKS) return;
    l.sub = 0;
    if (l.bricks <= 0) { l.act = "SHRUG"; l.sub = 0; return; }
    l.bricks--;

    const bx = l.dir > 0 ? l.x : l.x - BRICK_W + 1;
    fillRect(bx, l.y, BRICK_W, 1, MAT.BRICK);

    const nx = l.x + l.dir * BRICK_STEP;
    const ny = l.y - 1;
    if (solid(nx, ny) || solid(nx, ny - LEM_H + 1)) {  // wall or ceiling in the way
      l.dir = -l.dir;
      l.act = "SHRUG";
      l.sub = 0;
      return;
    }
    l.x = nx;
    l.y = ny;
    if (blockerAhead(l)) { l.dir = -l.dir; l.act = "SHRUG"; l.sub = 0; }
  }

  /** Out of bricks: stand and shrug for a moment so the player can react. */
  function shrug(l) {
    if (!solid(l.x, l.y + 1)) { l.act = "FALLER"; l.fall = 0; return; }
    if (++l.sub >= SHRUG_TICKS) l.act = "WALKER";
  }

  function bash(l) {
    const x0 = l.dir > 0 ? l.x + 1 : l.x - BASH_W;
    const res = digRect(x0, l.y - LEM_H, BASH_W, LEM_H + 1);

    if (res.removed) {
      l.sub = 1;                       // the tunnel has been started
    } else if (res.steel || l.sub) {
      l.act = "WALKER";                // hit bedrock, or broke through
      return;
    } else if (++l.wait > 90) {
      l.act = "WALKER";                // nothing to bash anywhere near
      return;
    } else {
      walk(l);                         // assigned early: stroll up to the wall
      return;
    }

    l.x += l.dir;
    if (l.x < 0 || l.x >= W) { l.x -= l.dir; l.dir = -l.dir; l.act = "WALKER"; return; }
    if (!solid(l.x, l.y + 1)) { l.act = "FALLER"; l.fall = 0; }
  }

  function mine(l) {
    const descend = (l.sub++ % 2) === 1;
    const x0 = l.dir > 0 ? l.x + 1 : l.x - BASH_W;
    const res = digRect(x0, l.y - LEM_H, BASH_W, LEM_H + (descend ? 2 : 1));
    if (!res.removed && res.steel) { l.act = "WALKER"; return; }

    l.x += l.dir;
    if (descend) l.y++;
    if (l.x < 0 || l.x >= W) { l.x -= l.dir; l.dir = -l.dir; l.act = "WALKER"; return; }
    if (l.y >= H) { kill(l, "GONE"); return; }
    if (!solid(l.x, l.y + 1)) { l.act = "FALLER"; l.fall = 0; }
  }

  function dig(l) {
    if ((l.sub++ % 2) === 1) return;
    const res = digRect(l.x - (DIG_W >> 1), l.y + 1, DIG_W, 1);
    if (!res.removed) {
      if (res.steel) { l.act = "WALKER"; return; }   // hit bedrock
      l.act = "FALLER"; l.fall = 0;                  // dug straight through
      return;
    }
    l.y++;
    if (l.y >= H) { kill(l, "GONE"); return; }
    if (!anySolid(l.x - (DIG_W >> 1), l.y + 1, DIG_W, 1)) { l.act = "FALLER"; l.fall = 0; }
  }

  function updateLem(l) {
    l.anim++;

    if (l.fuse > 0) {
      l.fuse--;
      if (l.fuse === 0) { explode(l); return; }
    }

    switch (l.act) {
      case "WALKER": walk(l); break;
      case "FALLER": fall(l); break;
      case "CLIMBER": climb(l); break;
      case "BUILDER": build(l); break;
      case "SHRUG": shrug(l); break;
      case "BASHER": bash(l); break;
      case "MINER": mine(l); break;
      case "DIGGER": dig(l); break;
      case "BLOCKER":
        if (!solid(l.x, l.y + 1)) { l.act = "FALLER"; l.fall = 0; }
        break;
    }

    if (l.alive && (l.act === "WALKER" || l.act === "FALLER" || l.act === "SHRUG") && atExit(l)) {
      l.alive = false;
      l.act = "EXIT";
      state.saved++;
      state.events.push("saved");
    }
  }

  /* ---------------------------------------------------------------- loop */

  function tick() {
    if (state.over) return;
    state.ticks++;
    state.events.length = 0;

    if (state.timeLeft > 0) {
      state.timeLeft--;
      if (state.timeLeft === 0 && !state.nuking) nuke();
    }

    // release lemmings from the hatch
    if (!state.nuking && state.spawned < state.level.count) {
      if (--state.spawnTimer <= 0) {
        state.lems.push(makeLem(state.level.entrance.x, state.level.entrance.y));
        state.spawned++;
        state.spawnTimer = spawnInterval();
      }
    }

    // the nuke arms one lemming every few ticks, like the original
    if (state.nuking && state.nukeIndex < state.lems.length) {
      if (state.ticks % 2 === 0) {
        const l = state.lems[state.nukeIndex++];
        if (l.alive && l.fuse < 0) l.fuse = FUSE_TICKS / 2;
      }
    }

    for (let i = 0; i < state.lems.length; i++) {
      const l = state.lems[i];
      if (l.alive) updateLem(l);
      else if (l.dying < 24) l.dying++;
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.vy += 0.35;
      p.x += p.vx; p.y += p.vy;
      if (--p.life <= 0) state.particles.splice(i, 1);
    }

    const done = (state.nuking || state.spawned >= state.level.count) && aliveCount() === 0;
    if (done) {
      state.over = true;
      state.won = state.saved >= state.level.need;
    }
  }

  /* ----------------------------------------------------------------- API */

  /** True when the skill may be handed to this lemming right now. */
  function canAssign(l, skill) {
    if (!l || !l.alive || l.fuse > 0) return false;
    if (!state.skills[skill]) return false;
    switch (skill) {
      case "CLIMBER": return !l.climber;
      case "FLOATER": return !l.floater;
      case "BOMBER": return true;
      case "BLOCKER": return WORKABLE.indexOf(l.act) >= 0;
      case "BUILDER": case "BASHER": case "MINER": case "DIGGER":
        return WORKABLE.indexOf(l.act) >= 0;
      default: return false;
    }
  }

  function assign(l, skill) {
    if (!canAssign(l, skill)) return false;
    state.skills[skill]--;
    switch (skill) {
      case "CLIMBER": l.climber = true; break;
      case "FLOATER": l.floater = true; break;
      case "BOMBER": l.fuse = FUSE_TICKS; break;
      case "BLOCKER": l.act = "BLOCKER"; break;
      case "BUILDER": l.act = "BUILDER"; l.bricks = BUILD_BRICKS; l.sub = BUILD_TICKS - 1; break;
      case "BASHER": l.act = "BASHER"; l.sub = 0; l.wait = 0; break;
      case "MINER": l.act = "MINER"; l.sub = 0; break;
      case "DIGGER": l.act = "DIGGER"; l.sub = 0; break;
    }
    state.events.push("assign");
    return true;
  }

  /** Lemming nearest to a point, preferring one that can take `skill`. */
  function pick(px, py, skill) {
    let best = null, bestD = 1e9, bestOk = false;
    for (let i = 0; i < state.lems.length; i++) {
      const l = state.lems[i];
      if (!l.alive) continue;
      if (px < l.x - 5 || px > l.x + 5) continue;
      if (py < l.y - LEM_H - 3 || py > l.y + 3) continue;
      const d = Math.abs(px - l.x) + Math.abs(py - (l.y - LEM_H / 2)) * 0.5;
      const ok = skill ? canAssign(l, skill) : true;
      if ((ok && !bestOk) || (ok === bestOk && d < bestD)) { best = l; bestD = d; bestOk = ok; }
    }
    return best;
  }

  function nuke() {
    if (state.nuking) return;
    state.nuking = true;
    state.nukeIndex = 0;
  }

  function setRate(r) {
    state.rate = Math.max(1, Math.min(99, r));
  }

  function load(level) {
    state.level = level;
    paintTerrain(level);
    state.lems = [];
    state.particles = [];
    state.skills = {};
    SKILLS.forEach(function (s) { state.skills[s] = level.skills[s] || 0; });
    state.spawned = 0; state.saved = 0; state.dead = 0;
    state.ticks = 0;
    state.timeLeft = Math.round(level.minutes * 60 * TPS);
    state.rate = level.rate;
    state.spawnTimer = TPS;          // one second of breathing space
    state.nuking = false; state.nukeIndex = 0;
    state.over = false; state.won = false;
    state.events = [];
  }

  return {
    W: W, H: H, TPS: TPS, LEM_H: LEM_H, MAT: MAT, SKILLS: SKILLS,
    MAX_FALL: MAX_FALL, FUSE_TICKS: FUSE_TICKS,
    state: state,
    load: load, tick: tick, assign: assign, canAssign: canAssign,
    pick: pick, nuke: nuke, setRate: setRate,
    solid: solid, aliveCount: aliveCount
  };
})();
