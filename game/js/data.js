/**
 * ======================= 虚拟人生 · 数据表 =======================
 * 所有可调整的游戏内容（天赋、家境、升学路线、专业课程、行动、
 * 随机事件、职业、创业动作）都在这个文件里，方便平衡性调整。
 * 逻辑请见 engine.js，界面请见 ui.js。
 */

/* ---------------- 天赋（开局二选一之一） ---------------- */
const TALENTS = [
  { id: "scholar", name: "天生学霸", icon: "🧠",
    desc: "学习效率 +30%，但不太会来事（人际 −20%）",
    mods: { knowledge: 1.30, social: 0.80 }, bonus: { knowledge: 5 } },
  { id: "social", name: "社交达人", icon: "🤝",
    desc: "人际与声望 +35%，读书稍慢（学习 −10%）",
    mods: { social: 1.35, knowledge: 0.90 }, bonus: { network: 10, skillComm: 5 } },
  { id: "geek", name: "技术极客", icon: "💻",
    desc: "专业技术 +35%，但容易钻牛角尖（压力 +15%）",
    mods: { tech: 1.35, stress: 1.15 }, bonus: { skillTech: 10 } },
  { id: "hustler", name: "生意头脑", icon: "💰",
    desc: "赚钱 +35%，商业技能 +30%",
    mods: { money: 1.35, biz: 1.30 }, bonus: { skillBiz: 10 } },
  { id: "iron", name: "铁人体质", icon: "🏋️",
    desc: "行动消耗精力 −20%，健康恢复 +30%",
    mods: { energyCost: 0.80, health: 1.30 }, bonus: { health: 10 } },
  { id: "lucky", name: "天生好运", icon: "🍀",
    desc: "好事件更常发生，考试运更好",
    mods: { luck: 1.60 }, bonus: { luck: 20 } }
];

/* ---------------- 家庭背景 ---------------- */
const ORIGINS = [
  { id: "rich", name: "富裕家庭", icon: "🏡",
    desc: "起始 20,000 元，每学期家用 4,000；但父母期望高（压力 +10%）",
    money: 20000, allowance: 4000, mods: { stress: 1.10 }, bonus: { network: 8 } },
  { id: "middle", name: "小康家庭", icon: "🏠",
    desc: "起始 6,000 元，每学期家用 1,500，平平稳稳",
    money: 6000, allowance: 1500, mods: {}, bonus: {} },
  { id: "poor", name: "清寒家庭", icon: "🛖",
    desc: "起始 800 元，每学期家用 300；但抗压 −20%、打工收入 +20%",
    money: 800, allowance: 300, mods: { stress: 0.80, money: 1.20 }, bonus: { health: 5 } }
];

/* ---------------- 升学 / 就业路线 ---------------- */
const TRACKS = {
  work: { id: "work", name: "直接出社会打工", icon: "🧰", edu: "高中",
          desc: "不再升学，马上找工作。省钱，但学历天花板很低。", semesters: 0, tuition: 0 },
  diploma: { id: "diploma", name: "技术学院（大专 · 2 年）", icon: "🔧", edu: "大专",
          desc: "4 个学期，学费 2,000/学期。门槛低、上手快，毕业后还能专升本。",
          semesters: 4, tuition: 2000, minKnowledge: 30 },
  degree: { id: "degree", name: "大学（本科 · 4 年）", icon: "🎓", edu: "本科",
          desc: "8 个学期，学费 4,500/学期。好工作的入场券，也能继续读研。",
          semesters: 8, tuition: 4500, minKnowledge: 38 },
  upgrade: { id: "upgrade", name: "专升本（插班本科 · 2 年）", icon: "📈", edu: "本科",
          desc: "4 个学期，学费 5,000/学期。大专毕业且 GPA ≥ 2.5 才能报读。",
          semesters: 4, tuition: 5000, minGpa: 2.5 },
  master: { id: "master", name: "研究生（硕士 · 2 年）", icon: "🔬", edu: "硕士",
          desc: "4 个学期，学费 6,000/学期。GPA ≥ 3.2 才收。研究型高薪职位的钥匙。",
          semesters: 4, tuition: 6000, minGpa: 3.2 }
};

