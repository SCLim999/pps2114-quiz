/**
 * Git Quest — an in-browser Git simulator.
 *
 * A teaching model of Git with the parts students actually get stuck on:
 * a real commit DAG, three-way merges, rebase / cherry-pick replay,
 * conflict markers and staged resolution. No server, no network.
 *
 * Public surface (used by js/git-viz.js and js/git-portal.js):
 *   const sim = new GitSim();            // fresh repo with one root commit
 *   sim.run("git merge feature")         // -> { ok, lines, snapshots }
 *   sim.snapshot()                       // deep copy of the repo state
 *   GitSim.fromSnapshot(repo)            // restore a simulator from a copy
 *   GitSim.canon(repo, opts)             // canonical shape string (goal check)
 */
(function (global) {
  "use strict";

  const MARK_OURS = "<<<<<<<";
  const MARK_MID = "=======";
  const MARK_THEIRS = ">>>>>>>";

  const clone = (o) => JSON.parse(JSON.stringify(o));

  /** Split a command line into tokens, honouring "quoted strings". */
  function tokenize(line) {
    const out = [];
    let cur = "", quote = null, started = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quote) {
        if (ch === quote) quote = null;
        else cur += ch;
      } else if (ch === '"' || ch === "'") {
        quote = ch; started = true;
      } else if (/\s/.test(ch)) {
        if (cur || started) { out.push(cur); cur = ""; started = false; }
      } else {
        cur += ch;
      }
    }
    if (cur || started) out.push(cur);
    return out;
  }

  /** A command error that carries a student-friendly hint. */
  function fail(message, hint) {
    const e = new Error(message);
    e.gitError = true;
    e.hint = hint || "";
    return e;
  }

  // ============================================================
  // REPO STATE
  // ============================================================

  function emptyRepo() {
    return {
      commits: {},                            // id -> { id, message, parents[], files{}, n }
      branches: { main: null },               // name -> commit id
      tags: {},                               // name -> commit id
      order: ["main"],                        // branch creation order (layout lanes)
      head: { type: "branch", name: "main" }, // or { type: "commit", id }
      index: {},                              // staged file -> content
      workdir: {},                            // working file -> content
      conflictFiles: [],                      // files with unresolved markers
      pending: null,                          // in-progress merge / rebase / cherry-pick
      nextNum: 1,
      clock: 0
    };
  }

  class GitSim {
    constructor(repo) {
      if (repo) {
        this.repo = clone(repo);
      } else {
        this.repo = emptyRepo();
        const root = this._makeCommit({
          message: "Initial commit",
          parents: [],
          files: { "README.md": "# project\n" }
        });
        this.repo.branches.main = root;
        this.repo.workdir = clone(this.repo.commits[root].files);
      }
      this.snapshots = [];
      this.lines = [];
    }

    static fromSnapshot(repo) { return new GitSim(repo); }

    snapshot() { return clone(this.repo); }

    // ---------- output helpers ----------
    _say(text, cls) { this.lines.push({ text, cls: cls || "out" }); }
    _snap() { this.snapshots.push(clone(this.repo)); }

    // ---------- commit plumbing ----------
    _makeCommit({ message, parents, files, id }) {
      const r = this.repo;
      const cid = id || "C" + r.nextNum++;
      r.commits[cid] = {
        id: cid,
        message: message || cid,
        parents: parents.slice(),
        files: clone(files || {}),
        n: ++r.clock
      };
      return cid;
    }

    /** `C3` replayed becomes `C3'`, then `C3''` … (Git's "copy" of a commit). */
    _copyId(origId) {
      let id = origId + "'";
      while (this.repo.commits[id]) id += "'";
      return id;
    }

    headCommitId() {
      const h = this.repo.head;
      return h.type === "branch" ? this.repo.branches[h.name] : h.id;
    }

    headCommit() {
      const id = this.headCommitId();
      return id ? this.repo.commits[id] : null;
    }

    /** Move whatever HEAD points at to `commitId`. */
    _moveHead(commitId) {
      const h = this.repo.head;
      if (h.type === "branch") this.repo.branches[h.name] = commitId;
      else h.id = commitId;
    }

    _checkoutFiles(commitId) {
      const c = this.repo.commits[commitId];
      this.repo.workdir = c ? clone(c.files) : {};
      this.repo.index = {};
      this.repo.conflictFiles = [];
    }

    // ---------- refs ----------
    resolve(ref) {
      if (!ref) throw fail("no ref given");
      const m = /^([^~^]+)((?:[~^]\d*)*)$/.exec(ref.trim());
      if (!m) throw fail(`bad revision '${ref}'`);
      let id = this._resolveBase(m[1]);
      const steps = m[2].match(/[~^]\d*/g) || [];
      for (const step of steps) {
        const c = this.repo.commits[id];
        if (!c) throw fail(`bad revision '${ref}'`);
        if (step[0] === "~") {
          const n = step.length > 1 ? parseInt(step.slice(1), 10) : 1;
          for (let i = 0; i < n; i++) {
            const cur = this.repo.commits[id];
            if (!cur || !cur.parents.length) throw fail(`'${ref}' goes back past the first commit`);
            id = cur.parents[0];
          }
        } else {
          const n = step.length > 1 ? parseInt(step.slice(1), 10) : 1;
          const p = c.parents[n - 1];
          if (!p) throw fail(`commit ${id} has no parent #${n}`,
            "`^2` only works on a merge commit (it has two parents).");
          id = p;
        }
      }
      return id;
    }

    _resolveBase(name) {
      const r = this.repo;
      if (name === "HEAD") {
        const id = this.headCommitId();
        if (!id) throw fail("HEAD points nowhere yet");
        return id;
      }
      if (r.branches[name] != null) return r.branches[name];
      if (r.tags[name] != null) return r.tags[name];
      if (r.commits[name]) return name;
      throw fail(`unknown revision '${name}'`,
        "Run `git log` or look at the graph — branch names and commit ids (C1, C2…) both work.");
    }

    // ---------- graph helpers ----------
    ancestors(id) {
      const seen = new Set();
      const stack = [id];
      while (stack.length) {
        const cur = stack.pop();
        if (!cur || seen.has(cur)) continue;
        seen.add(cur);
        const c = this.repo.commits[cur];
        if (c) for (const p of c.parents) stack.push(p);
      }
      return seen;
    }

    isAncestor(a, b) { return this.ancestors(b).has(a); }

    /** Longest distance from a root commit — used for merge-base choice + layout. */
    depth(id, memo) {
      memo = memo || (this._depthMemo = this._depthMemo || {});
      if (memo[id] != null) return memo[id];
      const c = this.repo.commits[id];
      if (!c || !c.parents.length) return (memo[id] = 0);
      let best = 0;
      for (const p of c.parents) best = Math.max(best, this.depth(p, memo) + 1);
      return (memo[id] = best);
    }

    mergeBase(a, b) {
      this._depthMemo = {};
      const anc = this.ancestors(a);
      let best = null, bestDepth = -1;
      for (const id of this.ancestors(b)) {
        if (!anc.has(id)) continue;
        const d = this.depth(id);
        if (d > bestDepth) { best = id; bestDepth = d; }
      }
      return best;
    }

    /** Commits in `tip` but not in `upstream`, parents first, merges dropped. */
    commitsToReplay(tip, upstream) {
      const skip = this.ancestors(upstream);
      const list = [];
      const walk = (id, seen) => {
        if (!id || skip.has(id) || seen.has(id)) return;
        seen.add(id);
        const c = this.repo.commits[id];
        if (!c) return;
        for (const p of c.parents) walk(p, seen);
        if (c.parents.length < 2) list.push(id);
      };
      walk(tip, new Set());
      this._depthMemo = {};
      return list.sort((x, y) => this.depth(x) - this.depth(y) || this.repo.commits[x].n - this.repo.commits[y].n);
    }

    // ---------- three-way merge ----------
    /**
     * Whole-file three-way merge: if only one side changed a file we take that
     * side, if both changed it the same way we take it once, otherwise we write
     * real conflict markers for the student to resolve.
     */
    threeWay(base, ours, theirs, ourLabel, theirLabel) {
      const files = new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)]);
      const result = {}, conflicts = [];
      for (const f of files) {
        const b = base[f] == null ? "" : base[f];
        const o = ours[f] == null ? "" : ours[f];
        const t = theirs[f] == null ? "" : theirs[f];
        let merged;
        if (o === t) merged = o;
        else if (b === o) merged = t;
        else if (b === t) merged = o;
        else {
          conflicts.push(f);
          merged = [
            `${MARK_OURS} ${ourLabel}`,
            o.replace(/\n$/, ""),
            MARK_MID,
            t.replace(/\n$/, ""),
            `${MARK_THEIRS} ${theirLabel}`,
            ""
          ].join("\n");
        }
        if (merged !== "") result[f] = merged;
      }
      return { files: result, conflicts };
    }

    hasMarkers(text) { return String(text).includes(MARK_OURS); }

    unresolved() {
      return Object.keys(this.repo.workdir).filter((f) => this.hasMarkers(this.repo.workdir[f]));
    }
  }

  GitSim.MARK_OURS = MARK_OURS;
  GitSim.MARK_MID = MARK_MID;
  GitSim.MARK_THEIRS = MARK_THEIRS;
  GitSim.tokenize = tokenize;
  GitSim.clone = clone;
  GitSim.fail = fail;
  global.GitSim = GitSim;
})(window);

