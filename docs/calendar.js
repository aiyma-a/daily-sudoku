"use strict";
// The Calendar page: pick a past Daily to replay.
// Loaded before app.js; app.js calls it once with the game's shared pieces (ctx).
window.CalendarUI = function (ctx) {
  const { T, Store, LEVELS, today, realToday, KY_MONTHS, cap, el, getJson, openModal } = ctx;
  // Pick a past Daily to play. It reloads the page with ?date=..., which the
  // game already supports. Replays never touch the streak (see recordSolve).
  const WD = { en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"], ky: ["Дш", "Шш", "Шр", "Бш", "Жм", "Иш", "Жк"] };
  const daySolved = (d) => {
    const n = LEVELS.filter((lv) => Store.json(`ds:${d}:${lv}`, {}).done).length;
    return n === 0 ? "" : n === LEVELS.length ? "full" : "part";
  };
  function monthTitle(y, m) {
    if (window.I18n.lang === "ky") return `${KY_MONTHS[m]} ${y}`;
    const s = new Date(y, m, 1, 12).toLocaleDateString(window.I18n.lang === "ru" ? "ru-RU" : undefined, { month: "long", year: "numeric" });
    return cap(s);
  }
  function openCalendar() {
    openModal(T("Calendar"), (b) => {
      b.appendChild(el("p", T("Replay a past day. Filled = all three solved, outlined = some solved. Replays do not change your streak."), "small"));
      if (today !== realToday) {
        const back = el("button", T("Back to today"), "primary");
        back.addEventListener("click", () => { location.href = "?mode=daily"; });
        b.appendChild(back);
      }
      const box = el("div"); b.appendChild(box);
      getJson("puzzles/index.json").catch(() => []).then((list) => {
        const avail = new Set(list.filter((d) => d <= realToday));
        if (!avail.size) { box.appendChild(el("p", T("No past days are available right now."))); return; }
        const first = [...avail].sort()[0];
        const [fy, fm] = first.split("-").map(Number), [ry, rm] = realToday.split("-").map(Number);
        const minM = fy * 12 + fm - 1, maxM = ry * 12 + rm - 1;
        const [vy, vm] = today.split("-").map(Number);
        let month = Math.min(maxM, Math.max(minM, vy * 12 + vm - 1));
        const draw = () => {
          box.innerHTML = "";
          const y = (month / 12) | 0, m = month % 12;
          const head = el("div", undefined, "calhead");
          const prev = el("button", "‹"); prev.disabled = month <= minM; prev.setAttribute("aria-label", T("Previous"));
          const next = el("button", "›"); next.disabled = month >= maxM; next.setAttribute("aria-label", T("Next"));
          prev.addEventListener("click", () => { month--; draw(); });
          next.addEventListener("click", () => { month++; draw(); });
          head.append(prev, el("strong", monthTitle(y, m)), next);
          box.appendChild(head);
          const grid = el("div", undefined, "calgrid");
          (WD[window.I18n.lang] || WD.en).forEach((w) => grid.appendChild(el("span", w, "calwd")));
          const lead = (new Date(y, m, 1).getDay() + 6) % 7;
          for (let i = 0; i < lead; i++) grid.appendChild(el("span"));
          const n = new Date(y, m + 1, 0).getDate();
          for (let d = 1; d <= n; d++) {
            const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            if (!avail.has(ds)) { grid.appendChild(el("span", String(d), "calday off")); continue; }
            const cls = `calday ${daySolved(ds)}${ds === today ? " viewing" : ""}${ds === realToday ? " now" : ""}`;
            const btn = el("button", String(d), cls);
            btn.addEventListener("click", () => { location.href = ds === realToday ? "?mode=daily" : `?date=${ds}&mode=daily`; });
            grid.appendChild(btn);
          }
          box.appendChild(grid);
        };
        draw();
      });
    });
  }

  return { openCalendar };
};
