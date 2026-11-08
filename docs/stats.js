"use strict";
// Streaks, solve statistics, achievements and the Stats page.
// Loaded before app.js; app.js calls it once with the game's shared pieces (ctx).
window.StatsUI = function (ctx) {
  const { T, $, Store, LEVELS, today, realToday, dayStr, fmt, cap, el, toast, isDone, openModal } = ctx;
  let days = Store.json("ds:days", []);          // dates on which a Daily puzzle was solved
  let stats = Store.json("ds:stats", {});         // per level: {n, total, best}

  function streaks() {
    const set = new Set(days);
    const step = (s, k) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + k); return dayStr(d); };
    let cur = 0, s = set.has(realToday) ? realToday : step(realToday, -1);
    while (set.has(s)) { cur++; s = step(s, -1); }
    let best = 0, run = 0, prev = null;
    [...set].sort().forEach((d) => { run = prev && step(prev, 1) === d ? run + 1 : 1; prev = d; best = Math.max(best, run); });
    return { cur, best };
  }
  function renderStreak() {
    const n = streaks().cur;
    const el = $("streak");
    el.hidden = !n;
    el.textContent = `🔥 ${n}`;
    el.title = T("Current streak");
  }
  function recordSolve() {
    const s = stats[ctx.level] || { n: 0, total: 0, best: 0 };
    s.n++; s.total += ctx.st.elapsed;
    if (!s.best || ctx.st.elapsed < s.best) s.best = ctx.st.elapsed;
    stats[ctx.level] = s;
    Store.setJson("ds:stats", stats);
    if (ctx.mode === "daily" && today === realToday && !days.includes(realToday)) {
      days = [...days, realToday].slice(-730);
      Store.setJson("ds:days", days);
    }
    checkAchievements();
  }

  // ------------------------------------------------------------ achievements
  const ACH = [
    ["first", "First solve", "Solve your first puzzle."],
    ["hard", "Hard stuff", "Solve a Hard puzzle."],
    ["nohint", "On your own", "Solve a puzzle without using hints."],
    ["quick", "Quick", "Solve an Easy puzzle in under 4 minutes."],
    ["ten", "Ten solved", "Solve 10 puzzles."],
    ["streak3", "Three in a row", "Solve the Daily 3 days in a row."],
    ["streak7", "Week streak", "Solve the Daily 7 days in a row."],
    ["triple", "Triple", "Solve Easy, Medium and Hard of the same Daily."],
  ];
  let got = Store.json("ds:ach", {});

  function checkAchievements() {
    const total = LEVELS.reduce((n, lv) => n + (stats[lv] ? stats[lv].n : 0), 0);
    const sk = streaks().cur;
    const test = {
      first: total >= 1,
      hard: !!stats.hard,
      nohint: !ctx.st.hints,
      quick: ctx.level === "easy" && ctx.st.elapsed < 240,
      ten: total >= 10,
      streak3: sk >= 3,
      streak7: sk >= 7,
      triple: ctx.mode === "daily" && today === realToday && LEVELS.every((lv) => isDone(lv)),
    };
    const fresh = ACH.filter(([id]) => test[id] && !got[id]);
    fresh.forEach(([id]) => { got[id] = realToday; });
    if (fresh.length) {
      Store.setJson("ds:ach", got);
      toast("🏆 " + T("Achievement unlocked: {name}", { name: fresh.map((x) => T(x[1])).join(", ") }));
    }
  }

  function openStats() {
    openModal(T("Stats"), (b) => {
      const sk = streaks();
      const p = el("p", `${T("Current streak")}: ${sk.cur} ${T("days")} · ${T("Best streak")}: ${sk.best} ${T("days")}`, "big");
      b.appendChild(p);
      if (!LEVELS.some((lv) => stats[lv])) { b.appendChild(el("p", T("Nothing solved yet."))); }
      else {
        const t = el("table");
        const hr = el("tr"); ["Level", "Solved", "Best", "Average"].forEach((h) => hr.appendChild(el("th", T(h)))); t.appendChild(hr);
        LEVELS.forEach((lv) => {
          const s = stats[lv]; if (!s) return;
          const r = el("tr");
          [T(cap(lv)), s.n, fmt(s.best), fmt(Math.round(s.total / s.n))].forEach((v) => r.appendChild(el("td", String(v))));
          t.appendChild(r);
        });
        b.appendChild(t);
      }
      b.appendChild(el("h3", T("Achievements")));
      ACH.forEach(([id, name, desc]) => {
        const r = el("p", undefined, got[id] ? "ach on" : "ach");
        r.textContent = `${got[id] ? "🏆" : "🔒"} ${T(name)} — ${T(desc)}`;
        b.appendChild(r);
      });
      b.appendChild(el("p", T("Everything stays on this phone."), "small"));
    });
  }
  $("btnStats").addEventListener("click", openStats);

  return { streaks, renderStreak, recordSolve };
};
