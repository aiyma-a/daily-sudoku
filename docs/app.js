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
    if (st.vals.join("") === day[level].solution) {
      st.done = true;
      stopTimer();
    }
    save();
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
  $("levels").addEventListener("click", (e) => {
    const lv = e.target.dataset && e.target.dataset.level;
    if (!lv || lv === level) return;
    save();
    level = lv;
    localStorage.setItem("ds:level", level);
    load();
  });
  document.addEventListener("visibilitychange", () => { if (st) save(); });

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
