/**
 * ======================= 虚拟人生 · 界面 =======================
 * 只负责画面与点击，所有规则都在 engine.js。
 */
(function () {
  "use strict";

  const SAVE_KEY = "vlife_save_v1";
  let S = null;          // 游戏状态
  let REPORT = null;     // 待显示的结算报告（学期 / 年度）
  let DRAFT = { talentId: null, originId: null, trackId: null };

  const $ = id => document.getElementById(id);
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const M = n => VL.money(n);

  /* ------------------------------------------------------ 存档 */
  function save(quiet) {
    if (!S) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(S));
      if (!quiet) toast("已保存到这台浏览器。");
    } catch (e) { if (!quiet) toast("保存失败：" + e.message); }
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { toast("没有找到存档。"); return; }
      S = JSON.parse(raw); REPORT = null; render();
      toast("存档已读取。");
    } catch (e) { toast("存档损坏：" + e.message); }
  }
  function toast(msg) {
    const n = document.createElement("div");
    n.textContent = msg;
    n.style.cssText = "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#26314a;" +
      "border:1px solid #4f8cff;color:#e8edf7;padding:9px 16px;border-radius:9px;z-index:99;font-size:14px";
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2200);
  }

  /* ------------------------------------------------------ HUD */
  function bar(cls, label, val, max) {
    const pct = Math.max(0, Math.min(100, (val / (max || 100)) * 100));
    return `<div class="bar ${cls}"><div class="lab"><span>${label}</span><span>${Math.round(val)}</span></div>
      <div class="track"><div class="fill" style="width:${pct}%"></div></div></div>`;
  }

  function renderHud() {
    if (!S) { $("hud").innerHTML = ""; return; }
    const st = S.s, m = VL.major(S);
    const mainKey = VL.mainStatKey(S);
    const star = k => (m && mainKey === k ? "★ " : "");   // 标出主修考核的能力
    const chips = [
      `<span class="chip">${esc(VL.talent(S).icon + " " + VL.talent(S).name)}</span>`,
      `<span class="chip">${esc(VL.origin(S).name)}</span>`,
      `<span class="chip">学历 <b>${esc(S.edu)}</b></span>`
    ];
    if (m) chips.push(`<span class="chip">主修 <b>${esc(m.name)}</b></span>`);
    if (S.gpa.credits) chips.push(`<span class="chip">GPA <b>${S.gpa.value.toFixed(2)}</b> · ${S.gpa.credits} 学分</span>`);
    chips.push(`<span class="chip money">现金 <b>${M(st.money)}</b></span>`);
    if (st.debt > 0) chips.push(`<span class="chip debt">负债 <b>${M(st.debt)}</b></span>`);
    if (S.job) chips.push(`<span class="chip">${esc(S.job.title)} · 年薪 <b>${M(S.job.salary)}</b></span>`);
    if (S.company) chips.push(`<span class="chip">${esc(S.company.name)} · 估值 <b>${M(S.company.valuation)}</b></span>`);

    $("hud").innerHTML = `<div class="hudwrap">
      <div class="hudtop"><span class="who">${esc(S.name)}</span><span class="chip">${S.age} 岁</span>${chips.join("")}</div>
      <div class="bars">
        ${bar("", star("knowledge") + "知识", st.knowledge)}
        ${bar("", star("skillTech") + "技术能力", st.skillTech)}
        ${bar("", star("skillBiz") + "商业能力", st.skillBiz)}
        ${bar("", star("skillComm") + "沟通能力", st.skillComm)}
        ${bar("", "人脉", st.network)}
        ${bar("", "声望", st.reputation)}
        ${bar("energy", "精力", st.energy)}
        ${bar("health", "健康", st.health)}
        ${bar("stress", "压力", st.stress)}
        ${bar("happy", "幸福感", st.happiness)}
      </div></div>`;
  }

  function renderLog() {
    if (!S) { $("log").innerHTML = ""; return; }
    $("log").innerHTML = S.log.slice(0, 60).map(e =>
      `<div class="e ${e.kind}"><span class="when">${esc(e.when)}</span><span class="tx">${esc(e.text)}</span></div>`
    ).join("");
  }

  /* ------------------------------------------------------ 各阶段画面 */

  function screenCreate() {
    const t = DRAFT.talentId, o = DRAFT.originId;
    return `<div class="card">
      <h2>开局：你是谁？</h2>
      <p class="sub">中学毕业那年，你 18 岁。天赋与家境决定你的起点，但走成什么样是你的选择。</p>
      <div class="rowline"><input type="text" id="in-name" maxlength="12" placeholder="给自己起个名字" value="${esc(DRAFT.name || "")}"></div>
      <h3>选一个天赋</h3>
      <div class="grid">${TALENTS.map(x => `
        <button class="pick ${t === x.id ? "on" : ""}" data-pick="talent" data-id="${x.id}">
          <span class="nm">${x.icon} ${esc(x.name)}</span><span class="ds">${esc(x.desc)}</span></button>`).join("")}</div>
      <h3>选一个家庭背景</h3>
      <div class="grid">${ORIGINS.map(x => `
        <button class="pick ${o === x.id ? "on" : ""}" data-pick="origin" data-id="${x.id}">
          <span class="nm">${x.icon} ${esc(x.name)}</span><span class="ds">${esc(x.desc)}</span></button>`).join("")}</div>
      <div class="rowline">
        <button class="btn big" data-do="start" ${t && o ? "" : "disabled"}>开始人生</button>
        <button class="btn ghost" data-do="load">读取上次存档</button>
      </div></div>`;
  }

  function screenTrack() {
    const opts = VL.trackOptions(S);
    const head = S.record.degrees.length || S.careerYear
      ? `<h2>回到学校</h2><p class="sub">学历是天花板。想走得更远，就再念一个学位。</p>`
      : `<h2>会考成绩：${S.hsResult} 分（${VL.grade(S.hsResult)}）</h2>
         <p class="sub">中学毕业了。接下来这一步，会决定你后面二十年能碰到什么样的机会。</p>`;

    const tracks = `<div class="grid">${opts.map(x => `
      <button class="pick ${DRAFT.trackId === x.track.id ? "on" : ""}" data-pick="track" data-id="${x.track.id}" ${x.ok ? "" : "disabled"}>
        <span class="nm">${x.track.icon} ${esc(x.track.name)}</span>
        <span class="ds">${esc(x.track.desc)}</span>
        ${x.track.tuition ? `<span class="cost">学费 ${M(x.track.tuition)} / 学期</span>` : ""}
        ${x.ok ? "" : `<span class="no">✗ ${esc(x.why)}</span>`}
      </button>`).join("")}</div>`;

    let majors = "";
    if (DRAFT.trackId && DRAFT.trackId !== "work") {
      majors = `<h3>选择主修（决定你要修哪些课、能应征什么工作）</h3>
        <div class="grid">${Object.values(MAJORS).map(m => `
          <button class="pick" data-do="enroll" data-track="${DRAFT.trackId}" data-major="${m.id}">
            <span class="nm">${m.icon} ${esc(m.name)}</span>
            <span class="ds">${esc(m.desc)}</span>
            <span class="cost">主修能力：${{ skillTech: "技术", skillBiz: "商业", skillComm: "沟通", knowledge: "知识" }[m.main]}</span>
          </button>`).join("")}</div>`;
    } else if (DRAFT.trackId === "work") {
      majors = `<div class="rowline"><button class="btn big" data-do="enroll" data-track="work">确定：直接去找工作</button></div>`;
    }
    return `<div class="card">${head}${tracks}${majors}</div>`;
  }

  function screenStudy() {
    const tr = TRACKS[S.stage.trackId], sem = S.sem;
    const courses = `<table><thead><tr><th>本学期修读的课</th><th class="num">难度</th><th>考核能力</th></tr></thead>
      <tbody>${sem.courses.map(c => `<tr><td>${esc(c.name)}</td><td class="num">${c.diff}</td>
        <td>${VL.statName(c.stat)}</td></tr>`).join("")}</tbody></table>`;

    const acts = `<div class="grid">${STUDY_ACTIONS.map(a => {
      const chk = VL.canDo(S, a), used = sem.used[a.id] || 0;
      const cost = [];
      if (a.cost.energy) cost.push(`精力 −${a.cost.energy}`);
      if (a.cost.money) cost.push(`${M(a.cost.money)}`);
      return `<button class="pick" data-do="study" data-id="${a.id}" ${chk.ok ? "" : "disabled"}>
        <span class="nm">${a.icon} ${esc(a.name)}${used ? ` <span style="color:#93a0b8">×${used}</span>` : ""}</span>
        <span class="ds">${esc(a.desc)}</span>
        <span class="cost">${cost.join(" · ")}</span>
        ${chk.ok ? "" : `<span class="no">✗ ${esc(chk.why)}</span>`}</button>`;
    }).join("")}</div>`;

    return `<div class="card">
      <h2>${esc(tr.edu)}第 ${Math.ceil(S.stage.semester / 2)} 学年 · 第 ${S.stage.semester % 2 === 1 ? "一" : "二"} 学期</h2>
      <p class="sub">剩余时间 <b>${sem.ap} / ${sem.apMax}</b> 个行动 &nbsp;·&nbsp; 学期进度 ${S.stage.semester}/${S.stage.semesters}
        &nbsp;·&nbsp; 挂科累计 ${S.stage.failed}（满 5 科退学）</p>
      ${courses}
      ${alarms()}
      <h3>这个学期你要做什么？</h3>
      ${acts}
      <div class="rowline">
        <button class="btn big green" data-do="exam">${sem.ap > 0 ? "提前进入期末考" : "参加期末考"}</button>
        <span style="color:#93a0b8;font-size:13px">上课出席会加考试分；重复同一个行动效果会打折。</span>
      </div></div>`;
  }

  function screenReport() {
    const r = REPORT;
    let body = "";
    if (r.kind === "exam") {
      const cls = g => g === "A" || g === "B+" ? "gd-a" : (g === "B" || g === "C" ? "gd-b" : (g === "F" ? "gd-f" : "gd-c"));
      body = `<table><thead><tr><th>科目</th><th class="num">分数</th><th>等级</th><th class="num">绩点</th></tr></thead>
        <tbody>${r.results.map(x => `<tr><td>${esc(x.name)}</td><td class="num">${x.score}</td>
          <td class="${cls(x.grade)}">${x.grade}</td><td class="num">${x.gp.toFixed(1)}</td></tr>`).join("")}</tbody></table>
        <p class="sub" style="margin-top:12px">平均 ${r.avg} 分 · 累计 GPA <b>${S.gpa.value.toFixed(2)}</b>
          ${r.failed ? ` · <span style="color:#f2666f">${r.failed} 科不及格</span>` : " · 全科通过"}</p>`;
    }
    body += (r.notes || []).map(n => `<div class="note">${esc(n)}</div>`).join("");
    return `<div class="card"><h2>${esc(r.title)}</h2>${body}
      <div class="rowline"><button class="btn big" data-do="continue">继续</button></div></div>`;
  }

  function screenCrossroads() {
    const c = VL.crossroads(S);
    const study = c.study.filter(x => x.track.id !== "work");
    const co = c.canStartup;
    return `<div class="card">
      <h2>毕业了，然后呢？</h2>
      <p class="sub">${esc(S.edu)} · ${esc(VL.major(S) ? VL.major(S).name : "")} · GPA ${S.gpa.value.toFixed(2)}
        ${S.record.internships ? ` · ${S.record.internships} 段实习` : ""} · 求职竞争力 <b>${VL.employability(S)}</b></p>
      <h3>继续升学</h3>
      <div class="grid">${study.length ? study.map(x => `
        <button class="pick" data-do="up" data-id="${x.track.id}" ${x.ok ? "" : "disabled"}>
          <span class="nm">${x.track.icon} ${esc(x.track.name)}</span>
          <span class="ds">${esc(x.track.desc)}</span>
          ${x.ok ? "" : `<span class="no">✗ ${esc(x.why)}</span>`}</button>`).join("")
        : `<p class="sub">没有可再念的学位了（已是最高学历）。</p>`}</div>
      <h3>出社会</h3>
      <div class="grid">
        <button class="pick" data-do="tojobs"><span class="nm">💼 找工作</span>
          <span class="ds">进入人才市场，看看你的学历与能力能拿到什么 offer。</span></button>
        <button class="pick" data-do="tofound" ${co.ok ? "" : "disabled"}><span class="nm">🚀 自己创业</span>
          <span class="ds">投入 80% 存款成立公司，从产品做到上市 —— 高风险，但天花板最高。</span>
          ${co.ok ? "" : `<span class="no">✗ ${esc(co.why)}</span>`}</button>
      </div></div>`;
  }

  function screenJobs() {
    const offers = VL.jobOffers(S), score = VL.employability(S);
    const row = o => `<button class="pick" data-do="take" data-id="${o.job.id}" ${o.ok ? "" : "disabled"}>
      <span class="nm">${esc(o.job.name)} · ${M(o.salary)}/年</span>
      <span class="ds">起始职位 ${esc(o.job.levels[0])} · 晋升阶梯 ${o.job.levels.length} 级（最高 ${esc(o.job.levels[o.job.levels.length - 1])}）</span>
      ${o.ok ? "" : `<span class="no">✗ ${esc(o.why)}</span>`}</button>`;
    const ok = offers.filter(o => o.ok), no = offers.filter(o => !o.ok);
    return `<div class="card">
      <h2>人才市场</h2>
      <p class="sub">学历 <b>${esc(S.edu)}</b> · 求职竞争力 <b>${score}</b>（由 GPA、专业能力、实习、人脉、声望决定）</p>
      <h3>你能拿到的 offer（${ok.length}）</h3>
      <div class="grid">${ok.length ? ok.map(row).join("") : `<p class="sub">没有公司要你。先去打零工或回学校进修吧。</p>`}</div>
      ${VL.startupCheck(S).ok ? `<h3>或者……</h3><div class="grid">
        <button class="pick" data-do="tofound"><span class="nm">🚀 不打工了，自己创业</span>
          <span class="ds">投入 80% 存款成立公司。</span></button></div>` : ""}
      <h3>暂时够不上的职位（${no.length}）</h3>
      <div class="grid">${no.slice(0, 8).map(row).join("")}</div>
      ${!ok.length ? `<div class="rowline"><button class="btn ghost" data-do="oddjob">先随便打零工过一年</button></div>` : ""}
      </div>`;
  }

  /** 健康或压力告急时的警示条 */
  function alarms() {
    let out = "";
    if (S.s.health <= 30) out += `<div class="note bad">⚠️ 健康只剩 ${Math.round(S.s.health)}！归零就直接终局 —— 去「陪家人 / 休假」或运动。</div>`;
    else if (S.s.health <= 50) out += `<div class="note">健康 ${Math.round(S.s.health)}，开始下滑了，别一直硬撑。</div>`;
    if (S.s.stress >= 80) out += `<div class="note bad">🥀 压力 ${Math.round(S.s.stress)}，随时可能 burnout 停职。</div>`;
    return out;
  }

  function screenCareer() {
    const j = JOBS.find(x => x.id === S.job.id);
    const needed = VL.promotionNeed(S);
    const acts = VL.careerActions(S).map(a => {
      const cost = a.action.cost && a.action.cost.money ? `花费 ${M(a.action.cost.money)}` : "";
      return `<button class="pick" data-do="career" data-id="${a.action.id}" ${a.ok ? "" : "disabled"}>
        <span class="nm">${a.action.icon} ${esc(a.action.name)}</span>
        <span class="ds">${esc(a.action.desc)}</span>
        ${cost ? `<span class="cost">${cost}</span>` : ""}
        ${a.ok ? "" : `<span class="no">✗ ${esc(a.why)}</span>`}</button>`;
    }).join("");
    return `<div class="card">
      <h2>${S.age} 岁 · ${esc(S.job.title)}（${esc(j.name)}）</h2>
      <p class="sub">年薪 <b>${M(S.job.salary)}</b> · 在职 ${S.job.years} 年 · 绩效 <b>${Math.round(S.job.perf)} / ${needed}</b> 就能升
        ${S.job.level >= j.levels.length - 1 ? "（已到顶）" : `→ ${esc(j.levels[S.job.level + 1])}`}
        · 今年剩 <b>${S.year.ap}</b> 个行动</p>
      ${alarms()}
      <div class="grid">${acts}</div>
      <div class="rowline"><button class="btn big green" data-do="endyear">结束这一年</button>
        <span style="color:#93a0b8;font-size:13px">${S.retireAge} 岁做人生总结。</span></div></div>`;
  }

  function screenStartup() {
    const c = S.company;
    const acts = VL.startupActions(S).map(a => `
      <button class="pick" data-do="su" data-id="${a.action.id}" ${a.ok ? "" : "disabled"}>
        <span class="nm">${a.action.icon} ${esc(a.action.name)}</span>
        <span class="ds">${esc(a.action.desc)}</span>
        ${a.action.cash ? `<span class="cost">${a.action.cash < 0 ? "现金 −" : "现金 +"}${M(Math.abs(a.action.cash))}</span>` : ""}
        ${a.ok ? "" : `<span class="no">✗ ${esc(a.why)}</span>`}</button>`).join("");
    return `<div class="card">
      <h2>${esc(c.name)} · 创业第 ${c.years + 1} 年${c.listed ? " · 已上市 🔔" : ""}</h2>
      <p class="sub">产品力 <b>${Math.round(c.product)}</b> · 营销力 <b>${Math.round(c.marketing)}</b> ·
        团队 <b>${c.team}</b> 人 · 年营收 <b>${M(c.revenue)}</b> · 公司现金 <b style="color:${c.cash < 0 ? "#f2666f" : "#35c98a"}">${M(c.cash)}</b><br>
        估值 <b>${M(c.valuation)}</b> · 你持股 <b>${(c.equity * 100).toFixed(1)}%</b>（约 ${M(c.valuation * c.equity)}）·
        今年剩 <b>${S.year.ap}</b> 个行动</p>
      ${alarms()}
      <div class="note">上市条件：估值 ≥ 4 亿元 且 年营收 ≥ 6000 万元。产品力带动客户成长，营销力会逐年衰减，团队每人每年约 9.5 万成本。</div>
      <div class="grid">${acts}</div>
      <div class="rowline"><button class="btn big green" data-do="endsuyear">结束这一年</button></div></div>`;
  }

  function screenEnd() {
    const e = S.ending;
    return `<div class="card ending">
      <div class="score">${S.age} 岁 · 人生总结 · 综合评分 ${e.score}</div>
      <div class="title">${esc(e.title)}</div>
      <div class="blurb">${esc(e.blurb)}</div>
      <div class="tags">
        <span class="tag">学历 ${esc(e.stats.edu)}</span>
        <span class="tag">GPA ${e.stats.gpa}</span>
        <span class="tag">身份 ${esc(e.stats.job)}</span>
        <span class="tag">净资产 ${M(e.worth)}</span>
        <span class="tag">健康 ${Math.round(S.s.health)}</span>
        <span class="tag">幸福感 ${Math.round(S.s.happiness)}</span>
      </div>
      ${e.achievements.length ? `<div class="tags">${e.achievements.map(a => `<span class="tag">${esc(a)}</span>`).join("")}</div>` : ""}
      <div class="timeline">${S.history.map(h => `<div class="t"><b>${h.age} 岁</b>${esc(h.text)}</div>`).join("")}</div>
      <div class="rowline" style="justify-content:center"><button class="btn big" data-do="again">再来一局</button></div>
      </div>`;
  }

  function screenFound() {
    const cash = Math.round(S.s.money * 0.8);
    return `<div class="card">
      <h2>下海创业</h2>
      <p class="sub">你会把 80% 的存款（${M(cash)}）投进公司当启动资金，自己持股 100%。
        接下来每年有 2 个行动：打磨产品、招人、营销、跑客户、融资。产品力带动客户复利成长，
        撑不住现金流就会结业。</p>
      <div class="rowline">
        <input type="text" id="in-co" maxlength="16" placeholder="公司名字" value="星火科技">
        <button class="btn big" data-do="found">成立公司</button>
        <button class="btn ghost" data-do="cancelfound">再想想</button>
      </div></div>`;
  }

  /* ------------------------------------------------------ 主渲染 */
  function render() {
    renderHud(); renderLog();
    let html;
    if (!S) html = screenCreate();
    else if (REPORT) html = screenReport();
    else if (DRAFT.founding && S.phase !== "startup") html = screenFound();
    else switch (S.phase) {
      case "track": html = screenTrack(); break;
      case "study": html = screenStudy(); break;
      case "crossroads": html = screenCrossroads(); break;
      case "jobmarket": html = screenJobs(); break;
      case "career": html = screenCareer(); break;
      case "startup": html = screenStartup(); break;
      case "end": html = screenEnd(); break;
      default: html = `<div class="card"><h2>???</h2><p class="sub">未知阶段：${esc(S.phase)}</p></div>`;
    }
    $("stage").innerHTML = html;
  }

  /* ------------------------------------------------------ 点击处理 */
  document.addEventListener("click", function (ev) {
    const pick = ev.target.closest("[data-pick]");
    if (pick && !pick.disabled) {
      const kind = pick.getAttribute("data-pick"), id = pick.getAttribute("data-id");
      if (kind === "talent") DRAFT.talentId = id;
      if (kind === "origin") DRAFT.originId = id;
      if (kind === "track") DRAFT.trackId = id;
      const nameBox = $("in-name"); if (nameBox) DRAFT.name = nameBox.value;
      render(); return;
    }
    const btn = ev.target.closest("[data-do]");
    if (!btn || btn.disabled) return;
    act(btn.getAttribute("data-do"), btn);
  });

  function act(what, btn) {
    const id = btn.getAttribute("data-id");
    switch (what) {

      case "start": {
        const name = ($("in-name").value || "").trim() || "无名氏";
        S = VL.newGame(name, DRAFT.talentId, DRAFT.originId);
        DRAFT.trackId = null;
        break;
      }
      case "load": load(); return;

      case "enroll": {
        const track = btn.getAttribute("data-track"), major = btn.getAttribute("data-major");
        VL.enroll(S, track, major || S.lastMajorId || "cs");
        DRAFT.trackId = null;
        break;
      }

      case "study": {
        const r = VL.studyAction(S, id);
        if (!r.ok) toast(r.msg);
        break;
      }

      case "exam": {
        const r = VL.endSemester(S);
        REPORT = {
          kind: "exam", title: r.dropout ? "期末成绩 —— 坏消息" : (r.graduated ? "期末成绩 —— 你毕业了！" : "期末成绩"),
          results: r.results, avg: r.avg, failed: r.failed, notes: r.notes
        };
        break;
      }

      case "continue": REPORT = null; break;

      case "up": {
        DRAFT.trackId = id; S.phase = "track"; break;
      }
      case "tojobs": S.phase = "jobmarket"; break;
      case "tofound": DRAFT.founding = true; break;
      case "found": {
        const box = $("in-co");
        const r = VL.foundCompany(S, (box && box.value.trim()) || "星火科技");
        if (!r.ok) { toast(r.msg); return; }
        DRAFT.founding = false;
        break;
      }
      case "cancelfound": DRAFT.founding = false; break;
      case "take": {
        const r = VL.takeJob(S, id);
        if (!r.ok) toast(r.msg);
        break;
      }
      case "oddjob": {
        S.job = null; S.phase = "career"; VL.startCareerYear(S);
        const r = VL.endCareerYear(S);
        REPORT = { kind: "year", title: `${S.age - 1} 岁 · 打零工的一年`, notes: r.notes };
        break;
      }

      case "career": {
        const r = VL.careerAction(S, id);
        if (!r.ok) { toast(r.msg); break; }
        if (r.found) DRAFT.founding = true;          // 辞职创业 → 先取公司名
        break;
      }
      case "endyear": {
        const age = S.age;
        const r = VL.endCareerYear(S);
        REPORT = { kind: "year", title: `${age} 岁 · 年度结算`, notes: r.notes };
        break;
      }
      case "su": {
        const r = VL.startupAction(S, id);
        if (!r.ok) toast(r.msg);
        break;
      }
      case "endsuyear": {
        const age = S.age;
        const r = VL.endStartupYear(S);
        REPORT = { kind: "year", title: `${age} 岁 · ${S.company ? S.company.name : "公司"} 年度结算`, notes: r.notes };
        break;
      }

      case "again": {
        S = null; REPORT = null; DRAFT = { talentId: null, originId: null, trackId: null };
        localStorage.removeItem(SAVE_KEY);
        break;
      }
    }
    if (S) save(true);
    render();
  }

  /* 顶部按钮 */
  $("btn-save").onclick = () => save(false);
  $("btn-load").onclick = load;
  $("btn-reset").onclick = () => {
    if (!confirm("重开一局？当前进度会被清掉。")) return;
    S = null; REPORT = null; DRAFT = { talentId: null, originId: null, trackId: null };
    localStorage.removeItem(SAVE_KEY); render();
  };

  /* 启动：有存档就自动续上 */
  try { if (localStorage.getItem(SAVE_KEY)) S = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { S = null; }
  render();
})();
