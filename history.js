/* =====================================================================
   history.js  —  local progress journal (localStorage).
   Saves a small thumbnail + the scores + the written critique snapshot for
   every piece you grade, so you can watch your fundamentals improve.
   Exposed as:  window.ArtHistory
   ===================================================================== */
(function () {
  "use strict";
  const KEY = "artgrader.history";
  const CAP = 60;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }
  function persist(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }   // quota — fail quietly
  }

  // small JPEG thumbnail so 60 entries stay well under quota
  function makeThumb(img, maxW = 360) {
    const s = Math.min(1, maxW / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * s));
    const h = Math.max(1, Math.round(img.naturalHeight * s));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.72);
  }

  function add(img, analysis) {
    const list = load();
    const rec = {
      id: Date.now(),
      date: new Date().toISOString(),
      thumb: makeThumb(img),
      overall: analysis.overall,
      scores: {
        values: analysis.values.score,
        color: analysis.color.score,
        lighting: analysis.lighting.score,
        composition: analysis.composition.score,
      },
      report: {
        values: pick(analysis.values),
        color: pick(analysis.color),
        lighting: pick(analysis.lighting),
        composition: pick(analysis.composition),
      },
    };
    list.unshift(rec);
    if (list.length > CAP) list.length = CAP;
    persist(list);
    return rec;
  }
  const pick = (d) => ({ score: d.score, good: d.good, bad: d.bad, tips: d.tips });

  function remove(id) { persist(load().filter((r) => r.id !== id)); }
  function clear() { localStorage.removeItem(KEY); }
  function count() { return load().length; }

  // ---- progress chart (inline SVG line of overall score over time) -------
  function renderChart(records, opts = {}) {
    const w = opts.w || 640, h = opts.h || 200, pad = 34;
    const data = records.slice().reverse();              // oldest -> newest
    if (data.length === 0) return `<div class="chart-empty">No data yet.</div>`;

    const xs = (i) => data.length === 1 ? w / 2 : pad + (i / (data.length - 1)) * (w - pad * 2);
    const ys = (v) => h - pad - (v / 100) * (h - pad * 2);

    // gridlines at 0/25/50/75/100
    let grid = "";
    for (let g = 0; g <= 100; g += 25) {
      const y = ys(g);
      grid += `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" class="grid"/>`;
      grid += `<text x="${pad - 8}" y="${y + 3}" class="ax">${g}</text>`;
    }

    const pts = data.map((r, i) => [xs(i), ys(r.overall)]);
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const area = `M${pts[0][0]} ${h - pad} ` + pts.map((p) => `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") + ` L${pts[pts.length - 1][0]} ${h - pad} Z`;

    const dots = pts.map((p, i) =>
      `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" class="dot"><title>${data[i].overall}/100 · ${new Date(data[i].date).toLocaleDateString()}</title></circle>`).join("");

    return `<svg class="progress-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#7c5cff" stop-opacity=".35"/>
        <stop offset="1" stop-color="#7c5cff" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}
      <path d="${area}" fill="url(#areaGrad)"/>
      <path d="${line}" class="trend"/>
      ${dots}
    </svg>`;
  }

  window.ArtHistory = { load, add, remove, clear, count, makeThumb, renderChart };
})();
