/* Static sanity check for the level maps.
   Node only — not shipped to the browser.

   Checks, per level:
     - map is rectangular, has exactly one start and one exit
     - every hardware/software part is reachable (tools + access cards picked up
       along the way, fixed-point expansion)
     - the exit CANNOT be reached before the socket opens
     - the exit CAN be reached once the socket opens
     - there are at least as many access cards of a colour as locked ports

   Approximations: monsters are ignored, crates count as walls (levels that need
   a crate bridge list the tiles it frees in `_bridge`), ice/data-bus tiles count
   as plain floor and teleports are treated as one connected set.            */

const { LEVELS } = require("../js/levels.js");

const WALL = "#";
const HAZARD = { "~": "F", "*": "H" };            // tile -> tool that survives it
const DOORS = { R: "r", B: "b", Y: "y", G: "g" };
const ITEMS = "csrbygFHKM";

let failures = 0;

function parse(level) {
  const g = level.map.map(r => r.split(""));
  const items = [];
  let start = null;
  const bridge = new Set((level._bridge || []).map(([x, y]) => x + "," + y));
  g.forEach((row, y) => row.forEach((ch, x) => {
    if (ch === "P") { start = { x, y }; g[y][x] = " "; }
    else if ("O@%&$".includes(ch)) { g[y][x] = ch === "O" ? "O" : " "; }
    else if (ITEMS.includes(ch)) { items.push({ x, y, ch }); g[y][x] = " "; }
    if (bridge.has(x + "," + y)) g[y][x] = " ";
  }));
  return { g, items, start };
}

function flood(g, start, have, socketOpen, teleports, switchFound) {
  const H = g.length, W = g[0].length;
  const seen = new Set(), stack = [start];
  const key = (x, y) => x + "," + y;
  seen.add(key(start.x, start.y));
  const passable = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const t = g[y][x];
    if (t === WALL || t === "O" || t === "!") return false;
    if (t === "S") return socketOpen;
    if (HAZARD[t]) return have.has(HAZARD[t]);
    if (DOORS[t]) return have.has(DOORS[t]);
    if (t === "-" || t === "|") return switchFound;
    return true;
  };
  while (stack.length) {
    const c = stack.pop();
    const nbrs = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy }));
    if (g[c.y][c.x] === "0") teleports.forEach(t => nbrs.push(t));
    for (const n of nbrs) {
      if (!passable(n.x, n.y) || seen.has(key(n.x, n.y))) continue;
      seen.add(key(n.x, n.y));
      stack.push(n);
    }
  }
  return seen;
}

function check(level, index) {
  const label = `#${index + 1} ${level.name}`;
  const problems = [];
  const W = level.map[0].length;
  level.map.forEach((r, y) => { if (r.length !== W) problems.push(`row ${y} is ${r.length} wide, expected ${W}`); });
  if (problems.length) { report(label, problems); return; }

  const { g, items, start } = parse(level);
  if (!start) problems.push("no start tile 'P'");
  const flat = g.flat();
  const count = ch => flat.filter(c => c === ch).length;
  if (count("X") !== 1) problems.push(`expected 1 exit, found ${count("X")}`);
  if (count("S") < 1) problems.push("no assembly socket 'S'");
  if (problems.length) { report(label, problems); return; }

  const teleports = [];
  g.forEach((row, y) => row.forEach((ch, x) => { if (ch === "0") teleports.push({ x, y }); }));

  // Fixed point: walk, pick up everything reachable, walk again.
  const have = new Set();
  let switchFound = false, reach, grew = true;
  while (grew) {
    reach = flood(g, start, have, false, teleports, switchFound);
    grew = false;
    for (const it of items) {
      if (reach.has(it.x + "," + it.y) && !"cs".includes(it.ch) && !have.has(it.ch)) { have.add(it.ch); grew = true; }
    }
    if (!switchFound) {
      g.forEach((row, y) => row.forEach((ch, x) => { if (ch === "k" && reach.has(x + "," + y)) { switchFound = true; grew = true; } }));
    }
  }

  const missed = items.filter(it => "cs".includes(it.ch) && !reach.has(it.x + "," + it.y));
  missed.forEach(m => problems.push(`part '${m.ch}' at (${m.x},${m.y}) is unreachable`));

  let exit = null;
  g.forEach((row, y) => row.forEach((ch, x) => { if (ch === "X") exit = { x, y }; }));
  if (reach.has(exit.x + "," + exit.y)) problems.push("exit can be reached without opening the socket");

  const open = flood(g, start, have, true, teleports, switchFound);
  if (!open.has(exit.x + "," + exit.y)) problems.push("exit is unreachable even with the socket open");

  for (const [door, card] of Object.entries(DOORS)) {
    if (card === "g") continue;                    // root access is never consumed
    const doors = count(door), cards = items.filter(i => i.ch === card).length;
    if (doors > cards) problems.push(`${doors} '${door}' ports but only ${cards} '${card}' cards`);
  }

  const hw = items.filter(i => i.ch === "c").length, sw = items.filter(i => i.ch === "s").length;
  report(label, problems, `${W}x${g.length}  hardware ${hw}  software ${sw}  tools [${[...have].join("")}]`);
}

function report(label, problems, extra = "") {
  if (problems.length) {
    failures++;
    console.log(`FAIL ${label}  ${extra}`);
    problems.forEach(p => console.log(`      - ${p}`));
  } else {
    console.log(`ok   ${label}  ${extra}`);
  }
}

LEVELS.forEach(check);
console.log(failures ? `\n${failures} level(s) need attention` : `\nall ${LEVELS.length} levels look sane`);
process.exit(failures ? 1 : 0);