/* ---------------- 专业与课程（修读课程 = 拿学分 + 涨技能） ----------------
   stat: 该课程主要考核的能力  diff: 难度（越高越难拿 A） */
const MAJORS = {
  cs: { id: "cs", name: "计算机科学", icon: "💻", main: "skillTech",
    desc: "编程、算法、系统。走技术路线或自己做产品创业。",
    courses: [
      { name: "程序设计基础", stat: "skillTech", diff: 28 },
      { name: "离散数学",     stat: "knowledge", diff: 36 },
      { name: "数据结构",     stat: "skillTech", diff: 40 },
      { name: "计算机组织",   stat: "knowledge", diff: 38 },
      { name: "算法分析",     stat: "skillTech", diff: 48 },
      { name: "数据库系统",   stat: "skillTech", diff: 40 },
      { name: "操作系统",     stat: "knowledge", diff: 50 },
      { name: "计算机网络",   stat: "knowledge", diff: 44 },
      { name: "软件工程",     stat: "skillComm", diff: 34 },
      { name: "人工智能与机器学习", stat: "skillTech", diff: 54 },
      { name: "云端与分布式系统",   stat: "skillTech", diff: 52 },
      { name: "毕业专题（Final Year Project）", stat: "skillTech", diff: 50 }
    ] },
  eng: { id: "eng", name: "工程（机电）", icon: "⚙️", main: "skillTech",
    desc: "扎实的硬功夫，工厂、制造、自动化都要人。",
    courses: [
      { name: "工程数学",   stat: "knowledge", diff: 40 },
      { name: "工程力学",   stat: "knowledge", diff: 42 },
      { name: "电路分析",   stat: "skillTech", diff: 44 },
      { name: "材料科学",   stat: "knowledge", diff: 36 },
      { name: "热力学",     stat: "knowledge", diff: 46 },
      { name: "机械设计",   stat: "skillTech", diff: 42 },
      { name: "控制系统",   stat: "skillTech", diff: 50 },
      { name: "制造工艺",   stat: "skillTech", diff: 38 },
      { name: "工业自动化", stat: "skillTech", diff: 48 },
      { name: "工程项目管理", stat: "skillComm", diff: 36 },
      { name: "工业实训",   stat: "skillTech", diff: 34 },
      { name: "毕业设计",   stat: "skillTech", diff: 50 }
    ] },
  biz: { id: "biz", name: "商业管理", icon: "📊", main: "skillBiz",
    desc: "管理、营销、创业学。想当企业家最顺的一条路。",
    courses: [
      { name: "管理学原理", stat: "skillBiz",  diff: 26 },
      { name: "微观经济学", stat: "knowledge", diff: 34 },
      { name: "会计学",     stat: "skillBiz",  diff: 40 },
      { name: "市场营销",   stat: "skillComm", diff: 32 },
      { name: "组织行为学", stat: "skillComm", diff: 30 },
      { name: "财务管理",   stat: "skillBiz",  diff: 44 },
      { name: "商业法规",   stat: "knowledge", diff: 38 },
      { name: "营运管理",   stat: "skillBiz",  diff: 40 },
      { name: "商业策略",   stat: "skillBiz",  diff: 46 },
      { name: "创业学",     stat: "skillBiz",  diff: 36 },
      { name: "国际商务",   stat: "skillComm", diff: 40 },
      { name: "毕业商业计划书", stat: "skillBiz", diff: 48 }
    ] },
  fin: { id: "fin", name: "金融", icon: "📈", main: "skillBiz",
    desc: "投资、风控、资本市场。数字敏感的人最吃香。",
    courses: [
      { name: "金融学导论", stat: "skillBiz",  diff: 30 },
      { name: "统计学",     stat: "knowledge", diff: 40 },
      { name: "宏观经济学", stat: "knowledge", diff: 42 },
      { name: "财务报表分析", stat: "skillBiz", diff: 44 },
      { name: "投资学",     stat: "skillBiz",  diff: 46 },
      { name: "公司金融",   stat: "skillBiz",  diff: 48 },
      { name: "风险管理",   stat: "knowledge", diff: 46 },
      { name: "金融衍生品", stat: "knowledge", diff: 54 },
      { name: "金融科技",   stat: "skillTech", diff: 44 },
      { name: "商业谈判",   stat: "skillComm", diff: 34 },
      { name: "投资组合实战", stat: "skillBiz", diff: 50 },
      { name: "毕业研究报告", stat: "skillBiz", diff: 48 }
    ] },
  med: { id: "med", name: "医学（临床）", icon: "🩺", main: "knowledge",
    desc: "最难念、最烧钱，但毕业就是社会尊敬的职业。",
    courses: [
      { name: "解剖学",   stat: "knowledge", diff: 50 },
      { name: "生理学",   stat: "knowledge", diff: 52 },
      { name: "生物化学", stat: "knowledge", diff: 54 },
      { name: "微生物学", stat: "knowledge", diff: 50 },
      { name: "药理学",   stat: "knowledge", diff: 56 },
      { name: "病理学",   stat: "knowledge", diff: 56 },
      { name: "内科学",   stat: "knowledge", diff: 58 },
      { name: "外科学",   stat: "skillTech", diff: 58 },
      { name: "儿科与妇产", stat: "knowledge", diff: 54 },
      { name: "医患沟通", stat: "skillComm", diff: 32 },
      { name: "临床实习 I", stat: "skillTech", diff: 50 },
      { name: "临床实习 II", stat: "skillTech", diff: 52 }
    ] },
  art: { id: "art", name: "设计与创意", icon: "🎨", main: "skillComm",
    desc: "作品集就是你的文凭。自由度高，收入波动大。",
    courses: [
      { name: "设计基础",   stat: "skillComm", diff: 26 },
      { name: "色彩与构成", stat: "skillComm", diff: 30 },
      { name: "设计史",     stat: "knowledge", diff: 32 },
      { name: "数码绘图",   stat: "skillTech", diff: 34 },
      { name: "UI/UX 设计", stat: "skillTech", diff: 42 },
      { name: "品牌设计",   stat: "skillComm", diff: 40 },
      { name: "摄影与影像", stat: "skillComm", diff: 34 },
      { name: "动态设计",   stat: "skillTech", diff: 44 },
      { name: "设计管理",   stat: "skillBiz",  diff: 38 },
      { name: "作品集工作坊", stat: "skillComm", diff: 36 },
      { name: "客户提案实务", stat: "skillComm", diff: 40 },
      { name: "毕业展作品", stat: "skillComm", diff: 46 }
    ] }
};

