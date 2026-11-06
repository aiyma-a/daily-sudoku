"use strict";
(function () {
  const T = window.I18n.t;
  const $ = (id) => document.getElementById(id);
  const LEVELS = ["easy", "medium", "hard"];

  // The date is the player's local date, so everyone gets a new puzzle at
  // their own midnight. ?date=YYYY-MM-DD lets you replay another day.
  const q = new URLSearchParams(location.search).get("date");
  const today = (() => {
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();

  let day = null;       // today's puzzles {easy:{puzzle,solution,score}, ...}; null when offline and not saved
  let mode = localStorage.getItem("ds:mode") === "practice" ? "practice" : "daily";
  let cur = null;       // the puzzle on screen: {puzzle, solution, score}
  let diffModel = null; // difficulty model, used to make Practice puzzles on the phone
  const pidx = (lv) => +localStorage.getItem(`ds:pidx:${lv}`) || 1;   // Practice puzzle number per level
  const TYPICAL = { easy: 40, medium: 65, hard: 135 };               // difficulty scores for guessing in Practice
  let level = localStorage.getItem("ds:level") || "easy";
  let st = null;        // game state for current level
  let sel = -1;
  let notesOn = false;
  let timerId = null;
  let hint = null;      // {cell, digit, why, stage} while a hint is showing
  let hintModel = null;
  let mistakeModel = null;
  let pace = JSON.parse(localStorage.getItem("ds:pace") || "null") || { ...window.Mistake.PACE };
  let lastMove = 0;     // st.elapsed at the last move
  let tip = "";         // message from "Just right for you"
  const loadSkill = () => {
    try { return JSON.parse(localStorage.getItem("ds:skill")) || { ...window.Skill.PRIOR }; }
    catch (e) { return { ...window.Skill.PRIOR }; }
  };

  const keyFor = (lv) => mode === "practice" ? `ds:p:${lv}:${pidx(lv)}` : `ds:${today}:${lv}`;
  const key = () => keyFor(level);
  const save = () => { if (st) localStorage.setItem(key(), JSON.stringify(st)); };

  function fresh() {
    const p = cur.puzzle;
    return {
      vals: p.split("").map(Number),
      notes: Array.from({ length: 81 }, () => 0), // bitmask of 1..9
      history: [], elapsed: 0, done: false,
    };
  }

  // Which puzzle is on screen: today's (Daily) or a numbered one made on the phone (Practice).
  function pickPuzzle() {
    if (mode === "daily") { cur = day[level]; return; }
    cur = window.Engine.makePuzzle(level, `practice-${pidx(level)}`, diffModel);
    if (cur.score === null) cur.score = TYPICAL[level];
  }

  function load() {
    if (mode === "daily" && !day) { mode = "practice"; }
    pickPuzzle();
    updateChrome();
    const raw = localStorage.getItem(key());
    st = raw ? JSON.parse(raw) : fresh();
    sel = -1;
    lastMove = st.elapsed;
    render();
    startTimer();
  }

  const isGiven = (i) => cur.puzzle[i] !== "0";

  // Kyrgyz date words are written out here because not every phone ships Kyrgyz locale data.
  const KY_DAYS = ["Жк", "Дш", "Шш", "Шр", "Бш", "Жм", "Иш"];
  const KY_MONTHS = ["янв.", "фев.", "мар.", "апр.", "май", "июн.", "июл.", "авг.", "сен.", "окт.", "ноя.", "дек."];
  function dateLabel() {
    const d = new Date(today + "T12:00:00");
    if (window.I18n.lang === "ky") return `${KY_DAYS[d.getDay()]}, ${d.getDate()}-${KY_MONTHS[d.getMonth()]}`;
    return d.toLocaleDateString(window.I18n.lang === "ru" ? "ru-RU" : undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  const cap = (w) => w[0].toUpperCase() + w.slice(1);
  function updateChrome() {
    [...$("mode").children].forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    $("pnav").hidden = mode !== "practice";
    $("prev").disabled = pidx(level) <= 1;
    $("label").textContent = mode === "daily"
      ? dateLabel()
      : `${T(cap(level))} #${pidx(level)}`;
  }

  // ------------------------------------------------------------ rendering
  function build() {
    const b = $("board");
    b.innerHTML = "";
    for (let i = 0; i < 81; i++) {
      const c = document.createElement("div");
      c.className = "cell";
      c.dataset.i = i;
      c.setAttribute("role", "gridcell");
      c.addEventListener("click", () => { sel = i; render(); });
      b.appendChild(c);
    }
    const pad = $("pad");
    for (let n = 1; n <= 9; n++) {
      const btn = document.createElement("button");
      btn.textContent = n;
      btn.dataset.n = n;
      btn.addEventListener("click", () => input(n));
      pad.appendChild(btn);
    }
  }

  function conflicts() {
    const bad = new Set();
    const v = st.vals;
    for (let i = 0; i < 81; i++) {
      if (!v[i]) continue;
      const r = (i / 9) | 0, c = i % 9;
      for (let j = 0; j < 81; j++) {
        if (j === i || v[j] !== v[i]) continue;
        const r2 = (j / 9) | 0, c2 = j % 9;
        if (r === r2 || c === c2 ||
            (((r / 3) | 0) === ((r2 / 3) | 0) && ((c / 3) | 0) === ((c2 / 3) | 0))) {
          bad.add(i);
        }
      }
    }
    return bad;
  }

  function render() {
    const cells = $("board").children;
    const bad = conflicts();
    if (S.mistakes) for (let i = 0; i < 81; i++) if (st.vals[i] && !isGiven(i) && st.vals[i] !== +cur.solution[i]) bad.add(i);
    const sv = sel >= 0 ? st.vals[sel] : 0;
    const sr = sel >= 0 ? (sel / 9) | 0 : -1, sc = sel >= 0 ? sel % 9 : -1;
    for (let i = 0; i < 81; i++) {
      const el = cells[i];
      const r = (i / 9) | 0, c = i % 9;
      let cls = "cell";
      if (isGiven(i)) cls += " given"; else if (st.vals[i]) cls += " entry";
      if (i === sel) cls += " selected";
      else if (sel >= 0 && (r === sr || c === sc ||
        (((r / 3) | 0) === ((sr / 3) | 0) && ((c / 3) | 0) === ((sc / 3) | 0)))) cls += " peer";
      if (sv && st.vals[i] === sv && i !== sel) cls += " same";
      if (bad.has(i)) cls += " conflict";
      const showHint = hint && hint.cell >= 0 && !st.vals[hint.cell];
      if (showHint && hint.zone && hint.zone.has(i)) cls += " hintzone";
      if (showHint && hint.cell === i) cls += hint.stage === 2 ? " hint ghost" : " hint";
      el.className = cls;
      if (showHint && hint.cell === i && hint.stage === 2) {
        el.textContent = hint.digit;
      } else if (st.vals[i]) {
        el.textContent = st.vals[i];
      } else if (st.notes[i]) {
        let h = '<div class="notes">';
        for (let n = 1; n <= 9; n++) h += `<span>${st.notes[i] & (1 << n) ? n : ""}</span>`;
        el.innerHTML = h + "</div>";
      } else {
        el.textContent = "";
      }
    }
    const counts = Array(10).fill(0);
    st.vals.forEach((x) => counts[x]++);
    [...$("pad").children].forEach((b) => b.classList.toggle("used", counts[+b.dataset.n] >= 9));
    [...$("levels").children].forEach((b) => {
      b.classList.toggle("active", b.dataset.level === level);
      b.classList.toggle("done", isDone(b.dataset.level));
    });
    $("notes").textContent = T("Notes");
    $("notes").setAttribute("aria-pressed", notesOn);
    $("msg").textContent = st.done ? T("Solved! 🎉") : "";
    $("hinttext").textContent = st.done ? "" : (hintText() || tip);
    tick();
    renderStreak();
    $("share").hidden = !st.done;
  }

  function isDone(lv) {
    try {
      const raw = localStorage.getItem(keyFor(lv));
      return raw ? JSON.parse(raw).done : false;
    } catch (e) { return false; }
  }

  // ------------------------------------------------------------- gameplay
  function input(n) {
    if (sel < 0 || st.done || isGiven(sel)) return;
    st.history.push({ i: sel, v: st.vals[sel], n: st.notes[sel] });
    if (notesOn) {
      if (st.vals[sel]) { st.history.pop(); return; }
      st.notes[sel] ^= 1 << n;
    } else {
      st.vals[sel] = st.vals[sel] === n ? 0 : n;
      st.notes[sel] = 0;
      if (st.vals[sel]) clearPeerNotes(sel, n);
    }
    afterMove();
    feedback("tap");
    if (!notesOn && st.vals[sel] && mistakeModel && !st.done) {
      const p = window.Mistake.pCorrect(mistakeModel, st.vals, sel, st.vals[sel]);
      if (p !== null && p < 0.4) {
        tip = T("That one looks like a guess. Double-check its row, column and box.");
        render();
      }
    }
  }

  function clearPeerNotes(i, n) {
    const r = (i / 9) | 0, c = i % 9;
    for (let j = 0; j < 81; j++) {
      const r2 = (j / 9) | 0, c2 = j % 9;
      if (r === r2 || c === c2 ||
          (((r / 3) | 0) === ((r2 / 3) | 0) && ((c / 3) | 0) === ((c2 / 3) | 0))) {
        st.notes[j] &= ~(1 << n);
      }
    }
  }

  function erase() {
    if (sel < 0 || st.done || isGiven(sel)) return;
    st.history.push({ i: sel, v: st.vals[sel], n: st.notes[sel] });
    st.vals[sel] = 0;
    st.notes[sel] = 0;
    afterMove();
    feedback("erase");
  }

  // Wipe everything on this puzzle (numbers, notes, timer) and start fresh.
  function startOver() {
    if (!confirm(T("Erase everything on this puzzle and start over?"))) return;
    const wasCounted = st.counted;
    st = fresh();
    st.counted = wasCounted;   // a finished puzzle was already learned from
    hint = null; tip = ""; sel = -1; lastMove = 0;
    $("board").classList.remove("win");
    $("hint").classList.remove("pulse");
    save();
    render();
    startTimer();
  }

  function undo() {
    const h = st.history.pop();
    if (!h || st.done) return;
    st.vals[h.i] = h.v;
    st.notes[h.i] = h.n;
    afterMove(true);
  }

  function afterMove(isUndo) {
    hint = null;
    tip = "";
    noteMove();
    if (st.vals.join("") === cur.solution) {
      st.done = true;
      stopTimer();
      if (!st.counted) {  // learn from this solve, once
        st.counted = true;
        st.done = true; save();
        recordSolve();
        localStorage.setItem("ds:skill", JSON.stringify(
          window.Skill.update(loadSkill(), cur.score || 70, st.elapsed, st.hints)));
      }
      $("board").classList.remove("win");
      void $("board").offsetWidth; // restart the animation
      $("board").classList.add("win");
      window.Confetti.burst();
      feedback("win");
      if (mode === "practice") $("next").classList.add("pulse");
    }
    save();
    render();
  }

  // Learn how long this player's pauses usually are; flag an unusual one.
  function noteMove() {
    const gap = st.elapsed - lastMove;
    if (gap > 0) pace = window.Mistake.paceUpdate(pace, gap);
    lastMove = st.elapsed;
    localStorage.setItem("ds:pace", JSON.stringify(pace));
    $("hint").classList.remove("pulse");
  }
  function checkStuck() {
    if (st.done || document.hidden || hint || tip) return;
    if (st.elapsed - lastMove > window.Mistake.stuckAfter(pace)) {
      tip = T("Taking a while? Tap Hint for a nudge.");
      $("hint").classList.add("pulse");
      render();
    }
  }

  // ----------------------------------------------------------------- hints
  // A learned model ranks the moves simple logic allows and we suggest the
  // top one (docs/hint.js). Press once to see where, again to see the digit.
  function hintText() {
    if (!hint) return "";
    const where = T("row {r}, column {c}", { r: ((hint.cell / 9) | 0) + 1, c: (hint.cell % 9) + 1 });
    if (hint.none) return hint.none;
    if (hint.stage === 2) return T("Put {d} in {where}.", { d: hint.digit, where });
    return T("Look at {where}: {why} (tap Hint again for the digit)", { where, why: T(hint.why) });
  }

  async function giveHint() {
    if (st.done) return;
    if (hint && hint.cell >= 0 && hint.stage === 1 && !hint.none && !st.vals[hint.cell]) {
      hint.stage = 2; st.hints = (st.hints || 0) + 1; save(); render(); return;
    }
    const sol = cur.solution;
    const wrong = st.vals.findIndex((v, i) => v && v !== +sol[i]);
    if (wrong >= 0) {
      hint = { cell: wrong, none: T("This number looks wrong. Erase it first.") };
      sel = wrong; render(); return;
    }
    if (!hintModel) hintModel = await fetch("ml/hint_model.json").then((r) => r.json());
    const pick = window.Hint.best(hintModel, st.vals);
    if (!pick) { hint = { cell: -1, none: T("No easy move here. Try pencil notes.") }; render(); return; }
    // Shade the lines that explain the move: the row, column or box where the
    // digit fits only here (hidden single), or every line that crosses the cell.
    const H = window.Hint, r0 = (pick.cell / 9) | 0, c0 = pick.cell % 9;
    const lines = [H.ROWS[r0], H.COLS[c0], H.BOXES[((r0 / 3) | 0) * 3 + ((c0 / 3) | 0)]];
    let zone = lines;
    if (pick.hidden) {
      const cand = H.candidates(st.vals);
      const only = lines.find((u) => u.every((j) => j === pick.cell || !cand.has(j) || !cand.get(j).has(pick.digit)));
      if (only) zone = [only];
    }
    hint = { cell: pick.cell, digit: pick.digit, stage: 1, zone: new Set(zone.flat()),
      why: pick.hidden ? "one digit fits only here in its row, column or box."
                       : "only one digit can go in this cell." };
    sel = pick.cell;
    render();
  }

  // ---------------------------------------------------------------- timer
  function fmt(s) {
    return `${(s / 60) | 0}:${String(s % 60).padStart(2, "0")}`;
  }
  function tick() { $("timer").textContent = fmt(st.elapsed); }
  function startTimer() {
    stopTimer();
    if (st.done) return;
    timerId = setInterval(() => {
      if (document.hidden) return;
      st.elapsed++;
      tick();
      checkStuck();
      if (st.elapsed % 5 === 0) save();
    }, 1000);
  }
  function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }

  // ------------------------------------------- settings, sound, stats, streak
  // Everything here is stored only on the phone (localStorage).
  const S = Object.assign({ mistakes: false, sound: false, vibe: true, big: false },
    (() => { try { return JSON.parse(localStorage.getItem("ds:set")) || {}; } catch (e) { return {}; } })());
  document.body.classList.toggle("big", S.big);
  const saveSettings = () => localStorage.setItem("ds:set", JSON.stringify(S));

  let audio = null;
  function tone(freq, ms, delay) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audio.currentTime + (delay || 0) / 1000;
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = freq; o.type = "sine";
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.15, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
      o.connect(g); g.connect(audio.destination);
      o.start(t0); o.stop(t0 + ms / 1000 + 0.02);
    } catch (e) { /* no audio on this device */ }
  }
  function feedback(kind) {
    if (S.vibe && navigator.vibrate) navigator.vibrate(kind === "win" ? [30, 40, 30, 40, 60] : kind === "erase" ? 8 : 12);
    if (!S.sound) return;
    if (kind === "tap") tone(660, 60);
    else if (kind === "erase") tone(330, 70);
    else if (kind === "win") [523, 659, 784, 1047].forEach((f, i) => tone(f, 160, i * 120));
  }

  const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const realToday = dayStr(new Date());
  const loadJson = (k, dflt) => { try { return JSON.parse(localStorage.getItem(k)) || dflt; } catch (e) { return dflt; } };
  let days = loadJson("ds:days", []);          // dates on which a Daily puzzle was solved
  let stats = loadJson("ds:stats", {});         // per level: {n, total, best}

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
    const s = stats[level] || { n: 0, total: 0, best: 0 };
    s.n++; s.total += st.elapsed;
    if (!s.best || st.elapsed < s.best) s.best = st.elapsed;
    stats[level] = s;
    localStorage.setItem("ds:stats", JSON.stringify(stats));
    if (mode === "daily" && today === realToday && !days.includes(realToday)) {
      days = [...days, realToday].slice(-730);
      localStorage.setItem("ds:days", JSON.stringify(days));
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
  let got = loadJson("ds:ach", {});
  let toastTimer = null;
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
  }
  function checkAchievements() {
    const total = LEVELS.reduce((n, lv) => n + (stats[lv] ? stats[lv].n : 0), 0);
    const sk = streaks().cur;
    const test = {
      first: total >= 1,
      hard: !!stats.hard,
      nohint: !st.hints,
      quick: level === "easy" && st.elapsed < 240,
      ten: total >= 10,
      streak3: sk >= 3,
      streak7: sk >= 7,
      triple: mode === "daily" && today === realToday && LEVELS.every((lv) => isDone(lv)),
    };
    const fresh = ACH.filter(([id]) => test[id] && !got[id]);
    fresh.forEach(([id]) => { got[id] = realToday; });
    if (fresh.length) {
      localStorage.setItem("ds:ach", JSON.stringify(got));
      toast("🏆 " + T("Achievement unlocked: {name}", { name: fresh.map((x) => T(x[1])).join(", ") }));
    }
  }

  // ------------------------------------------------------------------ share
  function shareText() {
    const when = mode === "daily"
      ? dateLabel()
      : `${T("Practice")} #${pidx(level)}`;
    const hints = st.hints ? T("{n} hints", { n: st.hints }) : T("no hints");
    return `${T("Daily Sudoku")} · ${when} · ${T(cap(level))} ✅ ${fmt(st.elapsed)} · ${hints}\n${location.origin}${location.pathname}`;
  }
  async function share() {
    const text = shareText();
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      toast(T("Copied to clipboard"));
    } catch (e) { /* share sheet closed */ }
  }
  $("share").addEventListener("click", share);

  // ----------------------------------------------------------- pop-up pages
  function closeModal() { $("modal").hidden = true; $("modalbody").innerHTML = ""; }
  function openModal(title, build) {
    $("modaltitle").textContent = title;
    $("modalbody").innerHTML = "";
    build($("modalbody"));
    $("modal").hidden = false;
    $("modalclose").focus();
  }
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };

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

  function openSettings() {
    openModal(T("Settings"), (b) => {
      [["mistakes", "Show mistakes in red"], ["sound", "Sound"], ["vibe", "Vibration"], ["big", "Bigger numbers"]].forEach(([k, label]) => {
        const row = el("div", undefined, "setrow");
        row.appendChild(el("span", T(label)));
        const btn = el("button", S[k] ? T("On") : T("Off"), "toggle");
        btn.setAttribute("aria-pressed", S[k]);
        btn.setAttribute("aria-label", T(label));
        btn.addEventListener("click", () => {
          S[k] = !S[k]; saveSettings();
          btn.textContent = S[k] ? T("On") : T("Off"); btn.setAttribute("aria-pressed", S[k]);
          if (k === "sound" && S.sound) feedback("tap");
          if (k === "vibe" && S.vibe) feedback("tap");
          document.body.classList.toggle("big", S.big);
          render();
        });
        row.appendChild(btn); b.appendChild(row);
      });
    });
  }

  const STEPS = [
    ["1. Fill the board", "Fill every row, column and 3×3 box with the digits 1 to 9, each only once. Tap an empty cell, then tap a number."],
    ["2. Use notes", "Not sure? Turn on Notes and pencil in small candidate digits. They clear by themselves when you place a number."],
    ["3. Stuck? Ask for a hint", "Tap Hint to see where to look, tap again for the digit. ★ For me picks the level that suits you. Daily is new every day; Practice never runs out and works offline."],
  ];
  function openTutorial() {
    localStorage.setItem("ds:tut", "1");
    let i = 0;
    openModal(T("How to play"), (b) => {
      const draw = () => {
        b.innerHTML = "";
        b.appendChild(el("h3", T(STEPS[i][0])));
        b.appendChild(el("p", T(STEPS[i][1])));
        b.appendChild(el("p", "● ".repeat(i + 1) + "○ ".repeat(STEPS.length - i - 1), "dots"));
        const row = el("div", undefined, "setrow");
        const skip = el("button", T("Skip")); skip.addEventListener("click", closeModal);
        const next = el("button", i === STEPS.length - 1 ? T("Start playing") : T("Next"), "primary");
        next.addEventListener("click", () => { if (i === STEPS.length - 1) closeModal(); else { i++; draw(); } });
        row.appendChild(skip); row.appendChild(next); b.appendChild(row);
      };
      draw();
    });
  }
  $("btnStats").addEventListener("click", openStats);
  $("btnSettings").addEventListener("click", openSettings);
  $("btnHelp").addEventListener("click", openTutorial);

  // Install button: Chrome/Android installs in one tap; iPhone has no such prompt, so show the steps.
  (function setupInstall() {
    const btn = $("btnInstall");
    const installed = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    if (installed) return;
    let deferred = null;
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; btn.hidden = false; });
    window.addEventListener("appinstalled", () => { deferred = null; btn.hidden = true; });
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) btn.hidden = false;
    btn.addEventListener("click", () => {
      if (deferred) { deferred.prompt(); deferred.userChoice.finally(() => { deferred = null; btn.hidden = true; }); }
      else toast(T("On iPhone: tap Share, then Add to Home Screen."));
    });
  })();
  $("modalclose").addEventListener("click", closeModal);
  $("modal").addEventListener("click", (e) => { if (e.target === $("modal")) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("modal").hidden) closeModal(); });

  // --------------------------------------------------------------- wiring
  document.addEventListener("keydown", (e) => {
    if (e.key >= "1" && e.key <= "9") input(+e.key);
    else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") erase();
    else if (e.key === "n" || e.key === "N") { notesOn = !notesOn; render(); }
    else if (e.key === "z" && (e.ctrlKey || e.metaKey)) undo();
    else if (e.key.startsWith("Arrow") && sel >= 0) {
      const d = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
      const n = sel + d;
      const wrapsRow = Math.abs(d) === 1 && ((n / 9) | 0) !== ((sel / 9) | 0);
      if (n >= 0 && n < 81 && !wrapsRow) { sel = n; render(); e.preventDefault(); }
    }
  });
  $("notes").addEventListener("click", () => { notesOn = !notesOn; render(); });
  $("erase").addEventListener("click", erase);
  $("undo").addEventListener("click", undo);
  $("reset").addEventListener("click", startOver);
  $("hint").addEventListener("click", giveHint);
  $("fit").addEventListener("click", () => {
    const open = mode === "daily" && day
      ? LEVELS.filter((lv) => !isDone(lv)).map((lv) => ({ level: lv, score: day[lv].score || 70 }))
      : LEVELS.map((lv) => ({ level: lv, score: TYPICAL[lv] }));
    if (!open.length) { tip = T("You finished all three today. Try Practice for more!"); render(); return; }
    const m = loadSkill();
    const r = window.Skill.recommend(m, open);
    const mins = Math.max(1, Math.round(r.seconds / 60));
    tip = T("Just right: {lv}, about {m} min for you", { lv: T(cap(r.level)), m: mins }) +
      (m.n ? T(" (learned from {n} solves).", { n: m.n }) : T(" (a first guess; it learns as you solve)."));
    if (r.level !== level) {
      save(); hint = null; level = r.level; localStorage.setItem("ds:level", level); load();
    } else render();
  });
  $("levels").addEventListener("click", (e) => {
    const lv = e.target.dataset && e.target.dataset.level;
    if (!lv || lv === level) return;
    save();
    hint = null;
    tip = "";
    level = lv;
    localStorage.setItem("ds:level", level);
    load();
  });
  document.addEventListener("visibilitychange", () => { if (st) save(); });

  // ------------------------------------------------- Daily / Practice menu
  function switchTo(newMode) {
    if (newMode === "daily" && !day) {
      tip = T("Today's puzzles are not saved on this phone yet. Open the game once with internet and they will work offline too.");
      render(); return;
    }
    if (newMode === mode) return;
    save();
    mode = newMode; localStorage.setItem("ds:mode", mode);
    hint = null; tip = "";
    load();
  }
  function stepPractice(d) {
    save();
    localStorage.setItem(`ds:pidx:${level}`, Math.max(1, pidx(level) + d));
    hint = null; tip = "";
    $("next").classList.remove("pulse");
    load();
  }
  $("mode").addEventListener("click", (e) => { if (e.target.dataset.mode) switchTo(e.target.dataset.mode); });
  $("prev").addEventListener("click", () => stepPractice(-1));
  $("next").addEventListener("click", () => stepPractice(1));

  localStorage.removeItem("ds:theme");

  $("langs").addEventListener("click", (e) => { if (e.target.dataset.lang) window.I18n.set(e.target.dataset.lang); });
  window.onLangChange = () => { closeModal(); hint = null; tip = ""; if (st) render(); updateChrome(); };

  // ----------------------------------------------------------------- boot
  if (!LEVELS.includes(level)) level = "easy";

  const getJson = (url, opts) => fetch(url, opts).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  getJson("ml/mistake_model.json").then((m) => { mistakeModel = m; }).catch(() => {});
  Promise.all([
    getJson(`puzzles/${today}.json`, { cache: "no-store" }).catch(() => null),
    getJson("ml/difficulty_model.json").catch(() => null),
  ]).then(([d, dm]) => {
    day = d; diffModel = dm;
    build();
    if (!day && mode === "daily") {
      tip = T("No connection and today's puzzle is not saved yet, so here is Practice (it works offline).");
    }
    load();
    keepOffline();
    if (!localStorage.getItem("ds:tut")) openTutorial();
  });

  // Offline support: register the service worker and save the coming days' puzzles on the phone.
  function keepOffline() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("sw.js").catch(() => {});
    // Once the service worker is in charge, ask for the coming days so it saves them.
    navigator.serviceWorker.ready.then(() => getJson("puzzles/index.json", { cache: "no-store" })).then((list) => {
      list.filter((d) => d >= today).slice(0, 14).forEach((d) => fetch(`puzzles/${d}.json`).catch(() => {}));
    }).catch(() => {});
  }
})();
