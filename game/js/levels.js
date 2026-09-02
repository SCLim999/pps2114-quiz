/**
 * ======================= LEVELS =======================
 * Each level is plain data, so new levels can be added without touching
 * the engine.
 *
 *   name      Level title shown in the menu and HUD.
 *   hint      One-line tip shown before the level starts.
 *   count     How many lemmings walk out of the hatch.
 *   need      How many must reach the exit to win.
 *   minutes   Time limit.
 *   rate      Starting release rate (1 = slow drip, 99 = flood).
 *   entrance  Hatch position; lemmings drop from here.
 *   exit      Foot position of the exit door (its floor level).
 *   skills    How many of each skill the player may hand out.
 *   shapes    Terrain, painted in order. Materials:
 *               dirt  — normal ground, can be dug/bashed/mined
 *               rock  — same, but darker (used for walls)
 *               steel — indestructible
 * =======================================================
 */
const LEVELS = [
  {
    name: "Just Dig!",
    hint: "The exit is under your feet: dig a shaft through the slab. Not right under the hatch, though — that drop would be fatal.",
    count: 10, need: 8, minutes: 4, rate: 50,
    entrance: { x: 80, y: 150 },
    exit: { x: 520, y: 260 },
    skills: { CLIMBER: 0, FLOATER: 0, BOMBER: 2, BLOCKER: 1, BUILDER: 2, BASHER: 0, MINER: 0, DIGGER: 5 },
    shapes: [
      { t: 'rect', mat: 'dirt', x: 0, y: 200, w: 640, h: 40 },
      { t: 'rect', mat: 'rock', x: 0, y: 260, w: 640, h: 100 }
    ]
  },
  {
    name: "Up and Over",
    hint: "Climbers get over the wall, but only floaters survive the drop. A miner could bring everyone through instead.",
    count: 12, need: 9, minutes: 5, rate: 50,
    entrance: { x: 60, y: 200 },
    exit: { x: 560, y: 320 },
    skills: { CLIMBER: 4, FLOATER: 4, BOMBER: 1, BLOCKER: 2, BUILDER: 2, BASHER: 1, MINER: 2, DIGGER: 1 },
    shapes: [
      { t: 'rect', mat: 'dirt', x: 0, y: 240, w: 190, h: 120 },
      { t: 'rect', mat: 'rock', x: 190, y: 110, w: 40, h: 250 },
      { t: 'rect', mat: 'dirt', x: 230, y: 320, w: 410, h: 40 }
    ]
  },
  {
    name: "Mind the Gap",
    hint: "Nothing crosses a chasm like a builder — and nothing stops a queue like a blocker.",
    count: 12, need: 7, minutes: 5, rate: 40,
    entrance: { x: 70, y: 170 },
    exit: { x: 590, y: 220 },
    skills: { CLIMBER: 2, FLOATER: 2, BOMBER: 2, BLOCKER: 2, BUILDER: 12, BASHER: 0, MINER: 0, DIGGER: 0 },
    shapes: [
      { t: 'rect', mat: 'dirt', x: 0, y: 220, w: 250, h: 140 },
      { t: 'rect', mat: 'dirt', x: 370, y: 220, w: 270, h: 140 },
      { t: 'rect', mat: 'rock', x: 0, y: 330, w: 250, h: 30 },
      { t: 'rect', mat: 'rock', x: 370, y: 330, w: 270, h: 30 }
    ]
  },
  {
    name: "Hold the Line",
    hint: "Bash your way out of the pen — but the cliff on the left needs a blocker first.",
    count: 12, need: 8, minutes: 6, rate: 40,
    entrance: { x: 320, y: 250 },
    exit: { x: 600, y: 300 },
    skills: { CLIMBER: 2, FLOATER: 2, BOMBER: 2, BLOCKER: 2, BUILDER: 4, BASHER: 2, MINER: 2, DIGGER: 2 },
    shapes: [
      { t: 'rect', mat: 'dirt', x: 120, y: 300, w: 520, h: 40 },
      { t: 'rect', mat: 'steel', x: 120, y: 340, w: 520, h: 20 },
      { t: 'rect', mat: 'rock', x: 200, y: 150, w: 20, h: 150 },
      { t: 'rect', mat: 'rock', x: 420, y: 150, w: 20, h: 150 }
    ]
  }
];
