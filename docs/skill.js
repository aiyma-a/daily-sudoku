"use strict";
// Learns how fast this player solves puzzles of each difficulty, on the
// phone, one solve at a time (online learning with stochastic gradient
// descent). No data leaves the device.
//
// Model: log(solve time) = a + b * (difficulty score / 100)
// It starts from a typical-solver guess (a prior) so it is useful from the
// first puzzle, then every finished puzzle nudges a and b toward you.
(function (root) {
  const PRIOR = { a: Math.log(300), b: 0.8, n: 0 };
  const LR = 0.15;
  const TARGET = Math.log(480);   // "just right" = about 8 minutes
  const HINT_SECONDS = 30;        // each hint counts as extra time taken

  const x = (score) => score / 100;
  const predictLog = (m, score) => m.a + m.b * x(score);

  function update(m, score, elapsed, hints) {
    const secs = Math.max(30, elapsed + HINT_SECONDS * (hints || 0));
    const err = Math.log(secs) - predictLog(m, score);
    return {
      a: m.a + LR * err,
      b: Math.min(3, Math.max(0.1, m.b + LR * err * x(score))),
      n: m.n + 1,
    };
  }

  // Seconds the model expects this player to need.
  const expectedSeconds = (m, score) => Math.exp(predictLog(m, score));

  // options: [{level, score}] -> the one closest to the target time.
  function recommend(m, options) {
    let best = null;
    options.forEach((o) => {
      const gap = Math.abs(predictLog(m, o.score) - TARGET);
      if (!best || gap < best.gap) best = { level: o.level, gap, seconds: expectedSeconds(m, o.score) };
    });
    return best;
  }

  const api = { PRIOR, update, expectedSeconds, recommend };
  if (typeof module !== "undefined") module.exports = api;
  else root.Skill = api;
})(typeof window !== "undefined" ? window : this);