/* ---------------- 每学期可做的行动（每学期 4 个行动点） ----------------
   eff.major 表示「本专业主修能力」；req 是门槛 */
const STUDY_ACTIONS = [
  { id: "class",    name: "认真上课做笔记", icon: "📖",
    desc: "出席率与课堂理解，期末考的基本盘",
    cost: { energy: 12 }, eff: { knowledge: 6, stress: 2 }, tag: "attend" },
  { id: "library",  name: "图书馆苦读", icon: "📚",
    desc: "知识涨得最快，但很耗精力也很闷",
    cost: { energy: 22 }, eff: { knowledge: 11, stress: 7 } },
  { id: "project",  name: "做课程项目 / 作品", icon: "🛠️",
    desc: "专业技能 + 知识，作品集也好看",
    cost: { energy: 20 }, eff: { knowledge: 4, major: 9, stress: 4 } },
  { id: "club",     name: "社团 / 学生会", icon: "🎭",
    desc: "人脉、声望与沟通能力",
    cost: { energy: 14, money: 150 }, eff: { network: 8, reputation: 4, skillComm: 5, stress: 1 } },
  { id: "parttime", name: "兼职打工", icon: "🧾",
    desc: "赚生活费，顺便练沟通",
    cost: { energy: 20 }, eff: { money: 1800, skillComm: 3, stress: 4 } },
  { id: "intern",   name: "争取实习", icon: "💼",
    desc: "需要专业能力 35+。履历含金量最高的一项",
    cost: { energy: 24 }, req: { major: 35 },
    eff: { money: 2500, major: 7, network: 9, reputation: 5, stress: 5 }, tag: "intern" },
  { id: "contest",  name: "竞赛 / 跟教授做研究", icon: "🏆",
    desc: "需要知识 55+。有机会拿奖与奖学金",
    cost: { energy: 24 }, req: { knowledge: 55 },
    eff: { major: 6, knowledge: 4, reputation: 8, stress: 6 }, tag: "contest" },
  { id: "side",     name: "搞副业（接单 / 小生意）", icon: "🚀",
    desc: "需要商业或专业能力 30+。练创业手感又赚钱",
    cost: { energy: 22 }, req: { any: 30 },
    eff: { money: 3200, skillBiz: 7, network: 4, stress: 5 } },
  { id: "gym",      name: "运动健身", icon: "🏃",
    desc: "身体是本钱，顺便减压",
    cost: { energy: 8 }, eff: { health: 8, stress: -8 } },
  { id: "rest",     name: "休息 / 娱乐 / 恋爱", icon: "🎮",
    desc: "减压提升幸福感，别把自己逼坏",
    cost: { energy: 4, money: 400 }, eff: { stress: -14, happiness: 6, network: 2 } }
];

