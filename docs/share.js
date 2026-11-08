"use strict";
// Share button and the result picture (no digits, so it spoils nothing).
// Loaded before app.js; app.js calls it once with the game's shared pieces (ctx).
window.ShareUI = function (ctx) {
  const { T, $, fmt, cap, toast, isGiven, dateLabel, pidx, today, streaks } = ctx;
  function shareText() {
    const when = ctx.mode === "daily"
      ? dateLabel()
      : `${T("Practice")} #${pidx(ctx.level)}`;
    const hints = ctx.st.hints ? T("{n} hints", { n: ctx.st.hints }) : T("no hints");
    return `${T("Daily Sudoku")} · ${when} · ${T(cap(ctx.level))} ✅ ${fmt(ctx.st.elapsed)} · ${hints}\n${location.origin}${location.pathname}`;
  }
  // A result picture to post: no digits (no spoilers), just the shape of how it
  // was filled in (darker = given, blue = yours) and the headline numbers.
  function resultImage() {
    const W = 1080, H = 1350, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d"), cs = getComputedStyle(document.body);
    const accent = cs.getPropertyValue("--accent").trim() || "#1a56c4", font = cs.fontFamily || "sans-serif";
    g.fillStyle = accent; g.fillRect(0, 0, W, H);
    g.fillStyle = "#fff"; g.textAlign = "center";
    g.font = `800 84px ${font}`; g.fillText(T("Daily Sudoku"), W / 2, 150);
    const when = ctx.mode === "daily" ? dateLabel() : `${T("Practice")} #${pidx(ctx.level)}`;
    g.font = `600 46px ${font}`; g.globalAlpha = .85; g.fillText(`${when} · ${T(cap(ctx.level))}`, W / 2, 225); g.globalAlpha = 1;
    const cell = 92, size = cell * 9, x0 = (W - size) / 2, y0 = 290;
    g.fillStyle = "#fff"; g.fillRect(x0 - 12, y0 - 12, size + 24, size + 24);
    for (let i = 0; i < 81; i++) {
      const r = (i / 9) | 0, c = i % 9;
      g.fillStyle = isGiven(i) ? "#c9ccd3" : accent;
      g.fillRect(x0 + c * cell + 3, y0 + r * cell + 3, cell - 6, cell - 6);
    }
    g.fillStyle = "#fff"; // thicker gaps between boxes
    for (let k = 1; k < 3; k++) { g.fillRect(x0 + k * cell * 3 - 5, y0, 10, size); g.fillRect(x0, y0 + k * cell * 3 - 5, size, 10); }
    g.font = `800 120px ${font}`; g.fillText(`✅ ${fmt(ctx.st.elapsed)}`, W / 2, 1230);
    g.font = `600 44px ${font}`;
    const hints = ctx.st.hints ? T("{n} hints", { n: ctx.st.hints }) : T("no hints");
    const sk = ctx.mode === "daily" && streaks().cur ? ` · 🔥 ${streaks().cur}` : "";
    g.fillText(hints + sk, W / 2, 1295);
    return new Promise((res) => cv.toBlob(res, "image/png"));
  }
  async function share() {
    const text = shareText();
    try {
      const blob = await resultImage();
      const file = new File([blob], "daily-sudoku.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      toast(T("Copied to clipboard"));
    } catch (e) { /* share sheet closed */ }
  }
  async function savePicture() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await resultImage());
    a.download = `daily-sudoku-${today}-${ctx.level}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  $("share").addEventListener("click", share);
  $("savePic").addEventListener("click", savePicture);
};
