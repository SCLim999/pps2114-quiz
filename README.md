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
| `game/` | **恐龙时代 / Dinosaur Era** — a standalone arcade shooting game (see below) |

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

---

## 恐龙时代 / Dinosaur Era — arcade shooting game

A standalone light-gun style shooter in `game/`, inspired by the "Dinosaur Era"
arcade cabinet. It is completely separate from the assessment — nothing in
`index.html` links to it, so students cannot wander into it during a test.

Open `game/index.html` in a browser (or host the folder) and play. No build
step, no assets, no dependencies: the jungle, the ruined skyline and all four
dinosaurs are drawn with Canvas 2D paths, and every sound is synthesised with
the Web Audio API at runtime.

| File | Purpose |
|---|---|
| `game/index.html` | Cabinet frame, start / pause / game-over overlays |
| `game/css/game.css` | Arcade styling, responsive layout |
| `game/js/game.js` | The whole game — perspective, dinosaurs, waves, HUD, audio |

**Controls** — mouse or touch to aim and fire, `R` to reload (auto-reloads when
the magazine is empty), `Space` to fire at the crosshair, `P` / `Esc` to pause.

**How it plays** — dinosaurs walk in from the horizon and grow as they get
closer; let one reach you and it takes a chunk of your health. Headshots do
double damage and score double, consecutive kills build a combo multiplier up
to ×4, and a missed shot breaks the combo. Every 5th wave sends a Spinosaurus
boss. The high score is kept in `localStorage`.

**Tuning it** — the four species live in the `TYPES` table at the top of
`game/js/game.js` (health, speed, size, score, damage, colours, hit boxes).
Wave composition and pacing are in `nextWave()`; magazine size, reload time and
starting health are the constants at the top of the file. While the page is
open, `window.DinoEra.state` exposes the live game state for debugging from the
browser console.
