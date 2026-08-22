/**
 * Git Quest — animated commit-graph visualiser.
 *
 * Turns a GitSim repo into an SVG DAG: commits are circles laid out by
 * generation (left to right) and branch lane (top to bottom), refs are pills
 * that glide to whichever commit they point at. Movement is tweened in JS so
 * edges stay glued to the nodes while everything slides.
 */
(function (global) {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const LANE_COLORS = ["#38bdf8", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#fb7185", "#22d3ee"];

  const el = (name, attrs, parent) => {
    const node = document.createElementNS(SVGNS, name);
    for (const k in (attrs || {})) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  };

  class GitViz {
    constructor(svg, opts) {
      this.svg = svg;
      this.o = Object.assign({ r: 20, dx: 104, dy: 92, pad: 46, minW: 660, minH: 330,
                               labels: true, messages: true, duration: 430 }, opts || {});
      this.gEdges = el("g", { class: "viz-edges" }, svg);
      this.gNodes = el("g", { class: "viz-nodes" }, svg);
      this.gRefs = el("g", { class: "viz-refs" }, svg);
      this.nodes = new Map();   // id -> { g, circle, text, msg }
      this.refs = new Map();    // key -> { g }
      this.edges = new Map();   // key -> path
      this.pos = new Map();     // id -> { x, y } currently painted
      this.view = null;         // current viewBox {x,y,w,h}
      this.raf = null;
    }

    // ---------------- layout ----------------

    /** Pure layout: repo -> { nodes, edges, refs, bounds }. */
    static plan(repo, o) {
      const live = global.GitSim.reachable(repo);
      const ids = [...live].filter((id) => repo.commits[id]);

      // generation = longest path from a root, so merges are pushed right
      const depth = {};
      const dep = (id, guard) => {
        if (depth[id] != null) return depth[id];
        if (guard.has(id)) return 0;
        guard.add(id);
        const c = repo.commits[id];
        let d = 0;
        if (c) for (const p of c.parents) if (repo.commits[p]) d = Math.max(d, dep(p, guard) + 1);
        return (depth[id] = d);
      };
      ids.forEach((id) => dep(id, new Set()));

      // lane = first branch (in creation order) whose history contains the commit
      const branchOrder = repo.order.filter((b) => repo.branches[b] != null)
        .concat(Object.keys(repo.branches).filter((b) => !repo.order.includes(b) && repo.branches[b] != null));
      const historyOf = (tip) => {
        const seen = new Set(); const st = [tip];
        while (st.length) {
          const id = st.pop();
          if (!id || seen.has(id)) continue;
          seen.add(id);
          const c = repo.commits[id];
          if (c) c.parents.forEach((p) => st.push(p));
        }
        return seen;
      };
      const histories = branchOrder.map((b) => historyOf(repo.branches[b]));
      const laneOf = (id) => {
        for (let i = 0; i < histories.length; i++) if (histories[i].has(id)) return i;
        return branchOrder.length;   // reachable only via HEAD or a tag
      };

      const sorted = ids.slice().sort((a, b) =>
        depth[a] - depth[b] || laneOf(a) - laneOf(b) || repo.commits[a].n - repo.commits[b].n);

      const taken = new Set();
      const nodes = sorted.map((id) => {
        let lane = laneOf(id);
        while (taken.has(depth[id] + ":" + lane)) lane++;
        taken.add(depth[id] + ":" + lane);
        return {
          id, lane, gen: depth[id],
          x: o.pad + depth[id] * o.dx,
          y: o.pad + lane * o.dy,
          commit: repo.commits[id],
          merge: repo.commits[id].parents.length > 1
        };
      });
      const byId = new Map(nodes.map((n) => [n.id, n]));

      const edges = [];
      for (const n of nodes) {
        n.commit.parents.forEach((p, i) => {
          if (byId.has(p)) edges.push({ key: p + ">" + n.id, from: p, to: n.id, second: i > 0 });
        });
      }

      // ref pills, stacked per commit
      const headId = repo.head.type === "branch" ? repo.branches[repo.head.name] : repo.head.id;
      const refs = [];
      const stack = {};
      const push = (commitId, text, kind) => {
        if (!byId.has(commitId)) return;
        const slot = (stack[commitId] = (stack[commitId] || 0));
        stack[commitId] = slot + 1;
        refs.push({ key: kind + ":" + text, commitId, text, kind, slot, lane: byId.get(commitId).lane });
      };
      if (repo.head.type === "commit") push(headId, "HEAD", "head");
      for (const b of branchOrder) {
        const isHead = repo.head.type === "branch" && repo.head.name === b;
        push(repo.branches[b], isHead ? "HEAD → " + b : b, isHead ? "branch head" : "branch");
      }
      for (const t of Object.keys(repo.tags)) push(repo.tags[t], "⚑ " + t, "tag");

      const maxX = nodes.reduce((m, n) => Math.max(m, n.x), 0);
      const maxY = nodes.reduce((m, n) => Math.max(m, n.y), 0);
      const maxSlot = Math.max(0, ...Object.values(stack));
      return {
        nodes, edges, refs, byId,
        headId,
        conflict: !!repo.pending,
        bounds: {
          // Clamp so a two-commit graph does not zoom to cartoon size.
          w: Math.max(o.minW, maxX + o.pad + 150),
          h: Math.max(o.minH, maxY + o.pad + 46 + maxSlot * 24)
        }
      };
    }

    // ---------------- rendering ----------------

    render(repo, opts) {
      opts = opts || {};
      const plan = GitViz.plan(repo, this.o);
      this.plan = plan;
      this._syncEdges(plan);
      this._syncNodes(plan);
      this._syncRefs(plan);
      const dur = opts.animate === false ? 0 : this.o.duration;
      this._tween(plan, dur);
    }

    _syncNodes(plan) {
      const keep = new Set();
      for (const n of plan.nodes) {
        keep.add(n.id);
        let rec = this.nodes.get(n.id);
        if (!rec) {
          const g = el("g", { class: "viz-node" }, this.gNodes);
          const circle = el("circle", { r: this.o.r, class: "viz-dot" }, g);
          const text = el("text", { class: "viz-id", "text-anchor": "middle", dy: "0.35em" }, g);
          const msg = this.o.messages
            ? el("text", { class: "viz-msg", "text-anchor": "middle", dy: this.o.r + 18 }, g)
            : null;
          rec = { g, circle, text, msg };
          this.nodes.set(n.id, rec);
          // spawn where the parent sits, so a new commit grows out of history
          const parent = n.commit.parents.map((p) => this.pos.get(p)).find(Boolean);
          this.pos.set(n.id, parent ? { x: parent.x, y: parent.y } : { x: n.x, y: n.y });
          g.classList.add("spawn");
          setTimeout(() => g.classList.remove("spawn"), 600);
        }
        const color = LANE_COLORS[n.lane % LANE_COLORS.length];
        rec.circle.setAttribute("fill", color);
        rec.circle.classList.toggle("is-merge", n.merge);
        rec.g.classList.toggle("is-head", n.id === plan.headId);
        rec.g.classList.toggle("is-conflict", plan.conflict && n.id === plan.headId);
        rec.text.textContent = n.id;
        if (rec.msg) rec.msg.textContent = (n.commit.message || "").slice(0, 18);
        rec.g.setAttribute("data-id", n.id);
      }
      for (const [id, rec] of [...this.nodes]) {
        if (keep.has(id)) continue;
        rec.g.classList.add("dying");
        setTimeout(() => rec.g.remove(), 400);
        this.nodes.delete(id);
        this.pos.delete(id);
      }
    }

    _syncEdges(plan) {
      const keep = new Set(plan.edges.map((e) => e.key));
      for (const e of plan.edges) {
        if (!this.edges.has(e.key)) {
          const path = el("path", { class: "viz-edge" + (e.second ? " is-second" : "") }, this.gEdges);
          this.edges.set(e.key, path);
        }
      }
      for (const [key, path] of [...this.edges]) {
        if (keep.has(key)) continue;
        path.remove();
        this.edges.delete(key);
      }
    }

    _syncRefs(plan) {
      const keep = new Set(plan.refs.map((r) => r.key));
      for (const r of plan.refs) {
        let rec = this.refs.get(r.key);
        if (!rec) {
          const g = el("g", { class: "viz-ref" }, this.gRefs);
          const rect = el("rect", { rx: 7, height: 20, class: "viz-ref-box" }, g);
          const text = el("text", { class: "viz-ref-text", dy: "0.98em", x: 8 }, g);
          rec = { g, rect, text };
          this.refs.set(r.key, rec);
        }
        rec.text.textContent = r.text;
        rec.g.setAttribute("class", "viz-ref kind-" + r.kind.split(" ")[0] + (r.kind.includes("head") ? " is-head" : ""));
        const w = Math.max(30, r.text.length * 7.6 + 16);
        rec.rect.setAttribute("width", w);
        rec.slot = r.slot;
        rec.commitId = r.commitId;
      }
      for (const [key, rec] of [...this.refs]) {
        if (keep.has(key)) continue;
        rec.g.remove();
        this.refs.delete(key);
      }
    }

    _tween(plan, duration) {
      if (this.raf) cancelAnimationFrame(this.raf);
      const from = new Map();
      for (const n of plan.nodes) {
        const cur = this.pos.get(n.id) || { x: n.x, y: n.y };
        from.set(n.id, { x: cur.x, y: cur.y });
      }
      const targetView = { x: 0, y: 0, w: plan.bounds.w, h: plan.bounds.h };
      const fromView = this.view || targetView;
      const start = performance.now();
      const ease = (t) => 1 - Math.pow(1 - t, 3);

      const step = (now) => {
        const t = duration <= 0 ? 1 : Math.min(1, (now - start) / duration);
        const k = ease(t);
        for (const n of plan.nodes) {
          const f = from.get(n.id);
          this.pos.set(n.id, { x: f.x + (n.x - f.x) * k, y: f.y + (n.y - f.y) * k });
        }
        this.view = {
          x: 0, y: 0,
          w: fromView.w + (targetView.w - fromView.w) * k,
          h: fromView.h + (targetView.h - fromView.h) * k
        };
        this._paint(plan);
        if (t < 1) this.raf = requestAnimationFrame(step);
        else this.raf = null;
      };
      this.raf = requestAnimationFrame(step);
    }

    _paint(plan) {
      this.svg.setAttribute("viewBox", `0 0 ${Math.round(this.view.w)} ${Math.round(this.view.h)}`);
      for (const n of plan.nodes) {
        const p = this.pos.get(n.id);
        const rec = this.nodes.get(n.id);
        if (rec && p) rec.g.setAttribute("transform", `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`);
      }
      for (const e of plan.edges) {
        const a = this.pos.get(e.from), b = this.pos.get(e.to);
        const path = this.edges.get(e.key);
        if (!a || !b || !path) continue;
        const mid = (a.x + b.x) / 2;
        path.setAttribute("d", a.y === b.y
          ? `M ${a.x} ${a.y} L ${b.x} ${b.y}`
          : `M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`);
      }
      for (const [, rec] of this.refs) {
        const p = this.pos.get(rec.commitId);
        if (!p) continue;
        rec.g.setAttribute("transform",
          `translate(${(p.x + this.o.r + 10).toFixed(1)},${(p.y - 10 + rec.slot * 24).toFixed(1)})`);
      }
    }
  }

  GitViz.LANE_COLORS = LANE_COLORS;
  global.GitViz = GitViz;
})(window);
