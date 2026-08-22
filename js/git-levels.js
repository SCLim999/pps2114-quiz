/**
 * Git Quest — level pack.
 *
 * Every level is defined by two command scripts:
 *   setup    — builds the starting repository the student sees
 *   solution — one reference way to reach the goal (also generates the goal
 *              graph shown in "Target", and the par score for stars)
 *
 * The goal check compares GRAPH SHAPE (plus file contents / HEAD when the
 * level asks for it), so any route that produces the right history passes —
 * commit ids and messages never have to match.
 */
(function (global) {
  "use strict";

  const WORLDS = [
    { id: 1, key: "basics",    name: { en: "Commits & Branches", zh: "提交与分支" },
      blurb: { en: "Snapshots, labels, and moving around history.", zh: "快照、标签，以及在历史中移动。" }, xp: 60 },
    { id: 2, key: "merge",     name: { en: "Merging", zh: "合并 Merge" },
      blurb: { en: "Fast-forward vs. a real merge commit.", zh: "快进合并与真正的合并提交。" }, xp: 90 },
    { id: 3, key: "rebase",    name: { en: "Rebase & Cherry-pick", zh: "变基与拣选" },
      blurb: { en: "Replay commits somewhere else.", zh: "把提交重放到别的地方。" }, xp: 120 },
    { id: 4, key: "conflict",  name: { en: "Conflict Resolution", zh: "冲突解决" },
      blurb: { en: "Two people, one file. You decide.", zh: "两个人改同一个文件，由你裁决。" }, xp: 150 },
    { id: 5, key: "mastery",   name: { en: "Undo & Mastery", zh: "撤销与终极关" },
      blurb: { en: "reset, revert, detached HEAD, boss fight.", zh: "reset、revert、游离 HEAD，以及最终 BOSS。" }, xp: 200 }
  ];

  const LEVELS = [
    // ==================== WORLD 1 ====================
    {
      id: "1-1", world: 1,
      name: { en: "Your First Commit", zh: "你的第一个提交" },
      brief: {
        en: "A commit is a snapshot of your whole project plus a pointer to its parent. The repo already has one commit; add a second.",
        zh: "一个 commit 就是整个项目的快照，外加一个指向父提交的指针。仓库里已经有一个提交了，请再加一个。"
      },
      goal: { en: "main has two commits.", zh: "main 上有两个提交。" },
      setup: [],
      solution: ['git commit -m "Add greeting"'],
      hints: [
        { en: "Type `git commit -m \"message\"`.", zh: "输入 `git commit -m \"信息\"`。" },
        { en: "The new commit's parent is wherever HEAD was pointing.", zh: "新提交的父节点就是 HEAD 原本指向的提交。" }
      ]
    },
    {
      id: "1-2", world: 1,
      name: { en: "Branch Out", zh: "开一条分支" },
      brief: {
        en: "A branch is just a movable label on a commit. Create `feature` and put one commit on it — main must not move.",
        zh: "分支只是贴在某个提交上的可移动标签。创建 `feature` 并在它上面提交一次——main 不能动。"
      },
      goal: { en: "feature exists and is one commit ahead of main.", zh: "存在 feature 分支，且比 main 多一个提交。" },
      setup: ['git commit -m "Project skeleton"'],
      solution: ['git checkout -b feature', 'git commit -m "Start the feature"'],
      hints: [
        { en: "`git checkout -b feature` creates the branch and switches to it.", zh: "`git checkout -b feature` 会创建分支并切换过去。" },
        { en: "Committing moves only the branch you are standing on.", zh: "提交只会移动你当前所在的那条分支。" }
      ]
    },
    {
      id: "1-3", world: 1,
      name: { en: "Two Timelines", zh: "两条时间线" },
      brief: {
        en: "A bug slipped in with the latest commit, so the hotfix must start from the commit BEFORE it. Use a relative ref.",
        zh: "最新的提交带进来一个 bug，所以修复分支必须从它的“前一个”提交开始。用相对引用。"
      },
      goal: { en: "hotfix branches off main~1 and has one commit of its own.", zh: "hotfix 从 main~1 分出，并且有自己的一个提交。" },
      setup: ['git commit -m "Add login page"', 'git commit -m "Risky refactor"'],
      solution: ['git checkout -b hotfix main~1', 'git commit -m "Fix the typo"'],
      hints: [
        { en: "`main~1` means \"one first-parent step back from main\".", zh: "`main~1` 表示“从 main 沿第一父提交往回一步”。" },
        { en: "`git checkout -b <name> <start-point>` starts a branch anywhere.", zh: "`git checkout -b <名字> <起点>` 可以从任意位置开分支。" }
      ]
    },
    {
      id: "1-4", world: 1,
      name: { en: "Move the Label", zh: "挪动标签" },
      brief: {
        en: "The `release` label is stuck two commits behind. Move it to main without committing anything new.",
        zh: "`release` 标签落后了两个提交。不要新建提交，把它移到 main 上。"
      },
      goal: { en: "release points at the same commit as main.", zh: "release 与 main 指向同一个提交。" },
      setup: ['git commit -m "v1 features"', 'git branch release',
              'git commit -m "Docs"', 'git commit -m "Perf work"'],
      solution: ['git branch -f release main'],
      hints: [
        { en: "`git branch -f <name> <ref>` re-points an existing branch.", zh: "`git branch -f <名字> <引用>` 可以让已存在的分支重新指向别处。" },
        { en: "Branches are cheap: moving one changes no commit at all.", zh: "分支非常廉价：移动它不会改变任何提交。" }
      ]
    },

    // ==================== WORLD 2 ====================
    {
      id: "2-1", world: 2,
      name: { en: "Fast Forward", zh: "快进合并" },
      brief: {
        en: "main has not moved since `feature` started, so Git can simply slide the label forward. Merge feature into main.",
        zh: "自 `feature` 分出后 main 没有动过，所以 Git 只需把标签往前滑。把 feature 合并进 main。"
      },
      goal: { en: "main points at feature's tip — no merge commit.", zh: "main 指向 feature 的顶端——不产生合并提交。" },
      setup: ['git commit -m "Base"', 'git checkout -b feature',
              'git commit -m "Feature part 1"', 'git commit -m "Feature part 2"', 'git checkout main'],
      solution: ['git merge feature'],
      compare: { head: true },
      hints: [
        { en: "You must be ON the branch that should move. `git status` tells you where you are.", zh: "你必须站在需要移动的那条分支上。`git status` 会告诉你位置。" },
        { en: "`git merge feature` while on main = fast-forward here.", zh: "在 main 上执行 `git merge feature`，这里就是快进。" }
      ]
    },
    {
      id: "2-2", world: 2,
      name: { en: "A Real Merge", zh: "真正的合并" },
      brief: {
        en: "Both branches moved on. Merging now needs a commit with TWO parents that ties the histories together.",
        zh: "两条分支都前进了。现在的合并需要一个拥有两个父提交的 commit，把两段历史绑在一起。"
      },
      goal: { en: "main ends with a merge commit whose parents are both tips.", zh: "main 以一个合并提交结束，它的父提交是两条分支的顶端。" },
      setup: ['git commit -m "Base"', 'git checkout -b feature', 'git commit -m "Feature work"',
              'git checkout main', 'git commit -m "Main work"'],
      solution: ['git merge feature'],
      compare: { head: true },
      hints: [
        { en: "The branch you are standing on is the one that gains the merge commit.", zh: "你所站的分支才会得到那个合并提交。" },
        { en: "Merge commits keep both histories — nothing is rewritten.", zh: "合并提交保留两段历史——什么都没有被改写。" }
      ]
    },
    {
      id: "2-3", world: 2,
      name: { en: "Two Features, One Trunk", zh: "两个特性，一条主干" },
      brief: {
        en: "Two teammates finished their branches. Bring both into main.",
        zh: "两位队友都完成了各自的分支。把它们都并进 main。"
      },
      goal: { en: "main contains the history of both alpha and beta.", zh: "main 包含 alpha 和 beta 两条分支的历史。" },
      setup: ['git commit -m "Base"',
              'git checkout -b alpha', 'git commit -m "Alpha work"',
              'git checkout -b beta main', 'git commit -m "Beta work"',
              'git checkout main', 'git commit -m "Trunk work"'],
      solution: ['git merge alpha', 'git merge beta'],
      compare: { head: true },
      hints: [
        { en: "Merge them one at a time; the second merge sees the first one's result.", zh: "一次合并一个；第二次合并会看到第一次的结果。" },
        { en: "Stay on main the whole time.", zh: "整个过程都待在 main 上。" }
      ]
    },
    {
      id: "2-4", world: 2,
      name: { en: "Which Way Round?", zh: "合并的方向" },
      brief: {
        en: "Direction matters. Bring main's newest work INTO feature, leaving main exactly where it is.",
        zh: "方向很重要。把 main 上最新的工作并“进” feature，而 main 本身保持原位。"
      },
      goal: { en: "feature has a merge commit; main is untouched.", zh: "feature 上出现合并提交；main 没有变化。" },
      setup: ['git commit -m "Base"', 'git checkout -b feature', 'git commit -m "Feature work"',
              'git checkout main', 'git commit -m "Urgent main fix"'],
      solution: ['git checkout feature', 'git merge main'],
      compare: { head: true },
      hints: [
        { en: "`git merge X` always merges X into the branch you are on.", zh: "`git merge X` 永远是把 X 合并到你当前所在的分支。" },
        { en: "So check out feature first.", zh: "所以先切换到 feature。" }
      ]
    },

    // ==================== WORLD 3 ====================
    {
      id: "3-1", world: 3,
      name: { en: "Straighten the Line", zh: "把历史拉直" },
      brief: {
        en: "Instead of a merge commit, replay feature's commits on top of main. Notice the copies get a `'` mark.",
        zh: "不要合并提交，而是把 feature 的提交重放到 main 之上。注意复制出来的提交带 `'` 号。"
      },
      goal: { en: "feature's commits sit in a straight line on top of main.", zh: "feature 的提交呈一条直线接在 main 之上。" },
      setup: ['git commit -m "Base"', 'git checkout -b feature',
              'git commit -m "Feature 1"', 'git commit -m "Feature 2"',
              'git checkout main', 'git commit -m "Main work"'],
      solution: ['git checkout feature', 'git rebase main'],
      hints: [
        { en: "`git rebase main` while on feature replays your commits onto main's tip.", zh: "在 feature 上执行 `git rebase main`，会把你的提交重放到 main 的顶端。" },
        { en: "Rebase COPIES commits (C3 → C3'); the originals are simply abandoned.", zh: "变基是“复制”提交（C3 → C3'）；原来的提交被抛弃。" }
      ]
    },
    {
      id: "3-2", world: 3,
      name: { en: "Rebase, Then Ship", zh: "先变基，再发布" },
      brief: {
        en: "The classic workflow: rebase your branch onto main, then let main fast-forward to it. No merge commit anywhere.",
        zh: "经典工作流：先把你的分支变基到 main，然后让 main 快进过来。全程没有合并提交。"
      },
      goal: { en: "main and feature both point at the top of one straight line.", zh: "main 与 feature 都指向同一条直线的顶端。" },
      setup: ['git commit -m "Base"', 'git checkout -b feature',
              'git commit -m "Feature 1"', 'git commit -m "Feature 2"',
              'git checkout main', 'git commit -m "Main work"'],
      solution: ['git checkout feature', 'git rebase main', 'git checkout main', 'git merge feature'],
      compare: { head: true },
      hints: [
        { en: "Two halves: rebase from feature, then fast-forward from main.", zh: "分两步：在 feature 上变基，然后回到 main 快进。" },
        { en: "After the rebase, `git merge feature` on main cannot conflict — it is a fast-forward.", zh: "变基之后，在 main 上 `git merge feature` 不可能冲突——那是快进。" }
      ]
    },
    {
      id: "3-3", world: 3,
      name: { en: "Wrong Base", zh: "开错了基底" },
      brief: {
        en: "`feature` was accidentally started from `experiment`. Move ONLY feature's own two commits onto main and leave experiment alone.",
        zh: "`feature` 不小心从 `experiment` 分出来了。只把 feature 自己的两个提交移到 main 上，别动 experiment。"
      },
      goal: { en: "feature's two commits sit on main; experiment keeps its commit.", zh: "feature 的两个提交接在 main 上；experiment 保留自己的提交。" },
      setup: ['git commit -m "Base"',
              'git checkout -b experiment', 'git commit -m "Wild idea"',
              'git checkout -b feature', 'git commit -m "Feature 1"', 'git commit -m "Feature 2"'],
      solution: ['git rebase --onto main experiment feature'],
      hints: [
        { en: "`git rebase --onto <newbase> <oldbase> <branch>`.", zh: "`git rebase --onto <新基底> <旧基底> <分支>`。" },
        { en: "Read it as: take the commits after `experiment` that belong to `feature`, and drop them on `main`.", zh: "读作：把属于 `feature`、在 `experiment` 之后的那些提交，放到 `main` 上。" }
      ]
    },
    {
      id: "3-4", world: 3,
      name: { en: "Cherry-pick the Fix", zh: "拣选那个修复" },
      brief: {
        en: "The `wip` branch is half-finished, but its middle commit fixes a crash (`bug.txt`). Copy just that one commit onto main.",
        zh: "`wip` 分支还没做完，但中间那个提交修好了一个崩溃（`bug.txt`）。只把那一个提交复制到 main。"
      },
      goal: { en: "main gains exactly one commit — the bug fix.", zh: "main 只多出一个提交——那个 bug 修复。" },
      setup: ['edit bug.txt "crash on empty input\\n"', 'git add .', 'git commit -m "Known bug"',
              'git checkout -b wip', 'edit sketch.txt "half an idea\\n"', 'git add .', 'git commit -m "WIP sketch"',
              'edit bug.txt "empty input handled\\n"', 'git add .', 'git commit -m "Fix the crash"',
              'edit sketch.txt "even more mess\\n"', 'git add .', 'git commit -m "WIP mess"',
              'git checkout main'],
      solution: ['git cherry-pick C4'],
      compare: { files: true, head: true },
      hints: [
        { en: "`git log wip` shows the commit ids; the fix is the one that touches bug.txt.", zh: "`git log wip` 可以看到提交 id；修复就是改动 bug.txt 的那个。" },
        { en: "`git cherry-pick <id>` copies one commit onto your current branch.", zh: "`git cherry-pick <id>` 会把某一个提交复制到你当前的分支上。" },
        { en: "Use `git show <id>` to check a commit's contents before picking it.", zh: "拣选之前可以用 `git show <id>` 检查提交内容。" }
      ]
    },

    // ==================== WORLD 4 ====================
    {
      id: "4-1", world: 4,
      name: { en: "First Blood: Conflict", zh: "初次冲突" },
      brief: {
        en: "You and a teammate both edited `config.txt`. Merge feature into main and keep BOTH lines (yours first).",
        zh: "你和队友都改了 `config.txt`。把 feature 合并进 main，并且保留两边的内容（你的在上）。"
      },
      goal: { en: "A merge commit on main whose config.txt contains both lines.", zh: "main 上出现合并提交，其中 config.txt 同时包含两行。" },
      setup: ['edit config.txt "timeout = 10\\n"', 'git add .', 'git commit -m "Add config"',
              'git checkout -b feature', 'edit config.txt "retries = 3\\n"', 'git add .', 'git commit -m "Feature config"',
              'git checkout main', 'edit config.txt "timeout = 30\\n"', 'git add .', 'git commit -m "Tune timeout"'],
      solution: ['git merge feature', 'resolve config.txt --both', 'git add config.txt', 'git commit'],
      compare: { files: true, head: true },
      hints: [
        { en: "Run the merge first — Git stops and writes conflict markers into the file.", zh: "先执行合并——Git 会停下来，并在文件里写入冲突标记。" },
        { en: "Use the Conflict panel (Keep both), or type `resolve config.txt --both`.", zh: "使用右侧冲突面板的“两边都保留”，或输入 `resolve config.txt --both`。" },
        { en: "Then `git add config.txt` and `git commit` to finish the merge.", zh: "然后 `git add config.txt` 再 `git commit` 完成合并。" }
      ]
    },
    {
      id: "4-2", world: 4,
      name: { en: "Theirs Wins", zh: "采用对方的版本" },
      brief: {
        en: "The feature branch has the correct API endpoint. Merge it into main and keep ONLY the feature side of `api.txt`.",
        zh: "feature 分支上的 API 地址才是对的。把它合并进 main，`api.txt` 只保留 feature 那一边。"
      },
      goal: { en: "A merge commit on main; api.txt holds the feature version only.", zh: "main 上有合并提交；api.txt 只剩 feature 的版本。" },
      setup: ['edit api.txt "url = http://old.example\\n"', 'git add .', 'git commit -m "Add api config"',
              'git checkout -b feature', 'edit api.txt "url = https://api.example/v2\\n"', 'git add .', 'git commit -m "New endpoint"',
              'git checkout main', 'edit api.txt "url = http://old.example/v1\\n"', 'git add .', 'git commit -m "Patch old endpoint"'],
      solution: ['git merge feature', 'resolve api.txt --theirs', 'git add api.txt', 'git commit'],
      compare: { files: true, head: true },
      hints: [
        { en: "\"Ours\" is the branch you are on (main); \"theirs\" is the branch being merged in.", zh: "“ours”是你当前所在的分支（main）；“theirs”是被合并进来的分支。" },
        { en: "`resolve api.txt --theirs` keeps the incoming side.", zh: "`resolve api.txt --theirs` 保留传入的那一边。" }
      ]
    },
    {
      id: "4-3", world: 4,
      name: { en: "Conflict While Rebasing", zh: "变基途中的冲突" },
      brief: {
        en: "Rebase feature onto main. The replay hits a conflict on `style.css` — keep the feature version, then continue.",
        zh: "把 feature 变基到 main。重放过程会在 `style.css` 上冲突——保留 feature 的版本，然后继续。"
      },
      goal: { en: "feature sits in a straight line on main, styled the feature way.", zh: "feature 直线接在 main 之上，样式采用 feature 的版本。" },
      setup: ['edit style.css "color: black\\n"', 'git add .', 'git commit -m "Base style"',
              'git checkout -b feature', 'edit style.css "color: rebeccapurple\\n"', 'git add .', 'git commit -m "Brand colour"',
              'git checkout main', 'edit style.css "color: navy\\n"', 'git add .', 'git commit -m "Corporate navy"',
              'git checkout feature'],
      solution: ['git rebase main', 'resolve style.css --theirs', 'git add style.css', 'git rebase --continue'],
      compare: { files: true },
      hints: [
        { en: "During a rebase, \"theirs\" is the commit being replayed — your feature commit.", zh: "变基过程中，“theirs”指正在被重放的那个提交——也就是你 feature 的提交。" },
        { en: "Finish with `git rebase --continue`, not `git commit`.", zh: "用 `git rebase --continue` 收尾，而不是 `git commit`。" },
        { en: "Stuck? `git rebase --abort` puts everything back.", zh: "卡住了？`git rebase --abort` 可以完全恢复原状。" }
      ]
    },
    {
      id: "4-4", world: 4,
      name: { en: "Judgement Call", zh: "逐个文件裁决" },
      brief: {
        en: "Two files conflict at once. Keep OUR version of `version.txt` and THEIR version of `feature.txt`.",
        zh: "两个文件同时冲突。`version.txt` 保留我们的版本，`feature.txt` 保留他们的版本。"
      },
      goal: { en: "One merge commit on main with each file resolved the right way.", zh: "main 上一个合并提交，两个文件各自按要求解决。" },
      setup: ['edit version.txt "1.0.0\\n"', 'edit feature.txt "flags: none\\n"', 'git add .', 'git commit -m "Base"',
              'git checkout -b feature', 'edit version.txt "1.1.0-beta\\n"', 'edit feature.txt "flags: dark-mode\\n"', 'git add .', 'git commit -m "Feature side"',
              'git checkout main', 'edit version.txt "1.0.1\\n"', 'edit feature.txt "flags: none, verified\\n"', 'git add .', 'git commit -m "Main side"'],
      solution: ['git merge feature', 'resolve version.txt --ours', 'resolve feature.txt --theirs',
                 'git add version.txt', 'git add feature.txt', 'git commit'],
      compare: { files: true, head: true },
      hints: [
        { en: "Each conflicted file is resolved separately — Git does not force one choice on all of them.", zh: "每个冲突文件都要单独处理——Git 不会强迫你对所有文件做同一个选择。" },
        { en: "`git status` lists every unmerged path that still needs you.", zh: "`git status` 会列出所有还需要你处理的未合并文件。" },
        { en: "`git add .` stages both once they are clean.", zh: "两个文件都干净以后，`git add .` 可以一次全部暂存。" }
      ]
    },

    // ==================== WORLD 5 ====================
    {
      id: "5-1", world: 5,
      name: { en: "Reset: Never Happened", zh: "reset：当作没发生" },
      brief: {
        en: "The last two commits on this private branch were a dead end. Throw them away so main points two commits back.",
        zh: "这条私有分支上最后两个提交是死路。把它们丢掉，让 main 回退两个提交。"
      },
      goal: { en: "main points two commits earlier; nothing new is created.", zh: "main 回到两个提交之前；不产生新提交。" },
      setup: ['git commit -m "Good work"', 'git commit -m "Wrong turn"', 'git commit -m "Deeper wrong turn"'],
      solution: ['git reset --hard HEAD~2'],
      hints: [
        { en: "`git reset --hard HEAD~2` moves the branch label back and cleans your files.", zh: "`git reset --hard HEAD~2` 会把分支标签往回移，并清理工作区文件。" },
        { en: "Only do this on history nobody else has pulled.", zh: "只在别人还没拉取过的历史上这么做。" }
      ]
    },
    {
      id: "5-2", world: 5,
      name: { en: "Revert: Undo in Public", zh: "revert：在公开历史上撤销" },
      brief: {
        en: "The bad commit is already pushed, so rewriting history is off the table. Undo its change with a NEW commit.",
        zh: "这个坏提交已经推送出去了，不能改写历史。用一个“新提交”来撤销它的改动。"
      },
      goal: { en: "main has one extra commit and secrets.txt is empty again.", zh: "main 多出一个提交，secrets.txt 恢复原样。" },
      setup: ['edit secrets.txt "nothing to see\\n"', 'git add .', 'git commit -m "Add placeholder"',
              'edit secrets.txt "PASSWORD=hunter2\\n"', 'git add .', 'git commit -m "Oops, leaked a password"'],
      solution: ['git revert HEAD'],
      compare: { files: true },
      hints: [
        { en: "`git revert HEAD` writes the inverse of the last commit as a new commit.", zh: "`git revert HEAD` 会把最后一个提交的“反操作”写成一个新提交。" },
        { en: "reset hides history; revert records the undo. In public, use revert.", zh: "reset 隐藏历史；revert 记录撤销。公开历史上请用 revert。" }
      ]
    },
    {
      id: "5-3", world: 5,
      name: { en: "Detached HEAD Rescue", zh: "游离 HEAD 救援" },
      brief: {
        en: "Someone committed twice while HEAD was detached, so no branch holds that work. Save it as `rescue`, then get back onto main.",
        zh: "有人在 HEAD 游离状态下提交了两次，没有任何分支指向这些工作。把它们保存成 `rescue`，然后回到 main。"
      },
      goal: { en: "rescue points at the loose commits and HEAD is back on main.", zh: "rescue 指向那些游离提交，且 HEAD 回到 main。" },
      setup: ['git commit -m "Sprint work"', 'git checkout HEAD',
              'git commit -m "Experiment A"', 'git commit -m "Experiment B"'],
      solution: ['git branch rescue', 'git checkout main'],
      compare: { head: true },
      hints: [
        { en: "`git branch rescue` labels the commit you are standing on — no need to move first.", zh: "`git branch rescue` 会给你当前所在的提交打上标签——不必先移动。" },
        { en: "Without a label, commits reachable from nothing are eventually garbage-collected.", zh: "没有标签指向的提交，最终会被垃圾回收清掉。" }
      ]
    },
    {
      id: "5-4", world: 5,
      name: { en: "Final Boss: Ship It", zh: "最终 BOSS：发布上线" },
      brief: {
        en: "Release day. Put feature's work in a straight line on main (resolving the `app.js` conflict in feature's favour), fast-forward main, and tag the tip `v1.0`.",
        zh: "发布日。把 feature 的工作以直线形式接到 main 上（`app.js` 冲突采用 feature 的版本），让 main 快进，并给顶端打上 `v1.0` 标签。"
      },
      goal: { en: "One straight history, main at the tip, tag v1.0 on it, HEAD on main.", zh: "一条直线历史，main 在顶端，其上有 v1.0 标签，HEAD 停在 main。" },
      setup: ['edit app.js "start()\\n"', 'git add .', 'git commit -m "Bootstrap app"',
              'git checkout -b feature', 'edit app.js "start(); render()\\n"', 'git add .', 'git commit -m "Render pass"',
              'edit docs.md "how to use\\n"', 'git add .', 'git commit -m "Docs"',
              'git checkout main', 'edit app.js "start(); log()\\n"', 'git add .', 'git commit -m "Add logging"'],
      solution: ['git checkout feature', 'git rebase main', 'resolve app.js --theirs', 'git add app.js',
                 'git rebase --continue', 'git checkout main', 'git merge feature', 'git tag v1.0'],
      compare: { files: true, head: true },
      hints: [
        { en: "Four moves: rebase (with a conflict), continue, fast-forward main, tag.", zh: "四步：变基（会冲突）、continue、main 快进、打标签。" },
        { en: "During the rebase, \"theirs\" is your feature commit being replayed.", zh: "变基过程中，“theirs”是正在被重放的 feature 提交。" },
        { en: "`git tag v1.0` tags whatever HEAD points at — so tag after the fast-forward.", zh: "`git tag v1.0` 会给 HEAD 所指的提交打标签——所以要在快进之后再打。" }
      ]
    }
  ];

  // Par = number of commands in the reference solution (used for stars).
  LEVELS.forEach((lv, i) => {
    lv.index = i;
    lv.par = lv.solution.length;
    lv.compare = Object.assign({ files: false, head: false }, lv.compare || {});
    lv.world = lv.world;
  });

  global.GIT_WORLDS = WORLDS;
  global.GIT_LEVELS = LEVELS;
})(window);
