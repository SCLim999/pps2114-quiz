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

## Bonus: VitroxCraft — ViTrox Campus 2.0 in a web Minecraft (`minecraft/`)

`minecraft/index.html` is a standalone, Minecraft-Education-style voxel world that
recreates the [ViTrox Campus 2.0 by CYC Architect](https://www.cycarch.com/vitrox-campus-20)
(Batu Kawan, Penang) — central circular courtyard, radial layout, circular landscape
ramp, doorless entrance, green roof, and the rectangular production/office blocks
punching through the circular form, including two computer rooms (~20 PCs total)
on the 4th floor of the VITROX-lettered building, reached via a staircase next to
the staff canteen.

- Open `minecraft/index.html` in a desktop browser (needs internet once, to load
  Three.js from a CDN; everything else is generated procedurally — no assets).
- Walk (WASD), fly (F), break/place blocks (mouse), and visit the **9 golden info
  blocks** to read architecture lessons about the building's design.
- **Trilingual**: the whole UI and all lessons switch between 中文 / English /
  Bahasa Melayu (top-right of the start menu; auto-detected on first load).
- **Multiplayer**: host a room from the start menu, share the 5-letter code, and
  classmates join over WebRTC (PeerJS) — positions and block edits sync live, no
  server needed.
- **Text-to-speech**: a 🔊 button on every lesson/dialogue reads the current text
  aloud in the selected language via the browser's built-in speech engine, or turn
  on "auto-read" in the start menu to have it read automatically every time. No
  internet or account needed; hidden automatically if the browser doesn't support it.
- **Male/female voices**: NPC dialogue automatically picks a voice matching the
  character's look (male guards/engineers/founders/Dr Janaka Low vs. female Siti/
  Mei Ling/Priya); a 👨/👩 picker in the start menu sets the narrator voice used
  for the architecture lessons themselves.
- **CodingMine coding tasks**: 3 of the computers in Computer Room 1 (green screens)
  are interactive workstations set in a fictional software company, "CodingMine" —
  press E to start Chapter 1, "All that Syntax": learn what an algorithm and a
  computer language are, practise C/C++ syntax with `player.say(...)`, tell strings
  apart from numbers, and help the CEO debug a broken snippet. Correct answers earn
  points shown live in the HUD and in the quest dashboard (press Q); progress is
  saved to `localStorage`. The two computer rooms are also staffed by 4 Computing
  School lecturers (Ts Dr Lim SC, Ms Syira, Ms Khor JY, Mr Eng YK) you can talk to.
- Player edits are saved to `localStorage`; the start menu has a world-reset button.
- Full user guide (Chinese): [`minecraft/MANUAL.md`](minecraft/MANUAL.md)

## How feedback works

- **Theory:** immediately after checking an answer, the option is marked right/wrong
  and a targeted explanation for the chosen option is shown.
- **Coding:** on every *Run & Check*, the student sees compiler errors (if any), a
  pass/fail table of all test cases with expected vs. actual output, and hint messages
  (e.g. "you never read input with `cin`"). Students can retry until they submit.
- **On submission:** a results screen summarises the score and all feedback, and the
  marks are recorded to the spreadsheet.
