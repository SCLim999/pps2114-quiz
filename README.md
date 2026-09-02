# PPS2114 — C++ Capability Assessment (Web App)

A web-based assessment that tests students on **C++ theory (multiple choice)** and
**C++ coding (compiled and run against real test cases)**, gives **instant feedback
after every attempt**, and **records marks into a Google Spreadsheet**.

No server needed — it is a static web page. Student C++ code is compiled by the free
[Wandbox](https://wandbox.org) public API (no account or key required).

## Files

| File | Purpose |
|---|---|
| `index.html` | The app page |
| `css/style.css` | Styling |
| `js/config.js` | **Lecturer settings** — spreadsheet URL, assessment name |
| `js/questions.js` | **Question bank** — edit MCQs, coding tasks, test cases, feedback |
| `js/app.js` | Application logic (no editing needed) |
| `google-apps-script/Code.gs` | Script that writes marks into your Google Sheet |
| `game/` | A separate Lemmings-like puzzle game (see below) |

## Setup — Google Sheets recording (one time, ~5 minutes)

1. Go to [sheets.new](https://sheets.new) and create a spreadsheet, e.g. *PPS2114 Marks*.
2. In the spreadsheet: **Extensions → Apps Script**.
3. Delete the placeholder code and paste in the contents of `google-apps-script/Code.gs`. Save.
4. Click **Deploy → New deployment → gear icon → Web app** and set:
   - **Execute as:** Me
   - **Who has access:** Anyone
5. Click **Deploy**, authorise the script when prompted, then copy the **Web app URL** (ends with `/exec`).
6. Open `js/config.js` and paste the URL:
   ```js
   SHEETS_WEBAPP_URL: "https://script.google.com/macros/s/XXXX/exec",
   ```
7. (Optional) In the Apps Script editor, run the `testAppend` function once — a test row
   should appear on a "Results" sheet. Delete the row afterwards.

Every student submission then appears as one row: timestamp, name, ID, class,
total, percentage, per-question scores, and notes (test cases passed, etc.).

> If you re-deploy the script later, use **Deploy → Manage deployments → Edit → New version**
> so the URL stays the same.

## Editing questions

Open `js/questions.js`:

- **Theory (`THEORY_QUESTIONS`)** — set `options`, the index of the correct `answer`,
  and per-option `explain` feedback shown after the student checks their answer.
- **Coding (`CODING_QUESTIONS`)** — set the task `text`, `starter` code, `tests`
  (`stdin` in, `expected` output; comparison ignores extra spaces/blank lines), and
  `hints` (regex checks that produce targeted feedback when a construct is missing,
  e.g. "no loop found"). Marks are awarded proportionally to test cases passed.
- **Debugging questions** — set `kind: "debug"` and put the buggy program in
  `starter`. Students must fix it so all test cases pass. Use hints with
  `fireWhen: "present"` to give targeted feedback while a specific bug is still
  in the code (e.g. the pattern `/i\s*<\s*n/` still matching means the off-by-one
  bug is unfixed). Compile errors are always shown verbatim from the compiler.

## Running / hosting

- **Quick test:** just open `index.html` in a browser.
- **For a class:** host the folder anywhere static — GitHub Pages, Netlify, or your
  course website — and give students the link. (Running C++ code requires internet
  access to reach the Wandbox API.)

## How feedback works

- **Theory:** immediately after checking an answer, the option is marked right/wrong
  and a targeted explanation for the chosen option is shown.
- **Coding:** on every *Run & Check*, the student sees compiler errors (if any), a
  pass/fail table of all test cases with expected vs. actual output, and hint messages
  (e.g. "you never read input with `cin`"). Students can retry until they submit.
- **On submission:** a results screen summarises the score and all feedback, and the
  marks are recorded to the spreadsheet.

## Bonus: `game/` — a Lemmings-like puzzle game

`game/index.html` is a stand-alone static page (no build step, no libraries) with a
small Lemmings-style game: lemmings pour out of a hatch, walk until something stops
them, and you save them by assigning one skill to one lemming at a time.

| File | Purpose |
|---|---|
| `game/index.html` | The game page |
| `game/css/game.css` | Styling |
| `game/js/levels.js` | **Level data** — terrain shapes, skill counts, targets |
| `game/js/engine.js` | Simulation: destructible pixel terrain + lemming state machine |
| `game/js/game.js` | Rendering, HUD and input |

**Skills:** Climber and Floater are permanent abilities; Bomber blows a lemming (and a
crater) up after five seconds; Blocker stands still and turns everyone else around;
Builder lays a twelve-brick staircase; Basher tunnels sideways; Miner tunnels
diagonally down; Digger digs straight down. Falling more than ~70 pixels is fatal
unless the lemming is a floater, and grey steel cannot be dug through.

**Controls:** click a skill (or press <kbd>1</kbd>–<kbd>8</kbd>), then click a lemming —
a green box means the skill can be given, red means it cannot. <kbd>Space</kbd> pauses,
<kbd>F</kbd> fast-forwards, <kbd>+</kbd>/<kbd>-</kbd> changes the release rate,
<kbd>N</kbd> nukes (twice to confirm), <kbd>R</kbd> restarts, <kbd>Esc</kbd> opens the
level list. Completed levels are remembered in the browser's local storage.

**Adding levels:** append an entry to `LEVELS` in `game/js/levels.js`. Terrain is a list
of `rect`, `circle` or `poly` shapes in a 640×360 space, each with a material of
`dirt`, `rock` or `steel`; also set the hatch position, the exit position, how many
lemmings are released, how many must be saved, the time limit and the skill counts.
