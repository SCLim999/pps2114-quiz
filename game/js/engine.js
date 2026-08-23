/**
 * ======================= 虚拟人生 · 游戏引擎 =======================
 * 纯逻辑，不碰 DOM（方便用 node 单独跑模拟测试）。
 * 状态机：create → track → study ⇄ exam → crossroads → jobmarket
 *         → career ⇄ startup → end
 */
const VL = {

  /* ------------------------- 小工具 ------------------------- */
  ri(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; },
  rf(a, b) { return Math.random() * (b - a) + a; },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },

  /** 金额格式化：12345 → 1.2万元 */
  money(n) {
    const neg = n < 0; n = Math.abs(Math.round(n));
    let out;
    if (n >= 100000000) out = (n / 100000000).toFixed(2) + " 亿元";
    else if (n >= 10000) out = (n / 10000).toFixed(1) + " 万元";
    else out = n.toLocaleString("en-US") + " 元";
    return (neg ? "−" : "") + out;
  },

  talent(s) { return TALENTS.find(t => t.id === s.talentId) || { mods: {}, name: "－" }; },
  origin(s) { return ORIGINS.find(o => o.id === s.originId) || { mods: {}, name: "－" }; },
  major(s) { return s.stage && s.stage.majorId ? MAJORS[s.stage.majorId] : (s.lastMajorId ? MAJORS[s.lastMajorId] : null); },

  /** 天赋 + 家境的乘数 */
  mod(s, key) {
    const a = this.talent(s).mods || {}, b = this.origin(s).mods || {};
    return (a[key] || 1) * (b[key] || 1);
  },

  /** 当前主修能力的字段名（没在念书时用最后一次的专业） */
  mainStatKey(s) {
    const m = this.major(s);
    return m ? m.main : "skillTech";
  },
  majorStat(s) { return s.s[this.mainStatKey(s)]; },

  /* ------------------------- 数值变动 -------------------------
     chg(state, {knowledge:+6, money:-100, major:+5, ...})
     - 正向收益会套用天赋/家境乘数
     - 知识与技能越高，增长越慢（边际递减）
  */
  chg(s, eff, scale) {
    scale = scale === undefined ? 1 : scale;
    const CAT = {
      knowledge: "knowledge", skillTech: "tech", skillBiz: "biz",
      skillComm: "social", network: "social", reputation: "social",
      health: "health", money: "money", stress: "stress"
    };
    const CAPPED = ["knowledge", "skillTech", "skillBiz", "skillComm",
      "network", "reputation", "health", "happiness", "stress", "energy"];

    for (let key in eff) {
      let v = eff[key] * scale;
      if (key === "major") { key = this.mainStatKey(s); }

      if (v > 0) {
        const cat = CAT[key];
        if (cat) v *= this.mod(s, cat);
        // 边际递减：能力越接近满分越难涨
        if (["knowledge", "skillTech", "skillBiz", "skillComm", "network", "reputation"].indexOf(key) >= 0) {
          v *= Math.max(0.25, 1 - s.s[key] / 130);
        }
      }
      if (key === "energy" && v < 0) v *= this.mod(s, "energyCost");

      s.s[key] = (s.s[key] || 0) + v;
      if (CAPPED.indexOf(key) >= 0) s.s[key] = this.clamp(s.s[key], 0, 100);
      if (key === "money" && s.s.money < 0) {           // 钱不够就变助学贷款
        s.s.debt += -s.s.money; s.s.money = 0;
      }
      s.s[key] = Math.round(s.s[key] * 10) / 10;
    }
  },

  log(s, text, kind) {
    s.log.unshift({ when: this.stamp(s), text: text, kind: kind || "info" });
    if (s.log.length > 300) s.log.pop();
  },

  stamp(s) {
    if (s.phase === "study" || s.phase === "exam") {
      const i = s.stage.semester, yr = Math.ceil(i / 2);
      return `${s.age}岁 · ${TRACKS[s.stage.trackId].edu}第${yr}年${i % 2 === 1 ? "上" : "下"}学期`;
    }
    return `${s.age}岁`;
  },

  /* ------------------------- 开局 ------------------------- */
  newGame(name, talentId, originId) {
    const t = TALENTS.find(x => x.id === talentId), o = ORIGINS.find(x => x.id === originId);
    const s = {
      version: 1,
      name: (name || "无名氏").slice(0, 12),
      talentId: t.id, originId: o.id,
      age: 18, phase: "track",
      edu: "高中",
      stage: null, sem: null,
      lastMajorId: null,
      s: {
        knowledge: 32 + this.ri(0, 14),
        skillTech: this.ri(4, 12), skillBiz: this.ri(4, 12), skillComm: this.ri(6, 16),
        energy: 100, stress: 8, health: 82,
        network: 8, reputation: 0, luck: 10, happiness: 60,
        money: o.money, debt: 0
      },
      gpa: { points: 0, credits: 0, value: 0 },
      record: { courses: [], internships: 0, awards: [], degrees: [], jobs: [] },
      flags: {},
      job: null, company: null,
      careerYear: 0, retireAge: 50,
      ending: null, log: [], history: []
    };
    this.chg(s, t.bonus || {}); this.chg(s, o.bonus || {});
    // 会考成绩：知识决定，运气微调
    const exam = this.clamp(Math.round(s.s.knowledge + this.ri(-4, 6) + s.s.luck / 5), 0, 100);
    s.hsResult = exam;
    s.s.knowledge = this.clamp(Math.round((s.s.knowledge + exam) / 2), 0, 100);
    this.log(s, `🎒 ${s.name} 中学毕业，会考总成绩 ${exam} 分（${this.grade(exam)}）。人生从这里开始。`, "good");
    this.mark(s, `中学毕业，会考 ${exam} 分`);
    return s;
  },

  grade(score) {
    if (score >= 85) return "A";
    if (score >= 75) return "B+";
    if (score >= 65) return "B";
    if (score >= 55) return "C";
    if (score >= 45) return "C−";
    if (score >= 38) return "D";
    return "F";
  },
  gradePoint(score) {
    if (score >= 85) return 4.0;
    if (score >= 75) return 3.5;
    if (score >= 65) return 3.0;
    if (score >= 55) return 2.5;
    if (score >= 45) return 2.0;
    if (score >= 38) return 1.0;
    return 0;
  },

  /** 记录获奖：同一个奖项不重复堆叠 */
  addAward(s, name) {
    if (s.record.awards.indexOf(name) < 0) s.record.awards.push(name);
  },

  /** 里程碑，用于结局的人生回顾 */
  mark(s, text) { s.history.push({ age: s.age, text: text }); },

  /* ------------------------- 升学路线 ------------------------- */
  trackOptions(s) {
    const out = [];
    const canDegree = s.edu === "高中";
    if (canDegree) {
      out.push(this.opt(TRACKS.degree, s.s.knowledge >= TRACKS.degree.minKnowledge,
        `会考成绩不够（需要知识 ${TRACKS.degree.minKnowledge}，你 ${Math.round(s.s.knowledge)}）`));
      out.push(this.opt(TRACKS.diploma, s.s.knowledge >= TRACKS.diploma.minKnowledge,
        `基础太弱（需要知识 ${TRACKS.diploma.minKnowledge}）`));
      out.push(this.opt(TRACKS.work, true, ""));
    }
    if (s.edu === "大专") {
      out.push(this.opt(TRACKS.upgrade, s.gpa.value >= TRACKS.upgrade.minGpa,
        `GPA 不够（需要 ${TRACKS.upgrade.minGpa}，你 ${s.gpa.value.toFixed(2)}）`));
    }
    if (s.edu === "本科") {
      out.push(this.opt(TRACKS.master, s.gpa.value >= TRACKS.master.minGpa,
        `GPA 不够（需要 ${TRACKS.master.minGpa}，你 ${s.gpa.value.toFixed(2)}）`));
    }
    return out;
  },
  opt(track, ok, why) { return { track: track, ok: ok, why: ok ? "" : why }; },

  /** 进入某个学位：trackId + majorId */
  enroll(s, trackId, majorId) {
    const tr = TRACKS[trackId];
    if (trackId === "work") { s.phase = "jobmarket"; this.log(s, "🧰 你决定不再升学，直接出社会。", "info"); return; }
    s.stage = { trackId: trackId, majorId: majorId, semester: 1, semesters: tr.semesters, failed: 0 };
    s.lastMajorId = majorId;
    s.phase = "study";
    this.log(s, `🎓 你入读【${tr.name}】，主修 ${MAJORS[majorId].name}。`, "good");
    this.mark(s, `入读 ${tr.name} · ${MAJORS[majorId].name}`);
    this.startSemester(s);
  },

  /* ------------------------- 学期 ------------------------- */
  /** 这学期要修的课（每学期 3 门，按专业课程表顺序） */
  semesterCourses(s) {
    const pool = MAJORS[s.stage.majorId].courses;
    const per = 3, i = s.stage.semester - 1;
    const out = [];
    for (let k = 0; k < per; k++) out.push(pool[(i * per + k) % pool.length]);
    return out;
  },

  startSemester(s) {
    const tr = TRACKS[s.stage.trackId], o = this.origin(s);
    s.sem = { ap: 4, apMax: 4, used: {}, attend: 0, courses: this.semesterCourses(s), notes: [] };
    // 学费 & 家用
    this.chg(s, { money: o.allowance });
    s.s.money -= tr.tuition;
    if (s.s.money < 0) { s.s.debt += -s.s.money; s.s.money = 0; s.sem.notes.push(`学费不够，办了助学贷款（累计负债 ${this.money(s.s.debt)}）`); this.chg(s, { stress: 5 }); }
    // 假期恢复
    s.s.energy = this.clamp(60 + Math.round(s.s.health * 0.4), 30, 100);
    this.chg(s, { stress: -10 });
    this.log(s, `🗓️ 新学期开始。学费 ${this.money(tr.tuition)}，家用 ${this.money(o.allowance)}。本学期修读：${s.sem.courses.map(c => c.name).join("、")}。`, "info");
  },

  /** 行动是否可做 */
  canDo(s, a) {
    const cost = a.cost || {};
    const eCost = (cost.energy || 0) * this.mod(s, "energyCost");
    if (s.sem.ap <= 0) return { ok: false, why: "本学期时间用完了" };
    if (s.s.energy < eCost) return { ok: false, why: "精力不足（去运动或休息）" };
    if ((cost.money || 0) > s.s.money) return { ok: false, why: `钱不够（需要 ${this.money(cost.money)}）` };
    if (a.req) {
      if (a.req.knowledge && s.s.knowledge < a.req.knowledge) return { ok: false, why: `知识不足 ${a.req.knowledge}` };
      if (a.req.major && this.majorStat(s) < a.req.major) return { ok: false, why: `专业能力不足 ${a.req.major}` };
      if (a.req.any && Math.max(this.majorStat(s), s.s.skillBiz) < a.req.any) return { ok: false, why: `专业或商业能力不足 ${a.req.any}` };
    }
    return { ok: true };
  },

  studyAction(s, id) {
    const a = STUDY_ACTIONS.find(x => x.id === id);
    const chk = this.canDo(s, a);
    if (!chk.ok) return { ok: false, msg: chk.why };

    const times = s.sem.used[id] || 0;
    const scale = times === 0 ? 1 : (times === 1 ? 0.65 : 0.4);   // 同一件事做多次会疲乏
    const cost = a.cost || {};
    this.chg(s, { energy: -(cost.energy || 0) });
    if (cost.money) this.chg(s, { money: -cost.money });
    this.chg(s, a.eff, scale);

    s.sem.used[id] = times + 1;
    s.sem.ap--;
    if (a.tag === "attend") s.sem.attend++;
    if (a.tag === "intern") { s.record.internships++; }
    if (a.tag === "contest" && Math.random() < 0.35 + s.s.luck / 300) {
      const prize = 3000;
      this.chg(s, { money: prize, reputation: 5 });
      this.addAward(s, "竞赛 / 研究获奖");
      s.sem.notes.push(`🏆 竞赛得奖，奖金 ${this.money(prize)}！`);
    }
    this.log(s, `${a.icon} ${a.name}${scale < 1 ? "（重复行动，效果打折）" : ""}`, "act");
    return { ok: true, action: a };
  },

  /** 期末考 + 学期结算 */
  endSemester(s) {
    const notes = [];
    if (s.sem.ap > 0) { this.chg(s, { stress: -4 * s.sem.ap }); notes.push(`剩下的时间你在宿舍躺平了（少许减压）。`); }

    const results = [];
    let failedNow = 0;
    for (const c of s.sem.courses) {
      let base = s.s.knowledge * 0.5 + s.s[c.stat] * 0.5;
      let score = base + s.sem.attend * 4 - (c.diff - 30) + this.ri(-9, 9) + s.s.luck / 6 * this.mod(s, "luck");
      if (s.s.stress >= 75) score -= 10;
      if (s.s.health <= 35) score -= 6;
      score = this.clamp(Math.round(score), 0, 100);
      const gp = this.gradePoint(score), g = this.grade(score);
      const credits = 3;
      results.push({ name: c.name, score: score, grade: g, gp: gp, credits: credits });
      s.record.courses.push({ name: c.name, grade: g, score: score });
      if (gp > 0) {
        s.gpa.points += gp * credits; s.gpa.credits += credits;
        this.chg(s, { [c.stat]: 3, knowledge: 2 });        // 修完课程 → 能力成长
      } else {
        failedNow++; s.stage.failed++;
        this.chg(s, { stress: 10, happiness: -6 });
      }
    }
    s.gpa.value = s.gpa.credits ? s.gpa.points / s.gpa.credits : 0;

    const avg = Math.round(results.reduce((a, r) => a + r.score, 0) / results.length);
    this.log(s, `📝 期末成绩公布：平均 ${avg} 分，本学期 ${failedNow ? failedNow + " 科不及格" : "全科通过"}，累计 GPA ${s.gpa.value.toFixed(2)}。`,
      failedNow ? "bad" : "good");

    // 随机事件
    const ev = this.rollEvent(s, STUDY_EVENTS);
    if (ev) { notes.push(ev); }

    // 健康 / 压力自然变化
    this.chg(s, { health: -2, stress: 3 });

    const semNotes = s.sem.notes.slice();

    // 退学判定
    let dropout = false;
    if (s.stage.failed >= 5) {
      dropout = true;
      this.log(s, "🚪 挂科太多，学校请你退学。学历停在这里了。", "bad");
      this.mark(s, `${TRACKS[s.stage.trackId].name} 肄业`);
      s.stage = null; s.sem = null; s.phase = "jobmarket";
    }

    const out = { results: results, avg: avg, failed: failedNow, notes: notes.concat(semNotes), dropout: dropout, graduated: false };
    if (dropout) return out;

    // 下一学期 / 毕业
    if (s.stage.semester % 2 === 0) s.age++;
    if (s.stage.semester >= s.stage.semesters) {
      out.graduated = true;
      this.graduate(s);
    } else {
      s.stage.semester++;
      s.phase = "study";
      this.startSemester(s);
    }
    return out;
  },

  graduate(s) {
    const tr = TRACKS[s.stage.trackId], m = MAJORS[s.stage.majorId];
    s.edu = tr.edu;
    const cls = s.gpa.value >= 3.7 ? "一等荣誉" : s.gpa.value >= 3.2 ? "二等一荣誉" : s.gpa.value >= 2.7 ? "二等二荣誉" : "及格毕业";
    s.record.degrees.push({ edu: tr.edu, major: m.name, gpa: +s.gpa.value.toFixed(2), cls: cls });
    this.log(s, `🎉 毕业了！${tr.edu} · ${m.name}，GPA ${s.gpa.value.toFixed(2)}（${cls}）。`, "good");
    this.mark(s, `${tr.edu}毕业 · ${m.name}（GPA ${s.gpa.value.toFixed(2)}）`);
    if (s.gpa.value >= 3.7) { this.chg(s, { reputation: 10 }); this.addAward(s, "院长嘉许名单"); }
    s.stage = null; s.sem = null;
    s.phase = "crossroads";
  },

  rollEvent(s, table) {
    const pool = table.filter(e => !e.cond || e.cond(s));
    if (!pool.length) return null;
    const lucky = this.mod(s, "luck");
    let total = 0;
    const weighted = pool.map(e => {
      let w = e.weight * (e.good ? lucky : 1 / lucky);
      total += w; return { e: e, w: total };
    });
    if (Math.random() > 0.75) return null;             // 不是每次都触发
    const r = Math.random() * total;
    const hit = weighted.find(x => r <= x.w) || weighted[weighted.length - 1];
    const text = hit.e.run(s);
    this.log(s, text, hit.e.good ? "good" : "bad");
    return text;
  },

  /* ------------------------- 毕业十字路口 ------------------------- */
  crossroads(s) {
    const out = { study: this.trackOptions(s), canStartup: this.startupCheck(s) };
    return out;
  },

  startupCheck(s) {
    const need = 20000;
    if (s.s.money < need) return { ok: false, why: `创业本金不足（至少 ${this.money(need)}，你有 ${this.money(s.s.money)}）` };
    if (s.s.skillBiz < 25 && this.majorStat(s) < 45) return { ok: false, why: "商业能力 25+ 或专业能力 45+ 才敢下海" };
    return { ok: true };
  },

  /* ------------------------- 人才市场 ------------------------- */
  employability(s) {
    const eduBonus = { "高中": 0, "大专": 10, "本科": 22, "硕士": 34 }[s.edu] || 0;
    return Math.round(
      s.gpa.value * 11 + this.majorStat(s) * 0.5 + s.s.skillComm * 0.2 +
      s.s.network * 0.25 + s.s.reputation * 0.4 +
      s.record.internships * 8 + s.record.awards.length * 4 + eduBonus
    );
  },

  jobOffers(s) {
    const score = this.employability(s);
    return JOBS.map(j => {
      let ok = true, why = "";
      if (j.edu.indexOf(s.edu) < 0) { ok = false; why = `学历不符（要 ${j.edu.join(" / ")}）`; }
      else if (j.majors && j.majors.indexOf(s.lastMajorId) < 0) { ok = false; why = "专业不对口"; }
      else if (score < (j.score || 0)) { ok = false; why = `竞争力不足（要 ${j.score}，你 ${score}）`; }
      else if (j.req) {
        for (const k in j.req) if (s.s[k] < j.req[k]) { ok = false; why = `${this.statName(k)} 不足 ${j.req[k]}`; }
      }
      // 起薪按竞争力浮动 ±20%
      const salary = Math.round(j.salary * (0.9 + this.clamp(score / 200, 0, 0.3)));
      return { job: j, ok: ok, why: why, salary: salary };
    }).sort((a, b) => (b.ok - a.ok) || (b.salary - a.salary));
  },

  statName(k) {
    return { knowledge: "知识", skillTech: "技术能力", skillBiz: "商业能力", skillComm: "沟通能力",
      network: "人脉", reputation: "声望", health: "健康", energy: "精力", stress: "压力" }[k] || k;
  },

  takeJob(s, jobId) {
    const offer = this.jobOffers(s).find(o => o.job.id === jobId);
    if (!offer || !offer.ok) return { ok: false, msg: offer ? offer.why : "没有这份工作" };
    const j = offer.job;
    s.job = { id: j.id, name: j.name, level: 0, title: j.levels[0], salary: offer.salary, perf: 0, years: 0 };
    s.record.jobs.push(`${j.levels[0]}（${j.name}）`);
    s.phase = "career";
    s.company = null;
    this.startCareerYear(s);
    this.log(s, `✅ 你入职【${j.name}】，职位 ${j.levels[0]}，年薪 ${this.money(offer.salary)}。`, "good");
    this.mark(s, `入职 ${j.name} · 年薪 ${this.money(offer.salary)}`);
    return { ok: true };
  },

  /* ------------------------- 上班族：每年 ------------------------- */
  startCareerYear(s) {
    s.year = { ap: 2, apMax: 2, notes: [], used: {} };
  },

  careerActions(s) {
    return CAREER_ACTIONS.map(a => {
      let ok = true, why = "";
      if (s.year.ap <= 0) { ok = false; why = "今年的时间用完了"; }
      else if (a.cost && a.cost.money > s.s.money) { ok = false; why = `钱不够（${this.money(a.cost.money)}）`; }
      else if (a.id === "invest" && s.s.money < 10000) { ok = false; why = "存款太少，先攒钱"; }
      else if (a.id === "school" && s.edu === "硕士") { ok = false; why = "已经是最高学历了"; }
      else if (a.id === "school" && s.age > 38) { ok = false; why = "年纪大了，学校名额给年轻人吧"; }
      else if (a.id === "hunt" && !s.job) { ok = true; }
      else if (a.id === "found") { const c = this.startupCheck(s); ok = c.ok; why = c.why; }
      return { action: a, ok: ok, why: why };
    });
  },

  careerAction(s, id) {
    const a = CAREER_ACTIONS.find(x => x.id === id);
    const av = this.careerActions(s).find(x => x.action.id === id);
    if (!av.ok) return { ok: false, msg: av.why };
    if (a.cost && a.cost.money) this.chg(s, { money: -a.cost.money });

    const times = s.year.used[id] || 0;
    const scale = times === 0 ? 1 : 0.6;                  // 一年内重复做同一件事，效果打折
    let msg = `${a.icon} ${a.name}${times ? "（重复，效果打折）" : ""}`;
    if (a.special === "invest") {
      const stake = Math.round(s.s.money * 0.3);
      const luck = this.mod(s, "luck");
      const roi = this.rf(-0.35, 0.55) + (s.s.skillBiz / 400) + (luck - 1) * 0.1;
      const gain = Math.round(stake * roi);
      this.chg(s, { money: gain, skillBiz: 3, stress: gain < 0 ? 5 : -2 });
      msg = `📈 你投入 ${this.money(stake)} 投资，${gain >= 0 ? "赚了 " : "亏了 "}${this.money(Math.abs(gain))}。`;
    } else if (a.special === "sidebiz") {
      const income = Math.round((s.s.skillBiz * 900 + s.s.network * 500) * this.rf(0.7, 1.4) * this.mod(s, "money"));
      this.chg(s, { money: income, skillBiz: 5, stress: 8, health: -3 });
      msg = `🏪 副业这一年净赚 ${this.money(income)}。`;
    } else if (a.special === "found") {
      return { ok: true, found: true, msg: "🚀 你决定辞职，自己干。" };   // 交给界面确认公司名
    } else if (a.special === "hunt") {
      s.year.hunting = true;
      msg = "🪜 你更新了简历，开始看外面的机会（年底可挑新工作）。";
    } else if (a.special === "school") {
      s.year.school = true;
      msg = "🏫 你决定回学校进修（年底入学）。";
    } else {
      const eff = {};
      for (const k in a.eff) if (k !== "perf") eff[k] = a.eff[k];
      this.chg(s, eff, scale);
      if (a.eff.perf && s.job) s.job.perf += a.eff.perf * scale;   // 绩效只算在职位上
    }
    s.year.ap--;
    s.year.used[id] = (s.year.used[id] || 0) + 1;
    this.log(s, msg, "act");
    return { ok: true, msg: msg };
  },

  /** 升职所需的绩效 */
  promotionNeed(s) { return s.job ? 80 + s.job.level * 45 : 0; },

  /** 年度结算 */
  endCareerYear(s) {
    const notes = [];
    if (s.job) {
      const j = JOBS.find(x => x.id === s.job.id);
      // 收支
      const income = s.job.salary;
      const living = Math.round(28000 + s.job.salary * 0.22 + (s.flags.kid ? 24000 : 0) + (s.flags.married ? 12000 : 0));
      let net = income - living;
      if (s.s.debt > 0) {                                  // 还学贷
        const pay = Math.min(s.s.debt, Math.max(6000, Math.round(income * 0.12)));
        s.s.debt -= pay; net -= pay;
        notes.push(`偿还学贷 ${this.money(pay)}，剩余负债 ${this.money(s.s.debt)}。`);
      }
      this.chg(s, { money: net });
      notes.push(`年薪 ${this.money(income)}，生活开销 ${this.money(living)}，结余 ${this.money(net)}。`);

      // 晋升
      s.job.years++;
      const needed = this.promotionNeed(s);
      if (s.job.perf >= needed && s.job.level < j.levels.length - 1) {
        s.job.level++; s.job.perf = 0;
        s.job.title = j.levels[s.job.level];
        s.job.salary = Math.round(s.job.salary * j.growth);
        s.record.jobs.push(`${s.job.title}（${j.name}）`);
        notes.push(`🎊 升职！你现在是 ${s.job.title}，年薪 ${this.money(s.job.salary)}。`);
        this.chg(s, { reputation: 6, happiness: 6 });
        this.mark(s, `晋升 ${s.job.title} · 年薪 ${this.money(s.job.salary)}`);
      } else if (s.job.level >= j.levels.length - 1) {
        s.job.salary = Math.round(s.job.salary * 1.05);     // 到顶了，只有微调
      } else {
        s.job.perf = Math.round(s.job.perf * 0.85);         // 绩效会衰减
        s.job.salary = Math.round(s.job.salary * 1.02);      // 年资加薪
        notes.push(`绩效累计 ${Math.round(s.job.perf)} / ${needed}，还没到升职门槛。`);
      }
    } else {
      // 失业年
      const living = 30000;
      this.chg(s, { money: -living, stress: 10, happiness: -5 });
      notes.push(`没有工作，靠积蓄生活（−${this.money(living)}）。`);
    }

    // 房产增值
    if (s.flags.house) { const up = Math.round(s.flags.house * this.rf(0.01, 0.09)); s.flags.house += up; }

    // 随机事件
    const ev = this.rollEvent(s, CAREER_EVENTS);
    if (ev) notes.push(ev);

    // 身体与压力
    const wear = 0.8 + Math.max(0, (s.age - 32) * 0.09) + s.s.stress / 80;
    this.chg(s, { health: -wear, stress: -4 });
    if (s.s.health <= 20) {
      notes.push("⚠️ 身体濒临崩溃，医生警告你必须休息！");
      this.chg(s, { happiness: -10 });
    }
    if (s.s.stress >= 90 && s.job) {
      notes.push("🥀 你严重 burnout，被迫停职休养一年。");
      s.job.perf = Math.round(s.job.perf * 0.5);
      this.chg(s, { stress: -35, health: 5, happiness: -8 });
    }

    s.age++; s.careerYear++;

    if (s.s.health <= 0) {                                 // 身体先垮了，游戏提前结束
      s.flags.collapsed = true;
      notes.push("💔 你在体检室听到坏消息 —— 医生要你立刻停下所有工作。");
      this.finish(s);
      return { notes: notes, next: "end" };
    }

    // 年底分支：回校 / 跳槽 / 结束
    let next = "career";
    if (s.year.school) next = "school";
    else if (s.year.hunting || !s.job) next = "jobmarket";
    if (s.age >= s.retireAge) next = "end";

    if (next === "school") { s.phase = "track"; }
    else if (next === "jobmarket") { s.phase = "jobmarket"; }
    else if (next === "end") { this.finish(s); }
    else { s.phase = "career"; this.startCareerYear(s); }

    return { notes: notes, next: next };
  },

  /* ------------------------- 创业 ------------------------- */
  foundCompany(s, name) {
    const chk = this.startupCheck(s);
    if (!chk.ok) return { ok: false, msg: chk.why };
    const cash = Math.round(s.s.money * 0.8);
    s.s.money -= cash;
    s.company = {
      name: (name || "无名科技").slice(0, 16),
      cash: cash, product: 10 + Math.round(this.majorStat(s) / 4), marketing: 5,
      team: 1, traction: 1, revenue: 0, valuation: 0, equity: 1, years: 0, listed: false, redYears: 0
    };
    s.job = null;
    s.phase = "startup";
    this.startCareerYear(s);
    this.log(s, `🚀 你成立了【${s.company.name}】，投入 ${this.money(cash)} 启动资金。`, "good");
    this.mark(s, `创业：成立 ${s.company.name}`);
    return { ok: true };
  },

  startupActions(s) {
    const c = s.company;
    return STARTUP_ACTIONS.map(a => {
      let ok = true, why = "";
      if (s.year.ap <= 0) { ok = false; why = "今年的时间用完了"; }
      else if (a.cash < 0 && c.cash + a.cash < -250000) { ok = false; why = "现金流撑不住了"; }
      else if (a.id === "raise") {
        if (c.product < 50) { ok = false; why = "产品力不足 50，投资人不买单"; }
        else if (c.revenue <= 0 && s.s.network < 40) { ok = false; why = "没有营收也没人脉，没人愿意投"; }
        else if (c.equity < 0.30) { ok = false; why = "股份稀释太多，不能再融了"; }
      } else if (a.id === "cut" && c.team <= 1) { ok = false; why = "只剩你一个人，没什么可裁"; }
      return { action: a, ok: ok, why: why };
    });
  },

  startupAction(s, id) {
    const a = STARTUP_ACTIONS.find(x => x.id === id), c = s.company;
    const av = this.startupActions(s).find(x => x.action.id === id);
    if (!av.ok) return { ok: false, msg: av.why };
    c.cash += a.cash;
    let msg = `${a.icon} ${a.name}`;

    if (a.id === "product") {
      const up = 8 + Math.round(this.majorStat(s) / 10) + Math.round(c.team * 0.8);
      c.product += up; this.chg(s, { stress: 6, major: 2 });
      msg = `🛠️ 产品力 +${up}（现在 ${Math.round(c.product)}）。`;
    } else if (a.id === "hire") {
      c.team += 2; this.chg(s, { skillComm: 3 });
      msg = `🧑‍💻 团队增至 ${c.team} 人，年薪成本也上去了。`;
    } else if (a.id === "market") {
      const up = 12 + Math.round(s.s.skillComm / 12);
      c.marketing += up; msg = `📣 营销力 +${up}（现在 ${Math.round(c.marketing)}）。`;
    } else if (a.id === "sell") {
      const up = Math.round((s.s.skillBiz + s.s.network) / 8);
      c.marketing += up; c.traction *= 1.15;
      this.chg(s, { network: 5, skillBiz: 3, stress: 7, health: -3 });
      msg = `👞 你亲自跑客户，营销力 +${up}、客户规模 +15%，也认识了更多人。`;
    } else if (a.id === "raise") {
      const val = this.valuation(s) || Math.max(2000000, c.product * 60000);
      const raise = Math.round(val * 0.22);
      const dilution = 0.25;
      c.cash += raise; c.equity = +(c.equity * (1 - dilution)).toFixed(4);
      c.valuation = val;
      this.chg(s, { reputation: 8, network: 6, stress: 8 });
      msg = `💵 融资成功：以 ${this.money(val)} 估值拿到 ${this.money(raise)}，你的股份稀释到 ${(c.equity * 100).toFixed(1)}%。`;
      this.mark(s, `${c.name} 完成融资，估值 ${this.money(val)}`);
    } else if (a.id === "cut") {
      c.team = Math.max(1, c.team - 1); c.product = Math.max(5, c.product - 3);
      this.chg(s, { happiness: -4, stress: 4 });
      msg = `✂️ 裁员一人、砍掉开支，现金流缓了一口气。`;
    } else if (a.id === "rest") {
      this.chg(s, { stress: -16, health: 9, happiness: 8, money: -3000 });
      msg = `🌴 你终于休了几天假。`;
    }
    s.year.ap--;
    this.log(s, msg, "act");
    return { ok: true, msg: msg };
  },

  valuation(s) {
    const c = s.company;
    return Math.round(c.revenue * 4.5 + c.product * 25000 + Math.max(0, c.cash));
  },

  endStartupYear(s) {
    const c = s.company, notes = [];
    c.years++;

    /* 成长模型：客户规模会复利。产品力与营销力决定成长率，天然有 12% 流失率。 */
    let growth = c.product / 430 + c.marketing / 300 + c.team * 0.006 +
      s.s.skillBiz / 700 - 0.15 + (this.mod(s, "luck") - 1) * 0.06;
    growth = this.clamp(growth, -0.40, 0.60) * this.rf(0.80, 1.20);
    c.traction = Math.max(0.4, c.traction * (1 + growth));

    // 市场意外：竞争对手抢客 / 意外爆红
    const roll = Math.random();
    if (roll < 0.22) {
      c.traction *= 0.72; c.product = Math.max(5, c.product - 5);
      notes.push("😰 竞争对手推出同类产品，客户跑了一批。");
      this.chg(s, { stress: 8, happiness: -4 });
    } else if (roll > 0.90 + (1 - this.mod(s, "luck")) * 0.05) {
      c.traction *= 1.30;
      notes.push("🎉 产品被媒体 / 社群自发传播，客户暴增！");
      this.chg(s, { happiness: 6, reputation: 5 });
    }

    const rev = Math.round(c.traction * 100000);
    const gross = rev * 0.45;
    const payroll = c.team * 95000;
    const opex = Math.round(c.marketing * 2000 + 60000);
    const profit = Math.round(gross - payroll - opex);
    c.revenue = rev; c.cash += profit;
    c.marketing = Math.round(c.marketing * 0.82);            // 营销效果会衰减
    c.valuation = this.valuation(s);
    notes.push(`客户规模 ${growth >= 0 ? "+" : ""}${Math.round(growth * 100)}%，年营收 ${this.money(rev)}。`);
    notes.push(`毛利 ${this.money(gross)} − 人力 ${this.money(payroll)} − 开支 ${this.money(opex)} = ${profit >= 0 ? "净利 " : "净亏 "}${this.money(Math.abs(profit))}。`);
    notes.push(`公司现金 ${this.money(c.cash)}，估值 ${this.money(c.valuation)}，你持股 ${(c.equity * 100).toFixed(1)}%。`);

    // 创始人个人收支
    const salary = Math.max(30000, Math.min(180000, Math.round(rev * 0.05)));
    const living = 30000 + (s.flags.kid ? 24000 : 0);
    if (c.cash > salary) { c.cash -= salary; this.chg(s, { money: salary - living }); }
    else { this.chg(s, { money: -living, stress: 8 }); notes.push("公司发不出你的薪水，你在吃老本。"); }

    this.chg(s, { health: -1.2 - s.s.stress / 80, stress: 4, reputation: rev > 3000000 ? 4 : 1 });

    const ev = this.rollEvent(s, CAREER_EVENTS);
    if (ev) notes.push(ev);

    s.age++; s.careerYear++;

    if (s.s.health <= 0) {
      s.flags.collapsed = true;
      notes.push("💔 长期硬撑，你的身体先倒下了。公司只能交给别人。");
      this.finish(s);
      return { notes: notes, next: "end" };
    }

    // 破产判定
    if (c.cash < -250000) {
      c.redYears++;
      if (c.redYears >= 2) {
        notes.push(`💀 资金链断了，【${c.name}】宣布结业。`);
        this.log(s, `💀 创业失败：${c.name} 结业，负债由你承担。`, "bad");
        this.mark(s, `${c.name} 结业，创业失败`);
        s.s.debt += Math.abs(Math.round(c.cash));
        s.company = null; s.phase = "jobmarket";
        this.chg(s, { happiness: -18, stress: 15, skillBiz: 8 });
        return { notes: notes, next: "jobmarket" };
      }
      notes.push("⚠️ 已经连续烧钱，明年再这样就撑不住了。");
    } else c.redYears = 0;

    // 上市
    if (!c.listed && c.valuation >= 400000000 && rev >= 60000000) {
      c.listed = true;
      this.chg(s, { reputation: 30, happiness: 20 });
      notes.push(`🔔 【${c.name}】成功上市！你的持股价值 ${this.money(c.valuation * c.equity)}。`);
      this.log(s, `🔔 ${c.name} 敲钟上市，你成了名副其实的企业家。`, "good");
      this.mark(s, `${c.name} 上市，市值 ${this.money(c.valuation)}`);
    }

    if (s.age >= s.retireAge) { this.finish(s); return { notes: notes, next: "end" }; }
    s.phase = "startup"; this.startCareerYear(s);
    return { notes: notes, next: "startup" };
  },

  /* ------------------------- 结局 ------------------------- */
  netWorth(s) {
    const co = s.company ? s.company.valuation * s.company.equity : 0;
    return Math.round(s.s.money + (s.flags.house || 0) + co - s.s.debt);
  },

  finish(s) {
    const w = this.netWorth(s);
    const j = s.job ? JOBS.find(x => x.id === s.job.id) : null;
    const topJob = j && s.job.level >= j.levels.length - 1;
    const prestige = j ? j.prestige + s.job.level : 0;
    const co = s.company;

    const score = Math.round(
      this.clamp(w / 200000, 0, 60) +               // 财富（最多 60）
      prestige * 2 +                                // 职位声望
      s.s.reputation * 0.25 + s.s.happiness * 0.25 + s.s.health * 0.15 +
      s.record.degrees.length * 4 +
      (co && co.listed ? 25 : 0)
    );

    let title, blurb;
    if (s.flags.collapsed || s.s.health <= 8) {
      title = "🩺 赢了数字，输了身体";
      blurb = `${s.age} 岁，净资产 ${this.money(w)}${s.job ? `，职位 ${s.job.title}` : ""}。` +
        `但健康只剩 ${Math.round(s.s.health)} —— 医生让你把一切停下。钱可以再赚，身体不能重来。`;
    } else if (co && co.listed && w >= 100000000) {
      title = "🏆 人生赢家：商业传奇";
      blurb = `你把 ${co.name} 从一间小公司做成上市企业，身价 ${this.money(w)}。当年那个中学毕业生，如今是别人 PPT 里的案例。`;
    } else if (co && w >= 20000000) {
      title = "🥇 人生赢家：成功企业家";
      blurb = `${co.name} 年营收 ${this.money(co.revenue)}，你持股 ${(co.equity * 100).toFixed(1)}%，身价 ${this.money(w)}。老板这条路，你走通了。`;
    } else if (topJob && prestige >= 12) {
      title = "🥇 人生赢家：登顶高管";
      blurb = `你做到了 ${s.job.title}，年薪 ${this.money(s.job.salary)}，净资产 ${this.money(w)}。从校园一路爬到顶，这份履历没人敢小看。`;
    } else if (co && w >= 5000000) {
      title = "🥈 有规模的老板";
      blurb = `${co.name} 年营收 ${this.money(co.revenue)}，估值 ${this.money(co.valuation)}，你的身价 ${this.money(w)}。没上市，但这是实打实自己挣的。`;
    } else if (s.edu === "硕士" && s.s.reputation >= 65) {
      title = "🎖️ 领域专家";
      blurb = `${s.job ? s.job.title : "自由研究者"}，声望 ${Math.round(s.s.reputation)}。你没成为最有钱的人，但成了最懂行的人之一。`;
    } else if (s.job && s.job.salary >= 550000) {
      title = "💼 高薪精英";
      blurb = `${s.job.title}，年薪 ${this.money(s.job.salary)}，净资产 ${this.money(w)}。中产上层，日子过得体面。`;
    } else if (s.s.health < 30) {
      title = "🩺 用健康换来的成绩";
      blurb = `净资产 ${this.money(w)}，但健康只剩 ${Math.round(s.s.health)}。医生说你该慢下来了 —— 有些账，年轻时欠的要老了还。`;
    } else if (co) {
      title = "🏬 自己当老板";
      blurb = `${co.name} 年营收 ${this.money(co.revenue)}，规模不大但活着，你的身价 ${this.money(w)}。不用看老板脸色，这也是一种成功。`;
    } else if (s.job && s.job.salary >= 180000 && s.s.health >= 45) {
      title = "🙂 一份不错的工作";
      blurb = `${s.job.title}，年薪 ${this.money(s.job.salary)}，净资产 ${this.money(w)}。不是首富，但稳定、体面、有余裕 —— 很多人求的就是这个。`;
    } else if (w < 0) {
      title = "😔 负债人生";
      blurb = `负债 ${this.money(-w)}。这一局不顺，但重开一次未必不能翻身。`;
    } else if (s.job) {
      title = "👷 平凡打工人";
      blurb = `${s.job.title}，年薪 ${this.money(s.job.salary)}，净资产 ${this.money(w)}。日子过得去，只是没什么惊喜。`;
    } else {
      title = "🌫️ 前路未定";
      blurb = `没有稳定工作，净资产 ${this.money(w)}。人生还长，但这一局到这里了。`;
    }

    const ach = [];
    if (s.record.degrees.length >= 2) ach.push("📚 学历叠满：念了两个以上学位");
    if (s.gpa.value >= 3.7) ach.push("🏅 学霸认证：GPA 3.7+");
    if (s.record.internships >= 3) ach.push("💼 实习狂人：3 段以上实习");
    if (s.record.awards.length) ach.push("🏆 获奖者：" + s.record.awards.join("、"));
    if (co && co.listed) ach.push("🔔 敲钟上市");
    if (s.flags.house) ach.push("🏘️ 有房一族");
    if (s.flags.married) ach.push("💍 已婚");
    if (s.flags.kid) ach.push("👶 当爸妈了");
    if (s.s.debt === 0 && s.record.degrees.length) ach.push("🧾 学贷清零");
    if (s.s.health >= 70) ach.push("💪 身体倍儿棒");
    if (s.s.happiness >= 80) ach.push("😄 心满意足");
    if (topJob) ach.push("🪜 爬到职涯顶端");

    s.ending = {
      title: title, blurb: blurb, score: score, worth: w,
      achievements: ach,
      stats: {
        edu: s.edu, gpa: +s.gpa.value.toFixed(2),
        job: s.job ? s.job.title : (co ? `${co.name} 创办人` : "无"),
        salary: s.job ? s.job.salary : 0,
        company: co ? { name: co.name, valuation: co.valuation, equity: co.equity, listed: co.listed, revenue: co.revenue } : null
      }
    };
    s.phase = "end";
    this.log(s, `🏁 ${s.age} 岁盘点：${title}（综合评分 ${score}）`, "good");
  }
};

/* node 环境下导出，方便跑模拟测试 */
if (typeof module !== "undefined" && module.exports) module.exports = VL;