/* ---------------- 求学期随机事件 ---------------- */
const STUDY_EVENTS = [
  { id: "scholarship", weight: 10, good: true,
    cond: s => s.gpa.value >= 3.4,
    run: s => { VL.chg(s, { money: 6000, reputation: 4, happiness: 5 });
      return "📜 成绩优异，你拿到了 6,000 元奖学金！"; } },
  { id: "mentor", weight: 8, good: true,
    cond: s => s.s.reputation >= 25,
    run: s => { VL.chg(s, { major: 6, network: 8 });
      return "👨‍🏫 一位教授看上你，愿意带你做项目 —— 专业能力与人脉提升。"; } },
  { id: "hackathon", weight: 8, good: true,
    cond: s => VL.majorStat(s) >= 40,
    run: s => { VL.chg(s, { reputation: 7, money: 2000, major: 4 });
      VL.addAward(s, "校际比赛获奖");
      return "🏅 你和同学组队参赛，居然拿了名次！奖金 2,000 元。"; } },
  { id: "flu", weight: 12, good: false,
    run: s => { VL.chg(s, { health: -10, energy: -15, money: -600 });
      return "🤒 你病了一场，医药费 600 元，身体也虚了。"; } },
  { id: "burnout", weight: 12, good: false,
    cond: s => s.s.stress >= 65,
    run: s => { VL.chg(s, { health: -12, knowledge: -4, happiness: -8 });
      return "😵 压力爆表，你整个学期都在硬撑，效率变差。记得留时间休息。"; } },
  { id: "phone", weight: 10, good: false,
    run: s => { VL.chg(s, { money: -1500, happiness: -3 });
      return "📱 手机 / 电脑坏了，修理与换机花了 1,500 元。"; } },
  { id: "scam", weight: 8, good: false,
    cond: s => s.s.money >= 3000,
    run: s => { const lost = Math.round(s.s.money * 0.25);
      VL.chg(s, { money: -lost, happiness: -6, knowledge: 2 });
      return `⚠️ 你被“稳赚不赔的投资”骗了 ${VL.money(lost)}。交学费买了一课。`; } },
  { id: "familyneed", weight: 8, good: false,
    cond: s => s.originId === "poor",
    run: s => { VL.chg(s, { money: -2000, stress: 8 });
      return "🏥 家里有急用，你把 2,000 元寄回家。压力上升，但你更懂事了。"; } },
  { id: "friend", weight: 10, good: true,
    run: s => { VL.chg(s, { network: 6, happiness: 5, stress: -5 });
      return "🍜 和室友深夜宵夜谈心，交到一辈子的朋友。"; } },
  { id: "leetcode", weight: 8, good: true,
    cond: s => s.stage && (s.stage.majorId === "cs" || s.stage.majorId === "eng"),
    run: s => { VL.chg(s, { skillTech: 6, knowledge: 3 });
      return "⌨️ 你连刷了一个月题库，手感明显变好。"; } },
  { id: "startupbug", weight: 7, good: true,
    cond: s => s.s.skillBiz >= 30,
    run: s => { VL.chg(s, { skillBiz: 6, network: 6, happiness: 3 });
      return "💡 你参加了创业营，第一次认真写了商业计划书。"; } },
  { id: "love", weight: 9, good: true,
    run: s => { VL.chg(s, { happiness: 10, stress: -8, money: -1200 });
      return "💕 你恋爱了。钱包瘦了一点，心情好了很多。"; } },
  { id: "quarrel", weight: 7, good: false,
    run: s => { VL.chg(s, { happiness: -7, stress: 8 });
      return "💔 一段关系无声结束，你消沉了一段时间。"; } }
];