/**
 * Git Quest — command layer.
 * Parses a command line and mutates the repo, recording output lines plus
 * one snapshot per visible step so the graph can be animated.
 */
(function (global) {
  "use strict";

  const GitSim = global.GitSim;
  const fail = GitSim.fail;
  const tokenize = GitSim.tokenize;

  Object.assign(GitSim.prototype, {

    /** Run one command line. Never throws: errors come back as output lines. */
    run(line) {
      this.lines = [];
      this.snapshots = [];
      const raw = String(line || "").trim();
      if (!raw) return { ok: true, lines: [], snapshots: [] };

      let ok = true;
      try {
        const argv = tokenize(raw);
        const head = argv[0];
        if (head === "git") this._git(argv.slice(1));
        else if (head === "edit" || head === "write") this._cmdEdit(argv.slice(1));
        else if (head === "resolve") this._cmdResolve(argv.slice(1));
        else if (head === "cat") this._cmdCat(argv.slice(1));
        else if (head === "ls") this._cmdLs();
        else throw fail(`'${head}' is not a command here`,
          "Everything in this game starts with `git` (plus `edit`, `resolve`, `cat`, `ls`).");
      } catch (err) {
        ok = false;
        if (!err.gitError) throw err;
        this._say(err.message, "err");
        if (err.hint) this._say("hint: " + err.hint, "hint");
      }
      // A command that never snapshotted changed no history: reading the repo
      // (status, log, cat…) and editing files are free moves.
      const changed = this.snapshots.length > 0;
      if (!changed) this._snap();
      return { ok, changed, lines: this.lines, snapshots: this.snapshots };
    },

    _git(args) {
      if (!args.length) throw fail("usage: git <command>", "Try `git status` to see where you are.");
      const sub = args[0], rest = args.slice(1);
      const table = {
        init: () => this._say("Reinitialized existing Git repository.", "muted"),
        status: () => this._cmdStatus(),
        log: () => this._cmdLog(rest),
        show: () => this._cmdShow(rest),
        add: () => this._cmdAdd(rest),
        commit: () => this._cmdCommit(rest),
        branch: () => this._cmdBranch(rest),
        checkout: () => this._cmdCheckout(rest),
        switch: () => this._cmdCheckout(rest, true),
        merge: () => this._cmdMerge(rest),
        rebase: () => this._cmdRebase(rest),
        "cherry-pick": () => this._cmdCherryPick(rest),
        reset: () => this._cmdReset(rest),
        revert: () => this._cmdRevert(rest),
        tag: () => this._cmdTag(rest),
        diff: () => this._cmdDiff()
      };
      const fn = table[sub];
      if (!fn) throw fail(`git: '${sub}' is not a command this simulator knows`,
        "Supported: add, commit, branch, checkout/switch, merge, rebase, cherry-pick, reset, revert, tag, log, status, show, diff.");
      fn();
    },

    _requireNoPending(what) {
      if (this.repo.pending) {
        const op = this.repo.pending.op;
        throw fail(`cannot ${what}: a ${op} is in progress`,
          `Finish it with \`git ${op === "merge" ? "commit" : op + " --continue"}\` or bail out with \`git ${op} --abort\`.`);
      }
    },

    // ============================================================
    // WORKING TREE
    // ============================================================

    _cmdEdit(args) {
      if (args.length < 2) throw fail("usage: edit <file> \"new content\"");
      const file = args[0];
      const content = args.slice(1).join(" ").replace(/\\n/g, "\n");
      this.repo.workdir[file] = content.endsWith("\n") ? content : content + "\n";
      this._say(`edited ${file}`, "muted");
    },

    /** Stand-in for opening the editor on a conflicted file. */
    _cmdResolve(args) {
      const file = args[0];
      const how = (args[1] || "--both").replace(/^--/, "");
      if (!file) throw fail("usage: resolve <file> --ours|--theirs|--both");
      const text = this.repo.workdir[file];
      if (text == null) throw fail(`no such file: ${file}`);
      if (!this.hasMarkers(text)) throw fail(`${file} has no conflict markers`);
      if (!["ours", "theirs", "both"].includes(how))
        throw fail("choose one of --ours, --theirs, --both");

      const out = [];
      let side = null, ours = [], theirs = [];
      for (const l of text.split("\n")) {
        if (l.startsWith(GitSim.MARK_OURS)) { side = "ours"; ours = []; theirs = []; }
        else if (side && l.startsWith(GitSim.MARK_MID)) side = "theirs";
        else if (side && l.startsWith(GitSim.MARK_THEIRS)) {
          if (how === "ours") out.push(...ours);
          else if (how === "theirs") out.push(...theirs);
          else out.push(...ours, ...theirs);
          side = null;
        }
        else if (side === "ours") ours.push(l);
        else if (side === "theirs") theirs.push(l);
        else out.push(l);
      }
      const joined = out.join("\n").replace(/\n+$/, "") + "\n";
      this.repo.workdir[file] = joined;
      this._say(`resolved ${file} (kept ${how})`, "ok");
      this._say(`next: \`git add ${file}\``, "muted");
    },

    _cmdCat(args) {
      const file = args[0];
      if (!file) throw fail("usage: cat <file>");
      const text = this.repo.workdir[file];
      if (text == null) throw fail(`no such file: ${file}`);
      text.replace(/\n$/, "").split("\n").forEach((l) => this._say(l, "file"));
    },

    _cmdLs() {
      const files = Object.keys(this.repo.workdir).sort();
      if (!files.length) this._say("(empty working directory)", "muted");
      else this._say(files.join("  "), "file");
    },

    _cmdAdd(args) {
      if (!args.length) throw fail("usage: git add <file> | git add .");
      const all = args.includes(".") || args.includes("-A");
      const files = all ? Object.keys(this.repo.workdir) : args;
      for (const f of files) {
        if (this.repo.workdir[f] == null) throw fail(`pathspec '${f}' did not match any file`);
        if (this.hasMarkers(this.repo.workdir[f]))
          throw fail(`${f} still contains conflict markers`,
            "Edit the file (or use `resolve " + f + " --both`) so no `<<<<<<<` lines remain, then add it.");
        this.repo.index[f] = this.repo.workdir[f];
      }
      this.repo.conflictFiles = this.repo.conflictFiles.filter((f) => !files.includes(f));
      this._say(`staged: ${files.join(", ")}`, "ok");
    },

    /** Files staged for the next commit (falls back to a simulated edit). */
    _stagedFiles(autoNote) {
      const head = this.headCommit();
      const base = head ? head.files : {};
      const staged = Object.assign({}, base, this.repo.index);
      for (const f of Object.keys(staged)) if (staged[f] === "") delete staged[f];
      if (JSON.stringify(staged) === JSON.stringify(base)) {
        // Nothing staged: invent a small change so beginner levels can just
        // commit. Each filler file is unique, so filler never conflicts.
        const file = `f${this.repo.nextNum}.txt`;
        staged[file] = `work done in commit ${this.repo.nextNum}\n`;
        this.repo.workdir[file] = staged[file];
        if (autoNote) this._say(`(nothing was staged, so a small change to ${file} was made for you)`, "muted");
      }
      return staged;
    },

    // ============================================================
    // COMMIT
    // ============================================================

    _cmdCommit(args) {
      let message = null, addAll = false;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === "-m" || a === "--message") message = args[++i];
        else if (a === "-am" || a === "-ma") { addAll = true; message = args[++i]; }
        else if (a === "-a" || a === "--all") addAll = true;
        else if (a === "--continue") { /* handled below */ }
        else if (!a.startsWith("-") && message == null) message = a;
      }
      if (addAll) for (const f of Object.keys(this.repo.workdir)) this.repo.index[f] = this.repo.workdir[f];

      const pending = this.repo.pending;
      if (pending && pending.op === "merge") return this._finishMerge(message);
      if (pending) throw fail(`a ${pending.op} is in progress`,
        `Use \`git ${pending.op} --continue\` to carry on.`);

      const files = this._stagedFiles(true);
      const parent = this.headCommitId();
      const id = this._makeCommit({
        message: message || "C" + this.repo.nextNum,
        parents: parent ? [parent] : [],
        files
      });
      this._moveHead(id);
      this.repo.index = {};
      this.repo.workdir = GitSim.clone(files);
      this._say(`[${this._headLabel()} ${id}] ${this.repo.commits[id].message}`, "ok");
      this._snap();
    },

    _headLabel() {
      return this.repo.head.type === "branch" ? this.repo.head.name : "detached HEAD";
    },

    // ============================================================
    // BRANCH / CHECKOUT / TAG
    // ============================================================

    _cmdBranch(args) {
      const r = this.repo;
      if (!args.length) {
        for (const b of r.order) {
          const mark = r.head.type === "branch" && r.head.name === b ? "* " : "  ";
          this._say(`${mark}${b} -> ${r.branches[b]}`, mark === "* " ? "ok" : "out");
        }
        return;
      }
      if (args[0] === "-d" || args[0] === "-D") {
        const name = args[1];
        if (r.branches[name] == null) throw fail(`branch '${name}' not found`);
        if (r.head.type === "branch" && r.head.name === name)
          throw fail(`cannot delete branch '${name}': you are on it`,
            "Check out another branch first.");
        delete r.branches[name];
        r.order = r.order.filter((b) => b !== name);
        this._say(`Deleted branch ${name}.`, "ok");
        this._snap();
        return;
      }
      const force = args[0] === "-f" || args[0] === "--force";
      const rest = force ? args.slice(1) : args;
      const name = rest[0];
      const target = this.resolve(rest[1] || "HEAD");
      if (!name) throw fail("usage: git branch [-f] <name> [start-point]");
      if (r.branches[name] != null && !force)
        throw fail(`branch '${name}' already exists`,
          "Use `git branch -f " + name + " <ref>` to move it instead.");
      if (r.branches[name] == null) r.order.push(name);
      r.branches[name] = target;
      if (force && r.head.type === "branch" && r.head.name === name) this._checkoutFiles(target);
      this._say(`${force ? "Moved" : "Created"} branch ${name} at ${target}`, "ok");
      this._snap();
    },

    _cmdCheckout(args, isSwitch) {
      this._requireNoPending("checkout");
      const r = this.repo;
      const createFlag = args[0] === "-b" || args[0] === "-c" || args[0] === "-B";
      if (createFlag) {
        const name = args[1];
        if (!name) throw fail(`usage: git ${isSwitch ? "switch -c" : "checkout -b"} <name> [start-point]`);
        const start = this.resolve(args[2] || "HEAD");
        if (r.branches[name] != null && args[0] !== "-B")
          throw fail(`branch '${name}' already exists`, "Drop the -b to just switch to it.");
        if (r.branches[name] == null) r.order.push(name);
        r.branches[name] = start;
        r.head = { type: "branch", name };
        this._checkoutFiles(start);
        this._say(`Switched to a new branch '${name}'`, "ok");
        this._snap();
        return;
      }
      const ref = args[0];
      if (!ref) throw fail("usage: git checkout <branch|commit>");
      if (r.branches[ref] != null) {
        r.head = { type: "branch", name: ref };
        this._checkoutFiles(r.branches[ref]);
        this._say(`Switched to branch '${ref}'`, "ok");
      } else {
        const id = this.resolve(ref);
        r.head = { type: "commit", id };
        this._checkoutFiles(id);
        this._say(`Note: switching to '${ref}' — you are in 'detached HEAD' state.`, "warn");
        this._say("Commits made here belong to no branch. `git branch <name>` keeps them.", "muted");
      }
      this._snap();
    },

    _cmdTag(args) {
      if (!args.length) {
        const names = Object.keys(this.repo.tags);
        this._say(names.length ? names.join("  ") : "(no tags)", names.length ? "out" : "muted");
        return;
      }
      if (args[0] === "-d") {
        if (this.repo.tags[args[1]] == null) throw fail(`tag '${args[1]}' not found`);
        delete this.repo.tags[args[1]];
        this._say(`Deleted tag ${args[1]}.`, "ok");
        this._snap();
        return;
      }
      const name = args[0];
      const at = this.resolve(args[1] || "HEAD");
      this.repo.tags[name] = at;
      this._say(`Tagged ${at} as ${name}`, "ok");
      this._snap();
    },

    // ============================================================
    // INSPECTION
    // ============================================================

    _cmdStatus() {
      const r = this.repo;
      if (r.head.type === "branch") this._say(`On branch ${r.head.name}`, "out");
      else this._say(`HEAD detached at ${r.head.id}`, "warn");

      if (r.pending) {
        this._say(`${r.pending.op} in progress`, "warn");
        const left = this.unresolved();
        if (left.length) {
          this._say("Unmerged paths:", "err");
          left.forEach((f) => this._say("  both modified:  " + f, "err"));
          this._say(`Fix them, \`git add\` them, then \`git ${r.pending.op === "merge" ? "commit" : r.pending.op + " --continue"}\`.`, "muted");
          return;
        }
        this._say(`All conflicts resolved — run \`git ${r.pending.op === "merge" ? "commit" : r.pending.op + " --continue"}\`.`, "ok");
      }
      const staged = Object.keys(r.index);
      if (staged.length) {
        this._say("Changes to be committed:", "ok");
        staged.forEach((f) => this._say("  modified:  " + f, "ok"));
      }
      const head = this.headCommit();
      const base = head ? head.files : {};
      const dirty = Object.keys(r.workdir).filter((f) => r.workdir[f] !== base[f] && r.index[f] !== r.workdir[f]);
      if (dirty.length) {
        this._say("Changes not staged for commit:", "warn");
        dirty.forEach((f) => this._say("  modified:  " + f, "warn"));
      }
      if (!staged.length && !dirty.length && !r.pending) this._say("nothing to commit, working tree clean", "muted");
    },

    _cmdLog(args) {
      const startRef = args.find((a) => !a.startsWith("-")) || "HEAD";
      const start = this.resolve(startRef);
      const seen = new Set();
      const walk = [start];
      const list = [];
      while (walk.length) {
        const id = walk.shift();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const c = this.repo.commits[id];
        list.push(c);
        c.parents.forEach((p) => walk.push(p));
      }
      list.sort((a, b) => b.n - a.n);
      for (const c of list) {
        const refs = this._refsAt(c.id);
        this._say(`commit ${c.id}${refs ? " (" + refs + ")" : ""}`, "ok");
        if (c.parents.length > 1) this._say(`Merge: ${c.parents.join(" ")}`, "muted");
        this._say(`    ${c.message}`, "out");
      }
    },

    _refsAt(id) {
      const r = this.repo;
      const refs = [];
      if (this.headCommitId() === id && r.head.type === "commit") refs.push("HEAD");
      for (const b of r.order) if (r.branches[b] === id) {
        refs.push(r.head.type === "branch" && r.head.name === b ? "HEAD -> " + b : b);
      }
      for (const t of Object.keys(r.tags)) if (r.tags[t] === id) refs.push("tag: " + t);
      return refs.join(", ");
    },

    _cmdShow(args) {
      const id = this.resolve(args[0] || "HEAD");
      const c = this.repo.commits[id];
      this._say(`commit ${id}   ${c.message}`, "ok");
      for (const f of Object.keys(c.files).sort()) {
        this._say(`--- ${f}`, "muted");
        c.files[f].replace(/\n$/, "").split("\n").forEach((l) => this._say("    " + l, "file"));
      }
    },

    _cmdDiff() {
      const head = this.headCommit();
      const base = head ? head.files : {};
      const names = new Set([...Object.keys(base), ...Object.keys(this.repo.workdir)]);
      let any = false;
      for (const f of names) {
        const a = base[f] || "", b = this.repo.workdir[f] || "";
        if (a === b) continue;
        any = true;
        this._say(`diff --git a/${f} b/${f}`, "muted");
        a.replace(/\n$/, "").split("\n").filter(Boolean).forEach((l) => this._say("-" + l, "err"));
        b.replace(/\n$/, "").split("\n").filter(Boolean).forEach((l) => this._say("+" + l, "ok"));
      }
      if (!any) this._say("(no changes)", "muted");
    }
  });
})(window);

