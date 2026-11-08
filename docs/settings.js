"use strict";
// The Settings page (mistakes, sound, vibration, bigger numbers).
// Loaded before app.js; app.js calls it once with the game's shared pieces (ctx).
window.SettingsUI = function (ctx) {
  const { T, S, saveSettings, feedback, render, el, openModal } = ctx;
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

  return { openSettings };
};