/* ---------------- 职业表 ----------------
   salary 为年薪（元）。levels 是晋升阶梯，越往上薪水乘 growth。 */
const JOBS = [
  /* 高中学历 */
  { id: "factory", name: "工厂操作员", edu: ["高中"], score: 0, salary: 36000,
    levels: ["操作员", "组长", "生产线主管", "车间经理"], growth: 1.30, prestige: 1 },
  { id: "waiter", name: "餐饮服务员", edu: ["高中"], score: 0, salary: 30000,
    levels: ["服务员", "领班", "店长", "区域督导"], growth: 1.35, prestige: 1 },
  { id: "sales", name: "销售员", edu: ["高中", "大专"], score: 10, req: { skillComm: 20 }, salary: 42000,
    levels: ["销售员", "资深销售", "销售主管", "销售经理", "销售总监"], growth: 1.38, prestige: 2 },
  { id: "rider", name: "外卖骑手 / 自由职业", edu: ["高中"], score: 0, salary: 40000,
    levels: ["骑手", "站点老手", "站长"], growth: 1.20, prestige: 1 },

  /* 大专 */
  { id: "tech", name: "技术员", edu: ["大专"], score: 22, salary: 60000,
    levels: ["技术员", "资深技术员", "技术主管", "工程主管"], growth: 1.32, prestige: 3 },
  { id: "admin", name: "行政 / 人事助理", edu: ["大专"], score: 18, salary: 54000,
    levels: ["助理", "专员", "主管", "部门经理"], growth: 1.33, prestige: 3 },
  { id: "jrdev", name: "初级程序员", edu: ["大专"], score: 30, req: { skillTech: 45 }, salary: 84000,
    levels: ["初级程序员", "程序员", "资深程序员", "技术组长"], growth: 1.35, prestige: 4 },

  /* 本科 */
  { id: "swe", name: "软件工程师", edu: ["本科", "硕士"], majors: ["cs", "eng"], score: 55,
    req: { skillTech: 55 }, salary: 156000,
    levels: ["软件工程师", "资深工程师", "技术组长", "工程经理", "技术总监", "首席技术官 (CTO)"],
    growth: 1.34, prestige: 7 },
  { id: "engineer", name: "工程师", edu: ["本科", "硕士"], majors: ["eng", "cs"], score: 50,
    req: { skillTech: 50 }, salary: 138000,
    levels: ["工程师", "资深工程师", "项目工程师", "工程经理", "厂长", "营运副总裁"],
    growth: 1.32, prestige: 6 },
  { id: "mgmt", name: "管理培训生 (MT)", edu: ["本科", "硕士"], score: 60, req: { skillComm: 50 },
    salary: 132000,
    levels: ["管培生", "部门专员", "部门经理", "总监", "集团副总裁", "集团执行长 (CEO)"],
    growth: 1.40, prestige: 8 },
  { id: "analyst", name: "数据 / 金融分析师", edu: ["本科", "硕士"], majors: ["fin", "biz", "cs"],
    score: 58, salary: 144000,
    levels: ["分析师", "资深分析师", "经理", "高级经理", "财务总监 (CFO)"],
    growth: 1.38, prestige: 7 },
  { id: "designer", name: "设计师", edu: ["本科", "大专", "硕士"], majors: ["art"], score: 35,
    salary: 108000,
    levels: ["设计师", "资深设计师", "美术指导", "设计总监", "创意合伙人"],
    growth: 1.34, prestige: 5 },
  { id: "teacher", name: "中学教师", edu: ["本科", "硕士"], score: 40, salary: 96000,
    levels: ["教师", "资深教师", "科主任", "副校长", "校长"], growth: 1.25, prestige: 6 },
  { id: "doctor", name: "住院医师", edu: ["本科", "硕士"], majors: ["med"], score: 60, salary: 168000,
    levels: ["住院医师", "主治医师", "专科医师", "顾问医师", "医院部门主任"],
    growth: 1.36, prestige: 9 },

  /* 硕士 */
  { id: "research", name: "研究员", edu: ["硕士"], score: 78, salary: 180000,
    levels: ["研究员", "资深研究员", "项目首席", "研究部主任", "首席科学家"],
    growth: 1.33, prestige: 8 },
  { id: "ds", name: "数据科学家", edu: ["硕士", "本科"], majors: ["cs", "fin"], score: 80,
    req: { skillTech: 70 }, salary: 240000,
    levels: ["数据科学家", "资深数据科学家", "算法负责人", "AI 总监", "首席数据官"],
    growth: 1.35, prestige: 9 },
  { id: "lecturer", name: "大学讲师", edu: ["硕士"], score: 70, salary: 156000,
    levels: ["讲师", "高级讲师", "副教授", "教授", "院长"], growth: 1.28, prestige: 8 },
  { id: "consultant", name: "策略顾问", edu: ["硕士", "本科"], score: 88, req: { skillComm: 65 },
    salary: 288000,
    levels: ["顾问", "资深顾问", "项目经理", "合伙人", "资深合伙人"], growth: 1.42, prestige: 9 },
  { id: "ib", name: "投资银行分析师", edu: ["硕士", "本科"], majors: ["fin", "biz"], score: 90,
    req: { skillBiz: 70 }, salary: 300000,
    levels: ["分析师", "经理", "执行董事", "董事总经理", "区域主管"], growth: 1.45, prestige: 10 }
];