/**
 * Git Quest — merge, rebase, cherry-pick, undo, and goal comparison.
 */
(function (global) {
  "use strict";

  const GitSim = global.GitSim;
  const fail = GitSim.fail;
  const clone = GitSim.clone;

  Object.assign(GitSim.prototype, {

    // ============================================================
    // MERGE
    // ============================================================

    _cmdMerge(args) {
      if (args.includes("--abort")) return this._abortPending("merge");
      if (args.includes("--continue")) return this._finishMerge(null);

      this._requireNoPending("merge");
      const ref = args.find((a) => !a.startsWith("-"));
      if (!ref) throw fail("usage: git merge <branch>");
      const target = this.resolve(ref);
      const head = this.headCommitId();

      if (this.isAncestor(target, head)) {
        this._say("Already up to date.", "muted");
        return;
      }
      if (this.isAncestor(head, target)) {
        this._moveHead(target);
        this._checkoutFiles(target);
        this._say(`Fast-forward: ${this._headLabel()} -> ${target}`, "ok");
        this._say("No merge commit was needed — your branch had no commits of its own.", "muted");
        this._snap();
        return;
      }

      const base = this.mergeBase(head, target);
      const ourLabel = "HEAD";
      const theirLabel = ref;
      const merged = this.threeWay(
        base ? this.repo.commits[base].files : {},
        this.repo.commits[head].files,
        this.repo.commits[target].files,
        ourLabel, theirLabel
      );

      if (merged.conflicts.length) {
        this.repo.pending = {
          op: "merge",
          theirs: target,
          theirsRef: ref,
          message: `Merge branch '${ref}'`,
          tree: merged.files,
          conflicts: merged.conflicts.slice(),
          before: this._beforeSnapshot()
        };
        this.repo.workdir = clone(merged.files);
        this.repo.index = {};
        this.repo.conflictFiles = merged.conflicts.slice();
        merged.conflicts.forEach((f) =>
          this._say(`CONFLICT (content): Merge conflict in ${f}`, "err"));
        this._say("Automatic merge failed; fix the conflicts and then commit the result.", "warn");
        this._say(`Both sides changed the same file. Open it, keep what should survive, remove the <<<<<<< ======= >>>>>>> lines, then \`git add\` + \`git commit\`.`, "muted");
        this._snap();
        return;
      }

      const id = this._makeCommit({
        message: `Merge branch '${ref}'`,
        parents: [head, target],
        files: merged.files
      });
      this._moveHead(id);
      this.repo.workdir = clone(merged.files);
      this.repo.index = {};
      this._say(`Merge made by the 'ort' strategy — created merge commit ${id}`, "ok");
      this._snap();
    },

    _finishMerge(message) {
      const p = this.repo.pending;
      if (!p || p.op !== "merge") throw fail("there is no merge to conclude");
      const left = this.unresolved();
      if (left.length) throw fail(`unresolved conflict in ${left.join(", ")}`,
        "Remove the conflict markers first (or use `resolve <file> --both`).");
      for (const f of p.conflicts) {
        if (this.repo.index[f] == null)
          throw fail(`${f} is resolved but not staged`, `Run \`git add ${f}\` to mark it resolved.`);
      }
      const files = Object.assign({}, p.tree, this.repo.index);
      const head = this.headCommitId();
      const id = this._makeCommit({
        message: message || p.message,
        parents: [head, p.theirs],
        files
      });
      this._moveHead(id);
      this.repo.pending = null;
      this.repo.index = {};
      this.repo.conflictFiles = [];
      this.repo.workdir = clone(files);
      this._say(`[${this._headLabel()} ${id}] ${this.repo.commits[id].message}`, "ok");
      this._say("Conflict resolved and merge committed.", "ok");
      this._snap();
    },

    _beforeSnapshot() {
      const copy = clone(this.repo);
      copy.pending = null;
      return copy;
    },

    _abortPending(op) {
      const p = this.repo.pending;
      if (!p) throw fail(`no ${op} in progress`);
      if (p.op !== op) throw fail(`a ${p.op} is in progress, not a ${op}`);
      this.repo = clone(p.before);
      this._say(`${op} aborted — repository restored to where you started.`, "ok");
      this._snap();
    },

    // ============================================================
    // REBASE
    // ============================================================

    _cmdRebase(args) {
      if (args.includes("--abort")) return this._abortPending("rebase");
      if (args.includes("--continue")) return this._continueReplay("rebase");
      if (args.includes("--skip")) return this._skipReplay("rebase");

      this._requireNoPending("rebase");
      let onto = null;
      const positional = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "--onto") onto = args[++i];
        else if (!args[i].startsWith("-")) positional.push(args[i]);
      }
      const upstreamRef = positional[0];
      if (!upstreamRef) throw fail("usage: git rebase <upstream> [branch] | git rebase --onto <newbase> <upstream> [branch]");

      if (positional[1]) this._cmdCheckout([positional[1]]);
      if (this.repo.head.type !== "branch")
        throw fail("cannot rebase: HEAD is detached",
          "Check out a branch first — rebase moves a branch's commits.");

      const branch = this.repo.head.name;
      const upstream = this.resolve(upstreamRef);
      const newBase = onto ? this.resolve(onto) : upstream;
      const tip = this.repo.branches[branch];

      if (!onto && this.isAncestor(tip, upstream)) {
        this.repo.branches[branch] = upstream;
        this._checkoutFiles(upstream);
        this._say(`Fast-forwarded ${branch} to ${upstream}.`, "ok");
        this._snap();
        return;
      }
      const queue = this.commitsToReplay(tip, upstream);
      if (!queue.length) {
        this._say("Current branch has nothing to replay.", "muted");
        return;
      }
      this._say(`Rebasing ${queue.length} commit(s) of '${branch}' onto ${newBase}…`, "out");
      this.repo.pending = {
        op: "rebase",
        queue,
        tip: newBase,
        branch,
        detach: true,
        conflicts: [],
        before: this._beforeSnapshot()
      };
      this.repo.head = { type: "commit", id: newBase };
      this._checkoutFiles(newBase);
      this._snap();
      this._replay();
    },

    // ============================================================
    // CHERRY-PICK
    // ============================================================

    _cmdCherryPick(args) {
      if (args.includes("--abort")) return this._abortPending("cherry-pick");
      if (args.includes("--continue")) return this._continueReplay("cherry-pick");

      this._requireNoPending("cherry-pick");
      const refs = args.filter((a) => !a.startsWith("-"));
      if (!refs.length) throw fail("usage: git cherry-pick <commit> [<commit> …]");
      const queue = refs.map((r) => this.resolve(r));
      this.repo.pending = {
        op: "cherry-pick",
        queue,
        tip: this.headCommitId(),
        branch: this.repo.head.type === "branch" ? this.repo.head.name : null,
        detach: false,
        conflicts: [],
        before: this._beforeSnapshot()
      };
      this._replay();
    },

    // ---------- shared replay engine (rebase + cherry-pick) ----------

    _replay() {
      const p = this.repo.pending;
      while (p.queue.length) {
        const origId = p.queue.shift();
        const orig = this.repo.commits[origId];
        const base = orig.parents[0] ? this.repo.commits[orig.parents[0]].files : {};
        const merged = this.threeWay(
          base,
          this.repo.commits[p.tip].files,
          orig.files,
          "HEAD (" + p.tip + ")",
          origId + " " + orig.message
        );
        if (merged.conflicts.length) {
          p.origId = origId;
          p.tree = merged.files;
          p.conflicts = merged.conflicts.slice();
          p.message = orig.message;
          this.repo.workdir = clone(merged.files);
          this.repo.index = {};
          this.repo.conflictFiles = merged.conflicts.slice();
          merged.conflicts.forEach((f) =>
            this._say(`CONFLICT (content): conflict in ${f} while applying ${origId} "${orig.message}"`, "err"));
          this._say(`Resolve it, \`git add\` the file, then \`git ${p.op} --continue\`.`, "warn");
          this._say(`Or bail out with \`git ${p.op} --abort\`.`, "muted");
          this._snap();
          return;
        }
        this._commitReplayed(origId, orig.message, merged.files);
      }
      this._finishReplay();
    },

    _commitReplayed(origId, message, files) {
      const p = this.repo.pending;
      const id = this._copyId(origId);
      this._makeCommit({ id, message, parents: [p.tip], files });
      p.tip = id;
      if (p.detach) this.repo.head = { type: "commit", id };
      else this._moveHead(id);
      this.repo.workdir = clone(files);
      this.repo.index = {};
      this.repo.conflictFiles = [];
      this._say(`Applied ${origId} as ${id}  "${message}"`, "ok");
      this._snap();
    },

    _continueReplay(op) {
      const p = this.repo.pending;
      if (!p) throw fail(`no ${op} in progress`);
      if (p.op !== op) throw fail(`a ${p.op} is in progress, not a ${op}`);
      const left = this.unresolved();
      if (left.length) throw fail(`unresolved conflict in ${left.join(", ")}`,
        "Delete the `<<<<<<<`, `=======` and `>>>>>>>` lines, keeping the code you want.");
      for (const f of p.conflicts) {
        if (this.repo.index[f] == null)
          throw fail(`${f} is resolved but not staged`, `Run \`git add ${f}\` first.`);
      }
      const files = Object.assign({}, p.tree, this.repo.index);
      this._commitReplayed(p.origId, p.message, files);
      p.conflicts = [];
      this._replay();
    },

    _skipReplay(op) {
      const p = this.repo.pending;
      if (!p || p.op !== op) throw fail(`no ${op} in progress`);
      this._say(`Skipped ${p.origId}.`, "warn");
      this._checkoutFiles(p.tip);
      p.conflicts = [];
      this._replay();
    },

    _finishReplay() {
      const p = this.repo.pending;
      if (p.detach && p.branch) {
        this.repo.branches[p.branch] = p.tip;
        this.repo.head = { type: "branch", name: p.branch };
      }
      this._checkoutFiles(p.tip);
      this.repo.pending = null;
      this._say(p.op === "rebase"
        ? `Successfully rebased and updated ${p.branch ? "refs/heads/" + p.branch : "HEAD"}.`
        : "Cherry-pick complete.", "ok");
      this._snap();
    },

    // ============================================================
    // UNDO
    // ============================================================

    _cmdReset(args) {
      this._requireNoPending("reset");
      let mode = "mixed", ref = null;
      for (const a of args) {
        if (a === "--hard" || a === "--soft" || a === "--mixed") mode = a.slice(2);
        else if (!a.startsWith("-")) ref = a;
      }
      if (!ref) throw fail("usage: git reset [--hard|--soft] <ref>",
        "e.g. `git reset --hard HEAD~1` throws away the last commit on this branch.");
      const target = this.resolve(ref);
      const oldHead = this.headCommitId();
      this._moveHead(target);
      if (mode === "hard") {
        this._checkoutFiles(target);
        this._say(`HEAD is now at ${target} (working tree reset)`, "ok");
      } else {
        const targetFiles = this.repo.commits[target].files;
        const oldFiles = this.repo.commits[oldHead].files;
        this.repo.index = {};
        if (mode === "soft") {
          for (const f of Object.keys(oldFiles)) {
            if (oldFiles[f] !== targetFiles[f]) this.repo.index[f] = oldFiles[f];
          }
        }
        this._say(`HEAD is now at ${target} (changes kept ${mode === "soft" ? "staged" : "in your files"})`, "ok");
      }
      this._say("The old commits are still in the database — but no branch points at them any more.", "muted");
      this._snap();
    },

    _cmdRevert(args) {
      this._requireNoPending("revert");
      const ref = args.find((a) => !a.startsWith("-"));
      if (!ref) throw fail("usage: git revert <commit>");
      const target = this.resolve(ref);
      const c = this.repo.commits[target];
      const parentFiles = c.parents[0] ? this.repo.commits[c.parents[0]].files : {};
      const head = this.headCommitId();
      const files = clone(this.repo.commits[head].files);
      const names = new Set([...Object.keys(c.files), ...Object.keys(parentFiles)]);
      for (const f of names) {
        if (c.files[f] === parentFiles[f]) continue;      // untouched by that commit
        if (parentFiles[f] == null) delete files[f];      // it added the file -> remove it
        else files[f] = parentFiles[f];                   // put the old content back
      }
      const id = this._makeCommit({
        message: `Revert "${c.message}"`,
        parents: [head],
        files
      });
      this._moveHead(id);
      this.repo.workdir = clone(files);
      this.repo.index = {};
      this._say(`[${this._headLabel()} ${id}] Revert "${c.message}"`, "ok");
      this._say("History is kept: a NEW commit undoes the change, nothing is rewritten.", "muted");
      this._snap();
    }
  });

  // ============================================================
  // GOAL COMPARISON
  // ============================================================

  /** Reachable commits (from branches, tags and HEAD). */
  GitSim.reachable = function (repo) {
    const roots = Object.values(repo.branches).concat(Object.values(repo.tags));
    if (repo.head.type === "commit") roots.push(repo.head.id);
    const seen = new Set();
    const stack = roots.filter(Boolean);
    while (stack.length) {
      const id = stack.pop();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const c = repo.commits[id];
      if (c) c.parents.forEach((p) => stack.push(p));
    }
    return seen;
  };

  function shapeFn(repo) {
    const memo = {};
    return function shape(id) {
      if (memo[id]) return memo[id];
      const c = repo.commits[id];
      if (!c) return "?";
      memo[id] = "*";                                   // cycle guard
      const parts = c.parents.map(shape).sort();
      return (memo[id] = "(" + parts.join(",") + ")");
    };
  }

  function fileSig(repo, id) {
    const c = repo.commits[id];
    if (!c) return "";
    return Object.keys(c.files).sort().filter((f) => !/^f\d+\.txt$/.test(f)).map((f) => {
      const body = String(c.files[f]).replace(/\r/g, "").split("\n")
        .map((l) => l.trim()).filter((l) => l.length).join("|");
      return f + ":" + body;
    }).join(";");
  }

  /**
   * Canonical description of a repo: the graph SHAPE each ref points at,
   * so commit ids (C3 vs C3') and messages never matter — only the structure
   * a student built. `opts.files` also pins the content at each branch tip,
   * `opts.head` also pins where HEAD sits.
   */
  GitSim.canon = function (repo, opts) {
    opts = opts || {};
    const shape = shapeFn(repo);
    const parts = [];
    for (const b of Object.keys(repo.branches).sort()) {
      const tip = repo.branches[b];
      if (tip == null) continue;
      parts.push(b + "=" + shape(tip) + (opts.files ? "{" + fileSig(repo, tip) + "}" : ""));
    }
    for (const t of Object.keys(repo.tags).sort()) {
      parts.push("tag:" + t + "=" + shape(repo.tags[t]));
    }
    if (opts.head) {
      parts.push("HEAD=" + (repo.head.type === "branch"
        ? "branch:" + repo.head.name
        : "detached:" + shape(repo.head.id)));
    }
    // Ref shapes alone cannot tell "branch started at main~1" from
    // "branch started at main": add the whole graph's fingerprint.
    const live = [...GitSim.reachable(repo)].filter((id) => repo.commits[id]);
    return parts.join(" ") + " | " + live.length + ":" + live.map(shape).sort().join(",");
  };

  /** Human-readable reasons a player's repo does not match the goal yet. */
  GitSim.explain = function (player, goal, opts) {
    opts = opts || {};
    const notes = [];
    const ps = shapeFn(player), gs = shapeFn(goal);
    const pB = Object.keys(player.branches), gB = Object.keys(goal.branches);
    gB.filter((b) => !pB.includes(b)).forEach((b) => notes.push(`branch \`${b}\` is missing`));
    pB.filter((b) => !gB.includes(b)).forEach((b) => notes.push(`branch \`${b}\` should not exist`));

    const count = (repo, id) => {
      const seen = new Set([]);
      const st = [id];
      while (st.length) {
        const c = st.pop();
        if (!c || seen.has(c)) continue;
        seen.add(c);
        (repo.commits[c] || { parents: [] }).parents.forEach((p) => st.push(p));
      }
      return seen.size;
    };
    for (const b of gB.filter((b) => pB.includes(b))) {
      if (ps(player.branches[b]) === gs(goal.branches[b])) {
        if (opts.files && fileSig(player, player.branches[b]) !== fileSig(goal, goal.branches[b]))
          notes.push(`the file contents at the tip of \`${b}\` are not what the goal expects`);
        continue;
      }
      const pc = count(player, player.branches[b]), gc = count(goal, goal.branches[b]);
      if (pc !== gc) notes.push(`\`${b}\` should have ${gc} commit(s) in its history, yours has ${pc}`);
      else notes.push(`\`${b}\` has the right number of commits but a different shape`);
    }
    for (const t of Object.keys(goal.tags)) if (player.tags[t] == null) notes.push(`tag \`${t}\` is missing`);
    const liveP = GitSim.reachable(player).size, liveG = GitSim.reachable(goal).size;
    if (!notes.length && liveP !== liveG)
      notes.push(`the graph holds ${liveP} commit(s), the goal holds ${liveG} — check where each branch starts`);
    if (!notes.length) notes.push("the branches look right individually, but the graph is shaped differently — compare it with the Target panel");
    if (opts.head) {
      const pHead = player.head.type === "branch" ? "branch:" + player.head.name : "detached";
      const gHead = goal.head.type === "branch" ? "branch:" + goal.head.name : "detached";
      if (pHead !== gHead) notes.push(goal.head.type === "branch"
        ? `you should end up checked out on \`${goal.head.name}\``
        : "you should end up with a detached HEAD");
    }
    return notes;
  };
})(window);
