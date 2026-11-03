"use strict";
// Hint ranking in the browser. Mirrors ml/hints.py: list the moves simple
// logic allows, describe each with 8 numbers, score them with the trained
// trees (ml/hint_train.py), and suggest the highest score.
(function (root) {
  const ROWS = [], COLS = [], BOXES = [];
  for (let a = 0; a < 9; a++) {
    ROWS.push(Array.from({ length: 9 }, (_, k) => a * 9 + k));
    COLS.push(Array.from({ length: 9 }, (_, k) => k * 9 + a));
    BOXES.push(Array.from({ length: 9 }, (_, k) =>
      (((a / 3) | 0) * 3 + ((k / 3) | 0)) * 9 + (a % 3) * 3 + (k % 3)));
  }
  const UNITS = ROWS.concat(COLS, BOXES);
  const PEERS = Array.from({ length: 81 }, (_, i) => {
    const s = new Set();
    UNITS.forEach((u) => { if (u.includes(i)) u.forEach((j) => s.add(j)); });
    s.delete(i);
    return [...s];
  });

  function candidates(cells) {
    const cand = new Map();
    for (let i = 0; i < 81; i++) {
      if (cells[i] !== 0) continue;
      const used = new Set(PEERS[i].map((p) => cells[p]));
      const s = new Set();
      for (let v = 1; v <= 9; v++) if (!used.has(v)) s.add(v);
      cand.set(i, s);
    }
    return cand;
  }

  function moves(cells) {
    const cand = candidates(cells);
    const found = new Map();
    cand.forEach((s, i) => { if (s.size === 1) found.set(i, [[...s][0], 0]); });
    UNITS.forEach((u) => {
      for (let v = 1; v <= 9; v++) {
        const spots = u.filter((i) => cand.has(i) && cand.get(i).has(v));
        if (spots.length === 1 && !found.has(spots[0])) found.set(spots[0], [v, 1]);
      }
    });
    return [...found.entries()].sort((a, b) => a[0] - b[0])
      .map(([i, [v, h]]) => ({ cell: i, digit: v, hidden: h }));
  }

  function features(cells, m) {
    const cand = candidates(cells);
    const r = (m.cell / 9) | 0, c = m.cell % 9;
    const b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
    const fill = (u) => u.filter((j) => cells[j] !== 0).length;
    return [
      m.hidden, cand.get(m.cell).size, fill(ROWS[r]), fill(COLS[c]), fill(BOXES[b]),
      cells.filter((x) => x === m.digit).length,
      PEERS[m.cell].filter((p) => cand.has(p) && cand.get(p).has(m.digit)).length,
      cand.size,
    ];
  }

  function score(model, x) {
    let total = model.init;
    for (const t of model.trees) {
      let n = 0;
      while (t.l[n] !== -1) n = x[t.f[n]] <= t.t[n] ? t.l[n] : t.r[n];
      total += model.lr * t.v[n];
    }
    return total;
  }

  // Best move for these cells (array of 81 numbers, 0 = empty), or null.
  function best(model, cells) {
    let pick = null;
    moves(cells).forEach((m) => {
      m.score = score(model, features(cells, m));
      if (!pick || m.score > pick.score) pick = m;
    });
    return pick;
  }

  const api = { moves, features, score, best };
  if (typeof module !== "undefined") module.exports = api;
  else root.Hint = api;
})(typeof window !== "undefined" ? window : this);
