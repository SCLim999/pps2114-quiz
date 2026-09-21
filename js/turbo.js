/**
 * ============================================================
 *  Borland Turbo C++ 3.0 — browser emulation of the DOS IDE
 * ============================================================
 *
 *  A self-contained re-creation of the Turbo C++ 3.0 (1992)
 *  integrated development environment: the 80x25 EGA text
 *  screen, the blue desktop, the pull-down menu bar, the edit
 *  window with its double-line frame and scroll bars, the
 *  Compile status box, the Message window with Borland-style
 *  error lines, the black user screen, and the original
 *  keyboard map (F2 Save, F3 Open, F9 Make, Ctrl+F9 Run,
 *  Alt+F9 Compile, F10 Menu, Alt+X Quit, Ctrl+Y delete line...).
 *
 *  Code really is compiled and executed: the IDE delegates to a
 *  `runner(code, stdin)` callback (the quiz app hands it the
 *  Wandbox API wrapper), then reformats gcc diagnostics into
 *  Turbo's own "Error NONAME00.CPP 7: ..." style.
 *
 *  Usage:
 *      const ide = TurboIDE.mount(element, {
 *        code:    "int main(){}",     // initial source
 *        fileName:"NONAME00.CPP",
 *        runner:  async (code, stdin) => ({compileError, output, runtimeError}),
 *        onChange:(code) => {},
 *        onRunCheck: async (code, ide) => {}   // optional Ctrl+F9 override
 *      });
 *      ide.getCode(); ide.setCode(src); ide.focus();
 *
 *  No dependencies, no build step.
 */
