/**
 * ======================= 虚拟人生 · 场景层 =======================
 * 用纯 SVG 画出《模拟人生》那种画面：主角站在前景，背景有同学 / 同事，
 * 头顶有 Plumbob 与云朵想法气泡，远景做景深模糊。
 * 不依赖任何图片资源，风格与数值都在这个文件里调。
 */
const SCENE = {

  /* ---------------- 外观选项（建角色时可挑） ---------------- */
  SKINS: ["#fadcc4", "#f0c39c", "#d99b6c", "#b3703f", "#7d4a26", "#54301a"],
  HAIRS: ["#241a14", "#4a2f1c", "#8a5a2b", "#c79a4b", "#e3d7c0", "#9c3b2c", "#3d3d48"],
  STYLES: ["short", "bob", "long", "buzz", "curly", "pony"],

  /* ---------------- 小工具 ---------------- */
  /** 由字符串生成稳定的伪随机数（同一个存档背景人物不会每次刷新都变） */
  hash(str) {
    let h = 2166136261;
    for (let i = 0; i < String(str).length; i++) {
      h ^= String(str).charCodeAt(i); h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  },
  pickBy(seed, arr) { return arr[seed % arr.length]; },

  /* ---------------- 想法气泡 ----------------
     模仿游戏里的云朵：几个圆叠在一起，下面两颗小圆当尾巴 */
  bubble(icon, flip) {
    if (!icon) return "";
    const s = flip ? -1 : 1;
    return `<g transform="translate(${s * 66},-206) scale(${s},1)"><g class="thought">
      <circle cx="4"  cy="6"  r="7"  class="bub"/>
      <circle cx="14" cy="18" r="5"  class="bub"/>
      <g transform="translate(0,-26)">
        <circle cx="-14" cy="6"  r="17" class="bub"/>
        <circle cx="10"  cy="10" r="15" class="bub"/>
        <circle cx="0"   cy="-8" r="18" class="bub"/>
        <circle cx="20"  cy="-4" r="13" class="bub"/>
        <text x="0" y="8" text-anchor="middle" class="bubicon"
          transform="scale(${s},1)">${icon}</text>
      </g></g></g>`;
  },

  /** Plumbob：心情越差越黄越红 */
  plumbob(mood) {
    const cls = mood >= 60 ? "pb-hi" : (mood >= 38 ? "pb-mid" : "pb-low");
    return `<g class="${cls}" transform="translate(0,-228)"><g class="pbob">
      <path class="pb-t" d="M0 -16 13 0 0 5 -13 0z"/>
      <path class="pb-b" d="M-13 0 0 5 13 0 0 22z"/></g></g>`;
  },

  /* ---------------- 发型 ---------------- */
  hair(style, color) {
    const c = `fill="${color}"`;
    switch (style) {
      case "buzz":
        return `<path ${c} d="M-25 -8 C-25 -34 25 -34 25 -8 C18 -22 -18 -22 -25 -8z"/>`;
      case "bob":
        return `<path ${c} d="M-26 -6 C-30 -36 30 -36 26 -6 L26 10 C22 -6 20 -12 12 -14
                  C0 -10 -12 -14 -12 -14 C-20 -12 -22 -6 -26 10z"/>`;
      case "long":
        return `<path ${c} d="M-26 -6 C-30 -38 30 -38 26 -6 L30 44 C22 48 20 30 18 -8
                  C6 -2 -6 -2 -18 -8 C-20 30 -22 48 -30 44z"/>`;
      case "curly":
        return `<g ${c}><circle cx="-20" cy="-14" r="11"/><circle cx="-7" cy="-24" r="12"/>
                  <circle cx="8" cy="-24" r="12"/><circle cx="21" cy="-13" r="11"/>
                  <circle cx="0" cy="-16" r="12"/></g>`;
      case "pony":
        return `<g ${c}><path d="M-26 -6 C-30 -36 30 -36 26 -6 L26 4 C20 -12 10 -16 0 -14
                  C-10 -16 -20 -12 -26 4z"/>
                  <path d="M22 -4 C40 2 40 26 30 34 C34 18 30 6 20 4z"/></g>`;
      default: /* short */
        return `<path ${c} d="M-26 -4 C-28 -34 28 -34 26 -4 C22 -18 14 -22 4 -18
                  C-8 -14 -18 -16 -26 -4z"/>`;
    }
  },

  /* ---------------- 服装（跟着人生阶段变） ---------------- */
  outfits: {
    student: { top: "#8fb6c9", cardigan: "#7a4b52", collar: true, bag: true },
    grad:    { top: "#2f3d55", gown: true, cap: true, collar: true, sleeve: "#3a4a66" },
    office:  { top: "#f2f4f7", blazer: "#37495e", collar: true, tie: "#c4574f" },
    startup: { top: "#4f5b6b", hoodie: true, sleeve: "#414c5b" },
    casual:  { top: "#cfd8de", cardigan: "#a58a5c", collar: true },
    winner:  { top: "#ffffff", blazer: "#1f2b3d", collar: true, tie: "#c9a227" }
  },

  /* ---------------- 一个「模拟人」 ----------------
     o = {skin, hair, style, outfit, mood, icon, scale, x, flip, faded} */
  sim(o) {
    const f = this.outfits[o.outfit] || this.outfits.casual;
    const skin = o.skin || this.SKINS[1];
    const hairC = o.hair || this.HAIRS[0];
    const pants = f.gown ? "#2f3d55" : "#3c4655";

    let body = "";
    /* 腿与鞋 */
    body += `<rect x="-15" y="-74" width="13" height="70" rx="6" fill="${pants}"/>
             <rect x="2"   y="-74" width="13" height="70" rx="6" fill="${pants}"/>
             <ellipse cx="-8" cy="-3" rx="9" ry="5" fill="#f4f6f8"/>
             <ellipse cx="9"  cy="-3" rx="9" ry="5" fill="#f4f6f8"/>`;
    /* 脖子（先画，之后被衣领压住才不会显得太长） */
    body += `<rect x="-7" y="-156" width="14" height="16" rx="5" fill="${skin}"/>
             <ellipse cx="0" cy="-142" rx="9" ry="4" fill="#000" opacity=".07"/>`;
    /* 上身 */
    body += `<path d="M-27 -142 C-27 -150 27 -150 27 -142 L29 -78 C10 -72 -10 -72 -29 -78z"
               fill="${f.top}"/>`;
    /* 外套 / 罩衫 */
    if (f.cardigan) {
      body += `<path d="M-27 -143 C-22 -149 -14 -150 -9 -146 L-11 -76 C-20 -74 -25 -76 -29 -78z"
                 fill="${f.cardigan}"/>
               <path d="M27 -143 C22 -149 14 -150 9 -146 L11 -76 C20 -74 25 -76 29 -78z"
                 fill="${f.cardigan}"/>
               <circle cx="0" cy="-124" r="2.2" fill="#e6e2d8"/>
               <circle cx="0" cy="-108" r="2.2" fill="#e6e2d8"/>
               <circle cx="0" cy="-92"  r="2.2" fill="#e6e2d8"/>`;
    }
    if (f.blazer) {
      body += `<path d="M-27 -143 C-20 -150 -10 -149 -4 -142 L-14 -110 L-11 -76 C-20 -74 -25 -76 -29 -78z"
                 fill="${f.blazer}"/>
               <path d="M27 -143 C20 -150 10 -149 4 -142 L14 -110 L11 -76 C20 -74 25 -76 29 -78z"
                 fill="${f.blazer}"/>`;
      if (f.tie) body += `<path d="M0 -140 L5 -134 L2 -108 L-2 -108 L-5 -134z" fill="${f.tie}"/>`;
    }
    if (f.hoodie) {
      body += `<path d="M-27 -142 C-27 -150 27 -150 27 -142 L29 -78 C10 -72 -10 -72 -29 -78z"
                 fill="${f.top}"/>
               <path d="M-14 -145 C-6 -132 6 -132 14 -145 C10 -150 -10 -150 -14 -145z" fill="#e9eef2"/>
               <path d="M-3 -138 L-3 -118 M3 -138 L3 -118" stroke="#e9eef2" stroke-width="2.5"/>`;
    }
    if (f.gown) {
      body += `<path d="M-30 -144 C-14 -152 14 -152 30 -144 L40 -60 C14 -52 -14 -52 -40 -60z"
                 fill="#2b3648"/>
               <path d="M-8 -148 L8 -148 L6 -96 L-6 -96z" fill="#f0f3f6"/>`;
    }
    /* 衣领 */
    if (f.collar) {
      body += `<path d="M-11 -147 L0 -136 L11 -147 C6 -151 -6 -151 -11 -147z" fill="#ffffff"/>`;
    }
    /* 手臂 */
    const sleeve = f.sleeve || f.blazer || f.cardigan || f.top;
    body += `<rect x="-36" y="-142" width="11" height="62" rx="5.5" fill="${sleeve}"/>
             <rect x="25"  y="-142" width="11" height="62" rx="5.5" fill="${sleeve}"/>
             <circle cx="-30.5" cy="-76" r="6" fill="${skin}"/>
             <circle cx="30.5"  cy="-76" r="6" fill="${skin}"/>`;
    /* 书包背带 */
    if (f.bag) {
      body += `<path d="M-16 -146 L-10 -96" stroke="#4b5a68" stroke-width="4" stroke-linecap="round"/>
               <path d="M16 -146 L10 -96" stroke="#4b5a68" stroke-width="4" stroke-linecap="round"/>`;
    }
    /* 头 */
    body += `<g transform="translate(0,-182)">
        <ellipse cx="-24" cy="4" rx="4.5" ry="6" fill="${skin}"/>
        <ellipse cx="24"  cy="4" rx="4.5" ry="6" fill="${skin}"/>
        <ellipse cx="0" cy="0" rx="23" ry="27" fill="${skin}"/>
        <ellipse cx="0" cy="8" rx="19" ry="18" fill="#ffffff" opacity=".06"/>
        ${this.hair(o.style || "short", hairC)}
        <g class="face">
          <ellipse cx="-8.5" cy="2" rx="2.6" ry="3.2" fill="#2a2118"/>
          <ellipse cx="8.5"  cy="2" rx="2.6" ry="3.2" fill="#2a2118"/>
          <circle cx="-7.6" cy="1" r=".9" fill="#ffffff"/>
          <circle cx="9.4"  cy="1" r=".9" fill="#ffffff"/>
          <path d="M-12 -5 C-10 -7.5 -5 -7.5 -4 -5.5" stroke="#3a2a1c" stroke-width="1.6"
            fill="none" stroke-linecap="round"/>
          <path d="M12 -5 C10 -7.5 5 -7.5 4 -5.5" stroke="#3a2a1c" stroke-width="1.6"
            fill="none" stroke-linecap="round"/>
          ${(o.mood === undefined || o.mood >= 38)
            ? `<path d="M-6 11 C-3 15 3 15 6 11" stroke="#8d4b3f" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
            : `<path d="M-6 14 C-3 10 3 10 6 14" stroke="#8d4b3f" stroke-width="1.8" fill="none" stroke-linecap="round"/>`}
          <ellipse cx="-15" cy="8" rx="4" ry="2.6" fill="#e79a8a" opacity=".35"/>
          <ellipse cx="15"  cy="8" rx="4" ry="2.6" fill="#e79a8a" opacity=".35"/>
        </g>
        ${f.cap ? `<g><path d="M-30 -14 L0 -24 L30 -14 L0 -6z" fill="#1e2733"/>
            <rect x="-6" y="-26" width="12" height="6" rx="2" fill="#1e2733"/>
            <path d="M22 -14 L26 8" stroke="#c9a227" stroke-width="2"/>
            <circle cx="26" cy="9" r="3" fill="#c9a227"/></g>` : ""}
      </g>`;

    return `<g class="sim ${o.faded ? "far" : "near"}"
        transform="translate(${o.x},${o.y}) scale(${(o.flip ? -1 : 1) * (o.scale || 1)},${o.scale || 1})">
      <ellipse cx="0" cy="2" rx="34" ry="7" fill="#4a6b78" opacity=".18"/>
      ${body}
      ${o.plumbob ? this.plumbob(o.mood === undefined ? 70 : o.mood) : ""}
      ${this.bubble(o.icon, o.flip)}
    </g>`;
  },

  /* ---------------- 背景 ----------------
     far  = 远景（会被景深模糊）   near = 地面与近景（保持清晰） */
  backdrop(kind) {
    const sky = {
      campus: ["#bfe9f7", "#eaf7fc"], office: ["#cfe6f2", "#f0f7fb"],
      startup: ["#e6dfd2", "#f7f3ea"], city: ["#c9e6f5", "#eef8fc"],
      sunset: ["#ffcf9c", "#ffeede"]
    }[kind] || ["#bfe9f7", "#eaf7fc"];

    let far = `<rect x="0" y="20" width="900" height="280" fill="url(#sky)"/>`;
    let near = "";
    const HZ = 214;                                   /* 地平线 */

    if (kind === "startup") {
      far += `<rect x="0" y="0" width="900" height="${HZ}" fill="#c9a68c"/>`;
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 19; c++)
          far += `<rect x="${c * 48 + (r % 2 ? 24 : 0)}" y="${r * 27}" width="44" height="23" rx="3"
                   fill="#b8927a" opacity=".5"/>`;
      far += `<rect x="64" y="34" width="196" height="118" rx="8" fill="#f7fbfc" stroke="#e2ebef" stroke-width="4"/>
              <path d="M86 84 L122 110 L158 58 L200 96" stroke="#57c93a" stroke-width="5" fill="none"/>
              <rect x="620" y="52" width="70" height="70" rx="6" fill="#e4ecef"/>
              <rect x="700" y="72" width="46" height="50" rx="6" fill="#d6e2e6"/>`;
      near += `<rect x="0" y="${HZ}" width="900" height="${300 - HZ}" fill="#c9b492"/>
               <rect x="0" y="${HZ}" width="900" height="7" fill="#a8916f"/>
               <rect x="596" y="${HZ - 18}" width="250" height="20" rx="6" fill="#8f7358"/>
               <rect x="612" y="${HZ - 44}" width="52" height="26" rx="4" fill="#e9eef1"/>`;
    } else if (kind === "office") {
      far += `<rect x="0" y="0" width="900" height="${HZ}" fill="#dceaf2"/>`;
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 12; c++)
          far += `<rect x="${c * 76 + 6}" y="${r * 44 + 6}" width="66" height="34" rx="5"
                   fill="#b9d7e6" opacity="${0.32 + ((r + c) % 3) * 0.17}"/>`;
      near += `<rect x="0" y="${HZ}" width="900" height="${300 - HZ}" fill="#dfd6c8"/>
               <rect x="0" y="${HZ}" width="900" height="6" fill="#c3b7a4"/>`;
      for (let r = 0; r < 5; r++) {                   /* 地毯格纹，做出透视 */
        const y = HZ + 8 + r * r * 2.6, h = 6 + r * 3;
        for (let c = 0; c < 14; c++)
          near += `<rect x="${c * 68 + (r % 2 ? 34 : 0)}" y="${y}" width="62" height="${h}" rx="3"
                    fill="#d8cdba" opacity=".35"/>`;
      }
      /* 盆栽：花盆 + 三片叶子 */
      near += `<g transform="translate(800,${HZ + 14})">
        <ellipse cx="0" cy="4" rx="40" ry="11" fill="#000" opacity=".07"/>
        <path d="M-22 0 L22 0 L17 -30 L-17 -30z" fill="#c98f6b"/>
        <rect x="-20" y="-34" width="40" height="8" rx="3" fill="#b87f5d"/>
        <g fill="#5fa052">
          <path d="M0 -34 C-26 -46 -30 -74 -12 -86 C-2 -70 -2 -48 0 -34z"/>
          <path d="M0 -34 C26 -46 30 -74 12 -86 C2 -70 2 -48 0 -34z" fill="#6fb45c"/>
          <path d="M0 -34 C-8 -60 -2 -84 2 -96 C10 -80 10 -54 0 -34z" fill="#569447"/>
        </g></g>`;
    } else {
      /* 校园 / 城市：远处建筑 + 树 */
      far += `<rect x="26"  y="42"  width="196" height="${HZ - 42}" rx="10" fill="#ab7761"/>
              <rect x="248" y="18"  width="152" height="${HZ - 18}" rx="10" fill="#93a3b4"/>
              <rect x="642" y="34"  width="232" height="${HZ - 34}" rx="10" fill="#9e7c65"/>`;
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        far += `<rect x="${44 + c * 44}" y="${62 + r * 38}" width="30" height="24" rx="3" fill="#f4e9d3" opacity=".85"/>`;
        far += `<rect x="${660 + c * 52}" y="${56 + r * 38}" width="34" height="24" rx="3" fill="#f4e9d3" opacity=".85"/>`;
      }
      for (let c = 0; c < 3; c++) for (let r = 0; r < 5; r++)
        far += `<rect x="${266 + c * 46}" y="${34 + r * 36}" width="34" height="24" rx="3" fill="#dbe8f0" opacity=".9"/>`;
      const tree = (x, y, s, dark) => `<g transform="translate(${x},${y}) scale(${s})">
        <rect x="-6" y="-42" width="12" height="52" rx="5" fill="#7d5a3c"/>
        <circle cx="0"   cy="-66" r="42" fill="${dark ? "#4f8f45" : "#63a852"}"/>
        <circle cx="-34" cy="-46" r="30" fill="${dark ? "#589a4c" : "#6fb45c"}"/>
        <circle cx="34"  cy="-48" r="32" fill="${dark ? "#4a8841" : "#5da24d"}"/>
        <circle cx="4"   cy="-32" r="28" fill="${dark ? "#54934a" : "#68ac57"}"/></g>`;
      far += tree(170, HZ + 4, 1, false) + tree(468, HZ + 8, 1.2, true) + tree(772, HZ + 4, .95, false);
      if (kind === "sunset") {                        /* 落日与暖色滤镜 */
        far = `<rect x="0" y="20" width="900" height="280" fill="url(#sky)"/>
               <circle cx="700" cy="150" r="46" fill="#ffd88a" opacity=".85"/>` +
              far.slice(far.indexOf("/>") + 2) +
              `<rect x="0" y="20" width="900" height="280" fill="#ff9d4d" opacity=".22"/>`;
      }

      /* 近景：有透视的铺砖人行道 */
      near += `<rect x="0" y="${HZ}" width="900" height="${300 - HZ}" fill="#ded2c0"/>
               <rect x="0" y="${HZ}" width="900" height="6" fill="#bfae97"/>`;
      let y = HZ + 6, h = 5, w = 30;
      for (let r = 0; r < 7 && y < 306; r++) {
        for (let c = -1; c * w < 940; c++)
          near += `<rect x="${(c * w + (r % 2 ? w / 2 : 0)).toFixed(1)}" y="${y.toFixed(1)}"
                    width="${(w - 3).toFixed(1)}" height="${Math.max(3, h - 2).toFixed(1)}" rx="2"
                    fill="${r % 2 ? "#d6c9b5" : "#dcd0be"}" opacity=".5"/>`;
        y += h; h *= 1.42; w *= 1.3;
      }
      /* 花台与路灯，让画面不空 */
      near += `<rect x="742" y="${HZ - 6}" width="126" height="34" rx="8" fill="#e7dfd0"/>
               <rect x="742" y="${HZ - 6}" width="126" height="7" rx="4" fill="#f2ece0"/>
               <g><circle cx="772" cy="${HZ - 14}" r="15" fill="#6aa15c"/>
                  <circle cx="800" cy="${HZ - 20}" r="18" fill="#5f9853"/>
                  <circle cx="832" cy="${HZ - 13}" r="14" fill="#74ab63"/>
                  <circle cx="812" cy="${HZ - 8}"  r="12" fill="#e8b6c4"/>
                  <circle cx="784" cy="${HZ - 4}"  r="10" fill="#f0d68a"/></g>
               <g opacity=".9"><rect x="97" y="${HZ - 86}" width="5" height="94" rx="2.5" fill="#7d8b95"/>
                  <ellipse cx="99" cy="${HZ + 8}" rx="12" ry="4" fill="#5d6c78" opacity=".28"/>
                  <path d="M89 ${HZ - 88} L110 ${HZ - 88} L105 ${HZ - 102} L94 ${HZ - 102}z" fill="#66757f"/>
                  <rect x="92" y="${HZ - 89}" width="15" height="5" rx="2.5" fill="#fff0bf"/></g>`;
    }
    return { far: far, near: near, sky: sky };
  },

  /** 阶段 → 背景 / 服装 / 默认气泡图标 */
  look(S) {
    const p = S ? S.phase : "create";
    if (p === "study" || p === "track") return { bg: "campus", fit: "student", icon: "📚" };
    if (p === "crossroads") return { bg: "campus", fit: "grad", icon: "🎓" };
    if (p === "jobmarket") return { bg: "city", fit: "office", icon: "🔎" };
    if (p === "career") return { bg: "office", fit: "office", icon: "💼" };
    if (p === "startup") return { bg: "startup", fit: "startup", icon: "🚀" };
    if (p === "end") {
      const win = S.ending && /赢家|老板|精英|专家/.test(S.ending.title);
      return { bg: "sunset", fit: win ? "winner" : "casual", icon: win ? "🏆" : "🏁" };
    }
    return { bg: "campus", fit: "student", icon: "✨" };
  },

  /* ---------------- 整个场景 ---------------- */
  render(S, draft) {
    const look = this.look(S);
    const bd = this.backdrop(look.bg);
    const app = (S && S.look) || (draft && draft.look) || {};
    const mood = S ? (S.s.happiness + S.s.health + (100 - S.s.stress)) / 3 : 75;
    const icon = (S && S.lastIcon) || look.icon;

    /* 背景人物：由存档名字派生，保证每次渲染都一样 */
    const seed = this.hash((S && S.name) || (draft && draft.name) || "sim");
    const extras = [
      { x: 590, y: 272, scale: .62, icon: "🔎", flip: false, off: 3 },
      { x: 722, y: 252, scale: .52, icon: "💡", flip: true, off: 11 },
      { x: 470, y: 238, scale: .40, icon: "", flip: false, off: 23 }
    ].map(e => this.sim({
      x: e.x, y: e.y, scale: e.scale, faded: true, flip: e.flip, icon: e.icon,
      skin: this.pickBy(seed + e.off, this.SKINS),
      hair: this.pickBy(seed * 3 + e.off, this.HAIRS),
      style: this.pickBy(seed * 7 + e.off, this.STYLES),
      outfit: this.pickBy(seed + e.off,
        (look.fit === "student" || look.fit === "grad") ? ["student", "casual"] : ["casual", "office"])
    })).join("");

    const hero = this.sim({
      x: 300, y: 292, scale: .85, plumbob: true, mood: mood, icon: icon,
      skin: app.skin || this.SKINS[1], hair: app.hair || this.HAIRS[0],
      style: app.style || "short", outfit: look.fit
    });

    return `<svg class="scenesvg" viewBox="0 56 900 244" preserveAspectRatio="xMidYMax slice"
        role="img" aria-label="场景">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${bd.sky[0]}"/><stop offset="1" stop-color="${bd.sky[1]}"/>
        </linearGradient>
        <filter id="dof-far"><feGaussianBlur stdDeviation="1.9"/></filter>
        <filter id="dof-mid"><feGaussianBlur stdDeviation=".7"/></filter>
      </defs>
      <g filter="url(#dof-far)">${bd.far}</g>
      ${bd.near}
      <g filter="url(#dof-mid)">${extras}</g>
      ${hero}
    </svg>`;
  }
};

if (typeof module !== "undefined" && module.exports) module.exports = SCENE;
