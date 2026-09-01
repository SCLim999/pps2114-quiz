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
| `js/turbo.js` | **Turbo C++ 3.0 emulation** — the DOS IDE used as the code editor |
| `css/turbo.css` | Text-mode (80x25) styling for the emulation |
| `turbo.html` | Stand-alone full-screen Turbo C++ 3.0 practice IDE |
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

## Turbo C++ 3.0 emulation

Students who were taught on Borland Turbo C++ 3.0 (1992) get the same IDE in the
browser. The coding questions use it as their editor, and `turbo.html` is a
full-screen version for free practice.

What is emulated:

- The 80x25 EGA text screen — blue desktop, pull-down menu bar, double-line
  window frames, scroll bars, drop shadows, blinking cursor, line:column
  indicator, and the grey status line.
- The original keyboard map: `F1` help, `F2` save, `F3` open, `F5` zoom,
  `F6` next window, `F9` make, `Alt+F9` compile, `Ctrl+F9` run, `Alt+F5` user
  screen, `Alt+F3` close, `F10` menu, `Alt+X` quit to DOS, plus the WordStar
  editor commands (`Ctrl+Y` delete line, `Ctrl+Q Y`, `Ctrl+K B/K/Y`, …).
- The **Compiling** status box, the **Message** window with Borland-style
  diagnostics (`Error HELLO.CPP 7: Statement missing ; in function main()`) that
  move the editor cursor to the offending line, and the black **user screen**
  showing program output.
- File | Open / Save against a small `C:` drive kept in the browser's
  `localStorage`, plus a toy `DOS shell` (`DIR`, `TYPE`, `CLS`, `VER`, `MEM`,
  `EXIT`).

What is *not* emulated: the debugger (`F7`/`F8`, watches, breakpoints), projects,
`Options` pages, and BGI graphics — those menu items answer with a polite dialog.
There is no x86 emulation: code is compiled by the same Wandbox service the rest
of the app uses.

### Turbo dialect support

Turbo-era source is accepted as written:

```cpp
#include <iostream.h>
#include <conio.h>

void main()
{
    clrscr();
    cout << "Hello, world!" << endl;
    getch();
}
```

Before compiling, `TurboIDE.modernize()` prepends a compatibility prologue
(modern headers, `using namespace std;`, no-op `clrscr()`/`getch()`/`gotoxy()`
shims), blanks the classic `.h` includes and rewrites `void main()` to
`int main()`. The prologue ends with a `#line 1` directive, so **error line
numbers still match what the student sees in the editor**. Source that is
already ISO C++ is passed through untouched.

### Switching it off

In `js/config.js`:

```js
TURBO_IDE: true   // false = plain textarea editor
```

Turbo-dialect source is translated either way, so the change only affects the
look of the editor.
