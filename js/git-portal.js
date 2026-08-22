/**
 * Git Quest — portal logic: levels, XP, stars, badges, terminal, animation.
 *
 * Depends on js/git-engine.js (simulator), js/git-viz.js (graph),
 * js/git-levels.js (level pack) and js/config.js (optional Sheets URL).
 */
(function () {
  "use strict";

  const STORE = "pps2114-git-quest-v1";
  const LEVELS = window.GIT_LEVELS;
  const WORLDS = window.GIT_WORLDS;
  const $ = (s) => document.querySelector(s);

  const RANKS = [
    { at: 0,    en: "Intern",            zh: "实习生" },
    { at: 150,  en: "Junior Committer",  zh: "初级提交者" },
    { at: 400,  en: "Branch Wrangler",   zh: "分支牧民" },
    { at: 750,  en: "Merge Marshal",     zh: "合并元帅" },
    { at: 1150, en: "Rebase Ranger",     zh: "变基游侠" },
    { at: 1600, en: "Conflict Slayer",   zh: "冲突终结者" },
    { at: 2100, en: "Git Sensei",        zh: "Git 宗师" }
  ];

  const solvedIn = (p, world) => LEVELS.filter((l) => l.world === world && p.levels[l.id] && p.levels[l.id].solved).length;
  const totalIn = (world) => LEVELS.filter((l) => l.world === world).length;

  const BADGES = [
    { id: "first-commit", en: "First Commit", zh: "第一个提交",
      hint: { en: "Solve level 1-1", zh: "通过 1-1" },
      test: (p) => !!(p.levels["1-1"] || {}).solved },
    { id: "brancher", en: "Brancher", zh: "开枝散叶",
      hint: { en: "Clear World 1", zh: "通关第一章" },
      test: (p) => solvedIn(p, 1) === totalIn(1) },
    { id: "merge-marshal", en: "Merge Marshal", zh: "合并元帅",
      hint: { en: "Clear World 2", zh: "通关第二章" },
      test: (p) => solvedIn(p, 2) === totalIn(2) },
    { id: "rebase-ranger", en: "Rebase Ranger", zh: "变基游侠",
      hint: { en: "Clear World 3", zh: "通关第三章" },
      test: (p) => solvedIn(p, 3) === totalIn(3) },
    { id: "conflict-slayer", en: "Conflict Slayer", zh: "冲突终结者",
      hint: { en: "Clear World 4", zh: "通关第四章" },
      test: (p) => solvedIn(p, 4) === totalIn(4) },
    { id: "time-traveler", en: "Time Traveller", zh: "时间旅人",
      hint: { en: "Master reset and revert", zh: "掌握 reset 与 revert" },
      test: (p) => !!(p.levels["5-1"] || {}).solved && !!(p.levels["5-2"] || {}).solved },
    { id: "cherry", en: "Cherry Picker", zh: "拣选专家",
      hint: { en: "Solve the cherry-pick level", zh: "通过拣选关卡" },
      test: (p) => !!(p.levels["3-4"] || {}).solved },
    { id: "perfectionist", en: "Perfectionist", zh: "完美主义",
      hint: { en: "Three stars on 8 levels", zh: "8 个关卡拿到三星" },
      test: (p) => Object.values(p.levels).filter((l) => l.stars === 3).length >= 8 },
    { id: "unaided", en: "No Hints Needed", zh: "无需提示",
      hint: { en: "Solve 6 levels with no hints", zh: "不用提示通过 6 关" },
      test: (p) => Object.values(p.levels).filter((l) => l.solved && !l.hints && !l.usedSolution).length >= 6 },
    { id: "boss", en: "Boss Slayer", zh: "屠龙者",
      hint: { en: "Beat the final boss", zh: "击败最终 BOSS" },
      test: (p) => !!(p.levels["5-4"] || {}).solved },
    { id: "completionist", en: "Completionist", zh: "全通",
      hint: { en: "Solve every level", zh: "通过所有关卡" },
      test: (p) => LEVELS.every((l) => (p.levels[l.id] || {}).solved) }
  ];

  const I18N = {
    en: {
      sandbox: "Sandbox", wipe: "Reset progress", mapTitle: "Level map", badgesTitle: "Badges",
      reportTitle: "Report to lecturer", reportBlurb: "Optional: send your stars to the course spreadsheet.",
      fieldName: "Full name", fieldId: "Student ID", fieldClass: "Class / group", sendReport: "Send progress",
      goalLabel: "Goal:", parLabel: "par", usedLabel: "commands used", bestLabel: "best",
      hintBtn: "Hint", restartBtn: "Restart level", solutionBtn: "Show solution", cheatBtn: "Command reference",
      yourRepo: "Your repository", target: "Target", terminal: "Terminal", runBtn: "Run", worktree: "Working tree",
      locked: "Locked — finish the level before it",
      sandboxName: "Sandbox", sandboxKicker: "Free play",
      sandboxBrief: "No goal here — try anything. Break things, abort things, watch the graph move.",
      sandboxGoal: "Experiment freely. Every command is available.",
      welcome: "Type a command below, or click a chip to paste one. `git status` is always a safe first move.",
      solved: "Level complete!", solvedAgain: "Solved again!",
      xpGain: "+%s XP", starsLabel: "%s / 3 stars",
      nextLevel: "Next level", replay: "Replay", close: "Close",
      newBadge: "New badge unlocked:",
      notYet: "Not there yet:",
      allDone: "That is the whole quest — every level cleared. Ship it. 🚀",
      hintCost: "Each hint costs a little XP.",
      noMoreHints: "No hints left for this level.",
      confirmSolution: "Show the reference solution? The level restarts, plays it step by step, and you get one star for it.",
      confirmWipe: "Erase all XP, stars and badges?",
      playing: "Playing the reference solution…",
      conflictNote: "Conflict! Fix the file(s) below, `git add` them, then finish with",
      stageBtn: "git add", keepOurs: "Keep ours", keepTheirs: "Keep theirs", keepBoth: "Keep both",
      staged: "staged", conflicted: "conflict",
      reportNoUrl: "No spreadsheet URL is configured in js/config.js.",
      reportNoName: "Enter your name and student ID first.",
      reportSending: "Sending…", reportOk: "Sent — %s / %s stars recorded.",
      reportErr: "Could not send: ", cheatTitle: "Commands this simulator understands",
      progressLabel: "%s / %s levels · %s / %s stars",
      fillerNote: "+ %s placeholder file(s) written by plain `git commit`.",
      emptyTree: "The working tree is empty."
    },
    zh: {
      sandbox: "自由模式", wipe: "清空进度", mapTitle: "关卡地图", badgesTitle: "徽章",
      reportTitle: "上报成绩", reportBlurb: "可选：把你的星星发送到课程表格。",
      fieldName: "姓名", fieldId: "学号", fieldClass: "班级 / 组别", sendReport: "发送进度",
      goalLabel: "目标：", parLabel: "标准步数", usedLabel: "已用命令", bestLabel: "最佳",
      hintBtn: "提示", restartBtn: "重玩本关", solutionBtn: "查看答案", cheatBtn: "命令速查",
      yourRepo: "你的仓库", target: "目标图", terminal: "终端", runBtn: "执行", worktree: "工作区",
      locked: "未解锁 —— 先通过上一关",
      sandboxName: "自由练习场", sandboxKicker: "自由模式",
      sandboxBrief: "这里没有目标——随便试。搞坏它、abort 它，看图怎么动。",
      sandboxGoal: "自由实验，所有命令都可用。",
      welcome: "在下面输入命令，或点击标签粘贴一条。`git status` 永远是安全的第一步。",
      solved: "过关！", solvedAgain: "再次通过！",
      xpGain: "+%s XP", starsLabel: "%s / 3 星",
      nextLevel: "下一关", replay: "再玩一次", close: "关闭",
      newBadge: "解锁新徽章：",
      notYet: "还没达成：",
      allDone: "全部关卡通关，Git 已经是你的了。🚀",
      hintCost: "每次提示会扣一点经验值。",
      noMoreHints: "本关没有更多提示了。",
      confirmSolution: "要看参考答案吗？本关会重新开始并逐步演示，本关只能拿一星。",
      confirmWipe: "确定清空所有经验、星星和徽章？",
      playing: "正在演示参考答案……",
      conflictNote: "冲突！修好下面的文件，`git add` 之后再执行",
      stageBtn: "git add", keepOurs: "保留我们的", keepTheirs: "保留他们的", keepBoth: "两边都保留",
      staged: "已暂存", conflicted: "冲突",
      reportNoUrl: "js/config.js 里没有配置表格地址。",
      reportNoName: "请先填写姓名和学号。",
      reportSending: "正在发送……", reportOk: "已发送 —— 记录了 %s / %s 星。",
      reportErr: "发送失败：", cheatTitle: "本模拟器支持的命令",
      progressLabel: "%s / %s 关 · %s / %s 星",
      fillerNote: "另有 %s 个由 `git commit` 自动生成的占位文件。",
      emptyTree: "工作区是空的。"
    }
  };

  // ============================================================
  // STATE
  // ============================================================
  const state = {
    lang: "en",
    levelIndex: 0,
    sandbox: false,
    sim: null,
    goalRepo: null,
    startRepo: null,
    commands: 0,
    hintsShown: 0,
    usedSolution: false,
    solvedThisRun: false,
    busy: false,
    history: [],
    histPos: -1
  };

  let progress = loadProgress();
  let viz, goalViz;

  function loadProgress() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(STORE) || "null"); } catch (e) { p = null; }
    if (!p || typeof p !== "object") p = {};
    return Object.assign({ xp: 0, levels: {}, badges: [], lang: null, student: {}, lastLevel: 0 }, p);
  }
  function saveProgress() {
    try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch (e) { /* private mode */ }
  }

  const t = (k) => (I18N[state.lang][k] != null ? I18N[state.lang][k] : I18N.en[k]);
  const tx = (obj) => (obj ? (obj[state.lang] || obj.en) : "");
  const fmt = (str, ...vals) => vals.reduce((s, v) => s.replace("%s", v), str);

  /** Escape HTML, then render `code` spans for backtick fragments. */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function mono(s) {
    return esc(s).replace(/`([^`]+)`/g, '<code style="font-family:var(--gq-mono);color:#7dd3fc">$1</code>');
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ============================================================
  // HEADER / XP / BADGES
  // ============================================================
  function rankFor(xp) {
    let cur = RANKS[0], next = null;
    for (let i = 0; i < RANKS.length; i++) {
      if (xp >= RANKS[i].at) { cur = RANKS[i]; next = RANKS[i + 1] || null; }
    }
    return { cur, next };
  }

  function renderHeader() {
    const { cur, next } = rankFor(progress.xp);
    $("#gq-rank").textContent = state.lang === "zh" ? cur.zh : cur.en;
    $("#gq-rank-zh").textContent = state.lang === "zh" ? "(" + cur.en + ")" : "";
    const floor = cur.at, ceil = next ? next.at : cur.at + 400;
    const pct = Math.min(100, Math.round(((progress.xp - floor) / (ceil - floor)) * 100));
    $("#gq-xp-now").textContent = progress.xp;
    $("#gq-xp-next").textContent = ceil;
    $("#gq-xp-bar").style.width = pct + "%";
  }

  function renderBadges() {
    const box = $("#gq-badges");
    box.innerHTML = "";
    for (const b of BADGES) {
      const earned = progress.badges.includes(b.id);
      const el = document.createElement("span");
      el.className = "gq-badge" + (earned ? " earned" : "");
      el.textContent = (earned ? "★ " : "☆ ") + (state.lang === "zh" ? b.zh : b.en);
      el.title = tx(b.hint);
      box.appendChild(el);
    }
  }

  function checkBadges() {
    const gained = [];
    for (const b of BADGES) {
      if (progress.badges.includes(b.id)) continue;
      if (b.test(progress)) { progress.badges.push(b.id); gained.push(b); }
    }
    if (gained.length) { saveProgress(); renderBadges(); }
    return gained;
  }

  function isUnlocked(i) {
    if (i === 0) return true;
    const prev = LEVELS[i - 1];
    return !!(progress.levels[prev.id] || {}).solved;
  }

  function stars(id) { return (progress.levels[id] || {}).stars || 0; }

  function renderMap() {
    const map = $("#gq-map");
    map.innerHTML = "";
    for (const w of WORLDS) {
      const wrap = document.createElement("div");
      wrap.className = "gq-world";
      const done = solvedIn(progress, w.id);
      wrap.innerHTML =
        '<div class="gq-world-head"><b>' + esc(tx(w.name)) + "</b><span>" + done + "/" + totalIn(w.id) + "</span></div>" +
        '<p class="gq-world-blurb">' + esc(tx(w.blurb)) + "</p>";
      LEVELS.forEach((lv, i) => {
        if (lv.world !== w.id) return;
        const unlocked = isUnlocked(i);
        const st = stars(lv.id);
        const btn = document.createElement("button");
        btn.className = "gq-level" +
          (!unlocked ? " is-locked" : "") +
          (st ? " is-solved" : "") +
          (!state.sandbox && i === state.levelIndex ? " is-current" : "");
        btn.innerHTML =
          '<span class="gq-lv-id">' + lv.id + "</span>" +
          '<span class="gq-lv-name">' + esc(tx(lv.name)) + "</span>" +
          '<span class="gq-lv-stars">' + (unlocked ? "★".repeat(st) + "☆".repeat(3 - st) : "🔒") + "</span>";
        if (!unlocked) btn.title = t("locked");
        btn.addEventListener("click", () => { if (unlocked) loadLevel(i); });
        wrap.appendChild(btn);
      });
      map.appendChild(wrap);
    }
    const totalStars = LEVELS.reduce((n, l) => n + stars(l.id), 0);
    const solved = LEVELS.filter((l) => (progress.levels[l.id] || {}).solved).length;
    $("#gq-map-summary").textContent = fmt(t("progressLabel"), solved, LEVELS.length, totalStars, LEVELS.length * 3);
  }

  // ============================================================
  // TERMINAL OUTPUT
  // ============================================================
  function log(text, cls) {
    const box = $("#gq-log");
    const div = document.createElement("div");
    div.className = cls || "out";
    div.innerHTML = mono(text);
    box.appendChild(div);
    while (box.children.length > 400) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  }

  // ============================================================
  // LEVEL LOADING
  // ============================================================
  const goalCache = {};

  function buildGoal(lv) {
    if (goalCache[lv.id]) return goalCache[lv.id];
    const sim = new GitSim();
    lv.setup.forEach((c) => sim.run(c));
    const start = sim.snapshot();
    lv.solution.forEach((c) => sim.run(c));
    goalCache[lv.id] = { start, goal: sim.snapshot() };
    return goalCache[lv.id];
  }

  function currentLevel() { return state.sandbox ? null : LEVELS[state.levelIndex]; }

  function loadLevel(index, opts) {
    opts = opts || {};
    state.sandbox = index === "sandbox";
    state.busy = false;
    state.commands = 0;
    state.hintsShown = 0;
    state.usedSolution = false;
    state.solvedThisRun = false;
    $("#gq-hintbox").classList.add("gq-hidden");
    $("#gq-hintbox").innerHTML = "";
    $("#gq-log").innerHTML = "";

    if (state.sandbox) {
      state.sim = new GitSim();
      state.startRepo = state.sim.snapshot();
      state.goalRepo = null;
    } else {
      state.levelIndex = index;
      progress.lastLevel = index;
      saveProgress();
      const lv = LEVELS[index];
      const built = buildGoal(lv);
      state.sim = GitSim.fromSnapshot(built.start);
      state.startRepo = built.start;
      state.goalRepo = built.goal;
    }

    renderMission();
    renderMap();
    renderPalette();
    viz.render(state.sim.repo, { animate: false });
    if (state.goalRepo) goalViz.render(state.goalRepo, { animate: false });
    else goalViz.render(state.sim.repo, { animate: false });
    renderFiles();
    renderStatusChip();

    const lv = currentLevel();
    if (lv) {
      log("== " + lv.id + " · " + tx(lv.name) + " ==", "sys");
      log(tx(lv.brief), "out");
      log(t("goalLabel") + " " + tx(lv.goal), "ok");
    } else {
      log("== " + t("sandboxName") + " ==", "sys");
      log(t("sandboxBrief"), "out");
    }
    log(t("welcome"), "muted");
    if (!opts.keepFocus) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      $("#gq-input").focus({ preventScroll: true });
    }
  }

  function renderMission() {
    const lv = currentLevel();
    if (!lv) {
      $("#gq-kicker").textContent = t("sandboxKicker");
      $("#gq-level-name").textContent = t("sandboxName");
      $("#gq-brief").innerHTML = mono(t("sandboxBrief"));
      $("#gq-goal").innerHTML = mono(t("sandboxGoal"));
      $("#gq-par").textContent = "–";
      $("#gq-best").textContent = "–";
      $("#gq-used").textContent = state.commands;
      $("#gq-hint").disabled = true;
      $("#gq-solution").disabled = true;
      return;
    }
    const world = WORLDS.find((w) => w.id === lv.world);
    const nth = LEVELS.filter((l) => l.world === lv.world).indexOf(lv) + 1;
    $("#gq-kicker").textContent =
      (state.lang === "zh" ? "第 " + lv.world + " 章 · 第 " + nth + " 关 · " : "World " + lv.world + " · Level " + nth + " · ") + tx(world.name);
    $("#gq-level-name").textContent = tx(lv.name);
    $("#gq-brief").innerHTML = mono(tx(lv.brief));
    $("#gq-goal").innerHTML = mono(tx(lv.goal));
    $("#gq-par").textContent = lv.par;
    $("#gq-used").textContent = state.commands;
    const rec = progress.levels[lv.id];
    $("#gq-best").textContent = rec && rec.best ? rec.best + " (" + "★".repeat(rec.stars) + ")" : "–";
    $("#gq-hint").disabled = false;
    $("#gq-solution").disabled = false;
  }

  function renderStatusChip() {
    if (!state.sim) return;
    const repo = state.sim.repo;
    const chip = $("#gq-status-chip");
    const where = repo.head.type === "branch" ? repo.head.name : "detached@" + repo.head.id;
    const op = repo.pending ? " · " + repo.pending.op.toUpperCase() + "!" : "";
    chip.innerHTML = '<span style="font-family:var(--gq-mono);color:' +
      (repo.pending ? "var(--gq-red)" : "var(--gq-cyan)") + '">HEAD → ' + esc(where) + esc(op) + "</span>";
  }

  // ============================================================
  // WORKING TREE PANEL
  // ============================================================
  function renderFiles() {
    if (!state.sim) return;
    const repo = state.sim.repo;
    const box = $("#gq-files");
    const note = $("#gq-conflict-note");
    box.innerHTML = "";

    if (repo.pending) {
      const finish = repo.pending.op === "merge" ? "git commit" : "git " + repo.pending.op + " --continue";
      note.innerHTML = '<div class="gq-conflict-note">' + mono(t("conflictNote") + " `" + finish + "`") + "</div>";
    } else {
      note.innerHTML = "";
    }

    const head = state.sim.headCommit();
    const committed = head ? head.files : {};
    const all = Object.keys(repo.workdir).sort();
    const filler = all.filter((f) => /^f\d+\.txt$/.test(f));   // auto-generated by plain `git commit`
    const names = all.filter((f) => !filler.includes(f));

    for (const f of names) {
      const content = repo.workdir[f];
      const conflicted = state.sim.hasMarkers(content);
      const isStaged = repo.index[f] === content;
      const modified = committed[f] !== content;
      const div = document.createElement("div");
      div.className = "gq-file" + (conflicted ? " is-conflict" : "");
      const flag = conflicted
        ? '<span class="gq-flag conflict">' + t("conflicted") + "</span>"
        : (isStaged ? '<span class="gq-flag staged">' + t("staged") + "</span>" : "");
      div.innerHTML = '<div class="gq-file-name"><span>' + esc(f) + "</span>" + flag + "</div>";

      if (conflicted) {
        const ta = document.createElement("textarea");
        ta.value = content;
        ta.spellcheck = false;
        ta.addEventListener("change", () => {
          repo.workdir[f] = ta.value.endsWith("\n") ? ta.value : ta.value + "\n";
          log("edited " + f + " in the editor", "muted");
          renderFiles();
        });
        div.appendChild(ta);
        const actions = document.createElement("div");
        actions.className = "gq-file-actions";
        [["--ours", t("keepOurs")], ["--theirs", t("keepTheirs")], ["--both", t("keepBoth")]]
          .forEach(([flagArg, label]) => {
            const b = document.createElement("button");
            b.className = "gq-btn tiny";
            b.textContent = label;
            b.addEventListener("click", () => submit("resolve " + f + " " + flagArg, { free: true }));
            actions.appendChild(b);
          });
        div.appendChild(actions);
      } else {
        const pre = document.createElement("pre");
        pre.textContent = content.replace(/\n$/, "");
        div.appendChild(pre);
        if (modified && !isStaged) {
          const actions = document.createElement("div");
          actions.className = "gq-file-actions";
          const b = document.createElement("button");
          b.className = "gq-btn tiny";
          b.textContent = t("stageBtn") + " " + f;
          b.addEventListener("click", () => submit("git add " + f));
          actions.appendChild(b);
          div.appendChild(actions);
        }
      }
      box.appendChild(div);
    }

    if (filler.length) {
      const note = document.createElement("p");
      note.className = "gq-world-blurb";
      note.textContent = fmt(t("fillerNote"), filler.length);
      box.appendChild(note);
    }
    if (!names.length && !filler.length) {
      const note = document.createElement("p");
      note.className = "gq-world-blurb";
      note.textContent = t("emptyTree");
      box.appendChild(note);
    }
  }

  // ============================================================
  // COMMAND PALETTE
  // ============================================================
  function renderPalette() {
    const lv = currentLevel();
    const world = lv ? lv.world : 5;
    const chips = ["git status", "git log", "git branch"];
    if (world >= 1) chips.push('git commit -m "message"', "git checkout -b name", "git checkout main", "git branch -f name ref");
    if (world >= 2) chips.push("git merge branch");
    if (world >= 3) chips.push("git rebase main", "git rebase --onto A B C", "git cherry-pick C4", "git show C4");
    if (world >= 4) chips.push("git add .", "git commit", "git rebase --continue", "git merge --abort", "git rebase --abort");
    if (world >= 5) chips.push("git reset --hard HEAD~1", "git revert HEAD", "git tag v1.0");
    const box = $("#gq-palette");
    box.innerHTML = "";
    chips.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = c;
      b.addEventListener("click", () => {
        const input = $("#gq-input");
        input.value = c;
        input.focus();
      });
      box.appendChild(b);
    });
  }

  // ============================================================
  // RUNNING COMMANDS
  // ============================================================
  async function submit(line, opts) {
    opts = opts || {};
    if (state.busy || !line.trim()) return;
    state.busy = true;
    $("#gq-input").disabled = true;
    try {
      log("$ " + line, "cmd");
      const res = state.sim.run(line);
      res.lines.forEach((l) => log(l.text, l.cls));
      if (res.ok && res.changed && !opts.free) state.commands++;
      $("#gq-used").textContent = state.commands;

      await playSnapshots(res.snapshots);
      renderFiles();
      renderStatusChip();
      if (!state.sandbox && !opts.noCheck) await checkGoal();
    } finally {
      state.busy = false;
      $("#gq-input").disabled = false;
      if (!opts.quiet) $("#gq-input").focus();
    }
  }

  /** One snapshot per visible step: rebase/cherry-pick replay animates commit by commit. */
  async function playSnapshots(snapshots) {
    if (!snapshots || !snapshots.length) return;
    for (let i = 0; i < snapshots.length; i++) {
      viz.render(snapshots[i], { animate: true });
      await wait(i === snapshots.length - 1 ? 460 : 620);
    }
  }

  // ============================================================
  // GOAL CHECK / SCORING
  // ============================================================
  async function checkGoal() {
    const lv = currentLevel();
    if (!lv || !state.goalRepo) return;
    if (state.sim.repo.pending) return;              // mid-merge / mid-rebase
    const mine = GitSim.canon(state.sim.repo, lv.compare);
    const goal = GitSim.canon(state.goalRepo, lv.compare);
    if (mine !== goal) return;
    if (state.solvedThisRun) return;          // already celebrated this attempt
    state.solvedThisRun = true;
    await wait(220);
    award(lv);
  }

  function award(lv) {
    const world = WORLDS.find((w) => w.id === lv.world);
    let st = state.commands <= lv.par ? 3 : (state.commands <= lv.par + 2 ? 2 : 1);
    if (state.usedSolution) st = 1;
    let xp = Math.round((world.xp * st / 3) / 5) * 5 - state.hintsShown * 10;
    if (state.usedSolution) xp = Math.round(xp * 0.4);
    xp = Math.max(10, xp);

    const rec = progress.levels[lv.id] || { stars: 0, best: null, xpAwarded: 0, hints: 0, solved: false };
    const already = rec.solved;
    const delta = Math.max(0, xp - (rec.xpAwarded || 0));
    progress.levels[lv.id] = {
      solved: true,
      stars: Math.max(rec.stars || 0, st),
      best: rec.best == null ? state.commands : Math.min(rec.best, state.commands),
      xpAwarded: Math.max(rec.xpAwarded || 0, xp),
      // keep the best attempt ever, so badges reward the good run
      hints: rec.solved ? Math.min(rec.hints || 0, state.hintsShown) : state.hintsShown,
      usedSolution: rec.solved ? !!rec.usedSolution && state.usedSolution : state.usedSolution
    };
    progress.xp += delta;
    saveProgress();

    const newBadges = checkBadges();
    renderHeader();
    renderMap();
    renderMission();
    log(fmt(t("xpGain"), delta) + " · " + fmt(t("starsLabel"), st), "ok");
    showComplete(lv, st, delta, newBadges, already);
  }

  function showComplete(lv, st, xp, badges, already) {
    const nextIndex = lv.index + 1 < LEVELS.length ? lv.index + 1 : null;
    const root = $("#gq-modal-root");
    root.innerHTML =
      '<div class="gq-modal-back"><div class="gq-modal">' +
      "<h2>" + esc(already ? t("solvedAgain") : t("solved")) + "</h2>" +
      '<div class="gq-stars">' + "★".repeat(st) + "☆".repeat(3 - st) + "</div>" +
      '<div class="gq-xp-gain">' + esc(fmt(t("xpGain"), xp)) + "</div>" +
      "<p>" + mono(tx(lv.goal)) + "</p>" +
      (badges.length
        ? '<div class="gq-new-badges">' + esc(t("newBadge")) + " " +
          badges.map((b) => '<span class="gq-badge earned">★ ' + esc(state.lang === "zh" ? b.zh : b.en) + "</span>").join(" ") +
          "</div>"
        : "") +
      (nextIndex == null ? "<p>" + esc(t("allDone")) + "</p>" : "") +
      '<div class="gq-modal-actions">' +
      (nextIndex != null ? '<button class="gq-btn primary" id="gq-next">' + esc(t("nextLevel")) + "</button>" : "") +
      '<button class="gq-btn" id="gq-replay">' + esc(t("replay")) + "</button>" +
      '<button class="gq-btn ghost" id="gq-close">' + esc(t("close")) + "</button>" +
      "</div></div></div>";

    const close = () => { root.innerHTML = ""; $("#gq-input").focus(); };
    if ($("#gq-next")) $("#gq-next").addEventListener("click", () => { close(); loadLevel(nextIndex); });
    $("#gq-replay").addEventListener("click", () => { close(); loadLevel(lv.index); });
    $("#gq-close").addEventListener("click", close);
  }

  // ============================================================
  // HINTS / SOLUTION / REFERENCE
  // ============================================================
  function showHint() {
    const lv = currentLevel();
    if (!lv) return;
    const box = $("#gq-hintbox");
    if (state.hintsShown >= lv.hints.length) {
      log(t("noMoreHints"), "muted");
      return;
    }
    const h = lv.hints[state.hintsShown++];
    box.classList.remove("gq-hidden");
    box.innerHTML += "<p>💡 " + mono(tx(h)) + "</p>";
    if (state.hintsShown === 1) log(t("hintCost"), "muted");
  }

  async function playSolution() {
    const lv = currentLevel();
    if (!lv || state.busy) return;
    if (!window.confirm(t("confirmSolution"))) return;
    loadLevel(lv.index, { keepFocus: true });
    state.usedSolution = true;
    log(t("playing"), "sys");
    for (const cmd of lv.solution) {
      await wait(520);
      await submit(cmd, { quiet: true, noCheck: true });
    }
    await checkGoal();
  }

  const CHEATS = [
    ["git status / git log / git show C3", { en: "look around", zh: "查看当前状态与历史" }],
    ["git commit -m \"msg\"", { en: "snapshot your work", zh: "把工作存成快照" }],
    ["git add <file> / git add .", { en: "stage changes (and mark conflicts resolved)", zh: "暂存改动（也用来标记冲突已解决）" }],
    ["git branch <name> [ref] / git branch -f <name> <ref>", { en: "create or move a label", zh: "创建或移动分支标签" }],
    ["git checkout <ref> / git checkout -b <name> [ref]", { en: "move HEAD, optionally creating a branch", zh: "移动 HEAD，可同时新建分支" }],
    ["git merge <branch>", { en: "join another branch into this one", zh: "把另一条分支并入当前分支" }],
    ["git rebase <upstream> [branch]", { en: "replay this branch's commits on top of another", zh: "把本分支的提交重放到另一处" }],
    ["git rebase --onto <new> <old> <branch>", { en: "move a branch off the wrong base", zh: "把分支从错误的基底搬走" }],
    ["git rebase --continue / --abort / --skip", { en: "steer a paused rebase", zh: "控制暂停中的变基" }],
    ["git cherry-pick <commit>…", { en: "copy single commits here", zh: "把单个提交复制到这里" }],
    ["git reset --hard <ref> / git revert <commit>", { en: "rewrite locally vs. undo publicly", zh: "本地改写历史 / 公开撤销" }],
    ["git tag <name> [ref]", { en: "pin a name on a commit", zh: "给提交钉上一个名字" }],
    ["edit <file> \"text\"", { en: "change a file (the game's editor)", zh: "修改文件（游戏里的编辑器）" }],
    ["resolve <file> --ours|--theirs|--both", { en: "resolve a conflict quickly", zh: "快速解决冲突" }],
    ["cat <file> / ls", { en: "inspect the working tree", zh: "查看工作区" }]
  ];

  function showCheats() {
    const root = $("#gq-modal-root");
    root.innerHTML =
      '<div class="gq-modal-back"><div class="gq-modal" style="width:min(620px,100%);text-align:left">' +
      "<h2>" + esc(t("cheatTitle")) + "</h2>" +
      CHEATS.map(([cmd, desc]) =>
        '<p style="margin:6px 0"><code style="font-family:var(--gq-mono);color:#7dd3fc">' + esc(cmd) +
        '</code><br><span style="color:var(--gq-muted);font-size:0.85rem">' + esc(tx(desc)) + "</span></p>").join("") +
      '<div class="gq-modal-actions"><button class="gq-btn primary" id="gq-close">' + esc(t("close")) + "</button></div>" +
      "</div></div>";
    $("#gq-close").addEventListener("click", () => { root.innerHTML = ""; $("#gq-input").focus(); });
  }

  // ============================================================
  // REPORT TO LECTURER (optional, reuses the course spreadsheet)
  // ============================================================
  async function sendReport() {
    const status = $("#gq-report-status");
    const url = (window.CONFIG || {}).SHEETS_WEBAPP_URL;
    status.className = "gq-report-status";
    if (!url) { status.textContent = t("reportNoUrl"); status.classList.add("err"); return; }
    const name = $("#gq-name").value.trim(), id = $("#gq-id").value.trim(), klass = $("#gq-class").value.trim();
    if (!name || !id) { status.textContent = t("reportNoName"); status.classList.add("err"); return; }
    progress.student = { name, id, klass };
    saveProgress();

    const total = LEVELS.reduce((n, l) => n + stars(l.id), 0);
    const maxTotal = LEVELS.length * 3;
    const payload = {
      assessment: "PPS2114 Git Quest",
      timestamp: new Date().toISOString(),
      name, studentId: id, class: klass,
      total, maxTotal,
      percent: Math.round((total / maxTotal) * 1000) / 10,
      questions: LEVELS.map((l) => {
        const rec = progress.levels[l.id] || {};
        return {
          id: l.id, score: rec.stars || 0, max: 3,
          note: rec.solved
            ? rec.best + " cmds" + (rec.hints ? ", " + rec.hints + " hint(s)" : "") + (rec.usedSolution ? ", solution shown" : "")
            : "not solved"
        };
      })
    };
    status.textContent = t("reportSending");
    try {
      // text/plain avoids a CORS preflight, which Apps Script does not support.
      await fetch(url, {
        method: "POST", mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      status.textContent = fmt(t("reportOk"), total, maxTotal);
      status.classList.add("ok");
    } catch (err) {
      status.textContent = t("reportErr") + err.message;
      status.classList.add("err");
    }
  }

  // ============================================================
  // LANGUAGE
  // ============================================================
  function applyLang() {
    document.documentElement.lang = state.lang === "zh" ? "zh" : "en";
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    $("#gq-lang").textContent = state.lang === "en" ? "中文" : "English";
    renderHeader();
    renderBadges();
    renderMap();
    renderMission();
    renderFiles();
    renderPalette();
  }

  // ============================================================
  // BOOT
  // ============================================================
  function boot() {
    const browserZh = (navigator.language || "en").toLowerCase().startsWith("zh");
    state.lang = progress.lang || (browserZh ? "zh" : "en");
    viz = new GitViz($("#gq-viz"));
    goalViz = new GitViz($("#gq-goal-viz"), { r: 15, dx: 84, dy: 76, pad: 34, minW: 470, minH: 250, messages: false, duration: 0 });

    const st = progress.student || {};
    if (st.name) $("#gq-name").value = st.name;
    if (st.id) $("#gq-id").value = st.id;
    if (st.klass) $("#gq-class").value = st.klass;

    $("#gq-run").addEventListener("click", () => {
      const input = $("#gq-input");
      const v = input.value;
      input.value = "";
      state.history.push(v);
      state.histPos = state.history.length;
      submit(v);
    });
    $("#gq-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); $("#gq-run").click(); }
      else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (state.histPos > 0) $("#gq-input").value = state.history[--state.histPos] || "";
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (state.histPos < state.history.length - 1) $("#gq-input").value = state.history[++state.histPos] || "";
        else { state.histPos = state.history.length; $("#gq-input").value = ""; }
      }
    });
    $("#gq-hint").addEventListener("click", showHint);
    $("#gq-restart").addEventListener("click", () => loadLevel(state.sandbox ? "sandbox" : state.levelIndex));
    $("#gq-solution").addEventListener("click", playSolution);
    $("#gq-cheats").addEventListener("click", showCheats);
    $("#gq-sandbox").addEventListener("click", () => loadLevel("sandbox"));
    $("#gq-report-btn").addEventListener("click", sendReport);
    $("#gq-lang").addEventListener("click", () => {
      state.lang = state.lang === "en" ? "zh" : "en";
      progress.lang = state.lang;
      saveProgress();
      applyLang();
    });
    $("#gq-wipe").addEventListener("click", () => {
      if (!window.confirm(t("confirmWipe"))) return;
      progress = { xp: 0, levels: {}, badges: [], lang: state.lang, student: progress.student, lastLevel: 0 };
      saveProgress();
      renderHeader(); renderBadges(); loadLevel(0);
    });

    // Start on the first unsolved level (or wherever the student left off).
    let start = LEVELS.findIndex((l) => !(progress.levels[l.id] || {}).solved);
    if (start < 0) start = Math.min(progress.lastLevel || 0, LEVELS.length - 1);
    loadLevel(start);
    applyLang();
    renderHeader();
    renderBadges();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