(function (global) {
  "use strict";

  /* =========================================================
     1.  EGA text mode: palette, screen buffer, renderer
     ========================================================= */

  /** The 16 EGA/CGA colours as the IBM VGA BIOS produced them. */
  const PAL = [
    "#000000", "#0000a8", "#00a800", "#00a8a8", "#a80000", "#a800a8", "#a85400", "#a8a8a8",
    "#545454", "#5454fc", "#54fc54", "#54fcfc", "#fc5454", "#fc54fc", "#fcfc54", "#ffffff"
  ];
  const BLACK = 0, BLUE = 1, GREEN = 2, CYAN = 3, RED = 4, MAGENTA = 5, BROWN = 6, LGRAY = 7,
        DGRAY = 8, LBLUE = 9, LGREEN = 10, LCYAN = 11, LRED = 12, LMAGENTA = 13, YELLOW = 14, WHITE = 15;

  /** Code page 437 line-drawing sets. */
  const FRAME = {
    single: { tl: "┌", t: "─", tr: "┐", l: "│", r: "│", bl: "└", b: "─", br: "┘" },
    double: { tl: "╔", t: "═", tr: "╗", l: "║", r: "║", bl: "╚", b: "═", br: "╝" }
  };
  const SHADE = "░";       // ░ desktop pattern
  const BLOCK = "█";       // █
  const UP = "↑", DOWN = "↓", LEFT = "←", RIGHT = "→";
  const ARR_U = "▲", ARR_D = "▼", ARR_L = "◄", ARR_R = "►";
  const BULLET = "■";      // ■ close box / thumb
  const SUBMENU = "►";

  function escHtml(s) {
    return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }
  function padR(s, n) { s = String(s); return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); }
  function padL(s, n) { s = String(s); return s.length >= n ? s.slice(0, n) : " ".repeat(n - s.length) + s; }

  /** An 80x25 character cell buffer that renders itself to HTML. */
  class Screen {
    constructor(cols, rows) {
      this.cols = cols;
      this.rows = rows;
      const n = cols * rows;
      this.ch = new Array(n).fill(" ");
      this.fg = new Uint8Array(n);
      this.bg = new Uint8Array(n);
      this.cx = 0; this.cy = 0;
      this.cursor = false;
    }

    clear(fg, bg, ch) {
      this.ch.fill(ch || " ");
      this.fg.fill(fg || 0);
      this.bg.fill(bg || 0);
    }

    put(x, y, ch, fg, bg) {
      if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
      const i = y * this.cols + x;
      this.ch[i] = ch;
      this.fg[i] = fg;
      this.bg[i] = bg;
    }

    /** Write `text` clipped to the screen; returns the x after the text. */
    write(x, y, text, fg, bg) {
      text = String(text);
      for (let i = 0; i < text.length; i++) this.put(x + i, y, text[i], fg, bg);
      return x + text.length;
    }

    fill(x, y, w, h, ch, fg, bg) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, ch, fg, bg);
    }

    /** Recolour a run of cells without touching their characters. */
    recolour(x, y, w, fg, bg) {
      for (let i = 0; i < w; i++) {
        if (x + i < 0 || x + i >= this.cols || y < 0 || y >= this.rows) continue;
        const k = y * this.cols + x + i;
        if (fg !== null && fg !== undefined) this.fg[k] = fg;
        if (bg !== null && bg !== undefined) this.bg[k] = bg;
      }
    }

    /**
     * Draw a window/dialog frame.
     * opts: {double, fg, bg, title, titleFg, fill, footer}
     */
    frame(x, y, w, h, opts) {
      const o = opts || {};
      const f = o.double === false ? FRAME.single : FRAME.double;
      const fg = o.fg === undefined ? WHITE : o.fg;
      const bg = o.bg === undefined ? BLUE : o.bg;
      this.fill(x, y, w, h, " ", fg, bg);
      this.write(x, y, f.tl + f.t.repeat(Math.max(0, w - 2)) + f.tr, fg, bg);
      for (let j = 1; j < h - 1; j++) {
        this.put(x, y + j, f.l, fg, bg);
        this.put(x + w - 1, y + j, f.r, fg, bg);
      }
      this.write(x, y + h - 1, f.bl + f.b.repeat(Math.max(0, w - 2)) + f.br, fg, bg);
      if (o.title) {
        const t = " " + o.title + " ";
        const tx = x + Math.max(1, Math.floor((w - t.length) / 2));
        this.write(tx, y, t, o.titleFg === undefined ? fg : o.titleFg, bg);
      }
      if (o.footer) {
        const t = " " + o.footer + " ";
        const tx = x + Math.max(1, Math.floor((w - t.length) / 2));
        this.write(tx, y + h - 1, t, o.footerFg === undefined ? fg : o.footerFg, bg);
      }
      return { x: x + 1, y: y + 1, w: w - 2, h: h - 2 };
    }

    /** The classic drop shadow: darken the cells right of and below a box. */
    shadow(x, y, w, h) {
      const dim = (cx, cy) => {
        if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return;
        const k = cy * this.cols + cx;
        this.fg[k] = DGRAY;
        this.bg[k] = BLACK;
      };
      for (let j = 1; j < h; j++) { dim(x + w, y + j); dim(x + w + 1, y + j); }
      for (let i = 2; i < w + 2; i++) dim(x + i, y + h);
    }

    toHTML(cursorVisible, cursorX, cursorY) {
      const rows = [];
      for (let y = 0; y < this.rows; y++) {
        const base = y * this.cols;
        let html = "";
        let i = 0;
        while (i < this.cols) {
          const isCur = cursorVisible && y === cursorY && i === cursorX;
          const fg = this.fg[base + i], bg = this.bg[base + i];
          let text = this.ch[base + i];
          let j = i + 1;
          if (!isCur) {
            while (j < this.cols &&
                   this.fg[base + j] === fg && this.bg[base + j] === bg &&
                   !(cursorVisible && y === cursorY && j === cursorX)) {
              text += this.ch[base + j];
              j++;
            }
          }
          html += '<span' + (isCur ? ' class="tc-cur"' : "") +
                  ' style="color:' + PAL[fg] + ';background:' + PAL[bg] + '">' +
                  escHtml(text) + "</span>";
          i = j;
        }
        rows.push('<div class="tc-row">' + html + "</div>");
      }
      return rows.join("");
    }
  }

  /* =========================================================
     2.  Syntax highlighting (Turbo C++ 3.0 default colours)
     ========================================================= */

  const KEYWORDS = new Set((
    "asm auto break case catch cdecl char class const continue default delete do double else " +
    "enum extern far float for friend goto huge if inline int interrupt long near new operator " +
    "pascal private protected public register return short signed sizeof static struct switch " +
    "template this throw try typedef union unsigned virtual void volatile while bool true false " +
    "namespace using nullptr explicit mutable typename const_cast static_cast dynamic_cast"
  ).split(" "));

  const SYN = {
    plain:   YELLOW,   // identifiers and everything else
    keyword: WHITE,    // reserved words
    comment: DGRAY,    // /* */ and //
    string:  LCYAN,    // "..." and '...'
    number:  LCYAN,
    prepro:  LGREEN,   // #include, #define ...
    punct:   WHITE
  };

  /**
   * Colour one line of C++. `inComment` carries block-comment state
   * between lines. Returns { colours: Uint8Array(line.length), inComment }.
   */
  function highlight(line, inComment) {
    const col = new Uint8Array(line.length).fill(SYN.plain);
    let i = 0;

    if (!inComment && /^\s*#/.test(line)) {
      col.fill(SYN.prepro);
      // a // comment can still close a directive line
      const c = line.indexOf("//");
      if (c >= 0) for (let k = c; k < line.length; k++) col[k] = SYN.comment;
      return { colours: col, inComment: false };
    }

    while (i < line.length) {
      if (inComment) {
        const end = line.indexOf("*/", i);
        const stop = end < 0 ? line.length : end + 2;
        for (let k = i; k < stop; k++) col[k] = SYN.comment;
        if (end < 0) return { colours: col, inComment: true };
        i = stop;
        inComment = false;
        continue;
      }
      const c = line[i];
      const two = line.substr(i, 2);

      if (two === "//") {
        for (let k = i; k < line.length; k++) col[k] = SYN.comment;
        break;
      }
      if (two === "/*") {
        inComment = true;
        continue;
      }
      if (c === '"' || c === "'") {
        let k = i + 1;
        while (k < line.length) {
          if (line[k] === "\\") { k += 2; continue; }
          if (line[k] === c) { k++; break; }
          k++;
        }
        for (let m = i; m < Math.min(k, line.length); m++) col[m] = SYN.string;
        i = k;
        continue;
      }
      if (/[0-9]/.test(c) && (i === 0 || !/[A-Za-z0-9_]/.test(line[i - 1]))) {
        let k = i;
        while (k < line.length && /[0-9A-Fa-fxX.uUlL]/.test(line[k])) k++;
        for (let m = i; m < k; m++) col[m] = SYN.number;
        i = k;
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let k = i;
        while (k < line.length && /[A-Za-z0-9_]/.test(line[k])) k++;
        const word = line.slice(i, k);
        if (KEYWORDS.has(word)) for (let m = i; m < k; m++) col[m] = SYN.keyword;
        i = k;
        continue;
      }
      if (/[{}()\[\];,.<>+\-*/%=!&|^~?:]/.test(c)) col[i] = SYN.punct;
      i++;
    }
    return { colours: col, inComment };
  }

  /* =========================================================
     3.  The edit buffer (lines, cursor, block, undo)
     ========================================================= */

  const TABSIZE = 4;

  class Buffer {
    constructor(text, fileName) {
      this.setText(text || "");
      this.fileName = fileName || "NONAME00.CPP";
      this.modified = false;
      this.insert = true;
      this.cur = { r: 0, c: 0 };
      this.top = 0;
      this.left = 0;
      this.sel = null;              // {r, c} anchor while a block is marked
      this.undoStack = [];
      this.redoStack = [];
    }

    setText(text) {
      this.lines = String(text).replace(/\r\n?/g, "\n").split("\n");
      if (this.lines.length === 0) this.lines = [""];
    }
    getText() { return this.lines.join("\n"); }

    line(r) { return this.lines[r] === undefined ? "" : this.lines[r]; }
    get lineCount() { return this.lines.length; }

    snapshot() {
      this.undoStack.push({ lines: this.lines.slice(), cur: { r: this.cur.r, c: this.cur.c } });
      if (this.undoStack.length > 200) this.undoStack.shift();
      this.redoStack.length = 0;
    }
    undo() {
      const s = this.undoStack.pop();
      if (!s) return false;
      this.redoStack.push({ lines: this.lines.slice(), cur: { r: this.cur.r, c: this.cur.c } });
      this.lines = s.lines;
      this.cur = s.cur;
      this.modified = true;
      this.clampCursor();
      return true;
    }
    redo() {
      const s = this.redoStack.pop();
      if (!s) return false;
      this.undoStack.push({ lines: this.lines.slice(), cur: { r: this.cur.r, c: this.cur.c } });
      this.lines = s.lines;
      this.cur = s.cur;
      this.modified = true;
      this.clampCursor();
      return true;
    }

    clampCursor() {
      if (this.cur.r < 0) this.cur.r = 0;
      if (this.cur.r > this.lines.length - 1) this.cur.r = this.lines.length - 1;
      if (this.cur.c < 0) this.cur.c = 0;
      if (this.cur.c > this.line(this.cur.r).length) this.cur.c = this.line(this.cur.r).length;
    }

    /* ---- block (selection) helpers ---- */
    hasBlock() {
      return this.sel && !(this.sel.r === this.cur.r && this.sel.c === this.cur.c);
    }
    blockRange() {
      if (!this.hasBlock()) return null;
      const a = this.sel, b = this.cur;
      const first = (a.r < b.r || (a.r === b.r && a.c <= b.c)) ? a : b;
      const last = first === a ? b : a;
      return { sr: first.r, sc: first.c, er: last.r, ec: last.c };
    }
    blockText() {
      const b = this.blockRange();
      if (!b) return "";
      if (b.sr === b.er) return this.line(b.sr).slice(b.sc, b.ec);
      const out = [this.line(b.sr).slice(b.sc)];
      for (let r = b.sr + 1; r < b.er; r++) out.push(this.line(r));
      out.push(this.line(b.er).slice(0, b.ec));
      return out.join("\n");
    }
    deleteBlock() {
      const b = this.blockRange();
      if (!b) return false;
      this.snapshot();
      const head = this.line(b.sr).slice(0, b.sc);
      const tail = this.line(b.er).slice(b.ec);
      this.lines.splice(b.sr, b.er - b.sr + 1, head + tail);
      this.cur = { r: b.sr, c: b.sc };
      this.sel = null;
      this.modified = true;
      return true;
    }

    /* ---- editing primitives ---- */
    insertText(text) {
      if (this.hasBlock()) this.deleteBlock(); else this.snapshot();
      this.sel = null;
      const parts = String(text).replace(/\r\n?/g, "\n").replace(/\t/g, " ".repeat(TABSIZE)).split("\n");
      const cur = this.cur;
      const ln = this.line(cur.r);
      const head = ln.slice(0, cur.c);
      const tail = this.insert || parts.length > 1 ? ln.slice(cur.c) : ln.slice(cur.c + parts[0].length);
      if (parts.length === 1) {
        this.lines[cur.r] = head + parts[0] + tail;
        cur.c = head.length + parts[0].length;
      } else {
        const block = [head + parts[0]];
        for (let i = 1; i < parts.length - 1; i++) block.push(parts[i]);
        block.push(parts[parts.length - 1] + tail);
        this.lines.splice(cur.r, 1, ...block);
        cur.r += parts.length - 1;
        cur.c = parts[parts.length - 1].length;
      }
      this.modified = true;
    }

    newLine() {
      if (this.hasBlock()) this.deleteBlock(); else this.snapshot();
      this.sel = null;
      const ln = this.line(this.cur.r);
      const head = ln.slice(0, this.cur.c);
      const tail = ln.slice(this.cur.c);
      // Turbo's auto-indent: the new line starts under the first non-blank
      const indent = (head.match(/^\s*/) || [""])[0];
      this.lines.splice(this.cur.r, 1, head, indent + tail);
      this.cur.r += 1;
      this.cur.c = indent.length;
      this.modified = true;
    }

    backspace() {
      if (this.hasBlock()) { this.deleteBlock(); return; }
      this.snapshot();
      const { r, c } = this.cur;
      if (c > 0) {
        const ln = this.line(r);
        this.lines[r] = ln.slice(0, c - 1) + ln.slice(c);
        this.cur.c = c - 1;
      } else if (r > 0) {
        const prev = this.line(r - 1);
        this.lines.splice(r - 1, 2, prev + this.line(r));
        this.cur = { r: r - 1, c: prev.length };
      } else {
        this.undoStack.pop();
        return;
      }
      this.modified = true;
    }

    del() {
      if (this.hasBlock()) { this.deleteBlock(); return; }
      this.snapshot();
      const { r, c } = this.cur;
      const ln = this.line(r);
      if (c < ln.length) {
        this.lines[r] = ln.slice(0, c) + ln.slice(c + 1);
      } else if (r < this.lines.length - 1) {
        this.lines.splice(r, 2, ln + this.line(r + 1));
      } else {
        this.undoStack.pop();
        return;
      }
      this.modified = true;
    }

    /** Ctrl+Y — the Turbo/WordStar "delete whole line". */
    deleteLine() {
      this.snapshot();
      if (this.lines.length === 1) this.lines[0] = "";
      else this.lines.splice(this.cur.r, 1);
      this.sel = null;
      this.clampCursor();
      this.cur.c = 0;
      this.modified = true;
    }

    /** Ctrl+QY — delete from the cursor to the end of the line. */
    deleteToEol() {
      this.snapshot();
      this.lines[this.cur.r] = this.line(this.cur.r).slice(0, this.cur.c);
      this.modified = true;
    }
  }

  /* =========================================================
     4.  Menu bar definition (Turbo C++ 3.0 layout)
     ========================================================= */

  const SEP = { sep: true };

  const MENUS = [
    { title: "≡", hot: -1, width: 24, items: [
      { label: "About...", act: "about" },
      SEP,
      { label: "Clear desktop", act: "clearDesktop" }
    ] },
    { title: "File", hot: 0, width: 30, items: [
      { label: "New", act: "new" },
      { label: "Open...", key: "F3", act: "open" },
      { label: "Save", key: "F2", act: "save" },
      { label: "Save as...", act: "saveAs" },
      SEP,
      { label: "Change dir...", act: "todo" },
      { label: "Print", act: "print" },
      { label: "DOS shell", act: "dosShell" },
      { label: "Quit", key: "Alt+X", act: "quit" }
    ] },
    { title: "Edit", hot: 0, width: 30, items: [
      { label: "Undo", key: "Alt+BkSp", act: "undo" },
      { label: "Redo", act: "redo" },
      SEP,
      { label: "Cut", key: "Shift+Del", act: "cut" },
      { label: "Copy", key: "Ctrl+Ins", act: "copy" },
      { label: "Paste", key: "Shift+Ins", act: "paste" },
      { label: "Clear", key: "Ctrl+Del", act: "clearBlock" },
      SEP,
      { label: "Show clipboard", act: "showClip" }
    ] },
    { title: "Search", hot: 0, width: 30, items: [
      { label: "Find...", act: "find" },
      { label: "Replace...", act: "replace" },
      { label: "Search again", key: "Ctrl+L", act: "searchAgain" },
      SEP,
      { label: "Go to line number...", act: "gotoLine" },
      { label: "Find error", act: "findError" }
    ] },
    { title: "Run", hot: 0, width: 32, items: [
      { label: "Run", key: "Ctrl+F9", act: "run" },
      { label: "Program reset", key: "Ctrl+F2", act: "reset" },
      { label: "Go to cursor", key: "F4", act: "todo" },
      { label: "Trace into", key: "F7", act: "todo" },
      { label: "Step over", key: "F8", act: "todo" },
      { label: "Arguments...", act: "todo" }
    ] },
    { title: "Compile", hot: 0, width: 32, items: [
      { label: "Compile", key: "Alt+F9", act: "compile" },
      { label: "Make", key: "F9", act: "make" },
      { label: "Link", act: "link" },
      { label: "Build all", act: "make" },
      SEP,
      { label: "Information...", act: "information" }
    ] },
    { title: "Debug", hot: 0, width: 34, items: [
      { label: "Inspect", key: "Alt+F4", act: "todo" },
      { label: "Evaluate/modify...", key: "Ctrl+F4", act: "todo" },
      { label: "Call stack", key: "Ctrl+F3", act: "todo" },
      { label: "Watches", key: SUBMENU, act: "todo" },
      { label: "Toggle breakpoint", key: "Ctrl+F8", act: "todo" },
      { label: "Breakpoints...", act: "todo" }
    ] },
    { title: "Project", hot: 0, width: 30, items: [
      { label: "Open project...", act: "todo" },
      { label: "Close project", act: "todo" },
      { label: "Add item...", act: "todo" },
      { label: "Delete item", act: "todo" },
      { label: "Local options...", act: "todo" },
      { label: "Include files...", act: "todo" }
    ] },
    { title: "Options", hot: 0, width: 30, items: [
      { label: "Compiler", key: SUBMENU, act: "todo" },
      { label: "Transfer...", act: "todo" },
      { label: "Make...", act: "todo" },
      { label: "Linker", key: SUBMENU, act: "todo" },
      { label: "Directories...", act: "todo" },
      { label: "Environment", key: SUBMENU, act: "todo" },
      SEP,
      { label: "Save...", act: "todo" }
    ] },
    { title: "Window", hot: 0, width: 32, items: [
      { label: "Size/Move", key: "Ctrl+F5", act: "todo" },
      { label: "Zoom", key: "F5", act: "zoom" },
      { label: "Next", key: "F6", act: "nextWindow" },
      { label: "Close", key: "Alt+F3", act: "closeWindow" },
      SEP,
      { label: "Message", act: "showMessage" },
      { label: "Output", act: "output" },
      { label: "User screen", key: "Alt+F5", act: "userScreen" }
    ] },
    { title: "Help", hot: 0, width: 32, items: [
      { label: "Contents", act: "helpContents" },
      { label: "Index", key: "Shift+F1", act: "helpContents" },
      { label: "Topic search", key: "Ctrl+F1", act: "helpTopic" },
      SEP,
      { label: "About...", act: "about" }
    ] }
  ];

  /* =========================================================
     5.  The IDE
     ========================================================= */

  class IDE {
    constructor(host, opts) {
      this.opts = opts || {};
      this.cols = 80;
      // a real EGA screen is 25 lines; embedded editors may be shorter
      this.rows = Math.max(14, Math.min(50, this.opts.rows || 25));
      this.screen = new Screen(this.cols, this.rows);
      this.buf = new Buffer(this.opts.code || "", this.opts.fileName || "NONAME00.CPP");
      this.clip = "";
      this.mode = "edit";               // edit | menu | dialog | user | dos | busy
      this.menu = null;                 // {m, i} open pull-down
      this.dialog = null;
      this.busyBox = null;              // {title, rows, footer}
      this.messages = [];               // Turbo message window lines
      this.msgVisible = false;
      this.msgSel = 0;
      this.msgTop = 0;
      this.active = "edit";             // edit | message
      this.zoomed = false;
      this.userLines = null;            // last program (user) screen
      this.dos = null;                  // DOS shell state
      this.lastSearch = null;
      this.focused = false;
      this.buildHost(host);
      this.draw();
    }

    /* ---------- DOM plumbing ---------- */
    buildHost(host) {
      host.classList.add("tc-shell");
      host.innerHTML = "";
      this.screenEl = document.createElement("div");
      this.screenEl.className = "tc-screen tc-nofocus";
      this.screenEl.setAttribute("role", "application");
      this.screenEl.setAttribute("aria-label", "Turbo C++ 3.0 IDE");
      this.input = document.createElement("textarea");
      this.input.className = "tc-input";
      this.input.setAttribute("autocapitalize", "off");
      this.input.setAttribute("autocorrect", "off");
      this.input.setAttribute("spellcheck", "false");
      this.input.setAttribute("aria-hidden", "true");
      host.appendChild(this.input);
      host.appendChild(this.screenEl);
      this.host = host;

      this.input.addEventListener("keydown", (e) => this.onKeyDown(e));
      this.input.addEventListener("paste", (e) => this.onPaste(e));
      this.input.addEventListener("input", () => this.onCompositionInput());
      this.input.addEventListener("focus", () => { this.focused = true; this.screenEl.classList.remove("tc-nofocus"); });
      this.input.addEventListener("blur", () => { this.focused = false; this.screenEl.classList.add("tc-nofocus"); });

      host.addEventListener("mousedown", (e) => this.onMouseDown(e));
      this.screenEl.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });

      this.fit();
      if (global.ResizeObserver) {
        this.ro = new ResizeObserver(() => this.fit());
        this.ro.observe(host);
      } else {
        global.addEventListener("resize", () => this.fit());
      }
    }

    /** Scale the font so that 80 columns exactly fill the host width. */
    fit() {
      const avail = (this.host.clientWidth - 12) * 0.998;
      if (avail <= 0) return;
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
      probe.className = "tc-screen";
      probe.style.fontSize = "16px";
      probe.textContent = "X".repeat(this.cols);
      document.body.appendChild(probe);
      const w = probe.getBoundingClientRect().width || 1;
      document.body.removeChild(probe);
      let size = 16 * (avail / w);
      let max = this.opts.maxFontSize || 20;
      if (this.opts.fitHeight) {
        // keep the whole 25-line screen on the page
        const room = (global.innerHeight || 800) - (this.opts.heightPad || 48);
        max = Math.min(max, room / (this.rows * 1.18));
      }
      size = Math.max(7, Math.min(max, size));
      this.screenEl.style.fontSize = size.toFixed(2) + "px";
      this.cellW = (w / this.cols) * (size / 16);
      this.cellH = size * 1.18;
      this.screenEl.style.width = (this.cellW * this.cols).toFixed(2) + "px";
    }

    /* ---------- geometry ---------- */
    layout() {
      const msgH = this.msgVisible && !this.zoomed ? 7 : 0;
      const editH = this.rows - 2 - msgH;                 // rows 1 .. 23-msgH
      return {
        edit: { x: 0, y: 1, w: this.cols, h: editH },
        msg: { x: 0, y: 1 + editH, w: this.cols, h: msgH }
      };
    }
    editViewport() {
      const w = this.layout().edit;
      return { x: w.x + 1, y: w.y + 1, w: w.w - 2, h: w.h - 2 };
    }

    /* =======================================================
       5a.  Drawing
       ======================================================= */

    draw() {
      const s = this.screen;
      s.clear(LGRAY, BLUE, " ");

      // desktop: the ░ pattern of Turbo Vision
      s.fill(0, 1, this.cols, this.rows - 2, SHADE, LGRAY, BLUE);

      this.drawMenuBar();
      this.drawEditWindow();
      if (this.msgVisible && !this.zoomed) this.drawMessageWindow();
      this.drawStatusLine();

      if (this.menu) this.drawPullDown();
      if (this.dialog) this.drawDialog();
      if (this.busyBox) this.drawBusyBox();

      // full-screen modes paint over everything
      if (this.mode === "user") this.drawUserScreen();
      if (this.mode === "dos") this.drawDosScreen();

      this.flush();
    }

    flush() {
      let cx = -1, cy = -1, vis = false;
      if (this.mode === "edit" && this.active === "edit" && !this.dialog && !this.busyBox) {
        const vp = this.editViewport();
        const x = vp.x + this.buf.cur.c - this.buf.left;
        const y = vp.y + this.buf.cur.r - this.buf.top;
        if (x >= vp.x && x < vp.x + vp.w && y >= vp.y && y < vp.y + vp.h) {
          cx = x; cy = y; vis = true;
        }
      } else if (this.dialog && this.dialog.type === "input" && this.dialog.field) {
        cx = this.dialog.field.x + Math.min(this.dialog.cursor - this.dialog.scroll, this.dialog.field.w - 1);
        cy = this.dialog.field.y;
        vis = true;
      } else if (this.mode === "dos" && this.dos) {
        cx = this.dos.promptLen + this.dos.input.length;
        cy = Math.min(this.dos.lines.length, this.rows - 1);
        vis = cx < this.cols;
      }
      this.screenEl.classList.toggle("tc-overwrite", !this.buf.insert);
      this.screenEl.innerHTML = this.screen.toHTML(vis, cx, cy);
    }

    drawMenuBar() {
      const s = this.screen;
      s.fill(0, 0, this.cols, 1, " ", BLACK, LGRAY);
      let x = 1;
      this.menuX = [];
      MENUS.forEach((m, idx) => {
        const open = this.menu && this.menu.m === idx;
        const label = " " + m.title + " ";
        const fg = open ? LGRAY : BLACK;
        const bg = open ? GREEN : LGRAY;
        s.write(x, 0, label, fg, bg);
        if (m.hot >= 0) s.recolour(x + 1 + m.hot, 0, 1, open ? YELLOW : LRED, bg);
        this.menuX.push({ x: x, w: label.length, idx: idx });
        x += label.length;
      });
      const clock = this.opts.statusRight;
      if (clock) s.write(this.cols - clock.length - 2, 0, clock, BLACK, LGRAY);
    }

    drawEditWindow() {
      const s = this.screen;
      const w = this.layout().edit;
      const act = this.active === "edit";
      const fg = act ? WHITE : LGRAY;
      s.frame(w.x, w.y, w.w, w.h, {
        double: act, fg: fg, bg: BLUE,
        title: this.buf.fileName, titleFg: act ? WHITE : LGRAY
      });
      // close box and zoom box
      s.write(w.x + 2, w.y, "[" + BULLET + "]", fg, BLUE);
      s.recolour(w.x + 3, w.y, 1, act ? LGREEN : LGRAY, BLUE);
      s.write(w.x + w.w - 5, w.y, "[" + (this.zoomed ? DOWN : UP) + "]", fg, BLUE);
      s.recolour(w.x + w.w - 4, w.y, 1, act ? LGREEN : LGRAY, BLUE);
      s.write(w.x + w.w - 2, w.y, "1", act ? YELLOW : LGRAY, BLUE);

      this.drawText();

      // line:column indicator sits in the bottom frame, Turbo style
      const pos = " " + (this.buf.cur.r + 1) + ":" + (this.buf.cur.c + 1) + " ";
      s.write(w.x + 2, w.y + w.h - 1, (this.buf.modified ? "*" : "") + pos, fg, BLUE);
    }

    /** The source text, with syntax colouring, block highlight and scroll bars. */
    drawText() {
      const s = this.screen;
      const vp = this.editViewport();
      const b = this.buf;

      // keep the cursor inside the window
      if (b.cur.r < b.top) b.top = b.cur.r;
      if (b.cur.r > b.top + vp.h - 1) b.top = b.cur.r - vp.h + 1;
      if (b.cur.c < b.left) b.left = b.cur.c;
      if (b.cur.c > b.left + vp.w - 1) b.left = b.cur.c - vp.w + 1;
      if (b.top < 0) b.top = 0;
      if (b.left < 0) b.left = 0;

      // block comment state has to be computed from the top of the file
      let inComment = false;
      for (let r = 0; r < b.top; r++) inComment = highlight(b.line(r), inComment).inComment;

      const block = b.blockRange();
      for (let j = 0; j < vp.h; j++) {
        const r = b.top + j;
        s.fill(vp.x, vp.y + j, vp.w, 1, " ", SYN.plain, BLUE);
        if (r >= b.lineCount) continue;
        const text = b.line(r);
        const hl = highlight(text, inComment);
        inComment = hl.inComment;
        for (let i = 0; i < vp.w; i++) {
          const c = b.left + i;
          if (c >= text.length) break;
          let fg = hl.colours[c], bg = BLUE;
          if (block && this.inBlock(block, r, c)) { fg = BLACK; bg = CYAN; }
          s.put(vp.x + i, vp.y + j, text[c], fg, bg);
        }
        // a marked block extends visually to the end of full lines
        if (block && r >= block.sr && r < block.er) {
          for (let i = Math.max(0, text.length - b.left); i < vp.w; i++) {
            s.put(vp.x + i, vp.y + j, " ", BLACK, CYAN);
          }
        }
      }

      // vertical scroll bar
      const wnd = this.layout().edit;
      const sbX = wnd.x + wnd.w - 1;
      s.put(sbX, vp.y, ARR_U, BLACK, CYAN);
      for (let j = 1; j < vp.h - 1; j++) s.put(sbX, vp.y + j, SHADE, CYAN, BLUE);
      s.put(sbX, vp.y + vp.h - 1, ARR_D, BLACK, CYAN);
      const span = Math.max(1, b.lineCount - 1);
      const thumb = Math.round((b.cur.r / span) * (vp.h - 3)) + 1;
      if (vp.h > 3) s.put(sbX, vp.y + Math.min(vp.h - 2, Math.max(1, thumb)), BULLET, BLACK, CYAN);

      // horizontal scroll bar lives in the bottom frame
      const sbY = wnd.y + wnd.h - 1;
      const hx = wnd.x + 12;
      const hw = wnd.w - 14;
      if (hw > 4) {
        s.put(hx, sbY, ARR_L, BLACK, CYAN);
        for (let i = 1; i < hw - 1; i++) s.put(hx + i, sbY, SHADE, CYAN, BLUE);
        s.put(hx + hw - 1, sbY, ARR_R, BLACK, CYAN);
        const maxLen = Math.max(1, b.line(b.cur.r).length);
        const tx = Math.round((b.cur.c / Math.max(maxLen, 60)) * (hw - 3)) + 1;
        s.put(hx + Math.min(hw - 2, Math.max(1, tx)), sbY, BULLET, BLACK, CYAN);
      }
    }

    inBlock(block, r, c) {
      if (r < block.sr || r > block.er) return false;
      if (r === block.sr && c < block.sc) return false;
      if (r === block.er && c >= block.ec) return false;
      return true;
    }

    drawMessageWindow() {
      const s = this.screen;
      const w = this.layout().msg;
      const act = this.active === "message";
      const fg = act ? WHITE : LGRAY;
      s.frame(w.x, w.y, w.w, w.h, { double: act, fg: fg, bg: BLUE, title: "Message", titleFg: fg });
      s.write(w.x + 2, w.y, "[" + BULLET + "]", fg, BLUE);
      s.write(w.x + w.w - 2, w.y, "2", act ? YELLOW : LGRAY, BLUE);

      const vh = w.h - 2;
      if (this.msgSel < this.msgTop) this.msgTop = this.msgSel;
      if (this.msgSel > this.msgTop + vh - 1) this.msgTop = this.msgSel - vh + 1;
      for (let j = 0; j < vh; j++) {
        const idx = this.msgTop + j;
        if (idx >= this.messages.length) break;
        const m = this.messages[idx];
        const sel = act && idx === this.msgSel;
        const text = padR(" " + m.text, w.w - 2);
        const colour = m.kind === "error" ? LRED : m.kind === "warning" ? YELLOW : LGRAY;
        s.write(w.x + 1, w.y + 1 + j, text.slice(0, w.w - 2), sel ? BLACK : colour, sel ? CYAN : BLUE);
      }
    }

    drawStatusLine() {
      const s = this.screen;
      const y = this.rows - 1;
      s.fill(0, y, this.cols, 1, " ", BLACK, LGRAY);
      let keys;
      if (this.mode === "user" || this.mode === "dos") {
        keys = [["", "Press any key to return to the IDE"]];
      } else if (this.dialog) {
        keys = [["Enter", "Ok"], ["Esc", "Cancel"], ["Tab", "Next field"]];
      } else if (this.menu) {
        keys = [["Enter", "Select"], ["Esc", "Cancel"], [String.fromCharCode(0x2191, 0x2193, 0x2190, 0x2192), "Move"]];
      } else {
        keys = [["F1", "Help"], ["F2", "Save"], ["F3", "Open"], ["Alt+F9", "Compile"],
                ["F9", "Make"], ["F10", "Menu"]];
      }
      let x = 1;
      keys.forEach((k) => {
        if (k[0]) {
          s.write(x, y, k[0], LRED, LGRAY);
          x += k[0].length + 1;
        }
        s.write(x, y, k[1], BLACK, LGRAY);
        x += k[1].length + 2;
      });
      if (this.mode !== "user" && this.mode !== "dos") {
        const right = (this.buf.insert ? "Insert" : "Overwrite");
        s.write(this.cols - right.length - 1, y, right, BLACK, LGRAY);
      }
    }

    drawPullDown() {
      const s = this.screen;
      const m = MENUS[this.menu.m];
      const anchor = this.menuX[this.menu.m];
      const w = m.width;
      const h = m.items.length + 2;
      let x = Math.min(anchor.x, this.cols - w - 3);
      const y = 1;
      s.shadow(x, y, w, h);
      s.frame(x, y, w, h, { double: false, fg: BLACK, bg: LGRAY });
      m.items.forEach((it, i) => {
        const yy = y + 1 + i;
        if (it.sep) {
          s.write(x, yy, "├" + "─".repeat(w - 2) + "┤", BLACK, LGRAY);
          return;
        }
        const sel = this.menu.i === i;
        const bg = sel ? GREEN : LGRAY;
        const fg = it.act === "todo" ? (sel ? LGRAY : DGRAY) : (sel ? WHITE : BLACK);
        s.write(x + 1, yy, padR(" " + it.label, w - 2), fg, bg);
        if (it.key) s.write(x + w - 2 - it.key.length, yy, it.key, fg, bg);
        if (it.act !== "todo") s.recolour(x + 2, yy, 1, sel ? YELLOW : LRED, bg);
      });
    }

    drawBusyBox() {
      const s = this.screen;
      const b = this.busyBox;
      const w = 44;
      const h = b.rows.length + 4;
      const x = Math.floor((this.cols - w) / 2);
      const y = Math.floor((this.rows - h) / 2) - 1;
      s.shadow(x, y, w, h);
      s.frame(x, y, w, h, { double: true, fg: WHITE, bg: BLUE, title: b.title, titleFg: WHITE });
      b.rows.forEach((r, i) => s.write(x + 3, y + 2 + i, padR(r, w - 6), YELLOW, BLUE));
      if (b.footer) {
        const t = " " + b.footer + " ";
        s.write(x + Math.floor((w - t.length) / 2), y + h - 1, t, BLACK, LGRAY);
      }
    }

    drawUserScreen() {
      const s = this.screen;
      s.clear(LGRAY, BLACK, " ");
      const lines = this.userLines || [];
      for (let i = 0; i < Math.min(lines.length, this.rows - 1); i++) {
        s.write(0, i, String(lines[i]).slice(0, this.cols), LGRAY, BLACK);
      }
      this.drawStatusLine();
    }

    drawDosScreen() {
      const s = this.screen;
      s.clear(LGRAY, BLACK, " ");
      const d = this.dos;
      const start = Math.max(0, d.lines.length - (this.rows - 1));
      let y = 0;
      for (let i = start; i < d.lines.length; i++) {
        s.write(0, y++, String(d.lines[i]).slice(0, this.cols), LGRAY, BLACK);
      }
      const prompt = d.prompt;
      d.promptLen = prompt.length;
      s.write(0, Math.min(y, this.rows - 1), (prompt + d.input).slice(0, this.cols), LGRAY, BLACK);
    }

    drawDialog() {
      const s = this.screen;
      const d = this.dialog;
      const w = d.w;
      const h = d.h;
      const x = Math.floor((this.cols - w) / 2);
      const y = Math.max(1, Math.floor((this.rows - h) / 2) - 1);
      d.box = { x: x, y: y, w: w, h: h };
      s.shadow(x, y, w, h);
      s.frame(x, y, w, h, { double: true, fg: WHITE, bg: LGRAY, title: d.title, titleFg: WHITE });
      s.write(x + 2, y, "[" + BULLET + "]", WHITE, LGRAY);

      let ty = y + 2;
      (d.lines || []).forEach((ln) => {
        if (ty < y + h - 2) s.write(x + 3, ty++, String(ln).slice(0, w - 6), BLACK, LGRAY);
      });

      if (d.type === "input") {
        const fw = w - 6;
        d.field = { x: x + 3, y: ty + 1, w: fw };
        if (d.cursor - d.scroll >= fw) d.scroll = d.cursor - fw + 1;
        if (d.cursor < d.scroll) d.scroll = d.cursor;
        const shown = padR(d.value.slice(d.scroll, d.scroll + fw), fw);
        s.write(x + 3, ty + 1, shown, BLACK, CYAN);
        ty += 2;
      }

      if (d.type === "list") {
        const lh = h - 6;
        d.listBox = { x: x + 3, y: ty, w: w - 6, h: lh };
        if (d.sel < d.top) d.top = d.sel;
        if (d.sel > d.top + lh - 1) d.top = d.sel - lh + 1;
        s.fill(x + 3, ty, w - 6, lh, " ", BLACK, CYAN);
        for (let i = 0; i < lh; i++) {
          const idx = d.top + i;
          if (idx >= d.items.length) break;
          const sel = idx === d.sel;
          s.write(x + 3, ty + i, padR(" " + d.items[idx], w - 6),
                  sel ? WHITE : BLACK, sel ? GREEN : CYAN);
        }
        ty += lh;
      }

      if (d.type === "text") {
        const lh = h - 4;
        d.textBox = { h: lh };
        for (let i = 0; i < lh; i++) {
          const idx = d.top + i;
          if (idx >= d.body.length) break;
          s.write(x + 3, y + 2 + i, padR(String(d.body[idx]).slice(0, w - 6), w - 6), BLACK, LGRAY);
        }
        ty = y + h - 2;
      }

      // buttons
      const buttons = d.buttons || ["Ok"];
      let bx = x + Math.max(3, Math.floor((w - buttons.reduce((a, t) => a + t.length + 6, 0)) / 2));
      const by = y + h - 2;
      d.buttonPos = [];
      buttons.forEach((label, i) => {
        const sel = d.button === i;
        const text = "  " + label + "  ";
        s.write(bx, by, text, sel ? WHITE : BLACK, sel ? GREEN : CYAN);
        s.write(bx + text.length, by, SHADE, DGRAY, LGRAY);
        s.recolour(bx + 2, by, 1, sel ? YELLOW : LRED, sel ? GREEN : CYAN);
        d.buttonPos.push({ x: bx, w: text.length, i: i });
        bx += text.length + 2;
      });
    }

    /* =======================================================
       5b.  Keyboard
       ======================================================= */

    onKeyDown(e) {
      const k = e.key;
      const ctrl = e.ctrlKey, alt = e.altKey, shift = e.shiftKey;

      // Alt+X quits from anywhere; the browser's own shortcuts stay free
      if (this.busyBox && this.busyBox.waitKey) {
        e.preventDefault();
        this.busyBox = null;
        this.mode = "edit";
        this.draw();
        return;
      }
      if (this.busyBox) { e.preventDefault(); return; }

      if (this.mode === "user") { e.preventDefault(); this.mode = "edit"; this.draw(); return; }
      if (this.mode === "dos") { e.preventDefault(); this.dosKey(e); return; }
      if (this.dialog) { e.preventDefault(); this.dialogKey(e); return; }
      if (this.menu) { e.preventDefault(); this.menuKey(e); return; }

      // ---- global (IDE) hot keys ----
      const fn = {
        F1: "helpContents", F2: "save", F3: "open", F5: "zoom", F6: "nextWindow", F9: "make"
      };
      if (!ctrl && !alt && !shift && fn[k]) { e.preventDefault(); this.action(fn[k]); return; }
      if (k === "F10" && !ctrl && !alt) { e.preventDefault(); this.openMenu(1); return; }
      if (k === "F9" && alt) { e.preventDefault(); this.action("compile"); return; }
      if (k === "F9" && ctrl) { e.preventDefault(); this.action("run"); return; }
      if (k === "F5" && alt) { e.preventDefault(); this.action("userScreen"); return; }
      if (k === "F3" && alt) { e.preventDefault(); this.action("closeWindow"); return; }
      if (k === "F2" && ctrl) { e.preventDefault(); this.action("reset"); return; }
      if (alt && /^[a-zA-Z]$/.test(k)) {
        const letter = k.toUpperCase();
        if (letter === "X") { e.preventDefault(); this.action("quit"); return; }
        const idx = MENUS.findIndex((m) => m.hot >= 0 && m.title[m.hot].toUpperCase() === letter);
        if (idx >= 0) { e.preventDefault(); this.openMenu(idx); return; }
        return;
      }

      if (this.active === "message") { this.messageKey(e); return; }

      // ---- editor ----
      const b = this.buf;
      const move = (fn2) => {
        if (shift) { if (!b.sel) b.sel = { r: b.cur.r, c: b.cur.c }; }
        else b.sel = null;
        fn2();
        b.clampCursor();
      };

      switch (k) {
        case "ArrowLeft":
          e.preventDefault();
          move(() => {
            if (ctrl) this.wordLeft();
            else if (b.cur.c > 0) b.cur.c--;
            else if (b.cur.r > 0) { b.cur.r--; b.cur.c = b.line(b.cur.r).length; }
          });
          break;
        case "ArrowRight":
          e.preventDefault();
          move(() => {
            if (ctrl) this.wordRight();
            else if (b.cur.c < b.line(b.cur.r).length) b.cur.c++;
            else if (b.cur.r < b.lineCount - 1) { b.cur.r++; b.cur.c = 0; }
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          if (ctrl) { b.top = Math.max(0, b.top - 1); break; }
          move(() => { if (b.cur.r > 0) b.cur.r--; });
          break;
        case "ArrowDown":
          e.preventDefault();
          if (ctrl) { b.top = Math.min(Math.max(0, b.lineCount - 1), b.top + 1); break; }
          move(() => { if (b.cur.r < b.lineCount - 1) b.cur.r++; });
          break;
        case "Home":
          e.preventDefault();
          move(() => { if (ctrl) { b.cur.r = 0; } b.cur.c = 0; });
          break;
        case "End":
          e.preventDefault();
          move(() => { if (ctrl) b.cur.r = b.lineCount - 1; b.cur.c = b.line(b.cur.r).length; });
          break;
        case "PageUp":
          e.preventDefault();
          move(() => { b.cur.r = Math.max(0, b.cur.r - (this.editViewport().h - 1)); });
          break;
        case "PageDown":
          e.preventDefault();
          move(() => { b.cur.r = Math.min(b.lineCount - 1, b.cur.r + (this.editViewport().h - 1)); });
          break;
        case "Enter":
          e.preventDefault();
          b.newLine();
          this.changed();
          break;
        case "Backspace":
          e.preventDefault();
          if (alt) { b.undo(); } else b.backspace();
          this.changed();
          break;
        case "Delete":
          e.preventDefault();
          if (ctrl) { if (b.hasBlock()) b.deleteBlock(); }
          else if (shift) { this.action("cut"); }
          else b.del();
          this.changed();
          break;
        case "Insert":
          e.preventDefault();
          if (ctrl) this.action("copy");
          else if (shift) this.action("paste");
          else b.insert = !b.insert;
          break;
        case "Tab":
          e.preventDefault();
          b.insertText(" ".repeat(TABSIZE - (b.cur.c % TABSIZE)));
          this.changed();
          break;
        case "Escape":
          e.preventDefault();
          b.sel = null;
          break;
        default:
          if (ctrl && !alt) {
            const c = k.toLowerCase();
            if (c === "y") { e.preventDefault(); b.deleteLine(); this.changed(); return; }
            if (c === "l") { e.preventDefault(); this.action("searchAgain"); return; }
            if (c === "c") { e.preventDefault(); this.action("copy"); return; }
            if (c === "x") { e.preventDefault(); this.action("cut"); return; }
            if (c === "v") { return; }               // let the paste event through
            if (c === "z") { e.preventDefault(); b.undo(); this.changed(); return; }
            if (c === "s") { e.preventDefault(); this.action("save"); return; }
            if (c === "a") {
              e.preventDefault();
              b.sel = { r: 0, c: 0 };
              b.cur = { r: b.lineCount - 1, c: b.line(b.lineCount - 1).length };
              break;
            }
            if (c === "q" || c === "k") { e.preventDefault(); this.pendingCtrl = c; return; }
            return;
          }
          if (alt) return;
          if (k.length === 1) {
            e.preventDefault();
            if (this.pendingCtrl) {
              const cmd = this.pendingCtrl.toUpperCase() + k.toUpperCase();
              this.pendingCtrl = null;
              this.wordStar(cmd);
              break;
            }
            b.insertText(k);
            this.changed();
          }
          return;
      }
      this.draw();
    }

    /** The WordStar-compatible Ctrl+Q / Ctrl+K commands Turbo inherited. */
    wordStar(cmd) {
      const b = this.buf;
      switch (cmd) {
        case "QR": b.cur = { r: 0, c: 0 }; break;                     // top of file
        case "QC": b.cur = { r: b.lineCount - 1, c: b.line(b.lineCount - 1).length }; break;
        case "QS": b.cur.c = 0; break;
        case "QD": b.cur.c = b.line(b.cur.r).length; break;
        case "QY": b.deleteToEol(); this.changed(); break;
        case "KB": b.sel = { r: b.cur.r, c: b.cur.c }; break;         // mark block begin
        case "KK": break;                                             // mark block end (cursor)
        case "KY": if (b.hasBlock()) { b.deleteBlock(); this.changed(); } break;
        case "KC": this.action("paste"); break;
        case "KH": b.sel = null; break;
        case "KD": case "KS": this.action("save"); break;
        default: break;
      }
      b.clampCursor();
    }

    wordLeft() {
      const b = this.buf;
      const ln = b.line(b.cur.r);
      let c = b.cur.c;
      while (c > 0 && /\s/.test(ln[c - 1])) c--;
      while (c > 0 && !/\s/.test(ln[c - 1])) c--;
      if (c === b.cur.c && b.cur.r > 0) { b.cur.r--; b.cur.c = b.line(b.cur.r).length; return; }
      b.cur.c = c;
    }
    wordRight() {
      const b = this.buf;
      const ln = b.line(b.cur.r);
      let c = b.cur.c;
      while (c < ln.length && !/\s/.test(ln[c])) c++;
      while (c < ln.length && /\s/.test(ln[c])) c++;
      if (c === b.cur.c && b.cur.r < b.lineCount - 1) { b.cur.r++; b.cur.c = 0; return; }
      b.cur.c = c;
    }

    changed() {
      this.buf.modified = true;
      if (this.opts.onChange) this.opts.onChange(this.buf.getText());
    }

    onPaste(e) {
      const text = (e.clipboardData || global.clipboardData).getData("text");
      if (text) {
        e.preventDefault();
        this.buf.insertText(text);
        this.changed();
        this.draw();
      }
    }

    /** Mobile keyboards and IME composition arrive as plain input events. */
    onCompositionInput() {
      const v = this.input.value;
      if (!v) return;
      this.input.value = "";
      if (this.mode === "edit" && !this.dialog && !this.menu) {
        this.buf.insertText(v);
        this.changed();
        this.draw();
      } else if (this.dialog && this.dialog.type === "input") {
        this.dialogInsert(v);
        this.draw();
      }
    }

    /* =======================================================
       5c.  Mouse
       ======================================================= */

    onMouseDown(e) {
      this.input.focus();
      const rect = this.screenEl.getBoundingClientRect();
      const cw = rect.width / this.cols;
      const chh = rect.height / this.rows;
      const x = Math.floor((e.clientX - rect.left) / cw);
      const y = Math.floor((e.clientY - rect.top) / chh);
      if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
      e.preventDefault();

      if (this.busyBox) {
        if (this.busyBox.waitKey) { this.busyBox = null; this.mode = "edit"; this.draw(); }
        return;
      }
      if (this.mode === "user" || this.mode === "dos") {
        if (this.mode === "user") { this.mode = "edit"; this.draw(); }
        return;
      }
      if (this.dialog) { this.dialogClick(x, y); return; }

      if (y === 0) {
        const hit = this.menuX.find((m) => x >= m.x && x < m.x + m.w);
        if (hit) this.openMenu(hit.idx);
        else { this.menu = null; }
        this.draw();
        return;
      }
      if (this.menu) {
        const m = MENUS[this.menu.m];
        const anchor = this.menuX[this.menu.m];
        const bx = Math.min(anchor.x, this.cols - m.width - 3);
        const i = y - 2;
        if (x >= bx && x < bx + m.width && i >= 0 && i < m.items.length && !m.items[i].sep) {
          this.menu.i = i;
          this.draw();
          this.activateMenuItem();
          return;
        }
        this.menu = null;
        this.draw();
        return;
      }

      const lay = this.layout();
      const w = lay.edit;
      if (y === w.y) {                                   // title bar: close / zoom boxes
        if (x >= w.x + 2 && x <= w.x + 4) { this.action("closeWindow"); return; }
        if (x >= w.x + w.w - 5 && x <= w.x + w.w - 3) { this.action("zoom"); return; }
      }
      const vp = this.editViewport();
      if (y >= vp.y && y < vp.y + vp.h && x >= vp.x && x < vp.x + vp.w) {
        this.active = "edit";
        const b = this.buf;
        b.sel = e.shiftKey ? (b.sel || { r: b.cur.r, c: b.cur.c }) : null;
        b.cur.r = Math.min(b.lineCount - 1, b.top + (y - vp.y));
        b.cur.c = Math.min(b.line(b.cur.r).length, b.left + (x - vp.x));
        this.draw();
        return;
      }
      if (this.msgVisible && y >= lay.msg.y && y < lay.msg.y + lay.msg.h) {
        this.active = "message";
        const idx = this.msgTop + (y - lay.msg.y - 1);
        if (idx >= 0 && idx < this.messages.length) {
          this.msgSel = idx;
          this.gotoMessage();
        }
        this.draw();
      }
    }

    onWheel(e) {
      if (this.mode !== "edit" || this.dialog || this.menu) return;
      e.preventDefault();
      const step = e.deltaY > 0 ? 3 : -3;
      this.buf.top = Math.max(0, Math.min(Math.max(0, this.buf.lineCount - 1), this.buf.top + step));
      const vp = this.editViewport();
      this.buf.cur.r = Math.max(this.buf.top, Math.min(this.buf.top + vp.h - 1, this.buf.cur.r));
      this.buf.clampCursor();
      this.draw();
    }

    /* =======================================================
       5d.  Menus
       ======================================================= */

    openMenu(idx) {
      this.menu = { m: idx, i: this.firstItem(idx, 0, 1) };
      this.draw();
    }
    firstItem(m, from, dir) {
      const items = MENUS[m].items;
      let i = from;
      for (let n = 0; n < items.length; n++) {
        if (i < 0) i = items.length - 1;
        if (i >= items.length) i = 0;
        if (!items[i].sep) return i;
        i += dir;
      }
      return 0;
    }
    menuKey(e) {
      const k = e.key;
      const m = MENUS[this.menu.m];
      switch (k) {
        case "Escape": this.menu = null; break;
        case "ArrowDown": this.menu.i = this.firstItem(this.menu.m, this.menu.i + 1, 1); break;
        case "ArrowUp": this.menu.i = this.firstItem(this.menu.m, this.menu.i - 1, -1); break;
        case "ArrowLeft":
          this.menu.m = (this.menu.m + MENUS.length - 1) % MENUS.length;
          this.menu.i = this.firstItem(this.menu.m, 0, 1);
          break;
        case "ArrowRight":
          this.menu.m = (this.menu.m + 1) % MENUS.length;
          this.menu.i = this.firstItem(this.menu.m, 0, 1);
          break;
        case "Home": this.menu.i = this.firstItem(this.menu.m, 0, 1); break;
        case "End": this.menu.i = this.firstItem(this.menu.m, m.items.length - 1, -1); break;
        case "Enter": this.draw(); this.activateMenuItem(); return;
        case "F10": this.menu = null; break;
        default:
          if (k.length === 1) {
            const letter = k.toUpperCase();
            const i = m.items.findIndex((it) => !it.sep && it.label[0].toUpperCase() === letter);
            if (i >= 0) { this.menu.i = i; this.draw(); this.activateMenuItem(); return; }
          }
          break;
      }
      this.draw();
    }
    activateMenuItem() {
      const m = MENUS[this.menu.m];
      const it = m.items[this.menu.i];
      this.menu = null;
      if (!it || it.sep) { this.draw(); return; }
      this.action(it.act, it);
    }

    /* =======================================================
       5e.  Dialogs
       ======================================================= */

    msgBox(title, lines, opts) {
      const o = opts || {};
      const width = Math.max(34, Math.min(70, lines.reduce((a, l) => Math.max(a, String(l).length), 0) + 10));
      this.dialog = {
        type: "message", title: title, lines: lines,
        w: width, h: lines.length + 6,
        buttons: o.buttons || ["Ok"], button: 0,
        onOk: o.onOk, onCancel: o.onCancel
      };
      this.draw();
    }

    inputBox(title, prompt, value, onOk) {
      this.dialog = {
        type: "input", title: title, lines: [prompt],
        value: value || "", cursor: (value || "").length, scroll: 0,
        w: 56, h: 9, buttons: ["Ok", "Cancel"], button: 0,
        onOk: onOk
      };
      this.draw();
    }

    listBox(title, prompt, items, onOk) {
      this.dialog = {
        type: "list", title: title, lines: [prompt], items: items,
        sel: 0, top: 0, w: 52, h: Math.min(18, items.length + 7),
        buttons: ["Ok", "Cancel"], button: 0, onOk: onOk
      };
      this.draw();
    }

    textWin(title, body) {
      this.dialog = {
        type: "text", title: title, body: body, top: 0,
        w: 72, h: Math.min(21, body.length + 5),
        buttons: ["Ok"], button: 0
      };
      this.draw();
    }

    dialogInsert(text) {
      const d = this.dialog;
      d.value = d.value.slice(0, d.cursor) + text + d.value.slice(d.cursor);
      d.cursor += text.length;
    }

    dialogKey(e) {
      const d = this.dialog;
      const k = e.key;
      if (k === "Escape") { this.closeDialog(false); return; }
      if (k === "Tab") {
        d.button = ((d.button || 0) + (e.shiftKey ? -1 : 1) + d.buttons.length) % d.buttons.length;
        this.draw();
        return;
      }
      if (k === "Enter") {
        // "No" still reports back (it means "continue without saving")
        this.closeDialog(d.buttons[d.button || 0] !== "Cancel");
        return;
      }
      if (d.type === "input") {
        if (k === "ArrowLeft") { d.cursor = Math.max(0, d.cursor - 1); }
        else if (k === "ArrowRight") { d.cursor = Math.min(d.value.length, d.cursor + 1); }
        else if (k === "Home") { d.cursor = 0; }
        else if (k === "End") { d.cursor = d.value.length; }
        else if (k === "Backspace") {
          if (d.cursor > 0) { d.value = d.value.slice(0, d.cursor - 1) + d.value.slice(d.cursor); d.cursor--; }
        } else if (k === "Delete") {
          d.value = d.value.slice(0, d.cursor) + d.value.slice(d.cursor + 1);
        } else if (k.length === 1) {
          this.dialogInsert(k);
        }
      } else if (d.type === "list") {
        const lh = d.listBox ? d.listBox.h : 8;
        if (k === "ArrowDown") d.sel = Math.min(d.items.length - 1, d.sel + 1);
        else if (k === "ArrowUp") d.sel = Math.max(0, d.sel - 1);
        else if (k === "PageDown") d.sel = Math.min(d.items.length - 1, d.sel + lh);
        else if (k === "PageUp") d.sel = Math.max(0, d.sel - lh);
        else if (k === "Home") d.sel = 0;
        else if (k === "End") d.sel = d.items.length - 1;
      } else if (d.type === "text") {
        const lh = d.textBox ? d.textBox.h : 10;
        if (k === "ArrowDown") d.top = Math.min(Math.max(0, d.body.length - lh), d.top + 1);
        else if (k === "ArrowUp") d.top = Math.max(0, d.top - 1);
        else if (k === "PageDown") d.top = Math.min(Math.max(0, d.body.length - lh), d.top + lh);
        else if (k === "PageUp") d.top = Math.max(0, d.top - lh);
      }
      this.draw();
    }

    dialogClick(x, y) {
      const d = this.dialog;
      if (!d.box) return;
      if (y === d.box.y && x >= d.box.x + 2 && x <= d.box.x + 4) { this.closeDialog(false); return; }
      if (d.type === "list" && d.listBox &&
          y >= d.listBox.y && y < d.listBox.y + d.listBox.h &&
          x >= d.listBox.x && x < d.listBox.x + d.listBox.w) {
        const idx = d.top + (y - d.listBox.y);
        if (idx < d.items.length) {
          d.sel = idx;
          this.draw();
          this.closeDialog(true);
        }
        return;
      }
      const by = d.box.y + d.box.h - 2;
      if (y === by) {
        const hit = (d.buttonPos || []).find((b) => x >= b.x && x < b.x + b.w);
        if (hit) {
          d.button = hit.i;
          this.closeDialog(d.buttons[hit.i] !== "Cancel");
          return;
        }
      }
      this.draw();
    }

    closeDialog(ok) {
      const d = this.dialog;
      this.dialog = null;
      if (!d) return;
      if (ok && d.onOk) {
        const value = d.type === "input" ? d.value
          : d.type === "list" ? d.items[d.sel]
          : (d.buttons || [])[d.button || 0];
        d.onOk(value, d.button || 0);
      } else if (!ok && d.onCancel) {
        d.onCancel();
      }
      this.draw();
    }

    /* =======================================================
       5f.  Message window
       ======================================================= */

    messageKey(e) {
      const k = e.key;
      if (k === "ArrowDown") { this.msgSel = Math.min(this.messages.length - 1, this.msgSel + 1); this.gotoMessage(); }
      else if (k === "ArrowUp") { this.msgSel = Math.max(0, this.msgSel - 1); this.gotoMessage(); }
      else if (k === "Enter") { this.active = "edit"; this.gotoMessage(); }
      else if (k === "Escape" || k === "Tab") { this.active = "edit"; }
      else { return; }
      e.preventDefault();
      this.draw();
    }

    gotoMessage() {
      const m = this.messages[this.msgSel];
      if (m && m.line) {
        this.buf.cur.r = Math.max(0, Math.min(this.buf.lineCount - 1, m.line - 1));
        this.buf.cur.c = Math.max(0, (m.col || 1) - 1);
        this.buf.clampCursor();
      }
    }

    setMessages(list, opts) {
      this.messages = list;
      // start on the first line that actually points at a source line
      const first = list.findIndex((m) => m && m.line > 0);
      this.msgSel = first < 0 ? 0 : first;
      this.msgTop = 0;
      this.msgVisible = list.length > 0;
      if (this.msgVisible) this.zoomed = false;
      if (opts && opts.focus) this.active = "message";
    }

    /* =======================================================
       5g.  Actions
       ======================================================= */

    action(act, item) {
      switch (act) {
        /* ---- File ---- */
        case "new":
          this.confirmDiscard(() => {
            this.buf = new Buffer(this.opts.template || DEFAULT_SOURCE, "NONAME00.CPP");
            this.messages = []; this.msgVisible = false;
            this.changed();
          });
          break;
        case "open": this.openFileDialog(); break;
        case "save": this.saveFile(this.buf.fileName); break;
        case "saveAs":
          this.inputBox("Save File As", "Save file as", this.buf.fileName, (name) => {
            if (name && name.trim()) this.saveFile(name.trim().toUpperCase());
          });
          break;
        case "print": this.printSource(); break;
        case "dosShell": this.enterDos(true); break;
        case "quit": this.quit(); break;

        /* ---- Edit ---- */
        case "undo": if (!this.buf.undo()) this.beep(); this.changed(); break;
        case "redo": this.buf.redo(); this.changed(); break;
        case "cut":
          if (this.buf.hasBlock()) { this.clip = this.buf.blockText(); this.copyToSystem(this.clip); this.buf.deleteBlock(); this.changed(); }
          break;
        case "copy":
          if (this.buf.hasBlock()) { this.clip = this.buf.blockText(); this.copyToSystem(this.clip); }
          break;
        case "paste":
          if (this.clip) { this.buf.insertText(this.clip); this.changed(); }
          else this.msgBox("Clipboard", ["The clipboard is empty.", "", "Use Ctrl+V to paste from the browser clipboard."]);
          break;
        case "clearBlock": if (this.buf.hasBlock()) { this.buf.deleteBlock(); this.changed(); } break;
        case "showClip":
          this.textWin("Clipboard", this.clip ? this.clip.split("\n") : ["(empty)"]);
          break;

        /* ---- Search ---- */
        case "find":
          this.inputBox("Find", "Text to find", this.lastSearch || "", (t) => {
            this.lastSearch = t;
            this.searchNext(t);
          });
          break;
        case "replace":
          this.inputBox("Replace", "Text to find", this.lastSearch || "", (t) => {
            this.lastSearch = t;
            this.inputBox("Replace", "New text", "", (r) => this.replaceAll(t, r));
          });
          break;
        case "searchAgain":
          if (this.lastSearch) this.searchNext(this.lastSearch);
          else this.action("find");
          break;
        case "gotoLine":
          this.inputBox("Go to Line Number", "Enter new line number", String(this.buf.cur.r + 1), (v) => {
            const n = parseInt(v, 10);
            if (n > 0) {
              this.buf.cur.r = Math.min(this.buf.lineCount - 1, n - 1);
              this.buf.cur.c = 0;
              this.buf.clampCursor();
            }
          });
          break;
        case "findError":
          if (this.messages.length) { this.active = "message"; this.gotoMessage(); }
          else this.msgBox("Find Error", ["No errors have been reported."]);
          break;

        /* ---- Compile / Run ---- */
        case "compile": case "make": case "link": this.doCompile(false); break;
        case "run": this.doRun(); break;
        case "reset":
          this.userLines = null;
          this.msgBox("Program Reset", ["The running program has been terminated."]);
          break;
        case "information": this.showInformation(); break;

        /* ---- Window ---- */
        case "zoom": this.zoomed = !this.zoomed; break;
        case "nextWindow":
          if (this.msgVisible) this.active = this.active === "edit" ? "message" : "edit";
          break;
        case "closeWindow":
          if (this.active === "message" || !this.msgVisible) {
            this.msgVisible = false;
            this.active = "edit";
          } else {
            this.msgBox("Cannot close", ["The edit window holds your source file.", "Use File|Quit to leave the IDE."]);
          }
          break;
        case "showMessage":
          this.msgVisible = true;
          this.zoomed = false;
          this.active = "message";
          break;
        case "output": case "userScreen":
          this.mode = "user";
          if (!this.userLines) this.userLines = ["", "  No program output yet - press Ctrl+F9 to run your program.", ""];
          break;

        /* ---- Help ---- */
        case "about": this.showAbout(); break;
        case "helpContents": this.showHelp(); break;
        case "helpTopic": this.showHelpTopic(); break;
        case "clearDesktop":
          this.messages = []; this.msgVisible = false; this.userLines = null; this.active = "edit";
          break;

        case "todo":
        default:
          this.msgBox("Turbo C++", [
            (item && item.label ? item.label.replace(/\.\.\.$/, "") : "That feature") + " is not available",
            "in this web emulation of Turbo C++ 3.0.",
            "",
            "Editing, compiling (Alt+F9), running (Ctrl+F9),",
            "the message window and the user screen all work."
          ]);
          break;
      }
      this.draw();
    }

    beep() { /* the PC speaker is, mercifully, not emulated */ }

    copyToSystem(text) {
      try {
        if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(() => {});
        }
      } catch (err) { /* clipboard permission denied - internal clipboard still works */ }
    }

    confirmDiscard(then) {
      if (!this.buf.modified) { then(); return; }
      this.msgBox("Turbo C++", [this.buf.fileName + " has been modified. Save?"], {
        buttons: ["Yes", "No", "Cancel"],
        onOk: (label, idx) => {
          if (idx === 0) { this.saveFile(this.buf.fileName); then(); }
          else if (idx === 1) then();
        }
      });
    }

    /* ---- files (a little C: drive in localStorage) ---- */
    saveFile(name) {
      this.buf.fileName = name;
      const ok = writeFile(name, this.buf.getText());
      this.buf.modified = false;
      if (!ok) {
        this.msgBox("Error", ["Cannot write " + name + " - the browser refused", "to store the file (private mode?)."]);
      }
      this.draw();
    }

    openFileDialog() {
      const files = Object.keys(readFiles()).sort();
      if (!files.length) {
        this.msgBox("Open a File", ["No files on drive C:.", "", "Use File|Save first."]);
        return;
      }
      this.listBox("Open a File", "*.CPP", files, (name) => {
        this.confirmDiscard(() => {
          const content = readFiles()[name];
          this.buf = new Buffer(content, name);
          this.messages = []; this.msgVisible = false;
          this.changed();
          this.draw();
        });
      });
    }

    printSource() {
      const w = global.open("", "_blank");
      if (!w) { this.msgBox("Print", ["The browser blocked the print window."]); return; }
      w.document.write("<pre style=\"font:12px/1.35 monospace\">" +
        escHtml(this.buf.fileName + "\n\n" + this.buf.getText()) + "</pre>");
      w.document.close();
      w.focus();
      w.print();
    }

    /* ---- search ---- */
    searchNext(text) {
      if (!text) return;
      const b = this.buf;
      const needle = text.toLowerCase();
      for (let n = 0; n < b.lineCount; n++) {
        const r = (b.cur.r + n) % b.lineCount;
        const from = n === 0 ? b.cur.c + 1 : 0;
        const idx = b.line(r).toLowerCase().indexOf(needle, from);
        if (idx >= 0) {
          b.sel = { r: r, c: idx };
          b.cur = { r: r, c: idx + text.length };
          this.draw();
          return;
        }
      }
      this.msgBox("Search", ["Search string not found."]);
    }

    replaceAll(find, repl) {
      if (!find) return;
      this.buf.snapshot();
      let count = 0;
      this.buf.lines = this.buf.lines.map((ln) =>
        ln.split(find).reduce((acc, part, i) => {
          if (i === 0) return part;
          count++;
          return acc + repl + part;
        }, ""));
      this.buf.modified = true;
      this.changed();
      this.msgBox("Replace", [count + " occurrence(s) replaced."]);
    }

    /* ---- information / help ---- */
    showInformation() {
      const src = this.buf.getText();
      this.msgBox("Information", [
        "Current directory: C:\\TC\\BIN",
        "",
        "Current file:      " + this.buf.fileName,
        "Lines compiled:    " + this.buf.lineCount,
        "Source size:       " + src.length + " bytes",
        "Total warnings:    " + this.messages.filter((m) => m.kind === "warning").length,
        "Total errors:      " + this.messages.filter((m) => m.kind === "error").length,
        "",
        "Available memory:  297K"
      ]);
    }

    showAbout() {
      this.msgBox("About", [
        "",
        "               Turbo C++",
        "             Version 3.00",
        "",
        "   Copyright (c) 1992 by Borland",
        "        International, Inc.",
        "",
        "   Web emulation of the DOS IDE -",
        "   the editor, menus and keyboard are",
        "   re-created in JavaScript; your code",
        "   is compiled by a modern C++ compiler.",
        ""
      ]);
    }

    showHelp() {
      this.textWin("Help", [
        "TURBO C++ 3.0 - KEYBOARD",
        "",
        "  F1              Help",
        "  F2              Save file",
        "  F3              Open file",
        "  F5              Zoom / unzoom window",
        "  F6              Switch to the next window",
        "  F9              Make (compile + link)",
        "  Alt+F9          Compile",
        "  Ctrl+F9         Run the program",
        "  Alt+F5          Show the user screen (program output)",
        "  Alt+F3          Close the active window",
        "  F10             Activate the menu bar",
        "  Alt+F/E/S/R/C/D/P/O/W/H   Open a pull-down menu",
        "  Alt+X           Quit to DOS",
        "",
        "EDITOR (WordStar compatible)",
        "",
        "  Ctrl+Y          Delete the whole line",
        "  Ctrl+Q Y        Delete to the end of the line",
        "  Ctrl+Q R / C    Top / bottom of the file",
        "  Ctrl+K B / K    Mark the beginning / end of a block",
        "  Ctrl+K Y        Delete the marked block",
        "  Shift+arrows    Mark a block",
        "  Ctrl+Ins        Copy      Shift+Ins  Paste",
        "  Shift+Del       Cut       Ctrl+Del   Clear block",
        "  Insert          Toggle insert / overwrite",
        "",
        "COMPILING",
        "",
        "  Errors appear in the Message window at the bottom.",
        "  Press F6 to jump into it, then Up/Down: the editor",
        "  cursor follows the selected error line."
      ]);
    }

    showHelpTopic() {
      const b = this.buf;
      const ln = b.line(b.cur.r);
      let s = b.cur.c, e = b.cur.c;
      while (s > 0 && /[A-Za-z0-9_]/.test(ln[s - 1])) s--;
      while (e < ln.length && /[A-Za-z0-9_]/.test(ln[e])) e++;
      const word = ln.slice(s, e);
      const help = HELP_TOPICS[word];
      if (help) this.textWin("Help on " + word, help);
      else this.msgBox("Help", ["No help available for '" + (word || "") + "'."]);
    }

    /* =======================================================
       5h.  Compile and run
       ======================================================= */

    /** The Turbo "Compiling" status box, shown while the job runs. */
    showCompileBox(state) {
      this.busyBox = {
        title: "Compiling",
        rows: [
          "  Main file: " + this.buf.fileName,
          "",
          "  Compiling: " + padR("C:\\TC\\BIN\\" + this.buf.fileName, 26),
          "     Linking: " + padR(state.linking ? this.buf.fileName.replace(/\.[A-Z]+$/i, ".EXE") : "", 26),
          "",
          "  Total file lines: " + padL(this.buf.lineCount, 6),
          "          Warnings: " + padL(state.warnings === undefined ? 0 : state.warnings, 6),
          "            Errors: " + padL(state.errors === undefined ? 0 : state.errors, 6),
          "",
          "  Available memory: 297K"
        ],
        footer: state.footer || null,
        waitKey: !!state.waitKey
      };
      this.draw();
    }

    async doCompile(runAfter, stdin) {
      if (this.busyBox) return;
      const code = this.buf.getText();
      this.showCompileBox({ linking: false });
      this.mode = "busy";

      let res;
      try {
        if (!this.opts.runner) throw new Error("no compiler service configured");
        res = await this.opts.runner(code, stdin || "");
      } catch (err) {
        this.busyBox = null;
        this.mode = "edit";
        this.msgBox("Error", [
          "Cannot reach the compiler.",
          "",
          String(err && err.message ? err.message : err).slice(0, 60),
          "",
          "Check your internet connection and try again."
        ]);
        return null;
      }

      const diag = borlandize(res.compileError || res.warnings || "", this.buf.fileName);
      const errors = diag.filter((d) => d.kind === "error");
      const warnings = diag.filter((d) => d.kind === "warning");

      if (errors.length) {
        this.setMessages(
          [{ kind: "info", text: "Compiling " + this.buf.fileName + ":" }].concat(diag),
          { focus: true });
        this.showCompileBox({ errors: errors.length, warnings: warnings.length, footer: "Error: Press any key", waitKey: true });
        this.gotoMessage();
        return null;
      }

      this.setMessages(
        [{ kind: "info", text: "Compiling " + this.buf.fileName + ":" }]
          .concat(warnings)
          .concat([{ kind: "info", text: "Linking " + this.buf.fileName.replace(/\.[A-Za-z]+$/, ".EXE") + ":" }]),
        { focus: false });
      this.msgVisible = warnings.length > 0;

      if (!runAfter) {
        this.showCompileBox({ linking: true, warnings: warnings.length, errors: 0, footer: "Success: Press any key", waitKey: true });
        return res;
      }

      this.busyBox = null;
      this.mode = "edit";
      return res;
    }

    async doRun() {
      if (this.opts.onRunCheck) { this.opts.onRunCheck(this.buf.getText(), this); return; }
      const code = this.buf.getText();
      const needsInput = /\bcin\s*>>|\bgetline\s*\(|\bscanf\s*\(|\bgets\s*\(|\bgetchar\s*\(/.test(code);
      if (needsInput) {
        this.inputBox("Program Input", "Standard input (values separated by spaces, \\n = new line)", "",
          (v) => this.runWith(String(v).replace(/\\n/g, "\n")));
        return;
      }
      this.runWith("");
    }

    async runWith(stdin) {
      const res = await this.doCompile(true, stdin);
      if (!res) return;
      const out = (res.output === undefined ? "" : res.output);
      const err = res.runtimeError;
      const lines = String(out).replace(/\r/g, "").split("\n");
      if (err) {
        lines.push("");
        lines.push(String(err).split("\n")[0]);
        lines.push("Abnormal program termination");
      }
      this.userLines = lines;
      this.mode = "user";
      this.draw();
    }

    /* =======================================================
       5i.  DOS shell / quit
       ======================================================= */

    enterDos(temporary) {
      this.dos = {
        lines: temporary
          ? ["Microsoft(R) MS-DOS(R) Version 6.22", "  (C)Copyright Microsoft Corp 1981-1994.", "",
             "Type EXIT to return to Turbo C++.", ""]
          : ["", "C:\\TC\\BIN>"],
        prompt: "C:\\TC\\BIN>",
        input: "",
        temporary: !!temporary,
        promptLen: 10
      };
      this.mode = "dos";
      this.draw();
    }

    dosKey(e) {
      const d = this.dos;
      const k = e.key;
      if (k === "Enter") {
        d.lines.push(d.prompt + d.input);
        this.dosCommand(d.input.trim());
        d.input = "";
      } else if (k === "Backspace") {
        d.input = d.input.slice(0, -1);
      } else if (k.length === 1) {
        d.input += k;
      }
      if (d.lines.length > 200) d.lines.splice(0, d.lines.length - 200);
      this.draw();
    }

    dosCommand(raw) {
      const d = this.dos;
      const parts = raw.split(/\s+/);
      const cmd = (parts[0] || "").toUpperCase();
      const arg = (parts[1] || "").toUpperCase();
      const files = readFiles();
      const out = (t) => d.lines.push(t);

      switch (cmd) {
        case "": break;
        case "CLS": d.lines = []; break;
        case "VER": out(""); out("MS-DOS Version 6.22"); out(""); break;
        case "MEM":
          out("");
          out("    655360 bytes total conventional memory");
          out("    647168 bytes available to MS-DOS");
          out("    304128 largest executable program size");
          out("");
          break;
        case "DIR": {
          out("");
          out(" Volume in drive C is TURBOC");
          out(" Directory of C:\\TC\\BIN");
          out("");
          out("TC       EXE      1237664  05-01-92   3:00a");
          out("TCC      EXE       196976  05-01-92   3:00a");
          Object.keys(files).sort().forEach((n) => {
            const base = n.replace(/\..*$/, "");
            const ext = (n.split(".")[1] || "");
            out(padR(base, 9) + padR(ext, 9) + padL(files[n].length, 7) + "  01-01-93  12:00p");
          });
          out("       " + (Object.keys(files).length + 2) + " file(s)");
          out("");
          break;
        }
        case "TYPE":
          if (files[arg]) files[arg].split("\n").forEach(out);
          else out("File not found - " + arg);
          break;
        case "DEL":
          if (files[arg]) { deleteFile(arg); out(""); }
          else out("File not found - " + arg);
          break;
        case "HELP":
          out("");
          out("Commands: DIR  TYPE  DEL  CLS  VER  MEM  TC  EXIT");
          out("");
          break;
        case "TC":
        case "EXIT":
          this.dos = null;
          this.mode = "edit";
          return;
        default:
          out("Bad command or file name");
          break;
      }
    }

    quit() {
      if (this.opts.onQuit) { this.opts.onQuit(); return; }
      if (this.opts.embedded) {
        this.msgBox("Turbo C++", ["Alt+X (quit to DOS) is disabled while", "the IDE is running inside the quiz."]);
        return;
      }
      this.confirmDiscard(() => this.enterDos(false));
    }

    /* =======================================================
       5j.  Public instance API
       ======================================================= */

    getCode() { return this.buf.getText(); }
    setCode(text, fileName) {
      this.buf = new Buffer(text, fileName || this.buf.fileName);
      this.messages = [];
      this.msgVisible = false;
      this.mode = "edit";
      this.draw();
    }
    focus() { this.input.focus(); }
    showUserScreen(lines) {
      this.setUserScreen(lines);
      this.mode = "user";
      this.draw();
    }
    /** Store program output for Alt+F5 without leaving the editor. */
    setUserScreen(lines) {
      this.userLines = Array.isArray(lines) ? lines : String(lines).split("\n");
    }
    showMessages(list, opts) { this.setMessages(list, opts); this.draw(); }
    compile() { return this.doCompile(false); }
    destroy() {
      if (this.ro) this.ro.disconnect();
      this.host.innerHTML = "";
    }
  }

  /* =========================================================
     6.  gcc diagnostics -> Borland message lines
     ========================================================= */

  /** Turn a gcc message into the phrasing Turbo C++ 3.0 used. */
  function classicWording(msg) {
    const q = "['‘’“”`]";
    const rules = [
      [new RegExp("expected " + q + ";" + q), "Statement missing ;"],
      [new RegExp("expected " + q + "\\)" + q), "Statement missing )"],
      [new RegExp("expected " + q + "\\(" + q), "Statement missing ("],
      [new RegExp("expected " + q + "\\}" + q), "Compound statement missing }"],
      [new RegExp("expected " + q + "\\{" + q), "Compound statement missing {"],
      [new RegExp(q + "([\\w:]+)" + q + " was not declared"), "Undefined symbol '$1'"],
      [new RegExp(q + "([\\w:]+)" + q + " undeclared"), "Undefined symbol '$1'"],
      [new RegExp("no matching function for call to " + q + "([^'’]+)" + q), "Could not find a match for '$1'"],
      [new RegExp("invalid conversion from " + q + "([^'’]+)" + q + " to " + q + "([^'’]+)" + q),
        "Cannot convert '$1' to '$2'"],
      [/unterminated (string|character|comment)/i, "Unterminated string or character constant"],
      [/No such file or directory/, "Unable to open include file"],
      [/control reaches end of non-void function/, "Function should return a value"],
      [new RegExp("unused variable " + q + "(\\w+)" + q), "'$1' is declared but never used"],
      [new RegExp(q + "(\\w+)" + q + " (?:is|may be) used uninitialized"), "Possible use of '$1' before definition"],
      [/expression result unused|statement has no effect/, "Code has no effect"],
      [/too few arguments/, "Too few parameters in call"],
      [/too many arguments/, "Too many parameters in call"],
      [/redefinition of/, "Multiple declaration"],
      [/undefined reference to .?main/, "Linker Error: Undefined symbol _main"],
      [/undefined reference to/, "Linker Error: Undefined symbol"]
    ];
    for (let i = 0; i < rules.length; i++) {
      const m = msg.match(rules[i][0]);
      if (m) {
        return rules[i][1].replace(/\$(\d)/g, (_, d) => m[Number(d)] || "");
      }
    }
    // fall back to the compiler's own words, Borland-capitalised
    const clean = msg.replace(/‘|’/g, "'").trim();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  /**
   * Convert a gcc diagnostic dump into Turbo message-window lines:
   *   Error NONAME00.CPP 7: Statement missing ; in function main()
   */
  function borlandize(text, fileName) {
    const out = [];
    if (!text) return out;
    let fn = "";
    String(text).replace(/\r/g, "").split("\n").forEach((raw) => {
      const inFn = raw.match(/In (?:member )?function .([^':’]+)./);
      if (inFn) {
        const m = inFn[1].match(/([A-Za-z_]\w*)\s*\(/);
        fn = m ? m[1] + "()" : "";
        return;
      }
      const d = raw.match(/^[^\s:]*:(\d+):(?:(\d+):)?\s*(fatal error|error|warning|note):\s*(.*)$/);
      if (d) {
        const kind = d[3] === "warning" ? "warning" : d[3] === "note" ? "info" : "error";
        if (kind === "info") return;                    // Turbo had no "note:" lines
        const label = kind === "warning" ? "Warning" : "Error";
        let body = classicWording(d[4]);
        let suffix = fn ? " in function " + fn : "";
        if (/Unable to open include file/.test(body)) {
          const inc = raw.match(/([\w.\\/-]+\.h)/);
          if (inc) body = "Unable to open include file '" + inc[1] + "'";
          suffix = "";
        }
        out.push({
          kind: kind,
          line: parseInt(d[1], 10),
          col: d[2] ? parseInt(d[2], 10) : 1,
          text: label + " " + fileName + " " + d[1] + ": " + body + suffix
        });
        return;
      }
      const link = raw.match(/undefined reference to .([^'’]+)./);
      if (link) {
        out.push({ kind: "error", line: 0, col: 0,
          text: "Linker Error: Undefined symbol _" + link[1].replace(/\(.*/, "") });
      }
    });
    return out.slice(0, 40);
  }

  /* =========================================================
     7.  Turbo C++ source -> modern C++ (line numbers preserved)
     ========================================================= */

  /**
   * Students are taught the 1992 dialect: <iostream.h>, void main(),
   * clrscr(), getch(). A modern compiler rejects all three, so the
   * source is prefixed with a small compatibility prologue and the
   * classic header lines are blanked out.
   *
   * The prologue ends with a #line 1 directive, so every error the
   * compiler reports still carries the line number the student sees
   * in the Turbo editor. Modern C++ source is returned untouched.
   */
  const CLASSIC_HEADERS = {
    "iostream.h": true, "fstream.h": true, "iomanip.h": true, "strstream.h": true,
    "constrea.h": true, "conio.h": true, "dos.h": true, "alloc.h": true, "mem.h": true
  };

  const CONIO_SHIM = [
    "inline void clrscr(){}",
    "inline int getch(){int c=std::getchar();return c<0?0:c;}",
    "inline int getche(){return getch();}",
    "inline void gotoxy(int,int){}",
    "inline void textcolor(int){}",
    "inline void textbackground(int){}",
    "inline void textmode(int){}",
    "inline void clreol(){}",
    "inline void window(int,int,int,int){}",
    "inline int kbhit(){return 0;}",
    "inline int wherex(){return 1;}",
    "inline int wherey(){return 1;}",
    "inline void delay(unsigned){}",
    "inline void sound(unsigned){}",
    "inline void nosound(){}"
  ].join("\n");

  function modernize(code) {
    const src = String(code).replace(/\r\n?/g, "\n");
    const lines = src.split("\n");

    let classic = /^[ \t]*void[ \t]+main[ \t]*\(/m.test(src);
    const headers = [];
    lines.forEach((line) => {
      const inc = line.match(/^\s*#\s*include\s*[<"]\s*([\w.]+)\s*[">]/);
      if (inc && CLASSIC_HEADERS[inc[1].toLowerCase()]) {
        classic = true;
        headers.push(inc[1].toLowerCase());
      }
    });
    if (!classic) return src;                    // already ISO C++ - leave it alone

    const body = lines.map((line) => {
      const inc = line.match(/^\s*#\s*include\s*[<"]\s*([\w.]+)\s*[">]/);
      if (inc && CLASSIC_HEADERS[inc[1].toLowerCase()]) return "";   // the prologue supplies it
      if (/^\s*void\s+main\s*\(/.test(line)) return line.replace(/void(\s+main\s*\()/, "int$1");
      return line;
    }).join("\n");

    const prologue = [
      "#include <iostream>",
      "#include <iomanip>",
      "#include <fstream>",
      "#include <sstream>",
      "#include <string>",
      "#include <cstdio>",
      "#include <cstdlib>",
      "#include <cstring>",
      "#include <cmath>",
      "using namespace std;"
    ];
    if (headers.indexOf("conio.h") >= 0 || headers.indexOf("dos.h") >= 0 ||
        /\b(clrscr|getch|getche|gotoxy|textcolor|kbhit|delay)\s*\(/.test(src)) {
      prologue.push(CONIO_SHIM);
    }
    // resynchronise the line counter so error messages match the editor
    prologue.push("#line 1");
    return prologue.join("\n") + "\n" + body;
  }

  /* =========================================================
     8.  A tiny C: drive kept in localStorage
     ========================================================= */

  const STORE_KEY = "tc3.drive.c";

  const SAMPLES = {
    "HELLO.CPP":
      "#include <iostream.h>\n#include <conio.h>\n\nvoid main()\n{\n" +
      "    clrscr();\n    cout << \"Hello, world!\" << endl;\n    getch();\n}\n",
    "AVERAGE.CPP":
      "#include <iostream.h>\n\nvoid main()\n{\n    int n;\n    float sum = 0, x;\n\n" +
      "    cin >> n;\n    for (int i = 0; i < n; i++)\n    {\n        cin >> x;\n" +
      "        sum = sum + x;\n    }\n    cout << sum / n << endl;\n}\n",
    "STARS.CPP":
      "#include <iostream.h>\n\nvoid main()\n{\n    int rows;\n\n    cin >> rows;\n" +
      "    for (int i = 1; i <= rows; i++)\n    {\n" +
      "        for (int j = 0; j < i; j++)\n            cout << \"*\";\n" +
      "        cout << endl;\n    }\n}\n"
  };

  function readFiles() {
    try {
      const raw = global.localStorage && localStorage.getItem(STORE_KEY);
      if (!raw) {
        if (global.localStorage) localStorage.setItem(STORE_KEY, JSON.stringify(SAMPLES));
        return Object.assign({}, SAMPLES);
      }
      return JSON.parse(raw);
    } catch (err) {
      return Object.assign({}, SAMPLES);
    }
  }
  function writeFile(name, content) {
    try {
      const files = readFiles();
      files[name] = content;
      localStorage.setItem(STORE_KEY, JSON.stringify(files));
      return true;
    } catch (err) { return false; }
  }
  function deleteFile(name) {
    try {
      const files = readFiles();
      delete files[name];
      localStorage.setItem(STORE_KEY, JSON.stringify(files));
      return true;
    } catch (err) { return false; }
  }

  const DEFAULT_SOURCE = SAMPLES["HELLO.CPP"];

  const HELP_TOPICS = {
    cout: ["cout  -  standard output stream  (<iostream.h>)", "",
           "    cout << \"Total = \" << total << endl;", "",
           "Use the insertion operator << once per item."],
    cin: ["cin  -  standard input stream  (<iostream.h>)", "",
          "    int n;", "    cin >> n;", "",
          "Use the extraction operator >> once per variable."],
    "for": ["for  -  counted loop", "",
            "    for (int i = 0; i < n; i++)", "    {", "        cout << i << endl;", "    }"],
    "while": ["while  -  conditional loop", "",
              "    while (x != 0)", "    {", "        cin >> x;", "    }"],
    "if": ["if / else  -  selection", "",
           "    if (mark >= 50)", "        cout << \"PASS\";", "    else", "        cout << \"FAIL\";"],
    "switch": ["switch  -  multi-way selection", "",
               "    switch (grade)", "    {", "        case 'A': cout << \"Excellent\"; break;",
               "        default : cout << \"Try again\";", "    }"],
    getch: ["getch()  -  read one key without echo  (<conio.h>)", "",
            "Turbo programs end with getch(); so the user screen",
            "stays visible. In this emulation it reads from the",
            "program input you type before running."],
    clrscr: ["clrscr()  -  clear the text screen  (<conio.h>)", "",
             "Supported, but it does nothing in this emulation."],
    main: ["main()  -  where the program starts", "",
           "Turbo C++ 3.0 accepted void main(); ISO C++ wants",
           "int main(). The emulation rewrites void main() for you."]
  };

  /* =========================================================
     9.  Public API
     ========================================================= */

  /** Build a runner backed by the Wandbox public compile API. */
  function wandboxRunner(cfg) {
    const conf = cfg || {};
    const url = conf.url || "https://wandbox.org/api/compile.json";
    const compiler = conf.compiler || "gcc-head";
    const timeout = conf.timeout || 20000;
    return async function (code, stdin) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ compiler: compiler, code: modernize(code), stdin: stdin || "" })
        });
        if (!res.ok) throw new Error("compiler service returned HTTP " + res.status);
        const data = await res.json();
        const diag = data.compiler_error || "";
        const failed = /(^|\n)[^\n]*\berror\b/i.test(diag);
        return {
          compileError: failed ? diag : "",
          warnings: failed ? "" : diag,
          output: data.program_output || "",
          runtimeError: (String(data.status) !== "0" || data.signal)
            ? (data.program_error || "runtime error (exit code " + data.status + ")")
            : null
        };
      } finally {
        clearTimeout(timer);
      }
    };
  }

  const TurboIDE = {
    version: "3.0",
    mount: function (host, opts) {
      const el = typeof host === "string" ? document.querySelector(host) : host;
      if (!el) throw new Error("TurboIDE.mount: host element not found");
      return new IDE(el, opts || {});
    },
    modernize: modernize,
    borlandize: borlandize,
    wandboxRunner: wandboxRunner,
    DEFAULT_SOURCE: DEFAULT_SOURCE
  };

  global.TurboIDE = TurboIDE;
  if (typeof module !== "undefined" && module.exports) module.exports = TurboIDE;
})(typeof window !== "undefined" ? window : globalThis);
