/* ============================================================================
   BIT BUILDER — sprites
   Everything is drawn with canvas paths, so the game ships with no image
   assets. Each function fills the tile box at (px, py) with side S.
   ========================================================================== */

const C = {
  floor: "#131a24", floorLine: "#1a2431", via: "#22303f",
  wallTop: "#3a4a66", wallFace: "#26324a", wallEdge: "#5madeup",
  coolant: "#0e3a8a", coolantLite: "#38bdf8",
  heat: "#4a1206", flame: "#fb923c", flameHot: "#fde047",
  ice: "#9fe8f5", iceLite: "#e6fbff", iceEdge: "#5fc7dd",
  bus: "#152130", busArrow: "#38bdf8",
  gold: "#f5c451", green: "#4ade80", red: "#f87171",
  purple: "#a78bfa", cyan: "#45d0e0", amber: "#f5a524",
  steel: "#94a3b8", dark: "#0b0f16", pcb: "#116b45"
};
C.wallEdge = "#4c6088";

const CARD_COLOR = { r: "#f87171", b: "#60a5fa", y: "#facc15", g: "#4ade80" };

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const Sprites = {
  /* ------------------------------------------------------------- terrain */
  floor(ctx, px, py, S, gx, gy) {
    ctx.fillStyle = C.floor;
    ctx.fillRect(px, py, S, S);
    ctx.strokeStyle = C.floorLine;
    ctx.lineWidth = Math.max(1, S * 0.02);
    const mode = (gx * 3 + gy * 5) % 4;
    ctx.beginPath();
    if (mode === 0) { ctx.moveTo(px + S * 0.5, py); ctx.lineTo(px + S * 0.5, py + S * 0.5); ctx.lineTo(px + S, py + S * 0.5); }
    else if (mode === 1) { ctx.moveTo(px, py + S * 0.3); ctx.lineTo(px + S * 0.7, py + S * 0.3); ctx.lineTo(px + S * 0.7, py + S); }
    else if (mode === 2) { ctx.moveTo(px + S * 0.2, py + S); ctx.lineTo(px + S * 0.2, py + S * 0.4); ctx.lineTo(px + S, py + S * 0.4); }
    ctx.stroke();
    if (mode === 3) {
      ctx.fillStyle = C.via;
      ctx.beginPath();
      ctx.arc(px + S * 0.5, py + S * 0.5, S * 0.07, 0, 7);
      ctx.fill();
    }
  },

  wall(ctx, px, py, S) {
    ctx.fillStyle = C.wallFace;
    ctx.fillRect(px, py, S, S);
    ctx.fillStyle = C.wallTop;
    ctx.fillRect(px + S * 0.06, py + S * 0.06, S * 0.88, S * 0.88);
    ctx.strokeStyle = C.wallEdge;
    ctx.lineWidth = Math.max(1, S * 0.04);
    ctx.strokeRect(px + S * 0.06, py + S * 0.06, S * 0.88, S * 0.88);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(px + S * 0.2, py + S * 0.24, S * 0.6, S * 0.1);
    ctx.fillRect(px + S * 0.2, py + S * 0.44, S * 0.6, S * 0.1);
    ctx.fillRect(px + S * 0.2, py + S * 0.64, S * 0.6, S * 0.1);
  },

  coolant(ctx, px, py, S, t, gx, gy) {
    ctx.fillStyle = C.coolant;
    ctx.fillRect(px, py, S, S);
    ctx.strokeStyle = C.coolantLite;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1, S * 0.05);
    for (let i = 0; i < 3; i++) {
      const yy = py + S * (0.25 + i * 0.25) + Math.sin(t * 2 + i + gx + gy) * S * 0.05;
      ctx.beginPath();
      ctx.moveTo(px + S * 0.1, yy);
      ctx.quadraticCurveTo(px + S * 0.5, yy - S * 0.12, px + S * 0.9, yy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },

  overheat(ctx, px, py, S, t, gx, gy) {
    ctx.fillStyle = C.heat;
    ctx.fillRect(px, py, S, S);
    for (let i = 0; i < 3; i++) {
      const phase = t * 4 + i * 2.1 + gx + gy;
      const h = S * (0.45 + 0.2 * Math.abs(Math.sin(phase)));
      const cx = px + S * (0.25 + i * 0.25);
      ctx.fillStyle = i === 1 ? C.flameHot : C.flame;
      ctx.beginPath();
      ctx.moveTo(cx, py + S * 0.92 - h);
      ctx.quadraticCurveTo(cx + S * 0.14, py + S * 0.9 - h * 0.35, cx, py + S * 0.92);
      ctx.quadraticCurveTo(cx - S * 0.14, py + S * 0.9 - h * 0.35, cx, py + S * 0.92 - h);
      ctx.fill();
    }
  },

  ice(ctx, px, py, S, corner) {
    const g = ctx.createLinearGradient(px, py, px + S, py + S);
    g.addColorStop(0, C.iceLite);
    g.addColorStop(1, C.ice);
    ctx.fillStyle = g;
    ctx.fillRect(px, py, S, S);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = Math.max(1, S * 0.03);
    ctx.beginPath();
    ctx.moveTo(px + S * 0.15, py + S * 0.7);
    ctx.lineTo(px + S * 0.45, py + S * 0.25);
    ctx.moveTo(px + S * 0.55, py + S * 0.8);
    ctx.lineTo(px + S * 0.85, py + S * 0.4);
    ctx.stroke();
    if (corner) {
      const sides = { "1": ["up", "left"], "2": ["up", "right"], "3": ["down", "right"], "4": ["down", "left"] }[corner];
      ctx.strokeStyle = C.iceEdge;
      ctx.lineWidth = Math.max(2, S * 0.12);
      ctx.beginPath();
      for (const s of sides) {
        if (s === "up") { ctx.moveTo(px, py + S * 0.05); ctx.lineTo(px + S, py + S * 0.05); }
        if (s === "down") { ctx.moveTo(px, py + S * 0.95); ctx.lineTo(px + S, py + S * 0.95); }
        if (s === "left") { ctx.moveTo(px + S * 0.05, py); ctx.lineTo(px + S * 0.05, py + S); }
        if (s === "right") { ctx.moveTo(px + S * 0.95, py); ctx.lineTo(px + S * 0.95, py + S); }
      }
      ctx.stroke();
    }
  },

  bus(ctx, px, py, S, dir, t) {
    ctx.fillStyle = C.bus;
    ctx.fillRect(px, py, S, S);
    const rot = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir];
    ctx.save();
    ctx.translate(px + S / 2, py + S / 2);
    ctx.rotate(rot);
    ctx.strokeStyle = C.busArrow;
    ctx.lineWidth = Math.max(1.5, S * 0.07);
    for (let i = 0; i < 3; i++) {
      const off = ((t * 1.6 + i / 3) % 1) * S - S / 2;
      ctx.globalAlpha = 0.3 + 0.5 * Math.sin(Math.PI * ((off + S / 2) / S));
      ctx.beginPath();
      ctx.moveTo(off - S * 0.12, -S * 0.18);
      ctx.lineTo(off + S * 0.06, 0);
      ctx.lineTo(off - S * 0.12, S * 0.18);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  socket(ctx, px, py, S, open, t) {
    Sprites.floor(ctx, px, py, S, 1, 1);
    ctx.fillStyle = open ? "#14532d" : "#1c1917";
    rr(ctx, px + S * 0.1, py + S * 0.1, S * 0.8, S * 0.8, S * 0.12);
    ctx.fill();
    ctx.strokeStyle = open ? C.green : C.gold;
    ctx.lineWidth = Math.max(1.5, S * 0.05);
    ctx.stroke();
    ctx.fillStyle = open ? C.green : C.gold;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        ctx.globalAlpha = open ? 0.35 : 0.8;
        ctx.fillRect(px + S * (0.22 + i * 0.16), py + S * (0.22 + j * 0.16), S * 0.07, S * 0.07);
      }
    }
    ctx.globalAlpha = 1;
    if (open) {
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 5);
      ctx.fillStyle = C.green;
      ctx.fillRect(px + S * 0.1, py + S * 0.1, S * 0.8, S * 0.8);
      ctx.globalAlpha = 1;
    }
  },

  exit(ctx, px, py, S, t) {
    Sprites.floor(ctx, px, py, S, 2, 2);
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.fillStyle = "#052e1a";
    rr(ctx, px + S * 0.08, py + S * 0.08, S * 0.84, S * 0.84, S * 0.16);
    ctx.fill();
    ctx.strokeStyle = C.green;
    ctx.globalAlpha = 0.5 + 0.5 * pulse;
    ctx.lineWidth = Math.max(2, S * 0.07);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.green;
    ctx.lineWidth = Math.max(2, S * 0.09);
    ctx.beginPath();
    ctx.arc(px + S / 2, py + S * 0.55, S * 0.22, -Math.PI * 0.35, Math.PI * 1.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + S / 2, py + S * 0.22);
    ctx.lineTo(px + S / 2, py + S * 0.5);
    ctx.stroke();
  },

  hint(ctx, px, py, S) {
    Sprites.floor(ctx, px, py, S, 3, 1);
    ctx.fillStyle = "#0f2c3a";
    rr(ctx, px + S * 0.15, py + S * 0.18, S * 0.7, S * 0.55, S * 0.08);
    ctx.fill();
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = Math.max(1, S * 0.04);
    ctx.stroke();
    ctx.fillStyle = C.cyan;
    ctx.font = `bold ${Math.round(S * 0.42)}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", px + S * 0.5, py + S * 0.46);
    ctx.fillRect(px + S * 0.35, py + S * 0.78, S * 0.3, S * 0.06);
  },

  surge(ctx, px, py, S, t) {
    Sprites.floor(ctx, px, py, S, 4, 2);
    ctx.fillStyle = "#3b0764";
    ctx.beginPath();
    ctx.arc(px + S / 2, py + S / 2, S * 0.34, 0, 7);
    ctx.fill();
    ctx.strokeStyle = C.purple;
    ctx.lineWidth = Math.max(1, S * 0.05);
    ctx.stroke();
    ctx.fillStyle = 0.5 + 0.5 * Math.sin(t * 8) > 0.5 ? C.flameHot : C.amber;
    ctx.beginPath();
    ctx.moveTo(px + S * 0.55, py + S * 0.22);
    ctx.lineTo(px + S * 0.38, py + S * 0.52);
    ctx.lineTo(px + S * 0.5, py + S * 0.52);
    ctx.lineTo(px + S * 0.44, py + S * 0.78);
    ctx.lineTo(px + S * 0.64, py + S * 0.46);
    ctx.lineTo(px + S * 0.51, py + S * 0.46);
    ctx.closePath();
    ctx.fill();
  },

  scrubber(ctx, px, py, S, t) {
    Sprites.floor(ctx, px, py, S, 5, 3);
    ctx.fillStyle = "#450a0a";
    rr(ctx, px + S * 0.14, py + S * 0.14, S * 0.72, S * 0.72, S * 0.14);
    ctx.fill();
    ctx.strokeStyle = C.red;
    ctx.lineWidth = Math.max(1, S * 0.05);
    ctx.stroke();
    ctx.fillStyle = C.red;
    const bob = Math.sin(t * 3) * S * 0.03;
    ctx.beginPath();
    ctx.arc(px + S * 0.5, py + S * 0.42 + bob, S * 0.17, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(px + S * 0.33, py + S * 0.42 + bob, S * 0.34, S * 0.14);
    ctx.fillStyle = "#450a0a";
    ctx.beginPath();
    ctx.arc(px + S * 0.43, py + S * 0.4 + bob, S * 0.045, 0, 7);
    ctx.arc(px + S * 0.57, py + S * 0.4 + bob, S * 0.045, 0, 7);
    ctx.fill();
    ctx.fillStyle = C.red;
    ctx.fillRect(px + S * 0.36, py + S * 0.62 + bob, S * 0.28, S * 0.1);
  },

  port(ctx, px, py, S, t) {
    ctx.fillStyle = "#0a1626";
    ctx.fillRect(px, py, S, S);
    ctx.save();
    ctx.translate(px + S / 2, py + S / 2);
    for (let i = 0; i < 3; i++) {
      ctx.rotate(t * (i % 2 ? -1.4 : 1.8) + i);
      ctx.strokeStyle = i === 1 ? C.cyan : "#2563eb";
      ctx.lineWidth = Math.max(1, S * 0.05);
      ctx.beginPath();
      ctx.arc(0, 0, S * (0.12 + i * 0.11), 0.6, 4.6);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = C.cyan;
    ctx.beginPath();
    ctx.arc(px + S / 2, py + S / 2, S * 0.07, 0, 7);
    ctx.fill();
  },

  toggleSwitch(ctx, px, py, S) {
    Sprites.floor(ctx, px, py, S, 6, 4);
    ctx.fillStyle = "#064e3b";
    rr(ctx, px + S * 0.18, py + S * 0.18, S * 0.64, S * 0.64, S * 0.1);
    ctx.fill();
    ctx.strokeStyle = C.green;
    ctx.lineWidth = Math.max(1, S * 0.05);
    ctx.stroke();
    ctx.fillStyle = C.green;
    ctx.beginPath();
    ctx.arc(px + S * 0.5, py + S * 0.5, S * 0.16, 0, 7);
    ctx.fill();
  },

  toggleWall(ctx, px, py, S, open) {
    Sprites.floor(ctx, px, py, S, 7, 5);
    ctx.globalAlpha = open ? 0.22 : 0.95;
    ctx.fillStyle = open ? "#134e4a" : "#0f766e";
    rr(ctx, px + S * 0.04, py + S * 0.04, S * 0.92, S * 0.92, S * 0.08);
    ctx.fill();
    ctx.strokeStyle = C.green;
    ctx.lineWidth = Math.max(1, S * 0.05);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (!open) {
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = Math.max(1, S * 0.03);
      for (let i = -1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(px + S * (i * 0.35), py + S);
        ctx.lineTo(px + S * (i * 0.35 + 0.5), py);
        ctx.stroke();
      }
    }
  },

  door(ctx, px, py, S, color) {
    const col = CARD_COLOR[color];
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(px, py, S, S);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.85;
    rr(ctx, px + S * 0.06, py + S * 0.06, S * 0.88, S * 0.88, S * 0.1);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(px + S * 0.06, py + S * 0.44, S * 0.88, S * 0.12);
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(px + S * 0.5, py + S * 0.5, S * 0.15, 0, 7);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(px + S * 0.5, py + S * 0.5, S * 0.07, 0, 7);
    ctx.fill();
  },

  /* --------------------------------------------------------------- items */
  card(ctx, px, py, S, color) {
    const col = CARD_COLOR[color];
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    rr(ctx, px + S * 0.18, py + S * 0.3, S * 0.64, S * 0.44, S * 0.06);
    ctx.fill();
    ctx.fillStyle = col;
    rr(ctx, px + S * 0.16, py + S * 0.26, S * 0.64, S * 0.44, S * 0.06);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(px + S * 0.22, py + S * 0.34, S * 0.18, S * 0.14);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(px + S * 0.46, py + S * 0.36, S * 0.28, S * 0.05);
    ctx.fillRect(px + S * 0.46, py + S * 0.46, S * 0.2, S * 0.05);
    if (color === "g") {
      ctx.fillStyle = "#052e16";
      ctx.font = `bold ${Math.round(S * 0.18)}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.fillText("root", px + S * 0.5, py + S * 0.65);
    }
  },

  tool(ctx, px, py, S, kind) {
    ctx.save();
    ctx.translate(px, py);
    if (kind === "F") {                       // coolant seal
      ctx.fillStyle = "#0ea5e9";
      ctx.beginPath();
      ctx.moveTo(S * 0.5, S * 0.18);
      ctx.bezierCurveTo(S * 0.85, S * 0.55, S * 0.72, S * 0.85, S * 0.5, S * 0.85);
      ctx.bezierCurveTo(S * 0.28, S * 0.85, S * 0.15, S * 0.55, S * 0.5, S * 0.18);
      ctx.fill();
      ctx.strokeStyle = "#e0f2fe";
      ctx.lineWidth = S * 0.06;
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.6, S * 0.16, 0.4, 3.4);
      ctx.stroke();
    } else if (kind === "H") {                // heatsink
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(S * 0.16, S * 0.62, S * 0.68, S * 0.14);
      for (let i = 0; i < 4; i++) ctx.fillRect(S * (0.2 + i * 0.16), S * 0.24, S * 0.09, S * 0.4);
      ctx.fillStyle = C.flame;
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.86, S * 0.07, 0, 7);
      ctx.fill();
    } else if (kind === "K") {                // grip pads
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(S * 0.24, S * 0.24);
      ctx.lineTo(S * 0.52, S * 0.24);
      ctx.lineTo(S * 0.56, S * 0.56);
      ctx.lineTo(S * 0.8, S * 0.62);
      ctx.lineTo(S * 0.8, S * 0.76);
      ctx.lineTo(S * 0.24, S * 0.76);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#78350f";
      for (let i = 0; i < 4; i++) ctx.fillRect(S * (0.28 + i * 0.13), S * 0.78, S * 0.08, S * 0.08);
    } else {                                  // mag grips
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = S * 0.16;
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.5, S * 0.24, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(S * 0.26, S * 0.5); ctx.lineTo(S * 0.26, S * 0.74);
      ctx.moveTo(S * 0.74, S * 0.5); ctx.lineTo(S * 0.74, S * 0.74);
      ctx.stroke();
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = S * 0.16;
      ctx.beginPath();
      ctx.moveTo(S * 0.26, S * 0.74); ctx.lineTo(S * 0.26, S * 0.84);
      ctx.moveTo(S * 0.74, S * 0.74); ctx.lineTo(S * 0.74, S * 0.84);
      ctx.stroke();
    }
    ctx.restore();
  },

  hardware(ctx, px, py, S, kind, t) {
    const bob = Math.sin(t * 3 + px * 0.05) * S * 0.03;
    ctx.save();
    ctx.translate(px, py + bob);
    ctx.fillStyle = "rgba(69,208,224,0.12)";
    ctx.beginPath();
    ctx.arc(S * 0.5, S * 0.5, S * 0.42, 0, 7);
    ctx.fill();
    switch (kind) {
      case "cpu":
        ctx.fillStyle = C.steel;
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(S * (0.28 + i * 0.13), S * 0.16, S * 0.06, S * 0.1);
          ctx.fillRect(S * (0.28 + i * 0.13), S * 0.74, S * 0.06, S * 0.1);
          ctx.fillRect(S * 0.16, S * (0.28 + i * 0.13), S * 0.1, S * 0.06);
          ctx.fillRect(S * 0.74, S * (0.28 + i * 0.13), S * 0.1, S * 0.06);
        }
        ctx.fillStyle = "#1e293b";
        rr(ctx, S * 0.24, S * 0.24, S * 0.52, S * 0.52, S * 0.05); ctx.fill();
        ctx.strokeStyle = C.cyan; ctx.lineWidth = S * 0.045; ctx.stroke();
        ctx.fillStyle = C.cyan;
        ctx.fillRect(S * 0.4, S * 0.4, S * 0.2, S * 0.2);
        break;
      case "ram":
        ctx.fillStyle = C.pcb;
        rr(ctx, S * 0.16, S * 0.28, S * 0.68, S * 0.4, S * 0.04); ctx.fill();
        ctx.fillStyle = "#0f172a";
        for (let i = 0; i < 3; i++) ctx.fillRect(S * (0.24 + i * 0.2), S * 0.34, S * 0.14, S * 0.18);
        ctx.fillStyle = C.gold;
        for (let i = 0; i < 8; i++) ctx.fillRect(S * (0.19 + i * 0.084), S * 0.6, S * 0.05, S * 0.08);
        break;
      case "gpu":
        ctx.fillStyle = "#1e293b";
        rr(ctx, S * 0.12, S * 0.3, S * 0.76, S * 0.42, S * 0.05); ctx.fill();
        ctx.strokeStyle = C.purple; ctx.lineWidth = S * 0.04; ctx.stroke();
        ctx.fillStyle = C.purple;
        ctx.beginPath(); ctx.arc(S * 0.38, S * 0.51, S * 0.11, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(S * 0.66, S * 0.51, S * 0.11, 0, 7); ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.beginPath(); ctx.arc(S * 0.38, S * 0.51, S * 0.04, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(S * 0.66, S * 0.51, S * 0.04, 0, 7); ctx.fill();
        break;
      case "ssd":
        ctx.fillStyle = "#334155";
        rr(ctx, S * 0.2, S * 0.22, S * 0.6, S * 0.56, S * 0.06); ctx.fill();
        ctx.strokeStyle = C.steel; ctx.lineWidth = S * 0.035; ctx.stroke();
        ctx.fillStyle = C.cyan;
        ctx.fillRect(S * 0.28, S * 0.32, S * 0.44, S * 0.08);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillRect(S * 0.28, S * 0.48, S * 0.3, S * 0.05);
        ctx.fillRect(S * 0.28, S * 0.58, S * 0.4, S * 0.05);
        break;
      case "psu":                              // brick with an IEC inlet, not a power symbol
        ctx.fillStyle = "#1f2937";
        rr(ctx, S * 0.14, S * 0.26, S * 0.72, S * 0.48, S * 0.06); ctx.fill();
        ctx.strokeStyle = C.amber; ctx.lineWidth = S * 0.04; ctx.stroke();
        ctx.fillStyle = "#0b1220";
        rr(ctx, S * 0.2, S * 0.36, S * 0.26, S * 0.28, S * 0.05); ctx.fill();
        ctx.fillStyle = C.amber;
        ctx.fillRect(S * 0.25, S * 0.42, S * 0.05, S * 0.12);
        ctx.fillRect(S * 0.36, S * 0.42, S * 0.05, S * 0.12);
        ctx.strokeStyle = C.steel; ctx.lineWidth = S * 0.035;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(S * 0.54, S * (0.38 + i * 0.11));
          ctx.lineTo(S * 0.8, S * (0.38 + i * 0.11));
          ctx.stroke();
        }
        break;
      case "fan":
        ctx.fillStyle = "#1f2937";
        rr(ctx, S * 0.16, S * 0.16, S * 0.68, S * 0.68, S * 0.08); ctx.fill();
        ctx.save();
        ctx.translate(S * 0.5, S * 0.5);
        ctx.rotate(t * 3);
        ctx.fillStyle = C.steel;
        for (let i = 0; i < 5; i++) {
          ctx.rotate((Math.PI * 2) / 5);
          ctx.beginPath();
          ctx.ellipse(S * 0.14, 0, S * 0.14, S * 0.06, 0.6, 0, 7);
          ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = C.cyan;
        ctx.beginPath(); ctx.arc(S * 0.5, S * 0.5, S * 0.07, 0, 7); ctx.fill();
        break;
      case "nic":
        ctx.fillStyle = C.pcb;
        rr(ctx, S * 0.16, S * 0.3, S * 0.68, S * 0.4, S * 0.04); ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(S * 0.56, S * 0.34, S * 0.24, S * 0.24);
        ctx.fillStyle = C.gold;
        ctx.fillRect(S * 0.6, S * 0.38, S * 0.16, S * 0.1);
        ctx.fillStyle = C.green;
        ctx.beginPath(); ctx.arc(S * 0.28, S * 0.62, S * 0.045, 0, 7); ctx.fill();
        break;
      default:                                    // mobo
        ctx.fillStyle = C.pcb;
        rr(ctx, S * 0.16, S * 0.16, S * 0.68, S * 0.68, S * 0.05); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = S * 0.03;
        ctx.beginPath();
        ctx.moveTo(S * 0.24, S * 0.3); ctx.lineTo(S * 0.5, S * 0.3); ctx.lineTo(S * 0.5, S * 0.66);
        ctx.moveTo(S * 0.3, S * 0.74); ctx.lineTo(S * 0.72, S * 0.74); ctx.lineTo(S * 0.72, S * 0.4);
        ctx.stroke();
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(S * 0.54, S * 0.24, S * 0.2, S * 0.16);
    }
    ctx.restore();
  },

  software(ctx, px, py, S, kind, t) {
    const bob = Math.sin(t * 3 + py * 0.05) * S * 0.03;
    ctx.save();
    ctx.translate(px, py + bob);
    ctx.fillStyle = "rgba(167,139,250,0.14)";
    ctx.beginPath();
    ctx.arc(S * 0.5, S * 0.5, S * 0.42, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#1e1b4b";
    switch (kind) {
      case "os":
        rr(ctx, S * 0.18, S * 0.22, S * 0.64, S * 0.56, S * 0.06); ctx.fill();
        ctx.strokeStyle = C.purple; ctx.lineWidth = S * 0.04; ctx.stroke();
        ctx.fillStyle = C.purple;
        ctx.fillRect(S * 0.18, S * 0.22, S * 0.64, S * 0.12);
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillRect(S * 0.26, S * 0.44, S * 0.36, S * 0.05);
        ctx.fillRect(S * 0.26, S * 0.56, S * 0.24, S * 0.05);
        break;
      case "driver":
        ctx.save();
        ctx.translate(S * 0.5, S * 0.5);
        ctx.rotate(t * 1.2);
        ctx.fillStyle = "#c4b5fd";
        for (let i = 0; i < 6; i++) {
          ctx.rotate(Math.PI / 3);
          ctx.fillRect(-S * 0.05, -S * 0.34, S * 0.1, S * 0.16);
        }
        ctx.beginPath(); ctx.arc(0, 0, S * 0.2, 0, 7); ctx.fill();
        ctx.fillStyle = "#1e1b4b";
        ctx.beginPath(); ctx.arc(0, 0, S * 0.08, 0, 7); ctx.fill();
        ctx.restore();
        break;
      case "compiler":
        rr(ctx, S * 0.16, S * 0.24, S * 0.68, S * 0.52, S * 0.06); ctx.fill();
        ctx.strokeStyle = C.green; ctx.lineWidth = S * 0.045;
        ctx.beginPath();
        ctx.moveTo(S * 0.4, S * 0.36); ctx.lineTo(S * 0.28, S * 0.5); ctx.lineTo(S * 0.4, S * 0.64);
        ctx.moveTo(S * 0.6, S * 0.36); ctx.lineTo(S * 0.72, S * 0.5); ctx.lineTo(S * 0.6, S * 0.64);
        ctx.stroke();
        break;
      case "antivirus":
        ctx.fillStyle = "#312e81";
        ctx.beginPath();
        ctx.moveTo(S * 0.5, S * 0.16);
        ctx.lineTo(S * 0.82, S * 0.3);
        ctx.quadraticCurveTo(S * 0.82, S * 0.72, S * 0.5, S * 0.86);
        ctx.quadraticCurveTo(S * 0.18, S * 0.72, S * 0.18, S * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = C.cyan; ctx.lineWidth = S * 0.045; ctx.stroke();
        ctx.strokeStyle = C.green; ctx.lineWidth = S * 0.07;
        ctx.beginPath();
        ctx.moveTo(S * 0.36, S * 0.5); ctx.lineTo(S * 0.47, S * 0.62); ctx.lineTo(S * 0.66, S * 0.38);
        ctx.stroke();
        break;
      case "database":
        ctx.fillStyle = "#4c1d95";
        ctx.beginPath();
        ctx.ellipse(S * 0.5, S * 0.3, S * 0.28, S * 0.1, 0, 0, 7);
        ctx.fill();
        ctx.fillRect(S * 0.22, S * 0.3, S * 0.56, S * 0.38);
        ctx.beginPath();
        ctx.ellipse(S * 0.5, S * 0.68, S * 0.28, S * 0.1, 0, 0, 7);
        ctx.fill();
        ctx.strokeStyle = C.purple; ctx.lineWidth = S * 0.035;
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          ctx.ellipse(S * 0.5, S * (0.44 + i * 0.14), S * 0.28, S * 0.1, 0, 0.2, Math.PI - 0.2);
          ctx.stroke();
        }
        break;
      default:                                    // browser
        ctx.fillStyle = "#1e3a8a";
        ctx.beginPath(); ctx.arc(S * 0.5, S * 0.5, S * 0.3, 0, 7); ctx.fill();
        ctx.strokeStyle = C.cyan; ctx.lineWidth = S * 0.035;
        ctx.beginPath(); ctx.arc(S * 0.5, S * 0.5, S * 0.3, 0, 7); ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(S * 0.5, S * 0.5, S * 0.13, S * 0.3, 0, 0, 7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(S * 0.2, S * 0.5); ctx.lineTo(S * 0.8, S * 0.5);
        ctx.stroke();
    }
    ctx.restore();
  },

  crate(ctx, px, py, S) {
    ctx.fillStyle = "#3f3f46";
    rr(ctx, px + S * 0.06, py + S * 0.06, S * 0.88, S * 0.88, S * 0.08);
    ctx.fill();
    ctx.strokeStyle = "#71717a";
    ctx.lineWidth = Math.max(1, S * 0.05);
    ctx.stroke();
    ctx.fillStyle = "#18181b";
    for (let i = 0; i < 3; i++) ctx.fillRect(px + S * 0.16, py + S * (0.18 + i * 0.24), S * 0.68, S * 0.14);
    ctx.fillStyle = C.green;
    ctx.beginPath();
    ctx.arc(px + S * 0.76, py + S * 0.25, S * 0.04, 0, 7);
    ctx.fill();
  },

  player(ctx, px, py, S, dir, t) {
    const step = Math.sin(t * 12) * S * 0.02;
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(S * 0.5, S * 0.88, S * 0.26, S * 0.08, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#e2e8f0";                     // lab coat / body
    rr(ctx, S * 0.26, S * 0.36 + step, S * 0.48, S * 0.46, S * 0.12);
    ctx.fill();
    ctx.fillStyle = C.cyan;
    ctx.fillRect(S * 0.26, S * 0.56 + step, S * 0.48, S * 0.06);
    ctx.fillStyle = "#cbd5e1";                     // helmet
    ctx.beginPath();
    ctx.arc(S * 0.5, S * 0.34 + step, S * 0.2, 0, 7);
    ctx.fill();
    const vx = { left: -0.09, right: 0.09, up: 0, down: 0 }[dir] || 0;
    const vy = { up: -0.05, down: 0.04, left: 0, right: 0 }[dir] || 0;
    ctx.fillStyle = dir === "up" ? "#475569" : "#0f172a";
    rr(ctx, S * (0.38 + vx), S * (0.28 + vy) + step, S * 0.24, S * 0.14, S * 0.05);
    ctx.fill();
    if (dir !== "up") {
      ctx.fillStyle = C.cyan;
      ctx.fillRect(S * (0.4 + vx), S * (0.31 + vy) + step, S * 0.08, S * 0.04);
    }
    ctx.strokeStyle = C.amber;                     // antenna
    ctx.lineWidth = S * 0.035;
    ctx.beginPath();
    ctx.moveTo(S * 0.62, S * 0.2 + step);
    ctx.lineTo(S * 0.68, S * 0.1 + step);
    ctx.stroke();
    ctx.fillStyle = C.amber;
    ctx.beginPath();
    ctx.arc(S * 0.68, S * 0.09 + step, S * 0.04, 0, 7);
    ctx.fill();
    ctx.restore();
  },

  monster(ctx, px, py, S, type, dir, t) {
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(S * 0.5, S * 0.86, S * 0.24, S * 0.07, 0, 0, 7);
    ctx.fill();
    if (type === "@") {                            // bug
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = S * 0.05;
      for (let i = 0; i < 3; i++) {
        const yy = S * (0.36 + i * 0.16);
        const wob = Math.sin(t * 10 + i) * S * 0.03;
        ctx.beginPath();
        ctx.moveTo(S * 0.3, yy); ctx.lineTo(S * 0.12, yy + wob);
        ctx.moveTo(S * 0.7, yy); ctx.lineTo(S * 0.88, yy - wob);
        ctx.stroke();
      }
      ctx.fillStyle = "#b91c1c";
      ctx.beginPath();
      ctx.ellipse(S * 0.5, S * 0.52, S * 0.22, S * 0.28, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "#fca5a5";
      ctx.lineWidth = S * 0.035;
      ctx.beginPath();
      ctx.moveTo(S * 0.5, S * 0.26); ctx.lineTo(S * 0.5, S * 0.78);
      ctx.stroke();
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(S * 0.42, S * 0.34, S * 0.045, 0, 7);
      ctx.arc(S * 0.58, S * 0.34, S * 0.045, 0, 7);
      ctx.fill();
    } else if (type === "%") {                     // glitch
      const j = Math.sin(t * 20) * S * 0.03;
      ctx.fillStyle = "#7c3aed";
      ctx.fillRect(S * 0.24, S * 0.26, S * 0.52, S * 0.5);
      ctx.fillStyle = "#22d3ee";
      ctx.fillRect(S * 0.24 + j, S * 0.36, S * 0.52, S * 0.08);
      ctx.fillStyle = "#f472b6";
      ctx.fillRect(S * 0.24 - j, S * 0.56, S * 0.52, S * 0.07);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(S * 0.34, S * 0.44, S * 0.1, S * 0.08);
      ctx.fillRect(S * 0.56, S * 0.44, S * 0.1, S * 0.08);
    } else if (type === "&") {                     // trojan
      ctx.fillStyle = "#ea580c";
      ctx.beginPath();
      ctx.moveTo(S * 0.5, S * 0.18);
      ctx.lineTo(S * 0.84, S * 0.5);
      ctx.lineTo(S * 0.68, S * 0.82);
      ctx.lineTo(S * 0.32, S * 0.82);
      ctx.lineTo(S * 0.16, S * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#fdba74";
      ctx.lineWidth = S * 0.04;
      ctx.stroke();
      ctx.fillStyle = "#fff7ed";
      ctx.beginPath();
      ctx.moveTo(S * 0.34, S * 0.62);
      for (let i = 0; i < 4; i++) {
        ctx.lineTo(S * (0.38 + i * 0.08), S * 0.72);
        ctx.lineTo(S * (0.42 + i * 0.08), S * 0.62);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#450a0a";
      ctx.beginPath();
      ctx.arc(S * 0.4, S * 0.44, S * 0.055, 0, 7);
      ctx.arc(S * 0.6, S * 0.44, S * 0.055, 0, 7);
      ctx.fill();
    } else {                                       // packet
      ctx.save();
      ctx.translate(S * 0.5, S * 0.5);
      ctx.rotate(t * 6);
      ctx.fillStyle = "#0284c7";
      ctx.beginPath();
      ctx.moveTo(0, -S * 0.28); ctx.lineTo(S * 0.28, 0);
      ctx.lineTo(0, S * 0.28); ctx.lineTo(-S * 0.28, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#7dd3fc";
      ctx.lineWidth = S * 0.04;
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#e0f2fe";
      ctx.font = `bold ${Math.round(S * 0.24)}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("01", S * 0.5, S * 0.5);
    }
    ctx.restore();
  }
};
