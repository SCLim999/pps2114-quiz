/* Breadth-first search that plays a level through the real engine.
   Monsters are removed and the clock is ignored: this proves the puzzle is
   completable and that the engine's rules (pushing, sliding, doors, sockets,
   teleports, toggles) actually let a player finish.                       */

const { Game, DIRS } = require("../js/engine.js");
const { LEVELS } = require("../js/levels.js");

const LIMIT = Number(process.env.LIMIT || 900000);

function snapshot(g) {
  return {
    grid: g.grid.map(r => r.join("")),
    items: g.items.map(r => r.map(i => i || ".").join("")),
    player: { ...g.player },
    blocks: g.blocks.map(b => ({ ...b })),
    keys: { ...g.keys },
    tools: { ...g.tools },
    collected: { ...g.collected },
    slide: g.slide,
    state: g.state
  };
}

function restore(g, s) {
  g.grid = s.grid.map(r => r.split(""));
  g.items = s.items.map(r => r.split("").map(c => (c === "." ? null : c)));
  g.player = { ...s.player };
  g.blocks = s.blocks.map(b => ({ ...b }));
  g.keys = { ...s.keys };
  g.tools = { ...s.tools };
  g.collected = { ...s.collected };
  g.slide = s.slide;
  g.state = s.state;
  g.events = [];
}

function key(s) {
  return s.grid.join("|") + "#" + s.items.join("|") + "#" + s.player.x + "," + s.player.y +
    "#" + s.slide + "#" + s.blocks.map(b => b.x + "," + b.y).sort().join(";") +
    "#" + Object.values(s.keys).join("") + Object.values(s.tools).map(Boolean).map(Number).join("");
}

function solve(level) {
  const g = new Game(level);
  g.monsters = [];
  const start = snapshot(g);
  const seen = new Set([key(start)]);
  let frontier = [{ s: start, path: "" }];
  let visited = 0;

  while (frontier.length) {
    const next = [];
    for (const node of frontier) {
      const moves = node.s.slide ? [null] : ["up", "down", "left", "right"];
      for (const mv of moves) {
        restore(g, node.s);
        g.monsters = [];
        g.step(mv);
        if (g.state === "dead") continue;
        const snap = snapshot(g);
        const k = key(snap);
        if (seen.has(k)) continue;
        seen.add(k);
        visited++;
        const path = node.path + (mv ? mv[0] : ".");
        if (g.state === "won") return { ok: true, moves: path.length, visited, path };
        if (visited > LIMIT) return { ok: false, reason: `gave up after ${visited} states`, visited };
        next.push({ s: snap, path });
      }
    }
    frontier = next;
  }
  return { ok: false, reason: "no solution exists", visited };
}

const only = process.argv[2] ? [Number(process.argv[2]) - 1] : LEVELS.map((_, i) => i);
let bad = 0;
for (const i of only) {
  const t0 = Date.now();
  const r = solve(LEVELS[i]);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (r.ok) {
    console.log(`ok   #${i + 1} ${LEVELS[i].name} — solved in ${r.moves} steps (${r.visited} states, ${secs}s)`);
    if (process.env.SHOW_PATH) console.log("PATH " + r.path);
  }
  else { bad++; console.log(`FAIL #${i + 1} ${LEVELS[i].name} — ${r.reason} (${secs}s)`); }
}
process.exit(bad ? 1 : 0);
