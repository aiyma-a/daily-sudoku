"use strict";
// Puzzle maker that runs on the phone, so Practice mode works offline.
// A JavaScript port of sudoku.py (generator, solver, human-style rater) and
// ml/features.py (the numbers the difficulty model reads). A test checks it
// gives the same answers as the Python versions.
(function (root) {
  const H = typeof module !== "undefined" ? require("./hint.js") : root.Hint;
  const { ROWS, COLS, BOXES, PEERS, candidates } = H;
  const UNITS = ROWS.concat(COLS, BOXES);
  const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  // ----------------------------------------------------- seeded randomness
  function makeRng(seedText) {
    let h = 1779033703 ^ seedText.length;
    for (let i = 0; i < seedText.length; i++) {
      h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let a = (h ^ (h >>> 16)) >>> 0;
    const next = () => {           // mulberry32
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
      shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      },
    };
  }

  // ------------------------------------------------------------- solver
  function countSolutions(input, limit) {
    const cells = input.slice();
    const row = Array(9).fill(0), col = Array(9).fill(0), box = Array(9).fill(0);
    for (let i = 0; i < 81; i++) {
      const v = cells[i];
      if (!v) continue;
      const b = 1 << v, r = (i / 9) | 0, c = i % 9, bx = ((r / 3) | 0) * 3 + ((c / 3) | 0);
      if ((row[r] & b) || (col[c] & b) || (box[bx] & b)) return 0;
      row[r] |= b; col[c] |= b; box[bx] |= b;
    }
    let found = 0;
    const pop = (m) => { let n = 0; while (m) { n += m & 1; m >>= 1; } return n; };
    (function rec() {
      let best = -1, bestMask = 0, bestN = 10;
      for (let i = 0; i < 81; i++) {
        if (cells[i]) continue;
        const r = (i / 9) | 0, c = i % 9;
        const mask = ~(row[r] | col[c] | box[((r / 3) | 0) * 3 + ((c / 3) | 0)]) & 0x3FE;
        const n = pop(mask);
        if (n < bestN) { best = i; bestMask = mask; bestN = n; if (n <= 1) break; }
      }
      if (best < 0) { found++; return; }
      if (bestN === 0) return;
      const r = (best / 9) | 0, c = best % 9, b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
      for (let v = 1; v <= 9; v++) {
        const bit = 1 << v;
        if (!(bestMask & bit)) continue;
        cells[best] = v; row[r] |= bit; col[c] |= bit; box[b] |= bit;
        rec();
        cells[best] = 0; row[r] &= ~bit; col[c] &= ~bit; box[b] &= ~bit;
        if (found >= limit) return;
      }
    })();
    return found;
  }

  function solve(input) {
    const cells = input.slice();
    const ok = (i, v) => PEERS[i].every((p) => cells[p] !== v);
    (function rec() {
      let best = -1, opts = null;
      for (let i = 0; i < 81; i++) {
        if (cells[i]) continue;
        const o = DIGITS.filter((v) => ok(i, v));
        if (!opts || o.length < opts.length) { best = i; opts = o; if (o.length <= 1) break; }
      }
      if (best < 0) return true;
      for (const v of opts) { cells[best] = v; if (rec()) return true; }
      cells[best] = 0;
      return false;
    })();
    return cells.includes(0) ? null : cells;
  }

  // -------------------------------------------------------- generation
  function randomFullGrid(rng) {
    const pattern = (r, c) => (3 * (r % 3) + ((r / 3) | 0) + c) % 9;
    const shuffled = () => {
      const groups = rng.shuffle([0, 1, 2]), out = [];
      groups.forEach((g) => rng.shuffle([0, 1, 2]).forEach((x) => out.push(g * 3 + x)));
      return out;
    };
    const rows = shuffled(), cols = shuffled();
    const nums = rng.shuffle(DIGITS.slice());
    const g = [];
    rows.forEach((r) => cols.forEach((c) => g.push(nums[pattern(r, c)])));
    return g;
  }

  function digHoles(full, rng, target) {
    const cells = full.slice();
    const order = rng.shuffle(Array.from({ length: 81 }, (_, i) => i));
    let clues = 81;
    for (const i of order) {
      if (clues <= target) break;
      const keep = cells[i];
      cells[i] = 0;
      if (countSolutions(cells, 2) !== 1) cells[i] = keep; else clues--;
    }
    return cells;
  }

  // ------------------------------------------------------------- rating
  function rate(input) {
    const cells = input.slice();
    const steps = { naked_single: 0, hidden_single: 0, locked_candidates: 0, naked_pair: 0 };
    const fail = () => ({ tier: 4, steps, solved: false });
    while (cells.includes(0)) {
      const cand = candidates(cells);
      if ([...cand.values()].some((s) => s.size === 0)) return fail();
      let done = false;
      for (const [i, s] of cand) {
        if (s.size === 1) { cells[i] = [...s][0]; steps.naked_single++; done = true; break; }
      }
      if (done) continue;
      let placed = false;
      for (const u of UNITS) {
        for (const v of DIGITS) {
          const spots = u.filter((i) => cand.has(i) && cand.get(i).has(v));
          if (spots.length === 1 && !u.some((j) => cells[j] === v)) {
            cells[spots[0]] = v; steps.hidden_single++; placed = true; break;
          }
        }
        if (placed) break;
      }
      if (placed) continue;
      if (eliminate(cand, steps)) {
        if (!solveWithOverlay(cells, cand, steps)) return fail();
        continue;
      }
      return fail();
    }
    let tier = 1;
    if (steps.hidden_single) tier = 2;
    if (steps.locked_candidates || steps.naked_pair) tier = 3;
    return { tier, steps, solved: true };
  }

  function eliminate(cand, steps) {
    const has = (i, v) => cand.has(i) && cand.get(i).has(v);
    for (const box of BOXES) {
      for (const v of DIGITS) {
        const spots = box.filter((i) => has(i, v));
        if (spots.length < 2) continue;
        for (const lines of [ROWS, COLS]) {
          const shared = lines.filter((ln) => spots.every((s) => ln.includes(s)));
          if (shared.length) {
            let changed = false;
            for (const i of shared[0]) {
              if (cand.has(i) && !box.includes(i) && cand.get(i).has(v)) { cand.get(i).delete(v); changed = true; }
            }
            if (changed) { steps.locked_candidates++; return true; }
          }
        }
      }
    }
    for (const lines of [ROWS, COLS]) {
      for (const ln of lines) {
        for (const v of DIGITS) {
          const spots = ln.filter((i) => has(i, v));
          if (spots.length < 2) continue;
          const bset = new Set();
          BOXES.forEach((bx, b) => { if (spots.some((s) => bx.includes(s))) bset.add(b); });
          if (bset.size === 1) {
            let changed = false;
            for (const i of BOXES[[...bset][0]]) {
              if (cand.has(i) && !ln.includes(i) && cand.get(i).has(v)) { cand.get(i).delete(v); changed = true; }
            }
            if (changed) { steps.locked_candidates++; return true; }
          }
        }
      }
    }
    for (const u of UNITS) {
      const pairs = u.filter((i) => cand.has(i) && cand.get(i).size === 2);
      for (let a = 0; a < pairs.length; a++) {
        for (let b = a + 1; b < pairs.length; b++) {
          const A = cand.get(pairs[a]), B = cand.get(pairs[b]);
          if (A.size === B.size && [...A].every((x) => B.has(x))) {
            const pv = [...A];
            let changed = false;
            for (const i of u) {
              if (cand.has(i) && i !== pairs[a] && i !== pairs[b]) {
                const s = cand.get(i);
                if (pv.some((x) => s.has(x))) { pv.forEach((x) => s.delete(x)); changed = true; }
              }
            }
            if (changed) { steps.naked_pair++; return true; }
          }
        }
      }
    }
    return false;
  }

  function place(cells, cand, i, v) {
    cells[i] = v;
    cand.delete(i);
    PEERS[i].forEach((p) => { if (cand.has(p)) cand.get(p).delete(v); });
  }

  function solveWithOverlay(cells, cand, steps) {
    while (cells.includes(0)) {
      let progress = false;
      for (const i of [...cand.keys()]) {
        if (cells[i] === 0 && cand.get(i).size === 1) {
          place(cells, cand, i, [...cand.get(i)][0]); steps.naked_single++; progress = true;
        }
      }
      for (const u of UNITS) {
        for (const v of DIGITS) {
          if (u.some((j) => cells[j] === v)) continue;
          const spots = u.filter((i) => cand.has(i) && cand.get(i).has(v));
          if (spots.length === 1) { place(cells, cand, spots[0], v); steps.hidden_single++; progress = true; }
        }
      }
      if ([...cand.values()].some((s) => s.size === 0)) return false;
      if (!progress && !eliminate(cand, steps)) return false;
    }
    return true;
  }

  // ------------------------------------------- difficulty-model features
  function hiddenSingles(cand) {
    const found = new Map();
    for (const u of UNITS) {
      for (const v of DIGITS) {
        const spots = u.filter((i) => cand.has(i) && cand.get(i).has(v));
        if (spots.length === 1) found.set(spots[0], v);
      }
    }
    return found;
  }

  function propagate(input, useHidden) {
    const cells = input.slice();
    for (;;) {
      const cand = candidates(cells);
      let moves = new Map();
      cand.forEach((s, i) => { if (s.size === 1) moves.set(i, [...s][0]); });
      if (useHidden && moves.size === 0) moves = hiddenSingles(cand);
      if (moves.size === 0 || [...cand.values()].some((s) => s.size === 0)) {
        return cells.filter((c) => c === 0).length;
      }
      const [i, v] = moves.entries().next().value;
      cells[i] = v;
    }
  }

  function features(cells) {
    const cand = candidates(cells);
    const sizes = [...cand.values()].map((s) => s.size);
    if (!sizes.length) sizes.push(0);
    const clues = 81 - cand.size;
    const per = (units) => units.map((u) => u.filter((i) => cells[i]).length);
    const rows = per(ROWS), cols = per(COLS), boxes = per(BOXES);
    const counts = Array.from({ length: 10 }, (_, k) => sizes.filter((s) => s === k).length);
    const total = sizes.reduce((a, b) => a + b, 0) || 1;
    const entropy = -sizes.reduce((t, s) => t + (s ? (s / total) * Math.log(s / total) : 0), 0);
    const digitClues = DIGITS.map((d) => cells.filter((c) => c === d).length);
    const pf = [...cand.keys()].map((i) => PEERS[i].filter((p) => cells[p]).length);
    if (!pf.length) pf.push(0);
    return [
      clues, Math.min(...rows), Math.min(...cols), Math.min(...boxes),
      boxes.filter((b) => b < 3).length, digitClues.filter((n) => n < 3).length,
      sizes.reduce((a, b) => a + b, 0) / sizes.length, Math.max(...sizes),
      counts[1], counts[2], counts.slice(4).reduce((a, b) => a + b, 0),
      entropy, Math.min(...rows, ...cols, ...boxes),
      pf.reduce((a, b) => a + b, 0) / pf.length,
      hiddenSingles(cand).size, propagate(cells, false), propagate(cells, true),
    ];
  }

  const LEVELS = {
    easy: { clues: [36, 42], tier: 1 },
    medium: { clues: [30, 35], tier: 2 },
    hard: { clues: [24, 29], tier: 3 },
  };
  const BANDS = { easy: [0, 50], medium: [50, 90], hard: [90, 175] };
  const bandOf = (s) => {
    for (const k of Object.keys(BANDS)) if (s < BANDS[k][1]) return k;
    return "expert";
  };

  // A puzzle of `level`, the same for the same seed. `model` is the
  // difficulty model (docs/ml/difficulty_model.json); it must agree with the
  // human-style rater, just like the nightly job.
  function makePuzzle(level, seed, model) {
    const spec = LEVELS[level];
    const rng = makeRng(`${seed}:${level}`);
    for (let tries = 0; tries < 400; tries++) {
      const full = randomFullGrid(rng);
      const puzzle = digHoles(full, rng, rng.int(spec.clues[0], spec.clues[1]));
      const r = rate(puzzle);
      if (!r.solved || r.tier !== spec.tier) continue;
      let score = null;
      if (model) {
        score = H.score(model, features(puzzle));
        if (bandOf(score) !== level) continue;
      }
      return { puzzle: puzzle.join(""), solution: full.join(""), tier: r.tier, score: score === null ? null : Math.round(score * 10) / 10 };
    }
    throw new Error("no puzzle found");
  }

  const api = { makeRng, countSolutions, solve, randomFullGrid, digHoles, rate, features, makePuzzle, bandOf };
  if (typeof module !== "undefined") module.exports = api;
  else root.Engine = api;
})(typeof window !== "undefined" ? window : this);
