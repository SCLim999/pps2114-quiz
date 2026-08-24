# Bit Builder

A tile-based puzzle game in the spirit of *Chip's Challenge*: you play a
technician walking a grid of server rooms, collecting **hardware parts**
(CPUs, RAM, GPUs, drives, PSUs, fans, network cards, motherboards) and
**software parts** (OS images, drivers, compilers, antivirus, databases,
browsers). When nothing is missing, the **assembly socket** opens and you can
reach the **power button** to boot the machine — before the clock runs out.

Pure static HTML/CSS/JS. No build step, no dependencies, no image assets —
every sprite is drawn with canvas paths. Open `index.html` and play.

## Controls

| Action | Keys |
|---|---|
| Move | arrow keys or WASD (swipe, or the on-screen pad on touch devices) |
| Restart level | <kbd>R</kbd> |
| Pause | <kbd>P</kbd> |
| Confirm on an overlay | <kbd>Enter</kbd> / <kbd>Space</kbd> |

Progress and best times are kept in `localStorage`, so finishing a level
unlocks the next one on that browser.

## Mechanics

| Thing | Behaviour |
|---|---|
| Hardware / software part | must all be collected before the socket opens |
| Assembly socket | walk through it once nothing is missing |
| Access cards (red/blue/yellow) | one card opens one matching port |
| Root access (green) | opens every green port, never used up |
| Coolant spill | kills you unless you carry the **Coolant Seal** |
| Overheat zone | kills you unless you carry the **Heatsink** |
| Cryo ice | you slide until something stops you; **Grip Pads** cancel it. Corner tiles bend the slide |
| Data bus | carries you one tile per beat; **Mag Grips** ignore it |
| Crate | push it; shoved into coolant or fire it plugs the hazard |
| Surge trap | one-shot — destroys whatever steps on it, you or a monster |
| Scrubber | wipes every tool off your belt (cards survive) |
| Network port | throws you out of the next port, still moving |
| Toggle switch / toggle walls | the switch flips every toggle wall on the map |
| Bug / Glitch | wall followers (left hand / right hand) |
| Trojan | hunts you down | 
| Packet | flies straight and bounces |

## Files

| File | Purpose |
|---|---|
| `index.html` | the page |
| `css/game.css` | styling |
| `js/levels.js` | **the level maps** — ASCII art, one character per tile (legend at the top of the file) |
| `js/engine.js` | rules: movement, sliding, pushing, hazards, monsters, the clock |
| `js/sprites.js` | every sprite, drawn with canvas paths |
| `js/main.js` | game loop, camera, input, HUD, level select, sound |
| `tools/*.js` | Node scripts used to check the maps (not shipped to the browser) |

## Editing or adding levels

Levels live in `js/levels.js` as arrays of equal-length strings. The legend at
the top of that file lists every character. Add an entry and it appears in the
level list automatically; `time` is the clock in seconds and `hint` is the text
shown by the level's help terminal.

After editing, run the checks (Node, no dependencies):

```bash
cd game/tools
node validate-levels.js      # rectangular maps, reachable parts, exit only via the socket, cards vs ports
node solve.js                # breadth-first search that actually plays each level through the engine
node solve.js 5              # …or just one level
node replay.js               # hand-written routes for the two crate-heavy levels, which are too big for BFS
node show.js 7               # print a level with a coordinate ruler
```

`validate-levels.js` and `solve.js` are the useful ones: the first catches
broken geometry, the second proves a level can actually be finished.
