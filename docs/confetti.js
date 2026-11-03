"use strict";
// Full-screen confetti burst on a canvas. No library. Skipped for people who
// asked their device to reduce motion.
(function (root) {
  const COLORS = ["#ff5c8a", "#ffc93c", "#4cc9f0", "#7bd96a", "#9b6bff", "#ff8a3d"];

  function burst() {
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = document.createElement("canvas");
    cv.id = "confetti";
    const dpr = window.devicePixelRatio || 1;
    const W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99";
    document.body.appendChild(cv);
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);

    // pieces shoot up from the bottom corners and the middle, then fall
    const pieces = Array.from({ length: 180 }, (_, k) => {
      const from = k % 3;                       // left corner, middle, right corner
      const x = [0.05, 0.5, 0.95][from] * W;
      const angle = (-90 + (from - 1) * 25 + (Math.random() - 0.5) * 50) * Math.PI / 180;
      const speed = (9 + Math.random() * 11) * Math.max(0.7, H / 800);
      return {
        x, y: H * 0.95, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        w: 6 + Math.random() * 7, h: 9 + Math.random() * 8,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
        color: COLORS[(Math.random() * COLORS.length) | 0], wob: Math.random() * 6.28,
      };
    });

    const start = performance.now();
    (function frame(now) {
      const t = now - start;
      ctx.clearRect(0, 0, W, H);
      const fade = t > 3200 ? Math.max(0, 1 - (t - 3200) / 800) : 1;
      pieces.forEach((p) => {
        p.vy += 0.28; p.vx *= 0.992; p.vy *= 0.992;
        p.x += p.vx + Math.sin(p.wob += 0.08) * 0.8; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (t < 4000) requestAnimationFrame(frame); else cv.remove();
    })(start);
  }

  root.Confetti = { burst };
})(window);
