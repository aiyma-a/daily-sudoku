"use strict";
(function () {
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

  let day = null;       // {easy:{puzzle,solution}, ...}
  let level = localStorage.getItem("ds:level") || "easy";
  let st = null;        // game state for current level
  let sel = -1;
  let notesOn = false;
  let timerId = null;
  let hint = null;      // {cell, digit, why, stage} while a hint is showing
  let hintModel = null;
  let tip = "";         // message from "Just right for you"
  const loadSkill = () => {
    try { return JSON.parse(localStorage.getItem("ds:skill")) || { ...window.Skill.PRIOR }; }
    catch (e) { return { ...window.Skill.PRIOR }; }
  };

  const key = () => `ds:${today}:${level}`;
  const save = () => localStorage.setItem(key(), JSON.stringify(st));

  function fresh() {
    const p = day[level].puzzle;
    return {
      vals: p.split("").map(Number),
      notes: Array.from({ length: 81 }, () => 0), // bitmask of 1..9
      history: [], elapsed: 0, done: false,
    };
  }

  function load() {
    const raw = localStorage.getItem(key());
    st = raw ? JSON.parse(raw) : fresh();
    sel = -1;
    render();
    startTimer();
  }

  const isGiven = (i) => day[level].puzzle[i] !== "0";

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
      if (hint && hint.cell === i && !st.vals[i]) cls += " hint";
      el.className = cls;
      if (st.vals[i]) {
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
    $("notes").textContent = `Notes: ${notesOn ? "on" : "off"}`;
    $("notes").setAttribute("aria-pressed", notesOn);
    $("msg").textContent = st.done ? "Solved! 🎉" : "";
    $("hinttext").textContent = st.done ? "" : (hintText() || tip);
    tick();
  }

  function isDone(lv) {
    try {
      const raw = localStorage.getItem(`ds:${today}:${lv}`);
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
    if (st.vals.join("") === day[level].solution) {
      st.done = true;
      stopTimer();
      if (!st.counted) {  // learn from this solve, once
        st.counted = true;
        localStorage.setItem("ds:skill", JSON.stringify(
          window.Skill.update(loadSkill(), day[level].score || 70, st.elapsed, st.hints)));
      }
      $("board").classList.remove("win");
      void $("board").offsetWidth; // restart the animation
      $("board").classList.add("win");
    }
    save();
    render();
  }

  // ----------------------------------------------------------------- hints
  // A learned model ranks the moves simple logic allows and we suggest the
  // top one (docs/hint.js). Press once to see where, again to see the digit.
  function hintText() {
    if (!hint) return "";
    const where = `row ${((hint.cell / 9) | 0) + 1}, column ${(hint.cell % 9) + 1}`;
    if (hint.none) return hint.none;
    if (hint.stage === 2) return `Put ${hint.digit} in ${where}.`;
    return `Look at ${where}: ${hint.why} (tap Hint again for the digit)`;
  }

  async function giveHint() {
    if (st.done) return;
    if (hint && hint.cell >= 0 && hint.stage === 1 && !hint.none && !st.vals[hint.cell]) {
      hint.stage = 2; st.hints = (st.hints || 0) + 1; save(); render(); return;
    }
    const sol = day[level].solution;
    const wrong = st.vals.findIndex((v, i) => v && v !== +sol[i]);
    if (wrong >= 0) {
      hint = { cell: wrong, none: "This number looks wrong. Erase it first." };
      sel = wrong; render(); return;
    }
    if (!hintModel) hintModel = await fetch("ml/hint_model.json").then((r) => r.json());
    const pick = window.Hint.best(hintModel, st.vals);
    if (!pick) { hint = { cell: -1, none: "No easy move here. Try pencil notes." }; render(); return; }
    hint = { cell: pick.cell, digit: pick.digit, stage: 1,
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
      if (st.elapsed % 5 === 0) save();
    }, 1000);
  }
  function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }

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
  $("hint").addEventListener("click", giveHint);
  $("fit").addEventListener("click", () => {
    const open = LEVELS.filter((lv) => !isDone(lv))
      .map((lv) => ({ level: lv, score: day[lv].score || 70 }));
    if (!open.length) { tip = "You finished all three today. Come back tomorrow!"; render(); return; }
    const m = loadSkill();
    const r = window.Skill.recommend(m, open);
    const mins = Math.max(1, Math.round(r.seconds / 60));
    tip = `Just right: ${r.level[0].toUpperCase() + r.level.slice(1)}, about ${mins} min for you` +
      (m.n ? ` (learned from ${m.n} solve${m.n > 1 ? "s" : ""}).` : " (a first guess; it learns as you solve).");
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

  // --------------------------------------------------------------- themes
  const THEMES = ["classic", "fall", "cartoon"];
  function setTheme(t) {
    if (!THEMES.includes(t)) t = "classic";
    document.body.dataset.theme = t;
    localStorage.setItem("ds:theme", t);
    [...$("themes").children].forEach((b) => b.classList.toggle("active", b.dataset.pick === t));
  }
  $("themes").addEventListener("click", (e) => {
    if (e.target.dataset && e.target.dataset.pick) setTheme(e.target.dataset.pick);
  });
  setTheme(localStorage.getItem("ds:theme") || "classic");

  // ----------------------------------------------------------------- boot
  $("date").textContent = new Date(today + "T12:00:00").toLocaleDateString(undefined,
    { weekday: "long", month: "long", day: "numeric" });
  if (!LEVELS.includes(level)) level = "easy";

  fetch(`puzzles/${today}.json`, { cache: "no-store" })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => { day = d; build(); load(); })
    .catch(() => {
      const e = $("error");
      e.hidden = false;
      e.textContent = "Today's puzzles are not published yet. Try again in a bit.";
    });
})();
