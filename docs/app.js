"use strict";
(function () {
  const T = window.I18n.t;
  const Store = window.Store;
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
  // ?mode=practice (used by the home-screen shortcut) opens Practice directly.
  const qm = new URLSearchParams(location.search).get("mode");
  if (qm === "practice" || qm === "daily") Store.set("ds:mode", qm);
  let mode = Store.get("ds:mode") === "practice" ? "practice" : "daily";
  let cur = null;       // the puzzle on screen: {puzzle, solution, score}
  let diffModel = null; // difficulty model, used to make Practice puzzles on the phone
  const pidx = (lv) => +Store.get(`ds:pidx:${lv}`) || 1;   // Practice puzzle number per level
  const TYPICAL = { easy: 40, medium: 65, hard: 135 };               // difficulty scores for guessing in Practice
  let level = Store.get("ds:level") || "easy";
  let st = null;        // game state for current level
  let sel = -1;
  let notesOn = false;
  let timerId = null;
  let hint = null;      // {cell, digit, why, stage} while a hint is showing
  let hintModel = null;
  let mistakeModel = null;
  let pace = Store.json("ds:pace", { ...window.Mistake.PACE });
  let lastMove = 0;     // st.elapsed at the last move
  let recap = "";       // after a solve: your time and your average on this level
  let tip = "";         // message from "Just right for you"
  const loadSkill = () => Store.json("ds:skill", { ...window.Skill.PRIOR });

  const keyFor = (lv) => mode === "practice" ? `ds:p:${lv}:${pidx(lv)}` : `ds:${today}:${lv}`;
  const key = () => keyFor(level);
  const save = () => { if (st) Store.setJson(key(), st); };

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
    recap = "";
    updateChrome();
    st = Store.json(key(), null) || fresh();
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
      ? `${T(cap(level))} · ${dateLabel()}`
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
      c.tabIndex = i === 0 ? 0 : -1;   // one tab stop; arrow keys move inside the board
      c.addEventListener("click", () => { sel = i; render(); });
      c.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sel = i; render(); }
      });
      c.addEventListener("focus", () => { if (sel !== i) { sel = i; render(); } });
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
      el.tabIndex = (sel >= 0 ? i === sel : i === 0) ? 0 : -1;
      el.setAttribute("aria-selected", i === sel);
      let lab = T("row {r}, column {c}", { r: r + 1, c: c + 1 }) + ": ";
      if (st.vals[i]) lab += st.vals[i] + (isGiven(i) ? ", " + T("given") : "");
      else if (st.notes[i]) { const l = []; for (let n = 1; n <= 9; n++) if (st.notes[i] & (1 << n)) l.push(n); lab += T("notes: {list}", { list: l.join(" ") }); }
      else lab += T("empty");
      if (bad.has(i)) lab += ", " + T("conflict");
      el.setAttribute("aria-label", lab);
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
    [...$("pad").children].forEach((b) => {
      const left = Math.max(0, 9 - counts[+b.dataset.n]);
      b.classList.toggle("used", left === 0);
      b.setAttribute("aria-label", b.dataset.n + ", " + (left ? T("{n} left", { n: left }) : T("all placed")));
    });
    [...$("levels").children].forEach((b) => {
      b.classList.toggle("active", b.dataset.level === level);
      b.classList.toggle("done", isDone(b.dataset.level));
    });
    $("notes").textContent = T("Notes");
    $("notes").setAttribute("aria-pressed", notesOn);
    $("msg").textContent = st.done ? T("Solved! 🎉") : "";
    $("hinttext").textContent = st.done ? recap : (hintText() || tip);
    const nx = st.done ? tryNextLevel() : null;
    $("tryNext").hidden = !nx;
    if (nx) $("tryNext").textContent = T("Try {lv}?", { lv: T(cap(nx)) });
    tick();
    Stats.renderStreak();
    $("share").hidden = !st.done;
    $("savePic").hidden = !st.done;
  }

  function isDone(lv) {
    return !!Store.json(keyFor(lv), {}).done;
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
    // A step is one cell {i, v, n}, or a group of cells {group: [...]} (Fill all notes).
    (h.group || [h]).forEach((c) => { st.vals[c.i] = c.v; st.notes[c.i] = c.n; });
    afterMove(true);
  }

  // Pencil in every digit that still fits each empty cell. One Undo takes it all back.
  function fillNotes() {
    if (st.done || !st.vals.includes(0)) return;
    const group = [];
    for (let i = 0; i < 81; i++) {
      if (st.vals[i]) continue;
      const r = (i / 9) | 0, c = i % 9, br = r - (r % 3), bc = c - (c % 3);
      let used = 0;
      for (let k = 0; k < 9; k++) {
        used |= 1 << st.vals[r * 9 + k];
        used |= 1 << st.vals[k * 9 + c];
        used |= 1 << st.vals[(br + ((k / 3) | 0)) * 9 + bc + (k % 3)];
      }
      let mask = 0;
      for (let n = 1; n <= 9; n++) if (!(used & (1 << n))) mask |= 1 << n;
      if (mask !== st.notes[i]) { group.push({ i, v: 0, n: st.notes[i] }); st.notes[i] = mask; }
    }
    if (!group.length) return;
    st.history.push({ group });
    afterMove();
    feedback("tap");
  }
  $("btnFillNotes").addEventListener("click", fillNotes);

  // Last 5 solve times per level (hints count as +30 s, like the skill model).
  const loadTimes = () => Store.json("ds:times", {});
  function recordTime() {
    const secs = Math.max(30, st.elapsed + 30 * (st.hints || 0));
    const all = loadTimes();
    all[level] = (all[level] || []).concat(secs).slice(-5);
    Store.setJson("ds:times", all);
    const avg = all[level].reduce((a, b) => a + b, 0) / all[level].length;
    const mins = (x) => Math.max(1, Math.round(x / 60));
    recap = all[level].length > 1
      ? T("You took {m} min. Your average on {lv}: {a} min.", { m: mins(secs), lv: T(cap(level)), a: mins(avg) })
      : T("You took {m} min.", { m: mins(secs) });
  }
  // The next level up, if your last 3 solves here were all quick (5 min or less).
  function tryNextLevel() {
    const next = LEVELS[LEVELS.indexOf(level) + 1];
    const t = (loadTimes()[level] || []).slice(-3);
    return next && t.length === 3 && t.every((x) => x <= 300) ? next : null;
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
        Stats.recordSolve();
        Store.setJson("ds:skill",
          window.Skill.update(loadSkill(), cur.score || 70, st.elapsed, st.hints));
        recordTime();
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
    Store.setJson("ds:pace", pace);
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
    Store.json("ds:set", {}));
  document.body.classList.toggle("big", S.big);
  const saveSettings = () => Store.setJson("ds:set", S);

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
  // ------------------------------------------------------------------ toast
  let toastTimer = null;
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
  }
  // ----------------------------------------------------------- pop-up pages
  let modalOpener = null;
  function closeModal() {
    $("modal").hidden = true; $("modalbody").innerHTML = "";
    // The opener may be inside the closed Menu: then focus the Menu button.
    if (modalOpener && modalOpener.offsetParent) modalOpener.focus(); else $("menuBtn").focus();
    modalOpener = null;
  }
  function openModal(title, build) {
    if ($("modal").hidden) modalOpener = document.activeElement;
    $("modaltitle").textContent = title;
    $("modalbody").innerHTML = "";
    build($("modalbody"));
    $("modal").hidden = false;
    $("modalclose").focus();
  }
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };

  // ---------------------------------------------------------------- calendar
  const STEPS = [
    ["1. Fill the board", "Fill every row, column and 3×3 box with the digits 1 to 9, each only once. Tap an empty cell, then tap a number."],
    ["2. Use notes", "Not sure? Turn on Notes and pencil in small candidate digits. They clear by themselves when you place a number."],
    ["3. Stuck? Ask for a hint", "Tap Hint to see where to look, tap again for the digit. ★ For me picks the level that suits you. Daily is new every day; Practice never runs out and works offline."],
  ];
  function openTutorial() {
    Store.set("ds:tut", "1");
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
  // Keep Tab inside an open dialog (pop-up page or Pause screen).
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const dlg = !$("pause").hidden ? $("pause") : !$("modal").hidden ? $("modal") : null;
    if (!dlg) return;
    const f = [...dlg.querySelectorAll("button:not([disabled]), a[href], input, select")].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!dlg.contains(document.activeElement)) { first.focus(); e.preventDefault(); }
    else if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  });

  // --------------------------------------------------------------- wiring
  document.addEventListener("keydown", (e) => {
    if (!$("modal").hidden || !$("pause").hidden) return;   // a dialog is open: keys belong to it
    if (e.key >= "1" && e.key <= "9") input(+e.key);
    else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") erase();
    else if (e.key === "n" || e.key === "N") { notesOn = !notesOn; render(); }
    else if (e.key === "z" && (e.ctrlKey || e.metaKey)) undo();
    else if (e.key.startsWith("Arrow") && sel >= 0 && panel.hidden) {
      const d = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
      const n = sel + d;
      const wrapsRow = Math.abs(d) === 1 && ((n / 9) | 0) !== ((sel / 9) | 0);
      if (n >= 0 && n < 81 && !wrapsRow) { sel = n; render(); $("board").children[n].focus(); e.preventDefault(); }
    }
  });
  $("notes").addEventListener("click", () => { notesOn = !notesOn; render(); });
  $("erase").addEventListener("click", erase);
  $("undo").addEventListener("click", undo);
  $("reset").addEventListener("click", startOver);
  $("hint").addEventListener("click", giveHint);
  $("tryNext").addEventListener("click", () => {
    const nx = tryNextLevel();
    if (!nx) return;
    save(); hint = null; tip = ""; recap = ""; level = nx; Store.set("ds:level", level); load();
  });
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
      save(); hint = null; level = r.level; Store.set("ds:level", level); load();
    } else render();
  });
  $("levels").addEventListener("click", (e) => {
    const lv = e.target.dataset && e.target.dataset.level;
    if (!lv || lv === level) return;
    save();
    hint = null;
    tip = "";
    level = lv;
    Store.set("ds:level", level);
    load();
  });
  document.addEventListener("visibilitychange", () => {
    if (st) save();
    if (document.hidden) pauseGame();
  });

  // ------------------------------------------------- Pause / Resume
  // Leaving the app or browser pauses the game: the board is hidden and the
  // timer stays stopped until the player taps Resume.
  let pauseOpener = null;
  function pauseGame() {
    if (!st || st.done || !$("pause").hidden) return;
    save(); stopTimer();
    setMenu(false);
    pauseOpener = document.activeElement;
    $("pause").hidden = false;
    $("resumeBtn").focus();
  }
  function resumeGame() {
    $("pause").hidden = true;
    if (pauseOpener && document.contains(pauseOpener) && pauseOpener !== document.body) pauseOpener.focus();
    pauseOpener = null;
    if (st && !st.done) startTimer();
  }
  $("pauseBtn").addEventListener("click", pauseGame);
  $("resumeBtn").addEventListener("click", resumeGame);

  // ------------------------------------------------- Menu panel
  const panel = $("menuPanel"), menuBtn = $("menuBtn");
  function setMenu(open) {
    panel.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
  }
  menuBtn.addEventListener("click", (e) => { e.stopPropagation(); setMenu(panel.hidden); });
  // Pick something in the menu and it closes (the "For me" tip shows on the board).
  panel.addEventListener("click", (e) => { if (e.target.closest("button")) setMenu(false); });
  document.addEventListener("click", (e) => { if (!panel.hidden && !panel.contains(e.target)) setMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { setMenu(false); menuBtn.focus(); } });

  // ------------------------------------------------- Daily / Practice menu
  function switchTo(newMode) {
    if (newMode === "daily" && !day) {
      tip = T("Today's puzzles are not saved on this phone yet. Open the game once with internet and they will work offline too.");
      render(); return;
    }
    if (newMode === mode) return;
    save();
    mode = newMode; Store.set("ds:mode", mode);
    hint = null; tip = "";
    load();
  }
  function stepPractice(d) {
    save();
    Store.set(`ds:pidx:${level}`, Math.max(1, pidx(level) + d));
    hint = null; tip = "";
    $("next").classList.remove("pulse");
    load();
  }
  $("mode").addEventListener("click", (e) => { if (e.target.dataset.mode) switchTo(e.target.dataset.mode); });
  $("prev").addEventListener("click", () => stepPractice(-1));
  $("next").addEventListener("click", () => stepPractice(1));

  Store.remove("ds:theme");

  $("langs").addEventListener("click", (e) => { if (e.target.dataset.lang) window.I18n.set(e.target.dataset.lang); });
  window.onLangChange = () => { closeModal(); hint = null; tip = ""; if (st) render(); updateChrome(); };

  // -------------------------------------------- Stats, Share, Calendar, Settings
  // These pages live in their own files; they get the shared pieces here. mode,
  // level, st and cur change as you play, so they are passed as live getters.
  const getJson = (url, opts) => fetch(url, opts).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const ctx = {
    T, $, Store, LEVELS, S, saveSettings, today, realToday, dayStr, KY_MONTHS,
    cap, fmt, el, getJson, toast, feedback, render, isDone, isGiven, dateLabel, pidx, openModal,
    get mode() { return mode; }, get level() { return level; }, get st() { return st; },
  };
  const Stats = window.StatsUI(ctx);
  ctx.streaks = Stats.streaks;
  window.ShareUI(ctx);
  $("btnCalendar").addEventListener("click", window.CalendarUI(ctx).openCalendar);
  $("btnSettings").addEventListener("click", window.SettingsUI(ctx).openSettings);

  // ----------------------------------------------------------------- boot
  if (!LEVELS.includes(level)) level = "easy";

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
    if (!Store.get("ds:tut")) openTutorial();
  });

  // Offline support: register the service worker and save the coming days' puzzles on the phone.
  function keepOffline() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("sw.js").catch(() => {});
    // Once the service worker is in charge, ask for the coming days so it saves them.
    navigator.serviceWorker.ready.then(() => getJson("puzzles/index.json", { cache: "no-store" })).then((list) => {
      // Save the next 253 days (about 700 bytes each), skipping ones already saved.
      list.filter((d) => d >= today).slice(0, 254).forEach((d) => {
        const url = `puzzles/${d}.json`;
        caches.match(url).then((hit) => { if (!hit) return fetch(url); }).catch(() => {});
      });
    }).catch(() => {});
  }
})();
