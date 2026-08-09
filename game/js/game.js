/**
 * ===========================================================
 *  恐龙时代 / DINOSAUR ERA — 街机风格打恐龙射击
 * ===========================================================
 *  纯 Canvas 2D，无外部素材、无依赖。所有恐龙与场景都是代码绘制的。
 *
 *  坐标系：固定虚拟分辨率 1280x720，CSS 负责缩放。
 *  深度：每只恐龙有 z ∈ [1(远) .. 0(贴脸)]，由 depthK() 换算成
 *  透视缩放，缩放同时决定它在地面上的落点，因此远近关系是自洽的。
 * ===========================================================
 */
(function () {
  'use strict';

  // ======================= 基本常量 =======================

  const W = 1280;               // 虚拟画布宽
  const H = 720;                // 虚拟画布高
  const HORIZON = 322;          // 地平线 y
  const GROUND = 690;           // 最近处（z=0）脚底 y
  const K_FAR = 0.25;           // z=1 时的透视系数

  const PLAYER_MAX_HP = 6;
  const START_HP = 5;
  const MAG_SIZE = 8;
  const RELOAD_TIME = 1.05;     // 秒

  // ======================= 小工具 =======================

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /** 可复现的伪随机数（只用于生成静态背景，避免每次刷新场景乱跳）。 */
  function makeRng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /** z(深度) → 透视系数 k，k=1 表示贴脸，k=K_FAR 表示地平线。 */
  const depthK = (z) => 1 / (1 + z * 3);
  /** 透视系数 → 脚底所在的地面 y。 */
  const groundY = (k) => HORIZON + (GROUND - HORIZON) * ((k - K_FAR) / (1 - K_FAR));
  /** 横向世界坐标(-1..1) + 透视系数 → 屏幕 x。 */
  const screenX = (wx, k) => W / 2 + wx * W * 0.66 * k;

  // ======================= 音效（WebAudio 合成） =======================

  const Sfx = {
    ac: null,
    noise: null,
    muted: false,

    init() {
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ac = new AC();
        const len = this.ac.sampleRate * 0.5;
        this.noise = this.ac.createBuffer(1, len, this.ac.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ac.state === 'suspended') this.ac.resume();
    },

    /** 一段噪声，用来做枪声/爆裂声。 */
    burst(dur, freq, gain, type) {
      if (!this.ac || this.muted) return;
      const t = this.ac.currentTime;
      const src = this.ac.createBufferSource();
      src.buffer = this.noise;
      const f = this.ac.createBiquadFilter();
      f.type = type || 'lowpass';
      f.frequency.setValueAtTime(freq, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.15), t + dur);
      const g = this.ac.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.ac.destination);
      src.start(t);
      src.stop(t + dur);
    },

    /** 一个带包络的振荡器音，用来做提示音/吼叫。 */
    tone(f0, f1, dur, gain, type, delay) {
      if (!this.ac || this.muted) return;
      const t = this.ac.currentTime + (delay || 0);
      const o = this.ac.createOscillator();
      o.type = type || 'square';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      const g = this.ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ac.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    },

    shot()    { this.burst(0.16, 2600, 0.34); this.tone(180, 40, 0.14, 0.18, 'square'); },
    dry()     { this.tone(900, 500, 0.05, 0.09, 'square'); },
    reload()  { this.tone(700, 400, 0.06, 0.1, 'square', 0); this.tone(520, 300, 0.07, 0.1, 'square', RELOAD_TIME - 0.18); },
    hit()     { this.burst(0.1, 900, 0.22); },
    headshot(){ this.tone(1400, 500, 0.16, 0.16, 'triangle'); this.burst(0.14, 1500, 0.24); },
    kill()    { this.burst(0.3, 700, 0.3); this.tone(260, 60, 0.3, 0.14, 'sawtooth'); },
    roar()    { this.tone(150, 60, 0.7, 0.22, 'sawtooth'); this.tone(90, 45, 0.8, 0.16, 'square'); },
    hurt()    { this.tone(320, 70, 0.35, 0.24, 'sawtooth'); },
    wave()    { this.tone(520, 780, 0.12, 0.14, 'square', 0); this.tone(780, 1040, 0.16, 0.14, 'square', 0.13); },
    over()    { this.tone(400, 60, 1.1, 0.22, 'sawtooth'); }
  };

  // ======================= 恐龙种类 =======================
  //  hp    血量
  //  spd   每秒推进的 z 值
  //  size  绘制/碰撞的整体比例
  //  skin  [主色, 暗色, 更暗, 腹部亮色, 描边]
  //  box   身体碰撞盒（局部坐标，原点在脚底，y 向上为负）
  //  head  头部碰撞圆（爆头判定）

  const TYPES = {
    raptor: {
      key: 'raptor', name: '迅猛龙', hp: 1, spd: 0.076, size: 0.62, score: 100, dmg: 1,
      skin: ['#8cc95a', '#63993a', '#436c26', '#e2ecbb', '#1f330f'],
      box: { x: -66, y: -104, w: 128, h: 104 }, head: { x: 50, y: -94, r: 19 }
    },
    trike: {
      key: 'trike', name: '三角龙', hp: 4, spd: 0.040, size: 1.02, score: 260, dmg: 2,
      skin: ['#cda653', '#a07c33', '#6d5322', '#f1e5c4', '#3a2a10'],
      box: { x: -76, y: -104, w: 196, h: 104 }, head: { x: 100, y: -56, r: 30 }
    },
    ptero: {
      key: 'ptero', name: '翼龙', hp: 1, spd: 0.066, size: 0.76, score: 190, dmg: 1, flying: true,
      skin: ['#b96fa5', '#864a77', '#582c4e', '#eed2e6', '#2c1428'],
      box: { x: -60, y: -56, w: 124, h: 70 }, head: { x: 38, y: -46, r: 18 }
    },
    spino: {
      key: 'spino', name: '棘龙', hp: 18, spd: 0.026, size: 1.55, score: 1500, dmg: 3, boss: true,
      skin: ['#e57a33', '#b4501d', '#7d3411', '#ffdba4', '#3f1607'],
      box: { x: -104, y: -150, w: 232, h: 150 }, head: { x: 90, y: -126, r: 30 }
    }
  };

  // ======================= 恐龙绘制 =======================
  //  所有绘制都在“局部坐标”里完成：原点 = 双脚之间的地面点，y 向上为负，
  //  一只标准恐龙大约 100 单位高。外层负责 translate / scale / 镜像。
  //  每个部件都是「先描粗一圈暗色边，再填本色」，这样在暗背景下轮廓清楚。

  let PAL = null;                                   // 受击闪白时覆盖所有颜色
  const C = (c) => PAL || c;

  /** 折线肢体：先画粗的描边线，再画本色线。 */
  function line(g, pts, w, col, out) {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const path = () => {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.stroke();
    };
    if (out) { g.strokeStyle = C(out); g.lineWidth = w + 6; path(); }
    g.strokeStyle = C(col); g.lineWidth = w; path();
  }

  /** 二次贝塞尔（尾巴、脖子）。 */
  function curve(g, x0, y0, cx, cy, x1, y1, w, col, out) {
    g.lineCap = 'round';
    const path = () => {
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(cx, cy, x1, y1);
      g.stroke();
    };
    if (out) { g.strokeStyle = C(out); g.lineWidth = w + 6; path(); }
    g.strokeStyle = C(col); g.lineWidth = w; path();
  }

  function ellipse(g, x, y, rx, ry, rot, col, out) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    if (out) { g.strokeStyle = C(out); g.lineWidth = 6; g.stroke(); }
    g.fillStyle = C(col);
    g.fill();
  }

  function poly(g, pts, col, out) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    if (out) { g.strokeStyle = C(out); g.lineWidth = 6; g.lineJoin = 'round'; g.stroke(); }
    g.fillStyle = C(col);
    g.fill();
  }

  /** 沿一条边排一列尖牙。h>0 向下长牙，h<0 向上长牙。 */
  function teeth(g, x, y, w, n, h) {
    g.fillStyle = C('#fffdf2');
    const step = w / n;
    for (let i = 0; i < n; i++) {
      g.beginPath();
      g.moveTo(x + step * i, y);
      g.lineTo(x + step * (i + 1), y);
      g.lineTo(x + step * (i + 0.5), y + h);
      g.closePath();
      g.fill();
    }
  }

  function eye(g, x, y, r, browCol) {
    g.fillStyle = C('#fff6cf');
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = C('#150d05');
    g.beginPath(); g.ellipse(x + r * 0.22, y, r * 0.4, r * 0.8, 0, 0, Math.PI * 2); g.fill();
    if (browCol) {                                   // 一道凶狠的眉毛
      g.strokeStyle = C(browCol);
      g.lineWidth = r * 0.75;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x - r * 1.4, y - r * 1.7);
      g.lineTo(x + r * 1.3, y - r * 0.6);
      g.stroke();
    }
  }

  /** 身上的斑纹。 */
  function stripes(g, x, y, w, n, col) {
    g.strokeStyle = C(col);
    g.lineWidth = 4;
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const sx = x + (w / n) * i;
      g.beginPath();
      g.moveTo(sx, y);
      g.quadraticCurveTo(sx + 4, y + 9, sx - 2, y + 17);
      g.stroke();
    }
  }

  /** 迅猛龙：小、快、双足，跑起来腿摆得很凶。 */
  function drawRaptor(g, t, s) {
    const [c1, c2, c3, belly, out] = s;
    const a = Math.sin(t * 11), b = Math.sin(t * 11 + Math.PI);
    // 尾巴
    curve(g, -18, -66, -54, -76 + a * 6, -88, -48 + a * 12, 12, c2, out);
    // 远侧腿
    line(g, [[-8, -64], [14 + b * 10, -40], [-8 + b * 12, -14], [12 + b * 12, -2]], 9, c3, out);
    // 躯干
    ellipse(g, -2, -68, 34, 23, -0.14, c1, out);
    // 脖子 + 头
    curve(g, 14, -78, 32, -96, 42, -100, 15, c1, out);
    poly(g, [[24, -110], [58, -108], [76, -96], [74, -86], [26, -88]], c1, out);   // 上颚 + 吻部
    poly(g, [[28, -86], [68, -88], [66, -80], [30, -80]], c2, out);                // 下颚
    teeth(g, 36, -88, 32, 6, 6);
    ellipse(g, 44, -104, 5, 3.5, 0, c2, null);                                     // 鼻孔隆起
    eye(g, 48, -100, 5, c3);
    // 腹部与斑纹
    ellipse(g, -2, -58, 21, 10, -0.1, belly, null);
    stripes(g, -20, -84, 34, 4, c3);
    // 前爪
    line(g, [[18, -74], [34, -62], [46, -66]], 5, c2, out);
    // 近侧腿（先画大腿肌肉）
    ellipse(g, 0, -68, 15, 19, -0.1, c1, out);
    line(g, [[0, -64], [24 + a * 10, -40], [2 + a * 12, -14], [26 + a * 12, -2]], 11, c1, out);
  }

  /** 三角龙：四足坦克，大头盾 + 三只角。 */
  function drawTrike(g, t, s) {
    const [c1, c2, c3, belly, out] = s;
    const a = Math.sin(t * 7), b = Math.sin(t * 7 + Math.PI);
    // 尾
    curve(g, -44, -60, -74, -56, -100, -30 + a * 5, 15, c2, out);
    // 远侧两条腿（暗色，在身体之前画）
    line(g, [[-34, -44], [-40 + b * 7, -24], [-34 + b * 12, -2], [-20 + b * 12, -2]], 11, c3, out);
    line(g, [[26, -44], [32 + a * 7, -24], [38 + a * 12, -2], [52 + a * 12, -2]], 11, c3, out);
    // 躯干
    ellipse(g, -10, -56, 56, 33, -0.04, c1, out);
    ellipse(g, -12, -44, 44, 17, 0, belly, null);
    stripes(g, -38, -82, 48, 5, c3);
    // 近侧两条腿（带大腿肌肉）
    ellipse(g, -28, -50, 17, 20, 0, c1, out);
    ellipse(g, 30, -50, 16, 19, 0, c1, out);
    line(g, [[-28, -44], [-34 + a * 8, -24], [-28 + a * 13, -2], [-12 + a * 13, -2]], 14, c1, out);
    line(g, [[30, -44], [36 + b * 8, -24], [42 + b * 13, -2], [58 + b * 13, -2]], 14, c1, out);
    // 头盾：一整片扇形，用暗色和身体拉开层次
    poly(g, [[36, -86], [58, -116], [94, -120], [120, -92], [118, -46], [86, -24], [50, -32]], c2, out);
    poly(g, [[48, -86], [64, -108], [90, -111], [110, -88], [108, -52], [84, -34], [58, -40]], c1, null);
    g.fillStyle = C(belly);                                   // 盾边上的骨突
    [[60, -112], [78, -118], [98, -114], [114, -94], [116, -66], [110, -44]].forEach(([bx, by]) => {
      g.beginPath(); g.arc(bx, by, 5, 0, Math.PI * 2); g.fill();
    });
    // 头 + 鹦鹉喙（压在盾前面）
    poly(g, [[62, -80], [104, -70], [128, -52], [118, -32], [80, -26], [60, -46]], c1, out);
    poly(g, [[116, -58], [146, -44], [114, -28]], belly, out);
    // 三只角：两根长眉角 + 一根鼻角
    poly(g, [[84, -74], [146, -110], [96, -60]], belly, out);
    poly(g, [[68, -76], [112, -122], [84, -66]], belly, out);
    poly(g, [[116, -56], [140, -72], [120, -44]], belly, out);
    eye(g, 96, -56, 5.5, c3);
  }

  /** 翼龙：从天上俯冲，翅膀在拍。 */
  function drawPtero(g, t, s) {
    const [c1, c2, c3, belly, out] = s;
    const f = Math.sin(t * 8.5);
    // 远侧翅膀
    poly(g, [[-4, -42], [-56, -70 - f * 26], [-78, -40 - f * 16], [-12, -30]], c3, out);
    // 身体
    ellipse(g, 0, -40, 26, 14, -0.2, c1, out);
    ellipse(g, 0, -35, 18, 8, -0.2, belly, null);
    // 爪
    line(g, [[-2, -30], [-6, -18 + f * 3], [6, -14 + f * 3]], 4, c3, out);
    // 脖子 + 长喙 + 头冠
    curve(g, 10, -44, 22, -52, 30, -50, 10, c1, out);
    poly(g, [[22, -58], [66, -46], [26, -38]], c1, out);
    poly(g, [[26, -60], [6, -76], [38, -54]], c2, out);
    eye(g, 31, -50, 4, null);
    // 近侧翅膀（张开的膜）
    poly(g, [[2, -44], [-42, -78 + f * 30], [-70, -46 + f * 22], [-4, -32]], c2, out);
    poly(g, [[2, -44], [-26, -64 + f * 22], [-42, -46 + f * 16], [-2, -36]], c1, null);
    line(g, [[2, -44], [-40, -76 + f * 29]], 5, c3, null);     // 翼指骨
  }

  /** 棘龙 BOSS：背帆 + 血盆大口，走两步吼一次。 */
  function drawSpino(g, t, s) {
    const [c1, c2, c3, belly, out] = s;
    const a = Math.sin(t * 4.5), b = Math.sin(t * 4.5 + Math.PI);
    const jaw = Math.sin(t * 2.1) > 0.72 ? 16 : 3;             // 偶尔张嘴
    // 尾
    curve(g, -34, -92, -92, -100 + a * 7, -136, -58 + a * 12, 22, c2, out);
    // 背帆
    g.beginPath();
    g.moveTo(-52, -104);
    g.quadraticCurveTo(-26, -196, 10, -188);
    g.quadraticCurveTo(44, -180, 54, -112);
    g.closePath();
    g.strokeStyle = C(out); g.lineWidth = 7; g.lineJoin = 'round'; g.stroke();
    g.fillStyle = C(c3); g.fill();
    g.strokeStyle = C(c2); g.lineWidth = 4;                    // 帆上的支棘
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.moveTo(i * 15 - 2, -110);
      g.lineTo(i * 13, -184 + Math.abs(i) * 13);
      g.stroke();
    }
    // 远侧腿
    line(g, [[-18, -90], [18 + b * 12, -58], [-10 + b * 14, -22], [20 + b * 14, -2]], 15, c3, out);
    // 躯干
    ellipse(g, -8, -98, 58, 37, -0.08, c1, out);
    ellipse(g, -4, -82, 44, 21, -0.05, belly, null);
    stripes(g, -46, -122, 62, 6, c3);
    // 脖子
    curve(g, 20, -114, 52, -138, 70, -138, 28, c1, out);
    // 头：上颚（吻部收窄）
    poly(g, [[46, -158], [96, -156], [132, -140], [130, -122], [48, -126]], c1, out);
    ellipse(g, 62, -160, 10, 6, 0, c2, null);                  // 鼻脊
    teeth(g, 58, -126, 66, 9, 10);
    // 下颚（会张合）
    g.save();
    g.translate(48, -122);
    g.rotate(jaw * Math.PI / 180);
    poly(g, [[0, 1], [66, 6], [56, 18], [2, 16]], c2, out);
    teeth(g, 8, 6, 48, 7, -9);
    g.restore();
    eye(g, 80, -146, 7.5, c3);
    // 小前肢
    line(g, [[34, -100], [52, -84], [66, -90]], 8, c2, out);
    // 近侧腿（先画大腿肌肉）
    ellipse(g, -2, -100, 21, 27, -0.08, c1, out);
    line(g, [[-2, -94], [34 + a * 12, -58], [6 + a * 14, -22], [40 + a * 14, -2]], 18, c1, out);
  }

  const DRAW = { raptor: drawRaptor, trike: drawTrike, ptero: drawPtero, spino: drawSpino };

  // ======================= 静态背景 =======================

  const bgCanvas = document.createElement('canvas');
  const fgCanvas = document.createElement('canvas');
  bgCanvas.width = fgCanvas.width = W;
  bgCanvas.height = fgCanvas.height = H;

  function tree(g, x, y, h, col) {
    g.strokeStyle = col;
    g.lineCap = 'round';
    g.lineWidth = h * 0.07;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x - h * 0.08, y - h * 0.5, x + h * 0.05, y - h);
    g.stroke();
    g.fillStyle = col;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.42;
      const len = h * rand(0.32, 0.46);
      g.save();
      g.translate(x + h * 0.05, y - h);
      g.rotate(a);
      g.beginPath();
      g.ellipse(len * 0.5, 0, len * 0.5, h * 0.045, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  function buildBackground() {
    const g = bgCanvas.getContext('2d');
    const rng = makeRng(20260809);
    const R = (a, b) => a + rng() * (b - a);

    // 天空
    let sky = g.createLinearGradient(0, 0, 0, HORIZON + 30);
    sky.addColorStop(0, '#20143a');
    sky.addColorStop(0.45, '#5c2b4a');
    sky.addColorStop(0.8, '#b8503a');
    sky.addColorStop(1, '#ffa554');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, HORIZON + 30);

    // 落日
    const sun = g.createRadialGradient(W * 0.5, HORIZON - 40, 8, W * 0.5, HORIZON - 40, 190);
    sun.addColorStop(0, 'rgba(255,232,160,.95)');
    sun.addColorStop(0.25, 'rgba(255,170,70,.55)');
    sun.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = sun;
    g.beginPath(); g.arc(W * 0.5, HORIZON - 40, 190, 0, Math.PI * 2); g.fill();

    // 远处废墟城市
    g.fillStyle = '#2b1c33';
    for (let x = -20; x < W + 20;) {
      const bw = R(28, 76), bh = R(40, 170);
      g.fillRect(x, HORIZON - bh, bw, bh + 10);
      // 破损的楼顶
      g.clearRect(x + R(0, bw * 0.6), HORIZON - bh, R(6, 16), R(6, 22));
      // 零星窗户
      g.fillStyle = 'rgba(255,196,120,.20)';
      for (let wy = HORIZON - bh + 10; wy < HORIZON - 12; wy += 16) {
        for (let wx = x + 6; wx < x + bw - 8; wx += 14) if (rng() > 0.72) g.fillRect(wx, wy, 5, 8);
      }
      g.fillStyle = '#2b1c33';
      x += bw + R(4, 22);
    }

    // 丛林层（远 → 近）
    const jungle = (yBase, amp, col) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(-10, H);
      g.lineTo(-10, yBase);
      for (let x = -10; x <= W + 10; x += 40) {
        g.quadraticCurveTo(x + 20, yBase - R(0, amp), x + 40, yBase - R(0, amp * 0.4));
      }
      g.lineTo(W + 10, H);
      g.closePath();
      g.fill();
    };
    jungle(HORIZON - 6, 46, '#1c3326');
    jungle(HORIZON + 4, 28, '#16291f');

    // 地面（草地）
    const grass = g.createLinearGradient(0, HORIZON, 0, H);
    grass.addColorStop(0, '#1e3524');
    grass.addColorStop(0.5, '#16261a');
    grass.addColorStop(1, '#0d1710');
    g.fillStyle = grass;
    g.fillRect(0, HORIZON, W, H - HORIZON);

    // 透视马路
    const road = g.createLinearGradient(0, HORIZON, 0, H);
    road.addColorStop(0, '#39332e');
    road.addColorStop(1, '#1d1a17');
    g.fillStyle = road;
    g.beginPath();
    g.moveTo(W / 2 - 70, HORIZON);
    g.lineTo(W / 2 + 70, HORIZON);
    g.lineTo(W + 340, H);
    g.lineTo(-340, H);
    g.closePath();
    g.fill();

    // 中线（按深度均匀分布，所以看起来有透视）
    g.fillStyle = 'rgba(232,214,150,.35)';
    for (let i = 0; i < 16; i++) {
      const z = 1 - i / 16;
      const k = depthK(z), k2 = depthK(Math.max(0, z - 0.028));
      const y1 = groundY(k), y2 = groundY(k2);
      const w1 = 4 * k, w2 = 4 * k2;
      g.beginPath();
      g.moveTo(W / 2 - w1, y1); g.lineTo(W / 2 + w1, y1);
      g.lineTo(W / 2 + w2, y2); g.lineTo(W / 2 - w2, y2);
      g.closePath(); g.fill();
    }

    // 路两侧的树与石头
    for (let i = 0; i < 26; i++) {
      const z = R(0.15, 0.95);
      const k = depthK(z);
      const side = rng() > 0.5 ? 1 : -1;
      const x = screenX(side * R(1.05, 2.1), k);
      const y = groundY(k);
      if (x < -60 || x > W + 60) continue;
      const shade = ['#12241a', '#173021', '#0e1c14'][randInt(0, 2)];
      if (rng() > 0.35) tree(g, x, y, 260 * k, shade);
      else { g.fillStyle = shade; g.beginPath(); g.ellipse(x, y, 40 * k, 16 * k, 0, 0, Math.PI * 2); g.fill(); }
    }

    // 暗角
    const vig = g.createRadialGradient(W / 2, H * 0.5, H * 0.35, W / 2, H * 0.5, H * 0.95);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,.62)');
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);

    // ---------- 前景（画在恐龙之上，制造纵深） ----------
    const f = fgCanvas.getContext('2d');
    const rng2 = makeRng(777);
    f.fillStyle = '#050b07';
    for (let i = 0; i < 42; i++) {
      const x = rng2() * W;
      const h = 60 + rng2() * 130;
      f.beginPath();
      f.moveTo(x - 60, H + 10);
      f.quadraticCurveTo(x - 10, H - h, x + 34, H - h * 0.35);
      f.quadraticCurveTo(x + 60, H - h * 0.1, x + 80, H + 10);
      f.closePath();
      f.fill();
    }
    tree(f, -70, H + 30, 360, '#060d09');
    tree(f, W + 70, H + 30, 400, '#060d09');
  }

  // ======================= 实体 =======================

  let idSeq = 1;

  class Dino {
    constructor(typeKey, wave) {
      const T = TYPES[typeKey];
      this.id = idSeq++;
      this.T = T;
      this.z = 1;
      this.wx = rand(-0.95, 0.95);            // 横向世界坐标
      this.drift = rand(-0.16, 0.16);
      this.spd = T.spd * (1 + (wave - 1) * 0.05) * rand(0.9, 1.12);
      this.hp = T.hp + (T.boss ? Math.floor((wave - 1) / 5) * 6 : 0);
      this.maxHp = this.hp;
      this.t = rand(0, 10);
      this.flash = 0;
      this.dead = false;
      this.hover = T.flying ? rand(60, 130) : 0;
      this.bob = rand(0, 6.28);
      this.face = 1;
      this.k = depthK(this.z);
      this.x = screenX(this.wx, this.k);
      this.y = groundY(this.k);
      this.scale = 1;
    }

    update(dt) {
      this.t += dt;
      this.z -= this.spd * dt;
      this.wx += this.drift * dt;
      if (this.wx > 1.05 || this.wx < -1.05) this.drift *= -1;
      this.flash = Math.max(0, this.flash - dt);

      this.k = depthK(Math.max(0, this.z));
      this.scale = this.k * this.T.size * 2.4;
      this.x = screenX(this.wx, this.k);
      this.y = groundY(this.k) - (this.T.flying
        ? (this.hover + Math.sin(this.t * 2.4 + this.bob) * 14) * this.k
        : 0);
      // 始终朝向玩家（屏幕中心）
      this.face = this.x > W / 2 ? -1 : 1;
    }

    /** 屏幕坐标 → 局部坐标 */
    toLocal(mx, my) {
      return {
        lx: (mx - this.x) / (this.scale * this.face),
        ly: (my - this.y) / this.scale
      };
    }

    /** 返回 null / 'body' / 'head' */
    hitTest(mx, my) {
      const { lx, ly } = this.toLocal(mx, my);
      const h = this.T.head;
      if ((lx - h.x) ** 2 + (ly - h.y) ** 2 <= h.r * h.r * 1.15) return 'head';
      const b = this.T.box;
      if (lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h) return 'body';
      return null;
    }

    draw(g) {
      const s = this.scale;
      // 影子（飞行单位的影子留在地面上，缩小一圈）
      const gy = groundY(this.k);
      g.fillStyle = this.T.flying ? 'rgba(0,0,0,.22)' : 'rgba(0,0,0,.38)';
      g.beginPath();
      g.ellipse(this.x, gy, 62 * s * (this.T.flying ? 0.55 : 1), 13 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.translate(this.x, this.y);
      g.scale(s * this.face, s);

      // 逼近警告：贴近时描一圈红光
      if (this.z < 0.16) {
        g.save();
        g.globalAlpha = 0.35 + Math.sin(this.t * 22) * 0.25;
        g.strokeStyle = '#ff3b2f';
        g.lineWidth = 6 / s;
        const b = this.T.box;
        g.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
        g.restore();
      }

      PAL = this.flash > 0 ? '#ffffff' : null;
      DRAW[this.T.key](g, this.t, this.T.skin);
      PAL = null;
      g.restore();

      // BOSS 血条
      if (this.T.boss && this.hp < this.maxHp) {
        const bw = 150 * this.k * 1.6, bx = this.x - bw / 2;
        const by = this.y - this.T.box.h * s - 26 * this.k * 1.6;
        g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(bx - 2, by - 2, bw + 4, 12);
        g.fillStyle = '#ff4d3d'; g.fillRect(bx, by, bw * (this.hp / this.maxHp), 8);
      }
    }
  }

  class Particle {
    constructor(x, y, col, spd, life, size, grav) {
      const a = rand(0, Math.PI * 2);
      this.x = x; this.y = y;
      this.vx = Math.cos(a) * spd;
      this.vy = Math.sin(a) * spd - spd * 0.4;
      this.life = this.max = life;
      this.col = col;
      this.size = size;
      this.grav = grav === undefined ? 620 : grav;
    }
    update(dt) {
      this.life -= dt;
      this.vy += this.grav * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      return this.life > 0;
    }
    draw(g) {
      g.globalAlpha = clamp(this.life / this.max, 0, 1);
      g.fillStyle = this.col;
      g.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
      g.globalAlpha = 1;
    }
  }

  class FloatText {
    constructor(x, y, text, col, size) {
      this.x = x; this.y = y; this.text = text; this.col = col;
      this.size = size || 22; this.life = 0.9; this.max = 0.9;
    }
    update(dt) { this.life -= dt; this.y -= 46 * dt; return this.life > 0; }
    draw(g) {
      g.globalAlpha = clamp(this.life / this.max, 0, 1);
      g.font = `800 ${this.size}px "Segoe UI", system-ui, sans-serif`;
      g.textAlign = 'center';
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(0,0,0,.75)';
      g.strokeText(this.text, this.x, this.y);
      g.fillStyle = this.col;
      g.fillText(this.text, this.x, this.y);
      g.globalAlpha = 1;
    }
  }

  // ======================= 游戏状态 =======================

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const el = {
    start: document.getElementById('overlay-start'),
    pause: document.getElementById('overlay-pause'),
    over: document.getElementById('overlay-over'),
    hiStart: document.getElementById('hi-start'),
    hiOver: document.getElementById('hi-over'),
    stScore: document.getElementById('st-score'),
    stWave: document.getElementById('st-wave'),
    stKills: document.getElementById('st-kills'),
    stAcc: document.getElementById('st-acc'),
    overTitle: document.getElementById('over-title')
  };

  const HS_KEY = 'dinoEra.highScore';
  let highScore = parseInt(localStorage.getItem(HS_KEY) || '0', 10) || 0;

  const G = {
    mode: 'menu',          // menu | playing | paused | over
    dinos: [],
    parts: [],
    texts: [],
    wave: 1,
    waveTimer: 0,          // >0 时正在显示 “WAVE N”
    spawnQueue: [],
    spawnTimer: 0,
    spawnGap: 1.2,
    hp: START_HP,
    ammo: MAG_SIZE,
    reloading: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    kills: 0,
    shots: 0,
    hits: 0,
    shake: 0,
    muzzle: 0,
    hurtFlash: 0,
    recoil: 0,
    aim: { x: W / 2, y: H * 0.6 },
    banner: null,
    bannerT: 0
  };

  function resetGame() {
    G.dinos.length = 0; G.parts.length = 0; G.texts.length = 0;
    G.wave = 0; G.hp = START_HP; G.ammo = MAG_SIZE; G.reloading = 0;
    G.score = 0; G.combo = 0; G.bestCombo = 0; G.kills = 0;
    G.shots = 0; G.hits = 0; G.shake = 0; G.muzzle = 0; G.hurtFlash = 0;
    nextWave();
  }

  function nextWave() {
    G.wave++;
    G.spawnQueue = [];
    const n = G.wave;
    const count = Math.min(4 + Math.round(n * 1.5), 20);
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      let key = 'raptor';
      if (n >= 2 && r > 0.82) key = 'trike';
      else if (n >= 2 && r > 0.62) key = 'ptero';
      else if (n >= 5 && r > 0.5) key = 'trike';
      G.spawnQueue.push(key);
    }
    if (n % 5 === 0) G.spawnQueue.push('spino');
    G.spawnGap = Math.max(0.42, 1.35 - n * 0.055);
    G.spawnTimer = 0.4;
    G.waveTimer = 1.8;
    showBanner(n % 5 === 0 ? `WAVE ${n} — BOSS 来袭!` : `WAVE ${n}`, n % 5 === 0 ? '#ff6a3d' : '#ffd35c');
    Sfx.wave();
    if (n % 5 === 0) Sfx.roar();
    if (n > 1 && n % 3 === 1) G.hp = Math.min(PLAYER_MAX_HP, G.hp + 1);
    G.ammo = MAG_SIZE;
    G.reloading = 0;
  }

  function showBanner(text, col) { G.banner = { text, col }; G.bannerT = 1.8; }

  // ======================= 射击 =======================

  function reload() {
    if (G.reloading > 0 || G.ammo === MAG_SIZE) return;
    G.reloading = RELOAD_TIME;
    Sfx.reload();
  }

  function shoot(mx, my) {
    if (G.mode !== 'playing') return;
    if (G.reloading > 0) return;
    if (G.ammo <= 0) { Sfx.dry(); reload(); return; }

    G.ammo--;
    G.shots++;
    G.muzzle = 0.07;
    G.recoil = 1;
    G.shake = Math.max(G.shake, 5);
    Sfx.shot();
    if (G.ammo === 0) reload();

    // 由近及远查找命中目标
    const order = G.dinos.slice().sort((a, b) => b.k - a.k);
    for (const d of order) {
      const part = d.hitTest(mx, my);
      if (!part) continue;
      G.hits++;
      hitDino(d, part, mx, my);
      return;
    }

    // 打空
    G.combo = 0;
    G.parts.push(new Particle(mx, my, '#8a8f86', 90, 0.3, 3, 300));
    G.texts.push(new FloatText(mx, my - 10, 'MISS', '#9fb0a5', 18));
  }

  function hitDino(d, part, mx, my) {
    const head = part === 'head';
    const dmg = head ? 2 : 1;
    d.hp -= dmg;
    d.flash = 0.08;

    const blood = d.T.skin[2];
    for (let i = 0; i < (head ? 16 : 9); i++) {
      G.parts.push(new Particle(mx, my, i % 3 === 0 ? '#ffd76a' : blood, rand(60, 300), rand(0.25, 0.6), rand(2, 5)));
    }

    if (d.hp > 0) {
      head ? Sfx.headshot() : Sfx.hit();
      if (head) G.texts.push(new FloatText(mx, my - 14, 'HEADSHOT!', '#ffd35c', 20));
      return;
    }

    // 击杀
    d.dead = true;
    G.kills++;
    G.combo++;
    G.bestCombo = Math.max(G.bestCombo, G.combo);
    const mult = comboMult();
    const gain = Math.round(d.T.score * (head ? 2 : 1) * mult);
    G.score += gain;
    Sfx.kill();
    if (d.T.boss) { Sfx.roar(); G.shake = 22; showBanner('BOSS DOWN!', '#ffd35c'); }

    G.texts.push(new FloatText(d.x, d.y - d.T.box.h * d.scale * 0.7, `+${gain}`, head ? '#ffd35c' : '#8dffb0', d.T.boss ? 34 : 24));
    for (let i = 0; i < (d.T.boss ? 60 : 22); i++) {
      G.parts.push(new Particle(d.x, d.y - d.T.box.h * d.scale * 0.5, pick([d.T.skin[0], d.T.skin[2], '#3a2a18']),
        rand(60, d.T.boss ? 460 : 300), rand(0.4, 1.1), rand(3, d.T.boss ? 9 : 6)));
    }
  }

  const comboMult = () => Math.min(4, 1 + Math.floor(G.combo / 4) * 0.5);

  function playerHurt(d) {
    G.hp -= d.T.dmg;
    G.combo = 0;
    G.hurtFlash = 0.6;
    G.shake = 20;
    Sfx.hurt(); Sfx.roar();
    G.texts.push(new FloatText(W / 2, H * 0.42, `-${d.T.dmg} HP`, '#ff5a4a', 32));
    for (let i = 0; i < 26; i++) {
      G.parts.push(new Particle(d.x, GROUND - 20, '#5b4a32', rand(80, 380), rand(0.3, 0.8), rand(3, 8)));
    }
    if (G.hp <= 0) gameOver();
  }

  function gameOver() {
    G.hp = 0;
    G.mode = 'over';
    Sfx.over();
    if (G.score > highScore) {
      highScore = G.score;
      localStorage.setItem(HS_KEY, String(highScore));
      el.overTitle.textContent = '新纪录! NEW RECORD';
    } else {
      el.overTitle.textContent = '游戏结束 GAME OVER';
    }
    el.stScore.textContent = G.score;
    el.stWave.textContent = G.wave;
    el.stKills.textContent = G.kills;
    el.stAcc.textContent = (G.shots ? Math.round(G.hits / G.shots * 100) : 0) + '%';
    el.hiOver.textContent = highScore;
    el.over.classList.remove('hidden');
  }

  // ======================= 每帧更新 =======================

  function update(dt) {
    G.muzzle = Math.max(0, G.muzzle - dt);
    G.shake = Math.max(0, G.shake - dt * 42);
    G.hurtFlash = Math.max(0, G.hurtFlash - dt);
    G.recoil = Math.max(0, G.recoil - dt * 5);
    G.bannerT = Math.max(0, G.bannerT - dt);

    if (G.mode !== 'playing') return;

    if (G.reloading > 0) {
      G.reloading -= dt;
      if (G.reloading <= 0) { G.reloading = 0; G.ammo = MAG_SIZE; }
    }

    // 出怪
    if (G.waveTimer > 0) G.waveTimer -= dt;
    else if (G.spawnQueue.length) {
      G.spawnTimer -= dt;
      if (G.spawnTimer <= 0) {
        G.dinos.push(new Dino(G.spawnQueue.shift(), G.wave));
        G.spawnTimer = G.spawnGap * rand(0.7, 1.3);
      }
    } else if (!G.dinos.length) {
      const bonus = 150 * G.wave + G.bestCombo * 20;
      G.score += bonus;
      G.texts.push(new FloatText(W / 2, H * 0.52, `WAVE CLEAR  +${bonus}`, '#8dffb0', 32));
      nextWave();
    }

    // 恐龙
    for (let i = G.dinos.length - 1; i >= 0; i--) {
      const d = G.dinos[i];
      d.update(dt);
      if (d.dead) { G.dinos.splice(i, 1); continue; }
      if (d.z <= 0) { playerHurt(d); G.dinos.splice(i, 1); }
    }

    // 特效
    for (let i = G.parts.length - 1; i >= 0; i--) if (!G.parts[i].update(dt)) G.parts.splice(i, 1);
    for (let i = G.texts.length - 1; i >= 0; i--) if (!G.texts[i].update(dt)) G.texts.splice(i, 1);
  }

  // ======================= 绘制 =======================

  function heart(g, x, y, s, filled) {
    g.beginPath();
    g.moveTo(x, y + s * 0.28);
    g.bezierCurveTo(x, y - s * 0.1, x - s * 0.5, y - s * 0.12, x - s * 0.5, y + s * 0.18);
    g.bezierCurveTo(x - s * 0.5, y + s * 0.52, x, y + s * 0.72, x, y + s * 0.95);
    g.bezierCurveTo(x, y + s * 0.72, x + s * 0.5, y + s * 0.52, x + s * 0.5, y + s * 0.18);
    g.bezierCurveTo(x + s * 0.5, y - s * 0.12, x, y - s * 0.1, x, y + s * 0.28);
    g.closePath();
    g.fillStyle = filled ? '#ff4d5e' : 'rgba(255,255,255,.16)';
    g.fill();
    g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,.55)'; g.stroke();
  }

  function label(g, text, x, y, size, col, align) {
    g.font = `800 ${size}px "Segoe UI", system-ui, sans-serif`;
    g.textAlign = align || 'left';
    g.textBaseline = 'alphabetic';
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(0,0,0,.7)';
    g.strokeText(text, x, y);
    g.fillStyle = col;
    g.fillText(text, x, y);
  }

  function drawHud(g) {
    // 生命
    for (let i = 0; i < PLAYER_MAX_HP; i++) heart(g, 44 + i * 34, 26, 30, i < G.hp);

    // 分数
    label(g, `SCORE ${G.score}`, W - 26, 42, 26, '#ffffff', 'right');
    label(g, `HIGH ${Math.max(highScore, G.score)}`, W - 26, 68, 15, '#9fd8b7', 'right');

    // 波次 + 剩余
    const remain = G.dinos.length + G.spawnQueue.length;
    label(g, `WAVE ${G.wave}`, W / 2, 42, 26, '#ffd35c', 'center');
    label(g, `剩余 ${remain}`, W / 2, 66, 15, '#cfe9dc', 'center');

    // 弹药
    const ax = 30, ay = H - 34;
    for (let i = 0; i < MAG_SIZE; i++) {
      const on = i < G.ammo && G.reloading === 0;
      g.fillStyle = on ? '#ffcf5c' : 'rgba(255,255,255,.14)';
      g.fillRect(ax + i * 17, ay, 11, 26);
      g.fillStyle = on ? '#c8801f' : 'rgba(255,255,255,.10)';
      g.fillRect(ax + i * 17, ay + 18, 11, 8);
    }
    if (G.reloading > 0) {
      const p = 1 - G.reloading / RELOAD_TIME;
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(ax, ay - 26, MAG_SIZE * 17 - 6, 14);
      g.fillStyle = '#24ff8f'; g.fillRect(ax, ay - 26, (MAG_SIZE * 17 - 6) * p, 14);
      label(g, '换弹中 RELOADING', ax, ay - 34, 15, '#24ff8f');
    } else if (G.ammo === 0) {
      label(g, '按 R 换弹', ax, ay - 12, 16, '#ff6a5a');
    }

    // 静音标记
    if (Sfx.muted) label(g, '🔇 M', W - 26, H - 26, 18, '#9fb0a5', 'right');

    // 连击
    if (G.combo >= 2) {
      const m = comboMult();
      label(g, `${G.combo} COMBO  x${m.toFixed(1)}`, W / 2, H - 30, 24, '#ffd35c', 'center');
    }

    // 波次横幅
    if (G.bannerT > 0 && G.banner) {
      const a = clamp(G.bannerT / 0.4, 0, 1);
      g.save();
      g.globalAlpha = a;
      g.textAlign = 'center';
      const scale = 1 + (1 - clamp(G.bannerT / 1.8, 0, 1)) * 0.06;
      g.translate(W / 2, H * 0.28);
      g.scale(scale, scale);
      label(g, G.banner.text, 0, 0, 58, G.banner.col, 'center');
      g.restore();
    }
  }

  function drawCrosshair(g, x, y) {
    const kick = G.recoil * 16;
    y -= kick;
    const r = 20 + G.recoil * 10;
    g.save();
    g.strokeStyle = G.reloading > 0 ? '#ff8a4a' : '#24ff8f';
    g.lineWidth = 2.5;
    g.shadowColor = g.strokeStyle;
    g.shadowBlur = 10;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    g.beginPath();
    g.moveTo(x - r - 10, y); g.lineTo(x - 6, y);
    g.moveTo(x + 6, y); g.lineTo(x + r + 10, y);
    g.moveTo(x, y - r - 10); g.lineTo(x, y - 6);
    g.moveTo(x, y + 6); g.lineTo(x, y + r + 10);
    g.stroke();
    g.fillStyle = g.strokeStyle;
    g.fillRect(x - 1.5, y - 1.5, 3, 3);
    g.restore();
  }

  function render() {
    const g = ctx;
    g.save();

    if (G.shake > 0.2) g.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));

    g.drawImage(bgCanvas, 0, 0);

    // 恐龙按深度从远到近绘制
    const sorted = G.dinos.slice().sort((a, b) => a.k - b.k);
    for (const d of sorted) d.draw(g);

    for (const p of G.parts) p.draw(g);
    g.drawImage(fgCanvas, 0, 0);
    for (const t of G.texts) t.draw(g);

    // 枪口闪光
    if (G.muzzle > 0) {
      g.fillStyle = `rgba(255,236,180,${G.muzzle * 3.2})`;
      g.fillRect(0, 0, W, H);
    }
    // 受伤红闪
    if (G.hurtFlash > 0) {
      const a = G.hurtFlash / 0.6;
      const vg = g.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.8);
      vg.addColorStop(0, 'rgba(255,0,0,0)');
      vg.addColorStop(1, `rgba(255,30,20,${0.75 * a})`);
      g.fillStyle = vg;
      g.fillRect(0, 0, W, H);
    }

    g.restore();

    if (G.mode === 'playing' || G.mode === 'paused') {
      drawHud(g);
      drawCrosshair(g, G.aim.x, G.aim.y);
    }
  }

  // ======================= 主循环 =======================

  let last = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // ======================= 输入 =======================

  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width * W, 0, W),
      y: clamp((e.clientY - r.top) / r.height * H, 0, H)
    };
  }

  canvas.addEventListener('pointermove', (e) => {
    const p = toCanvas(e);
    G.aim.x = p.x; G.aim.y = p.y;
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Sfx.init();
    const p = toCanvas(e);
    G.aim.x = p.x; G.aim.y = p.y;
    shoot(p.x, p.y);
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'r') { Sfx.init(); reload(); }
    else if (k === 'p' || k === 'escape') togglePause();
    else if (k === 'm') {
      Sfx.muted = !Sfx.muted;
      showBanner(Sfx.muted ? '静音 MUTED' : '开启声音 SOUND ON', '#8dffb0');
      G.bannerT = 0.9;
    }
    else if (k === ' ') { e.preventDefault(); Sfx.init(); shoot(G.aim.x, G.aim.y); }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.mode === 'playing') togglePause();
  });

  function togglePause() {
    if (G.mode === 'playing') { G.mode = 'paused'; el.pause.classList.remove('hidden'); }
    else if (G.mode === 'paused') { G.mode = 'playing'; el.pause.classList.add('hidden'); }
  }

  function startGame() {
    Sfx.init();
    el.start.classList.add('hidden');
    el.over.classList.add('hidden');
    el.pause.classList.add('hidden');
    resetGame();
    G.mode = 'playing';
  }

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-again').addEventListener('click', startGame);
  document.getElementById('btn-resume').addEventListener('click', togglePause);
  document.getElementById('btn-quit').addEventListener('click', () => {
    el.pause.classList.add('hidden');
    G.mode = 'menu';
    G.dinos.length = 0; G.parts.length = 0; G.texts.length = 0;
    el.hiStart.textContent = highScore;
    el.start.classList.remove('hidden');
  });

  // ======================= 启动 =======================

  buildBackground();
  el.hiStart.textContent = highScore;
  requestAnimationFrame(loop);

  // 调试用：在浏览器控制台里可以查看 / 调整运行时状态
  window.DinoEra = { state: G, TYPES, start: startGame };
})();
