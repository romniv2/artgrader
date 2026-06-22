/* =====================================================================
   share.js  —  build a shareable "report card" PNG from a grade, and
   hand it to the native share sheet (or download as a fallback).
   Exposed as:  window.ArtShare
   ===================================================================== */
(function () {
  "use strict";

  const scoreColor = (s) => s >= 80 ? "#46d39a" : s >= 65 ? "#8bd450" : s >= 50 ? "#e8c14a" : s >= 35 ? "#e89a4a" : "#e8674a";
  const gradeLetter = (s) => {
    const t = [[93, "A"], [90, "A−"], [87, "B+"], [83, "B"], [80, "B−"], [77, "C+"], [73, "C"], [70, "C−"], [65, "D+"], [58, "D"], [0, "—"]];
    for (const [m, l] of t) if (s >= m) return l; return "—";
  };
  const blurb = (s) => s >= 88 ? "Genuinely strong work." : s >= 76 ? "Solid, with clear next steps." : s >= 64 ? "Good bones — a few targeted fixes away." : s >= 50 ? "Real potential; fundamentals need a pass." : "Lots to gain — structure first.";

  function rr(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function logoMark(ctx, x, y, size) {
    const g = ctx.createLinearGradient(x, y, x + size, y + size);
    g.addColorStop(0, "#7c5cff"); g.addColorStop(1, "#34d6c8");
    ctx.fillStyle = g; rr(ctx, x, y, size, size, size * 0.26); ctx.fill();
    const s = size / 56;
    ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 5 * s; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(x + 28 * s, y + 30 * s, 13 * s, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    [["#ff6b6b", 20, 22], ["#ffd166", 28, 18], ["#4ecdc4", 36, 22]].forEach(([c, dx, dy]) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, 3.2 * s, 0, 7); ctx.fill();
    });
  }

  // draw the artwork "contained" inside a rounded frame
  function drawArt(ctx, img, x, y, w, h) {
    ctx.save(); rr(ctx, x, y, w, h, 22); ctx.clip();
    ctx.fillStyle = "#0c0d13"; ctx.fillRect(x, y, w, h);
    const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = 1; rr(ctx, x, y, w, h, 22); ctx.stroke();
  }

  function buildCard(img, a) {
    const W = 1080, H = 1350, M = 72;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d");

    // background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#15131f"); bg.addColorStop(1, "#0c0d13");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * 0.2, 120, 0, W * 0.2, 120, 520);
    glow.addColorStop(0, "rgba(124,92,255,.28)"); glow.addColorStop(1, "rgba(124,92,255,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

    // brand row
    logoMark(ctx, M, 70, 60);
    ctx.fillStyle = "#e9ebf2"; ctx.font = "700 42px Georgia, serif"; ctx.textBaseline = "alphabetic";
    ctx.fillText("ArtGrader", M + 80, 100);
    ctx.fillStyle = "#9aa0b4"; ctx.font = "400 22px system-ui, sans-serif";
    ctx.fillText("a studio critique for your digital paintings", M + 80, 128);

    // artwork
    drawArt(ctx, img, M, 176, W - 2 * M, 624);

    // overall ring
    const ringX = M + 96, ringY = 968, R = 92;
    ctx.lineWidth = 16; ctx.strokeStyle = "#23283a";
    ctx.beginPath(); ctx.arc(ringX, ringY, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = scoreColor(a.overall); ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(ringX, ringY, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * a.overall / 100); ctx.stroke();
    ctx.fillStyle = scoreColor(a.overall); ctx.textAlign = "center";
    ctx.font = "800 58px Georgia, serif"; ctx.fillText(gradeLetter(a.overall), ringX, ringY + 8);
    ctx.fillStyle = "#9aa0b4"; ctx.font = "600 24px system-ui, sans-serif";
    ctx.fillText(a.overall + "/100", ringX, ringY + 44);
    ctx.textAlign = "left";

    // category bars
    const bx = M + 232, bw = W - bx - M, cats = [["Values", a.values.score], ["Color", a.color.score], ["Lighting", a.lighting.score], ["Composition", a.composition.score]];
    let by = 912;
    cats.forEach(([name, sc]) => {
      ctx.fillStyle = "#cfd3e0"; ctx.font = "600 26px system-ui, sans-serif"; ctx.fillText(name, bx, by);
      ctx.fillStyle = "#e9ebf2"; ctx.textAlign = "right"; ctx.fillText(String(sc), bx + bw, by); ctx.textAlign = "left";
      ctx.fillStyle = "#1d2230"; rr(ctx, bx, by + 12, bw, 12, 6); ctx.fill();
      ctx.fillStyle = scoreColor(sc); rr(ctx, bx, by + 12, bw * sc / 100, 12, 6); ctx.fill();
      by += 54;
    });

    // headline
    ctx.fillStyle = "#e9ebf2"; ctx.font = "italic 600 40px Georgia, serif";
    ctx.fillText(blurb(a.overall), M, 1182);

    // divider + footer
    ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(M, 1232); ctx.lineTo(W - M, 1232); ctx.stroke();
    ctx.fillStyle = "#8b91a6"; ctx.font = "500 24px system-ui, sans-serif";
    ctx.fillText("Graded with ArtGrader — runs free in your browser", M, 1280);
    ctx.textAlign = "right"; ctx.fillStyle = "#6f7589";
    ctx.fillText(new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }), W - M, 1280);
    ctx.textAlign = "left";

    return c;
  }

  async function toBlob(canvas) { return new Promise((r) => canvas.toBlob(r, "image/png")); }

  async function share(img, analysis) {
    const card = buildCard(img, analysis);
    const blob = await toBlob(card);
    const file = new File([blob], "artgrader-report.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "My ArtGrader report", text: "I graded my artwork with ArtGrader." }); return "shared"; }
      catch (e) { if (e.name === "AbortError") return "cancelled"; }
    }
    download(blob); return "downloaded";
  }

  function downloadCard(img, analysis) { return toBlob(buildCard(img, analysis)).then(download); }
  function download(blob) {
    const a = document.createElement("a"); a.download = "artgrader-report.png";
    a.href = URL.createObjectURL(blob); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  window.ArtShare = { buildCard, share, downloadCard };
})();
