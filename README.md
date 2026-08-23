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

## How feedback works

- **Theory:** immediately after checking an answer, the option is marked right/wrong
  and a targeted explanation for the chosen option is shown.
- **Coding:** on every *Run & Check*, the student sees compiler errors (if any), a
  pass/fail table of all test cases with expected vs. actual output, and hint messages
  (e.g. "you never read input with `cin`"). Students can retry until they submit.
- **On submission:** a results screen summarises the score and all feedback, and the
  marks are recorded to the spreadsheet.

---

## 附加：虚拟 Microsoft Windows 1.01 (`win1/index.html`)

一个与测验程序无关的独立网页小玩具 —— 用纯 HTML/CSS/JavaScript 模拟
**从开机自检到图形界面**的完整 Windows 1.0 体验，不需要任何依赖或服务器，
双击 `win1/index.html` 就能运行。

**流程**：电源按钮 → BIOS 自检（640K 内存计数）→ MS-DOS 3.20 启动 →
自动执行 `WIN` → Windows 1.01 启动画面 → MS-DOS Executive 图形界面。
（自检过程中点击画面或按空格可快进。）

**界面**：忠实还原 Windows 1.0 的**平铺式**窗口 —— 窗口不重叠，
标题栏左边的小方块是关闭键，右边 `▲` 放大到全屏、`▼` 缩成底部图标；
拖动标题栏放到另一个窗口上可交换位置，拖到底部图标区即缩成图标；
拖动窗口之间的边界可以调整平铺比例。

**内附程序**

| 程序 | 说明 |
|---|---|
| MS-DOS Executive | 虚拟磁盘的文件管理器，双击 `.EXE` 运行、双击 `.TXT` 用记事本打开 |
| Notepad | 文本编辑器，可打开/保存到虚拟磁盘，含查找功能 |
| Calculator | 计算器（含 M+ / M- / MR / MC 与开方、百分比） |
| Clock | 模拟指针时钟 |
| Calendar | 月历，可为每天写备忘 |
| Reversi | 黑白棋，含合法着法判定、提示与三档 AI（α-β 搜索） |
| Paint | 单色画图：铅笔、直线、矩形、椭圆、橡皮、油漆桶、四档线宽 |
| Control Panel | 控制面板：窗口边框宽度、桌面底纹、CRT 扫描线、提示音 |

`Special → End Session` 会结束 Windows 回到 `C:\>` 提示符，
该提示符支持 `WIN`、`DIR`、`TYPE`、`CLS`、`VER`、`DATE`、`TIME`、`ECHO`、`HELP`，
输入 `WIN` 可再次进入 Windows。
