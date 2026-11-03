"use strict";
// Mistake detection in the browser. Mirrors ml/mistakes.py: describe the
// entry a player just made with 6 numbers and ask the trained classifier how
// likely it is to be right. It never looks at the solution.
(function (root) {
  const H = typeof module !== "undefined" ? require("./hint.js") : root.Hint;

  function features(cells, i, d) {   // cells = board BEFORE the entry
    const cand = H.candidates(cells);
    const r = (i / 9) | 0, c = i % 9;
    const units = [H.ROWS[r], H.COLS[c], H.BOXES[((r / 3) | 0) * 3 + ((c / 3) | 0)]];
    const spots = units.map((u) => u.filter((j) => cand.has(j) && cand.get(j).has(d)).length);
    const fill = units.map((u) => u.filter((j) => cells[j] !== 0).length);
    const k = cand.get(i).size;
    return [k, Math.min(...spots), Math.max(...fill), cells.filter((x) => x === d).length,
      cand.size, (k === 1 || Math.min(...spots) === 1) ? 1 : 0];
  }

  // Probability (0..1) that digit d in cell i is right. null if it clashes
  // with a neighbour (those are already shown in red).
  function pCorrect(model, cells, i, d) {
    const before = cells.slice();
    before[i] = 0;
    const cand = H.candidates(before);
    if (!cand.has(i) || !cand.get(i).has(d)) return null;
    let raw = model.init;
    const x = features(before, i, d);
    for (const t of model.trees) {
      let n = 0;
      while (t.l[n] !== -1) n = x[t.f[n]] <= t.t[n] ? t.l[n] : t.r[n];
      raw += model.lr * t.v[n];
    }
    return 1 / (1 + Math.exp(-raw));
  }

  // "Stuck" detector: learns how long YOUR pauses usually are (running mean
  // and spread) and flags a pause that is unusually long for you.
  const PACE = { mean: 15, sd: 8 };
  function paceUpdate(p, gap) {
    if (gap > 300) return p;            // a break, not thinking
    const a = 0.1, d = gap - p.mean;
    const mean = p.mean + a * d;
    const sd = Math.sqrt((1 - a) * (p.sd * p.sd + a * d * d));
    return { mean, sd };
  }
  const stuckAfter = (p) => Math.max(45, p.mean + 3 * p.sd);

  const api = { features, pCorrect, PACE, paceUpdate, stuckAfter };
  if (typeof module !== "undefined") module.exports = api;
  else root.Mistake = api;
})(typeof window !== "undefined" ? window : this);
