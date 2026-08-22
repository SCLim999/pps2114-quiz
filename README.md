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
| `git-game.html` | **Git Quest** — the Git branching/merging puzzle game (see below) |
| `css/style.css` | Styling |
| `js/config.js` | **Lecturer settings** — spreadsheet URL, assessment name |
| `js/questions.js` | **Question bank** — edit MCQs, coding tasks, test cases, feedback |
| `js/app.js` | Application logic (no editing needed) |
| `google-apps-script/Code.gs` | Script that writes marks into your Google Sheet |

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

# Git Quest — the Git branching game

`git-game.html` is a second, self-contained teaching app in the same repository:
a level-based game in the spirit of *Learn Git Branching* / *Oh My Git!*, where
**merge**, **rebase** and **conflict resolution** are puzzles instead of slides.
Open the file in a browser — no build step, no server, no network.

## What a student sees

* **A real simulator.** `js/git-engine.js` models a genuine commit DAG: three-way
  merges, fast-forward vs. merge commits, rebase and cherry-pick replay (copies
  are marked `C3'` like Git's own docs), conflict markers, staging, `--continue`
  and `--abort`, `reset` vs. `revert`, tags, detached HEAD, relative refs
  (`main~2`, `HEAD^2`).
* **An animated graph.** `js/git-viz.js` tweens the SVG graph on every command,
  so a rebase visibly replays commit by commit and branch labels glide to their
  new commit. A second, smaller graph always shows the **target** state.
* **20 levels in 5 worlds** (`js/git-levels.js`), bilingual EN / 中文:
  commits & branches → merging → rebase & cherry-pick → conflicts → undo & boss fight.
* **Gamification:** stars (3 if you match the reference solution's command count),
  XP and ranks, 11 badges, sequential level unlocking, hints, a step-by-step
  "show solution" playback, and a free-play **Sandbox**. Progress is saved in
  `localStorage`.
* **Conflict panel.** When a merge or rebase stops, the conflicted file appears in
  an editor with the real `<<<<<<< / ======= / >>>>>>>` markers and
  *keep ours / keep theirs / keep both* buttons; the student still has to
  `git add` and finish the operation.
* **Optional reporting.** The sidebar can POST the student's stars to the same
  Google Sheet as the C++ assessment (`CONFIG.SHEETS_WEBAPP_URL`, one row per
  student, one column per level, assessment name `PPS2114 Git Quest`). It is
  never sent automatically — the student clicks *Send progress*.

## Files

| File | Purpose |
|---|---|
| `git-game.html` | The game page |
| `css/git-game.css` | Game styling (dark console theme) |
| `js/git-engine.js` | The Git simulator + goal comparison |
| `js/git-viz.js` | Animated SVG commit-graph renderer |
| `js/git-levels.js` | **Level pack — edit this to add or change puzzles** |
| `js/git-portal.js` | Game loop: XP, stars, badges, terminal, hints |

## Adding a level

A level is defined by two command scripts, so you never have to hand-draw a
target graph — the game builds it by running your own solution:

```js
{
  id: "3-5", world: 3,
  name:  { en: "…", zh: "…" },
  brief: { en: "…", zh: "…" },          // what the student reads
  goal:  { en: "…", zh: "…" },          // one-line objective
  setup:    ["git commit -m Base", "git checkout -b feature", "git commit -m Work"],
  solution: ["git rebase main"],        // reference answer -> target graph + par
  compare:  { files: true, head: true },// also pin file contents / where HEAD ends
  hints: [{ en: "…", zh: "…" }]
}
```

Setup and solution scripts may use every simulator command plus two helpers:
`edit <file> "content"` (change a file — `\n` becomes a newline) and
`resolve <file> --ours|--theirs|--both` (the stand-in for opening the editor on a
conflict).

**How the goal check works.** The player's repo passes when its *graph shape*
matches the target: every branch's and tag's ancestry structure, the total number
of reachable commits, plus file contents at each branch tip when
`compare.files` is set and HEAD's location when `compare.head` is set. Commit ids
and commit messages are deliberately ignored, so any route that builds the right
history counts — a student who reaches the same graph a different way still wins.
Only commands that change history count towards the star rating, so `git status`,
`git log` and editing files are free.
