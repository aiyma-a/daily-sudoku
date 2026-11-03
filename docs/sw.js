"use strict";
// Service worker: keeps the game and recent puzzles on the phone so it opens
// and plays with no connection. Bump VERSION when the file list changes.
const VERSION = "v1";
const CACHE = `daily-sudoku-${VERSION}`;
const SHELL = [
  "./", "index.html", "style.css", "app.js", "hint.js", "engine.js", "skill.js",
  "mistake.js", "confetti.js", "how.html", "manifest.webmanifest",
  "ml/hint_model.json", "ml/mistake_model.json", "ml/difficulty_model.json",
  "ml/summary.json", "ml/importance.png", "ml/predicted_vs_real.png",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))  // one missing file must not block the rest
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const isPuzzle = url.pathname.includes("/puzzles/");

  if (isPuzzle) {
    // Puzzles: ask the network first (a new day), fall back to the saved copy.
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }
  // Everything else: show the saved copy instantly, refresh it in the background.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit || (req.mode === "navigate" ? caches.match("index.html") : undefined));
      return hit || net;
    })
  );
});
