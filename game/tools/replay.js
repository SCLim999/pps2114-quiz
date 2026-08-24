/* Levels with several crates have too many states for the exhaustive search in
   solve.js, so they are verified by walking a hand-written route through the
   real engine instead. Reaching "won" proves crate pushing, hazard tools,
   doors, the socket rule and the map itself all line up.                   */

const { Game } = require("../js/engine.js");
const { LEVELS } = require("../js/levels.js");

const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const AVOID = "0T!";                       // ports and traps: never route through them

function runner(levelName) {
  const level = LEVELS.find(l => l.name === levelName);
  const g = new Game(level);
  g.monsters = [];                          // routing, not dodging

  const safe = (x, y) => {
    if (!g.playerCanEnter(x, y, "down") || g.blockAt(x, y)) return false;
    const t = g.grid[y][x];
    if (AVOID.includes(t)) return false;
    if (t === "~" && !g.tools.F) return false;
    if (t === "*" && !g.tools.H) return false;
    return true;
  };

  const step = dir => {
    g.step(dir);
    while (g.slide && g.state === "playing") g.step(null);
    if (g.state === "dead") throw new Error(`${levelName}: died — ${g.deathReason}`);
  };

  const walkTo = (tx, ty) => {
    for (let guard = 0; guard < 400; guard++) {
      if (g.player.x === tx && g.player.y === ty) return;
      const from = new Map([[g.player.x + "," + g.player.y, null]]);
      let frontier = [[g.player.x, g.player.y]], found = false;
      search:
      while (frontier.length) {
        const next = [];
        for (const [x, y] of frontier) {
          for (const [dir, [dx, dy]] of Object.entries(DIR)) {
            const nx = x + dx, ny = y + dy, k = nx + "," + ny;
            if (from.has(k) || !safe(nx, ny)) continue;
            from.set(k, { x, y, dir });
            if (nx === tx && ny === ty) { found = true; break search; }
            next.push([nx, ny]);
          }
        }
        frontier = next;
      }
      if (!found) throw new Error(`${levelName}: no route from ${g.player.x},${g.player.y} to ${tx},${ty}`);
      const dirs = [];
      let k = tx + "," + ty;
      while (from.get(k)) { const p = from.get(k); dirs.unshift(p.dir); k = p.x + "," + p.y; }
      for (const d of dirs) {                 // re-plan if a slide moved us off the plan
        const before = { x: g.player.x, y: g.player.y };
        step(d);
        const [dx, dy] = DIR[d];
        if (g.player.x !== before.x + dx || g.player.y !== before.y + dy) break;
      }
    }
    throw new Error(`${levelName}: gave up walking to ${tx},${ty}`);
  };

  return { g, step, walkTo, levelName };
}

function finish(r) {
  const { g, levelName } = r;
  if (g.state !== "won") throw new Error(`${levelName}: route ended in state "${g.state}"`);
  console.log(`ok   ${levelName} — hand route wins in ${g.moves} moves, ` +
    `${g.collected.hw}/${g.required.hw} hardware, ${g.collected.sw}/${g.required.sw} software`);
}

/* ------------------------------------------------------- #3 Coolant Spill */
{
  const r = runner("Coolant Spill");
  r.walkTo(3, 3);                    // hardware part — clears the crate's landing tile
  r.walkTo(3, 1);                    // line up north of the crate
  r.step("down"); r.step("down");    // shove it into the coolant channel
  r.walkTo(3, 6);                    // Coolant Seal
  r.walkTo(3, 9);
  r.walkTo(15, 5);                   // swim east across the lake
  r.walkTo(14, 1);
  r.walkTo(9, 1);                    // sealed chamber above the lake
  r.walkTo(14, 9);
  r.walkTo(14, 12);
  r.step("left");                    // through the assembly socket
  r.walkTo(8, 12);
  finish(r);
}

/* ------------------------------------------------------ #10 Final Assembly */
{
  const r = runner("Final Assembly");
  r.walkTo(3, 5);                    // hardware part in the start bay
  r.walkTo(1, 3);                    // west of the crate
  for (let i = 0; i < 6; i++) r.step("right");   // bridge the coolant at (8,3)
  r.walkTo(9, 3);                    // Coolant Seal on the dry pallet
  r.walkTo(9, 5);                    // blue access card
  r.walkTo(9, 1);
  r.walkTo(13, 3);                   // blue port into the east bay
  r.walkTo(14, 2); r.walkTo(15, 1); r.walkTo(15, 3);
  r.walkTo(13, 7);                   // Heatsink
  r.walkTo(15, 10); r.walkTo(15, 11);            // through the overheat strip
  r.walkTo(9, 10);                   // back across the coolant gap into the hub
  r.walkTo(4, 11);                   // Grip Pads before touching the ice
  r.walkTo(1, 9); r.walkTo(2, 7);
  r.walkTo(2, 13);
  r.walkTo(9, 13); r.walkTo(9, 16);
  r.walkTo(15, 13); r.walkTo(15, 16);
  r.walkTo(3, 16);
  r.step("left");                    // assembly socket
  r.step("left");                    // power button
  finish(r);
}