/* ---------------- 上班族每年可做的行动（每年 2 个行动点） ---------------- */
const CAREER_ACTIONS = [
  { id: "grind",   name: "拼命干活 / 主动加班", icon: "🔥",
    desc: "绩效大涨，但健康与压力代价不小",
    eff: { perf: 38, stress: 12, health: -6 } },
  { id: "steady",  name: "稳定输出，不出错", icon: "🧷",
    desc: "小幅绩效，稳稳当当",
    eff: { perf: 16, stress: 2 } },
  { id: "upskill", name: "进修 / 考专业证书", icon: "🎓",
    desc: "花钱花时间，但能力才是长期的本钱",
    cost: { money: 6000 }, eff: { perf: 10, major: 8, knowledge: 5, stress: 4 } },
  { id: "network", name: "拓展人脉 / 行业社群", icon: "🤝",
    desc: "跳槽、融资、拉客户都靠这个",
    cost: { money: 2000 }, eff: { network: 10, reputation: 5, stress: 2 } },
  { id: "sidebiz", name: "经营副业", icon: "🏪",
    desc: "收入看你的商业能力与人脉",
    eff: { stress: 8, skillBiz: 5 }, special: "sidebiz" },
  { id: "invest",  name: "理财投资", icon: "📈",
    desc: "投入存款的三成，盈亏自负",
    special: "invest" },
  { id: "family",  name: "陪家人 / 好好休假", icon: "🌴",
    desc: "减压、养身体、提升幸福感",
    cost: { money: 4000 }, eff: { stress: -20, health: 9, happiness: 9 } },
  { id: "hunt",    name: "看机会 / 跳槽面试", icon: "🪜",
    desc: "重新进入人才市场，挑一份更好的工作",
    special: "hunt" },
  { id: "found",   name: "辞职创业", icon: "🚀",
    desc: "把 80% 存款投进自己的公司，从此不再打工",
    special: "found" },
  { id: "school",  name: "在职进修学位", icon: "🏫",
    desc: "回学校念书（大专 / 本科 / 硕士），学历天花板才是关键",
    special: "school" }
];

