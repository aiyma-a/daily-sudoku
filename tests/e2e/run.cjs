"use strict";
// Browser test for the phone side of the game (docs/). Run: npm test
// Starts a tiny static server on docs/, opens the game in Chrome at phone size,
// plays it, and checks the main screens. Needs Google Chrome installed.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const DOCS = path.join(__dirname, "..", "..", "docs");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".webmanifest": "application/manifest+json" };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const f = path.join(DOCS, p);
      if (!f.startsWith(DOCS) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    }).listen(0, "127.0.0.1", () => resolve(srv));
  });
}

let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed++; console.log("  ok   " + name); }
  catch (e) { failures.push(name); console.log("  FAIL " + name + "\n       " + String(e.message).split("\n")[0]); }
}
const ok = (c, msg) => { if (!c) throw new Error(msg || "check failed"); };

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const index = JSON.parse(fs.readFileSync(path.join(DOCS, "puzzles", "index.json"), "utf8"));
  // Pretend it is this day, so the Daily puzzle and the Calendar do not depend on the real date.
  const date = index[Math.min(3, index.length - 1)];
  const puzzle = JSON.parse(fs.readFileSync(path.join(DOCS, "puzzles", `${date}.json`), "utf8"));

  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow" });
  await ctx.addInitScript((d) => {
    const real = Date, fixed = new real(d + "T12:00:00").getTime();
    class D extends real { constructor(...a) { a.length ? super(...a) : super(fixed); } static now() { return fixed; } }
    window.Date = D;
  }, date);
  const page = await ctx.newPage();
  const errors = [], missing = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/404/.test(m.text())) errors.push(m.text()); });
  page.on("response", (r) => { if (r.status() === 404 && !/favicon/.test(r.url())) missing.push(r.url()); });

  const cell = (i) => page.locator(`#board .cell[data-i="${i}"]`);
  const menu = async (id) => { await page.click("#menuBtn"); await page.click(id); };
  const closeModal = () => page.click("#modalclose");
  const place = async (i, d) => { await cell(i).click(); await page.click(`#pad button[data-n="${d}"]`); };
  const empties = () => puzzle.easy.puzzle.split("").map((c, i) => (c === "0" ? i : -1)).filter((i) => i >= 0);

  console.log(`Daily Sudoku browser test (pretending it is ${date})`);
  await page.goto(base);
  await page.waitForSelector("#board .cell");

  await check("first visit shows How to play, which can be skipped", async () => {
    ok(await page.locator("#modal").isVisible(), "tutorial not shown");
    await page.click("#modalbody >> text=Skip");
    ok(await page.locator("#modal").isHidden(), "tutorial still open");
  });

  await check("board has 81 cells and the pad has 9 keys", async () => {
    ok((await page.locator("#board .cell").count()) === 81);
    ok((await page.locator("#pad button").count()) === 9);
  });

  await check("cells have screen-reader labels (row, column, given/empty)", async () => {
    const given = puzzle.easy.puzzle.indexOf("0") === 0 ? "empty" : "given";
    const lab = await cell(0).getAttribute("aria-label");
    ok(/row 1, column 1/.test(lab) && lab.includes(given), lab);
  });

  await check("keyboard: one Tab stop, arrow keys move, Enter selects", async () => {
    ok((await page.locator('#board .cell[tabindex="0"]').count()) === 1, "more than one tab stop");
    await cell(0).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    ok((await page.evaluate(() => document.activeElement.dataset.i)) === "10", "focus did not move to cell 10");
    ok(await cell(10).evaluate((e) => e.classList.contains("selected")), "cell 10 not selected");
  });

  await check("wrong entry, Erase and Undo", async () => {
    const i = empties()[0], right = +puzzle.easy.solution[i], wrong = right === 1 ? 2 : 1;
    await place(i, wrong);
    ok((await cell(i).textContent()) === String(wrong), "digit not placed");
    await page.click("#erase");
    ok((await cell(i).textContent()) === "", "erase did not clear");
    await page.click("#undo");
    ok((await cell(i).textContent()) === String(wrong), "undo did not bring it back");
    await page.click("#erase");
  });

  await check("Notes: turn on, pencil a digit, turn off", async () => {
    const i = empties()[1];
    await page.click("#notes");
    ok((await page.getAttribute("#notes", "aria-pressed")) === "true");
    await place(i, 5);
    ok((await cell(i).locator(".notes").count()) === 1, "no notes shown");
    await page.click("#notes");
    ok((await page.getAttribute("#notes", "aria-pressed")) === "false");
    await cell(i).click(); await page.click("#erase");
  });

  await check("Fill all notes puts notes in empty cells", async () => {
    await menu("#btnFillNotes");
    ok((await page.locator("#board .notes").count()) > 10, "few notes");
  });

  await check("Hint: where, then the digit", async () => {
    await page.click("#hint");
    await page.waitForFunction(() => /Look at|Put|wrong|No easy/.test(document.getElementById("hinttext").textContent));
    const t1 = await page.textContent("#hinttext");
    if (/Look at/.test(t1)) {
      await page.click("#hint");
      ok(/Put \d in/.test(await page.textContent("#hinttext")), "no digit on second tap");
    }
  });

  await check("Pause hides the board, focus is trapped, Resume returns", async () => {
    await page.click("#pauseBtn");
    ok(await page.locator("#pause").isVisible());
    await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
    ok(await page.evaluate(() => document.getElementById("pause").contains(document.activeElement)), "focus left the Pause screen");
    await page.click("#resumeBtn");
    ok(await page.locator("#pause").isHidden());
  });

  await check("Stats, Settings, How to play, Calendar open and close (Esc too)", async () => {
    for (const [btn, title] of [["#btnStats", "Stats"], ["#btnSettings", "Settings"], ["#btnHelp", "How to play"], ["#btnCalendar", "Calendar"]]) {
      await menu(btn);
      ok((await page.textContent("#modaltitle")) === title, `${title} title`);
      await page.keyboard.press("Escape");
      ok(await page.locator("#modal").isHidden(), `${title} did not close`);
    }
  });

  await check("Settings toggles save (Bigger numbers)", async () => {
    await menu("#btnSettings");
    await page.click('#modalbody button[aria-label="Bigger numbers"]');
    ok(await page.evaluate(() => document.body.classList.contains("big")), "not big");
    ok(await page.evaluate(() => JSON.parse(localStorage.getItem("ds:set")).big === true), "not saved");
    await page.click('#modalbody button[aria-label="Bigger numbers"]');
    await closeModal();
  });

  await check("Calendar lists days, the viewed day is marked", async () => {
    await menu("#btnCalendar");
    await page.waitForSelector(".calday");
    ok((await page.locator(".calday.now").count()) === 1, "today not marked");
    await closeModal();
  });

  await check("Daily solves and shows Solved, Share and Save picture", async () => {
    // Fill every empty cell for Easy.
    for (const i of empties()) {
      await cell(i).click();
      if (await cell(i).evaluate((e) => e.classList.contains("entry"))) continue;
      await page.click(`#pad button[data-n="${puzzle.easy.solution[i]}"]`);
    }
    await page.waitForFunction(() => /Solved/.test(document.getElementById("msg").textContent));
    ok(await page.locator("#share").isVisible(), "no Share button");
    ok(await page.locator("#savePic").isVisible(), "no Save picture button");
  });

  await check("Save picture downloads a PNG", async () => {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#savePic")]);
    const f = await dl.path();
    ok(fs.readFileSync(f).subarray(1, 4).toString() === "PNG", "not a PNG");
  });

  await check("Share builds the picture and text (no crash without a share sheet)", async () => {
    await page.evaluate(() => { window.__shared = null; navigator.share = async (d) => { window.__shared = d; }; navigator.canShare = () => true; });
    await page.click("#share");
    await page.waitForFunction(() => window.__shared);
    const d = await page.evaluate(() => ({ text: window.__shared.text, file: window.__shared.files && window.__shared.files[0].type }));
    ok(/Daily Sudoku/.test(d.text) && /Easy/.test(d.text), d.text);
    ok(d.file === "image/png", "no picture attached");
  });

  await check("Solving unlocks achievements, shown on the Stats page", async () => {
    await menu("#btnStats");
    const t = await page.textContent("#modalbody");
    ok(/🏆 First solve/.test(t), "First solve not unlocked");
    await closeModal();
  });

  await check("Stats show the solved puzzle and a streak", async () => {
    await menu("#btnStats");
    const t = await page.textContent("#modalbody");
    ok(/Easy/.test(t) && /Current streak: 1/.test(t), t.slice(0, 120));
    await closeModal();
  });

  await check("progress survives a reload", async () => {
    await page.reload();
    await page.waitForFunction(() => /Solved/.test(document.getElementById("msg").textContent));
  });

  await check("switching level (Medium) loads a fresh board", async () => {
    await page.click("#menuBtn"); await page.click('#levels button[data-level="medium"]');
    ok((await page.textContent("#msg")) === "", "still shows Solved");
    ok(/Medium/.test(await page.textContent("#label")));
  });

  await check("Practice: new puzzle and previous puzzle", async () => {
    await page.click("#menuBtn"); await page.click('#mode button[data-mode="practice"]');
    await page.waitForFunction(() => !document.getElementById("pnav").hidden);
    ok(/#1/.test(await page.textContent("#label")));
    await page.click("#next");
    ok(/#2/.test(await page.textContent("#label")));
    await page.click("#prev");
    ok(/#1/.test(await page.textContent("#label")));
    await page.click("#menuBtn"); await page.click('#mode button[data-mode="daily"]');
  });

  await check("Russian and Kyrgyz show no raw English labels or errors", async () => {
    for (const lang of ["ru", "ky", "en"]) {
      await page.click(`#langs button[data-lang="${lang}"]`);
      const bad = await page.evaluate(() => [...document.querySelectorAll("[data-i18n]")].filter((e) => e.textContent.trim() === "").length);
      ok(bad === 0, `${lang}: empty translated labels`);
    }
    ok((await page.textContent("#menuBtn")).includes("Menu"));
  });

  await check("no sideways scrolling at 320px, landscape or tablet", async () => {
    for (const [w, h] of [[320, 640], [844, 390], [820, 1180]]) {
      await page.setViewportSize({ width: w, height: h });
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `scrolls sideways at ${w}x${h}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
  });

  await check("opens offline after the first visit", async () => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(async () => (await caches.keys()).length > 0);
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector("#board .cell");
    ok((await page.locator("#board .cell").count()) === 81);
    await ctx.setOffline(false);
  });

  await check("no script errors and no missing files", async () => {
    ok(!errors.length, errors.join(" | "));
    ok(!missing.length, "404: " + missing.join(", "));
  });

  await browser.close();
  srv.close();
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
