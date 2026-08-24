/* Print one level with a ruler, marking tiles the validator can reach. */
const { LEVELS } = require("../js/levels.js");
const path = require("path");
const i = parseInt(process.argv[2], 10) - 1;
const L = LEVELS[i];
const W = L.map[0].length;
let ruler = "   ";
for (let x = 0; x < W; x++) ruler += x % 10;
console.log(`#${i + 1} ${L.name}  (${W}x${L.map.length})`);
console.log(ruler);
L.map.forEach((r, y) => console.log(String(y).padStart(2) + " " + r));