/* ---------------- 创业公司每年可做的行动（每年 2 个行动点） ---------------- */
const STARTUP_ACTIONS = [
  { id: "product", name: "打磨产品", icon: "🛠️", desc: "产品力是估值的根本",
    cash: -40000 },
  { id: "hire",    name: "招兵买马", icon: "🧑‍💻", desc: "团队 +2 人，人多好办事，也更烧钱",
    cash: -30000 },
  { id: "market",  name: "市场营销", icon: "📣", desc: "营销力 +12，营收才跑得起来",
    cash: -70000 },
  { id: "sell",    name: "亲自跑客户", icon: "👞", desc: "免费拉单，靠你的商业能力与人脉",
    cash: 0 },
  { id: "raise",   name: "对外融资", icon: "💵", desc: "需要产品力 50+ 且有营收或人脉 40+。每轮稀释 25% 股份",
    cash: 0 },
  { id: "cut",     name: "降本增效", icon: "✂️", desc: "裁减一人、砍开支，换取现金流",
    cash: 30000 },
  { id: "rest",    name: "喘口气，陪家人", icon: "🌴", desc: "创业也是马拉松（不花公司的钱）",
    cash: 0 }
];

/* ---------------- 职涯随机事件 ---------------- */
const CAREER_EVENTS = [
  { id: "headhunt", weight: 10, good: true,
    cond: s => s.s.network >= 40 && s.job,
    run: s => { s.job.salary = Math.round(s.job.salary * 1.12);
      return `📞 猎头挖你，你顺势谈了加薪 12%，现在年薪 ${VL.money(s.job.salary)}。`; } },
  { id: "praise", weight: 10, good: true,
    cond: s => s.job && s.job.perf >= 60,
    run: s => { VL.chg(s, { reputation: 6, happiness: 4 }); s.job.perf += 15;
      return "🌟 你主导的项目大获好评，老板在全公司会议上点名表扬。"; } },
  { id: "bonus", weight: 10, good: true,
    cond: s => s.job,
    run: s => { const b = Math.round(s.job.salary * 0.15); VL.chg(s, { money: b, happiness: 4 });
      return `🎁 年终奖 ${VL.money(b)} 入账。`; } },
  { id: "layoff", weight: 8, good: false,
    cond: s => s.job && s.job.perf < 40,
    run: s => { const old = s.job.title; s.job = null; VL.chg(s, { happiness: -12, stress: 12 });
      return `📉 公司重组，你被裁员了（原职位：${old}）。下一年得重新找工作。`; } },
  { id: "badboss", weight: 10, good: false,
    cond: s => s.job,
    run: s => { VL.chg(s, { stress: 12, happiness: -6 });
      return "😤 换了个爱抢功的上司，这一年过得很憋。"; } },
  { id: "sick", weight: 10, good: false,
    run: s => { const c = 8000 + VL.ri(0, 12000); VL.chg(s, { health: -12, money: -c });
      return `🏥 身体出了点问题，医药费 ${VL.money(c)}。`; } },
  { id: "marry", weight: 9, good: true,
    cond: s => s.age >= 26 && !s.flags.married && s.s.happiness >= 45,
    run: s => { s.flags.married = true; const c = 60000; VL.chg(s, { money: -c, happiness: 15, stress: -8 });
      return `💍 你结婚了！婚礼花了 ${VL.money(c)}，但人生多了一个战友。`; } },
  { id: "baby", weight: 8, good: true,
    cond: s => s.flags.married && !s.flags.kid && s.age >= 28,
    run: s => { s.flags.kid = true; VL.chg(s, { happiness: 12, money: -30000, stress: 6 });
      return "👶 家里多了个小家伙。开销变大，但你更有干劲了。"; } },
  { id: "property", weight: 8, good: true,
    cond: s => s.s.money >= 300000,
    run: s => { const c = Math.round(s.s.money * 0.4); VL.chg(s, { money: -c, happiness: 10 });
      s.flags.house = (s.flags.house || 0) + c;
      return `🏘️ 你付了 ${VL.money(c)} 买房。资产从此稳稳跟着你增值。`; } },
  { id: "market_crash", weight: 7, good: false,
    cond: s => s.s.money >= 100000,
    run: s => { const l = Math.round(s.s.money * 0.18); VL.chg(s, { money: -l, happiness: -5 });
      return `📊 市场大跌，你的投资蒸发了 ${VL.money(l)}。`; } },
  { id: "mentee", weight: 8, good: true,
    cond: s => s.job && s.job.level >= 2,
    run: s => { VL.chg(s, { reputation: 6, happiness: 5, network: 5 });
      return "🧑‍🏫 你开始带新人，行业里慢慢有了你的名声。"; } }
];
