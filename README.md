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
ramp, doorless entrances on all four sides (E/S/W/N), a paved roof terrace with
planters, and the rectangular production/office blocks punching through the
circular form, including two computer rooms (~20 PCs total) on the 4th floor of
the VITROX-lettered building, reached via a staircase next to the staff canteen —
or via a wide door straight from the ring building's roof terrace to the
VITROX building's 3rd floor (its ground/2nd-floor atrium opening and the
ring's own 2nd-floor entrance skybridge were widened to match). A wide
four-storey glass skybridge also connects the
ring building's stair tower straight to the lab building (the one full of
ViTrox inspection machines), with an opening at every one of the lab's four
floors.

- Open `minecraft/index.html` in a desktop browser (needs internet once, to load
  Three.js from a CDN; everything else is generated procedurally — no assets).
- **Password gate**: the page opens on a lock screen and won't reveal the start
  menu until the correct password is entered (ask the maintainer for it) — re-checked
  on every page load. Only a SHA-256 hash of the password ships in the source, not
  the plaintext.
- Walk (WASD), fly (F), break/place blocks (mouse), and visit the **10 golden info
  blocks** to read architecture lessons about the building's design (including
  one at the computer lab's blackboard).
- **Tutorial gate with a hands-on practice**: a yellow-shirted **Game Master**
  NPC waits just outside the basketball court's south gate and explains the
  controls. Talking to him alone doesn't unlock the game, though — right next
  to him is a yellow practice tile (place a block on it) and a plank block
  (break it). Every other NPC and golden info block stays locked (both
  the on-screen prompt and the reminder toast point you back to him) until
  you complete both, at which point a "🎉 Practice complete" toast unlocks
  everything. Progress is saved to `localStorage`, so it only has to happen
  once per browser.
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
- **DataMine IT quiz stations**: all 10 computers are in the first computer
  room — the one Ts Dr Lim SC is stationed in — 5 per row, facing each other
  across the aisle he stands in. Each has a *different screen colour* and a
  *single* multiple-choice question on a different computing topic —
  Introduction to Computing, C++ Programming, Database, Information Technology,
  Data Science, Artificial Intelligence, Networking & Internet, Operating
  System, HTML, and Software Design. Questions are short and fun, aimed at
  primary/secondary-school level. Walk up to a station and press E to answer;
  correct answers earn points shown live in the HUD (1 point per question, 10
  points total), saved to `localStorage`. The second computer room is now just
  décor — two rows of plain computers with no quiz. A big blackboard mounted on
  the wall between the two rooms (visible from both sides) shows live progress
  per topic and total score — and if a multiplayer room is active, a second
  column shows a live leaderboard of every connected player's score. The two
  computer rooms are also staffed by 4 Computing School
  lecturers you can talk to: Ts Dr Lim SC (Programme Leader · Software Engineering),
  Ms Syira (Data Science), Ms Khor JY (Mobile App Dev · Flutter), and Mr Eng YK
  (Artificial Intelligence). Two of them have a "▶ Watch teaching animation"
  button in their dialogue: Ms Syira's plays a data packet bouncing between
  a client and a server (Request/Response) for the Networking & Internet
  topic, and Mr Eng YK's plays a CPU box cycling round-robin through four
  processes (P1–P4) for the Operating System topic. Scattered through the
  ground-floor pilotis of the
  ViTrox Education college building — well apart from each other and from Dr
  Janaka Low (its Principal) — are 7 wooden mailbox-style kiosks — a post, a
  crate and a coloured icon plaque, Minecraft-signpost style — grouped by
  qualification type along the walkway: 4 diplomas first (💻 Computer Science,
  📈 Business Studies, ⚙️ Mechatronics Engineering, ⚡ Electrical and Electronic
  Engineering), then 3 bachelor's degrees (🎓 Mechatronics Engineering Hons
  with UCSI University, 🔌 Electronic Engineering Hons and 🤖 Computer Science
  (Intelligent Computing) Hons — both marked *Coming Soon* — with Universiti
  Sains Malaysia). Marketing officer Cindy wanders that floor to point
  visitors to them. Just south of the building, across a stretch of lawn, is
  a small **sakura garden**: a cross-shaped stone path around a central
  lantern, four benches, and a ring of 8 pink cherry-blossom trees with
  fallen-petal tiles scattered underneath — pure scenery, free to wander
  through.
- **HUD minimap, compass and play timer**: a small top-down minimap (top-left)
  shows the central courtyard as a reference circle, gold/green dots for
  unvisited/visited info points, blue dots for NPCs, and a white arrow for
  the player's position and facing. A scrolling compass tape (top-center)
  shows N/E/S/W sliding past a fixed center pointer as you turn, so it's
  always obvious which way you're facing and where to walk next. A play
  timer next to the explore/DataMine chips counts actual play time (paused
  while a menu or dialogue is open).
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
