/* =====================================================================
   app.js  —  UI wiring.
   Views: landing -> result -> history. Plus tutorial, theory, progress.
   Depends on: ArtAnalysis, ArtCorrections, ArtTheory, ArtHistory, ArtAI
   ===================================================================== */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const DISPLAY_MAX = 1400;

  const state = {
    img: null, dataUrl: null, analysis: null,
    overlay: "none", activeTab: "values",
    compareOn: false, correctedCanvas: null, saved: false,
  };

  // ---------- toast ----------
  let toastTimer;
  function toast(msg, ms = 2600) {
    const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add("hidden"), ms);
  }

  // ---------- view switching ----------
  function showView(name) {
    $("#landingView").classList.toggle("hidden", name !== "landing");
    $("#resultView").classList.toggle("hidden", name !== "result");
    $("#historyView").classList.toggle("hidden", name !== "history");
    $("#newImageBtn").classList.toggle("hidden", name === "landing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ===================================================================
  //  UPLOAD
  // ===================================================================
  const dropzone = $("#dropzone");
  const fileInput = $("#fileInput");
  const openPicker = () => fileInput.click();

  $("#browseBtn").addEventListener("click", openPicker);
  $("#heroUploadBtn").addEventListener("click", openPicker);
  dropzone.addEventListener("click", (e) => { if (e.target.id !== "browseBtn") openPicker(); });
  dropzone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") openPicker(); });
  fileInput.addEventListener("change", (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); });

  ["dragenter", "dragover"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("drag"); }));
  dropzone.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) loadFile(f); else toast("That doesn't look like an image file.");
  });
  window.addEventListener("paste", (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
    if (item) loadFile(item.getAsFile());
  });

  function loadFile(file) {
    if (!file || !file.type.startsWith("image/")) return toast("Please choose an image.");
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => { state.img = img; state.dataUrl = reader.result; onImageReady(); };
      img.onerror = () => toast("Couldn't decode that image.");
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  // ===================================================================
  //  PIPELINE
  // ===================================================================
  function onImageReady() {
    state.saved = false;
    showView("result");
    drawBaseImage();
    requestAnimationFrame(() => {
      state.analysis = ArtAnalysis.analyzeImage(state.img);
      renderReport(state.analysis);
      setOverlay("none");
      $$("#overlayControls .seg-btn").forEach((x) => x.classList.toggle("active", x.dataset.overlay === "none"));
      resetCompare();
      $("#aiBlock").classList.toggle("hidden", !ArtAI.hasKey());
      $("#aiOutput").classList.add("muted");
      if (!state.saved) { ArtHistory.add(state.img, state.analysis); state.saved = true; refreshHistoryCount(); }
    });
  }

  function displaySize() {
    const s = Math.min(1, DISPLAY_MAX / Math.max(state.img.naturalWidth, state.img.naturalHeight));
    return { w: Math.max(1, Math.round(state.img.naturalWidth * s)), h: Math.max(1, Math.round(state.img.naturalHeight * s)) };
  }
  function drawBaseImage() {
    const { w, h } = displaySize();
    for (const id of ["#viewCanvas", "#overlayCanvas", "#correctedCanvas"]) { const c = $(id); c.width = w; c.height = h; }
    $("#viewCanvas").getContext("2d").drawImage(state.img, 0, 0, w, h);
  }

  // ===================================================================
  //  REPORT
  // ===================================================================
  function gradeLetter(score) {
    const t = [[93, "A"], [90, "A−"], [87, "B+"], [83, "B"], [80, "B−"], [77, "C+"], [73, "C"], [70, "C−"], [65, "D+"], [58, "D"], [0, "—"]];
    for (const [m, l] of t) if (score >= m) return l; return "—";
  }
  function overallBlurb(s) {
    if (s >= 88) return "Genuinely strong. We're polishing, not rescuing.";
    if (s >= 76) return "Solid piece with a couple of clear levers to pull.";
    if (s >= 64) return "Good bones. A few targeted fixes will lift it a lot.";
    if (s >= 50) return "Real potential — the fundamentals need a pass.";
    return "Lots to gain here. Let's fix the structure first.";
  }
  function scoreColor(s) {
    if (s >= 80) return "#46d39a"; if (s >= 65) return "#8bd450";
    if (s >= 50) return "#e8c14a"; if (s >= 35) return "#e89a4a"; return "#e8674a";
  }

  function renderReport(a) {
    const C = 2 * Math.PI * 52, ring = $("#ringFg");
    ring.style.strokeDasharray = C; ring.style.strokeDashoffset = C * (1 - a.overall / 100); ring.style.stroke = scoreColor(a.overall);
    $("#overallLetter").textContent = gradeLetter(a.overall);
    $("#overallLetter").style.color = scoreColor(a.overall);
    $("#overallTitle").textContent = `Overall ${a.overall}/100`;
    $("#overallSummary").textContent = overallBlurb(a.overall);

    const cats = [["Values", a.values.score], ["Color", a.color.score], ["Lighting", a.lighting.score], ["Composition", a.composition.score]];
    $("#scorebars").innerHTML = cats.map(([n, sc]) => `
      <div class="scorebar"><div class="sb-label"><span>${n}</span><strong>${sc}</strong></div>
      <div class="sb-track"><div class="sb-fill" style="width:${sc}%;background:${scoreColor(sc)}"></div></div></div>`).join("");

    renderPalette(a.color.palette);
    renderTab(state.activeTab);
  }

  function renderPalette(palette) {
    $("#paletteStrip").innerHTML = palette.map((p) => {
      const hex = "#" + [p.r, p.g, p.b].map((v) => v.toString(16).padStart(2, "0")).join("");
      return `<div class="swatch" style="background:${hex};flex:${Math.max(0.4, p.weight * 4)}"><span>${hex.toUpperCase()}</span></div>`;
    }).join("");
  }

  // ---------- tabs ----------
  $$(".tab").forEach((t) => t.addEventListener("click", () => {
    $$(".tab").forEach((x) => x.classList.remove("active")); t.classList.add("active");
    state.activeTab = t.dataset.tab; renderTab(state.activeTab);
  }));

  function renderTab(tab) {
    const a = state.analysis; if (!a) return;
    const map = {
      values: { d: a.values, metrics: valueMetrics(a.values) },
      color: { d: a.color, metrics: colorMetrics(a.color) },
      lighting: { d: a.lighting, metrics: lightMetrics(a.lighting) },
      composition: { d: a.composition, metrics: compMetrics(a.composition) },
    };
    const { d, metrics } = map[tab];
    $("#tabBody").innerHTML = `
      <div class="metric-row">${metrics}</div>
      ${listBlock("good", "✓ Working", d.good)}
      ${listBlock("bad", "✕ Hurting it", d.bad)}
      ${listBlock("tip", "→ Try this", d.tips)}
      ${theoryBlock(tab, d)}`;
  }

  function theoryBlock(tab, d) {
    const concepts = ArtTheory.forCategory(tab, d);
    if (!concepts.length) return "";
    const cards = concepts.map((c) => `
      <details class="theory-card">
        <summary><span class="t-chip">📖 ${c.tag}</span> ${c.title}</summary>
        <div class="t-body">
          <p>${c.body}</p>
          <p class="t-why"><strong>Why it matters:</strong> ${c.why}</p>
          <p class="t-tip"><strong>Try:</strong> ${c.tip}</p>
        </div>
      </details>`).join("");
    return `<div class="theory-wrap"><h4 class="theory-h">Theory behind this</h4>${cards}</div>`;
  }

  function listBlock(cls, title, items) {
    if (!items || !items.length) return "";
    return `<div class="fb ${cls}"><h4>${title}</h4><ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul></div>`;
  }
  const chip = (l, v) => `<div class="metric"><small>${l}</small><b>${v}</b></div>`;
  const valueMetrics = (v) => chip("Black point", Math.round(v.blackPoint)) + chip("White point", Math.round(v.whitePoint)) + chip("Range", `${Math.round(v.range)}/255`) + chip("Contrast", Math.round(v.std));
  const colorMetrics = (c) => chip("Mean sat.", c.meanSat.toFixed(2)) + chip("Temp.", c.tempBias) + chip("Cast (W/C)", c.castWarmCool.toFixed(2)) + chip("Swatches", c.palette.length);
  const lightMetrics = (l) => chip("Global contrast", Math.round(l.globalContrast)) + chip("Local contrast", l.localContrast.toFixed(1)) + chip("Light dir.", l.lightDir || "—") + chip("Flat?", l.flat ? "yes" : "no");
  const compMetrics = (c) => chip("Focal X", c.focal.x.toFixed(2)) + chip("Focal Y", c.focal.y.toFixed(2)) + chip("On thirds", c.onThirds ? "yes" : "no") + chip("L/R balance", c.hBalance.toFixed(2));

  // ===================================================================
  //  OVERLAYS  (incl. Notan posterize)
  // ===================================================================
  $$("#overlayControls .seg-btn").forEach((b) => b.addEventListener("click", () => {
    $$("#overlayControls .seg-btn").forEach((x) => x.classList.remove("active")); b.classList.add("active");
    setOverlay(b.dataset.overlay);
  }));

  const NOTAN_TONES = [28, 84, 132, 186, 234];   // 5-value scale
  function setOverlay(type) {
    state.overlay = type;
    const oc = $("#overlayCanvas"), ctx = oc.getContext("2d");
    ctx.clearRect(0, 0, oc.width, oc.height);
    $("#paletteStrip").classList.toggle("hidden", type !== "palette");
    $("#notanLegend").classList.toggle("hidden", type !== "notan");

    if (type === "gray") {
      ctx.save(); ctx.filter = "grayscale(1)"; ctx.drawImage(state.img, 0, 0, oc.width, oc.height); ctx.restore();
    } else if (type === "notan") {
      ctx.drawImage(state.img, 0, 0, oc.width, oc.height);
      const id = ctx.getImageData(0, 0, oc.width, oc.height), px = id.data;
      for (let i = 0; i < px.length; i += 4) {
        const L = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        const band = Math.min(4, Math.floor(L / 51.2));
        const t = NOTAN_TONES[band];
        px[i] = px[i + 1] = px[i + 2] = t;
      }
      ctx.putImageData(id, 0, 0);
      renderNotanLegend();
    } else if (type === "thirds") {
      drawThirds(ctx, oc.width, oc.height);
    }
  }

  function renderNotanLegend() {
    $("#notanLegend").innerHTML = "<span>dark</span>" +
      NOTAN_TONES.map((t) => `<i style="background:rgb(${t},${t},${t})"></i>`).join("") + "<span>light</span>";
  }

  function drawThirds(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = Math.max(1, w / 900); ctx.setLineDash([6, 6]);
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo((w * i) / 3, 0); ctx.lineTo((w * i) / 3, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (h * i) / 3); ctx.lineTo(w, (h * i) / 3); ctx.stroke();
    }
    const f = state.analysis.composition.focal;
    ctx.setLineDash([]); ctx.fillStyle = "rgba(124,92,255,.9)"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(f.x * w, f.y * h, Math.max(7, w / 90), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ===================================================================
  //  CORRECTIONS + COMPARE
  // ===================================================================
  function currentFixes() { const f = {}; $$("#correctionToggles input").forEach((i) => (f[i.dataset.fix] = i.checked)); return f; }

  $("#applyFixBtn").addEventListener("click", () => {
    if (!state.analysis) return;
    const fixes = currentFixes();
    if (!Object.values(fixes).some(Boolean)) return toast("Tick at least one fix to apply.");
    const corrected = ArtCorrections.renderCorrected(state.img, state.analysis, fixes, DISPLAY_MAX);
    state.correctedCanvas = corrected;
    const dst = $("#correctedCanvas"); dst.width = corrected.width; dst.height = corrected.height;
    dst.getContext("2d").drawImage(corrected, 0, 0);
    setOverlay("none");
    $$("#overlayControls .seg-btn").forEach((x) => x.classList.toggle("active", x.dataset.overlay === "none"));
    showCompare(true); $("#downloadBtn").classList.remove("hidden");
    toast("Drag the divider to compare. Real edits to your pixels.");
  });
  $("#teachOnlyBtn").addEventListener("click", () => { showCompare(false); $("#downloadBtn").classList.add("hidden"); toast("Words only — no pixels touched."); });
  $("#downloadBtn").addEventListener("click", () => {
    if (!state.correctedCanvas) return;
    const a = document.createElement("a"); a.download = "artgrader-corrected.png"; a.href = state.correctedCanvas.toDataURL("image/png"); a.click();
  });

  function resetCompare() { showCompare(false); $("#downloadBtn").classList.add("hidden"); }
  function showCompare(on) { state.compareOn = on; $("#compareWrap").classList.toggle("hidden", !on); if (on) setCompare(50); }
  function setCompare(pct) {
    pct = Math.max(0, Math.min(100, pct));
    $("#correctedCanvas").style.clipPath = `inset(0 0 0 ${pct}%)`;
    $("#compareHandle").style.left = pct + "%";
  }
  (function initCompareDrag() {
    const wrap = $("#compareWrap"); let dragging = false;
    const toPct = (x) => { const r = wrap.getBoundingClientRect(); return ((x - r.left) / r.width) * 100; };
    const start = (e) => { dragging = true; move(e); };
    const move = (e) => { if (!dragging) return; setCompare(toPct(e.touches ? e.touches[0].clientX : e.clientX)); };
    const end = () => (dragging = false);
    $("#compareHandle").addEventListener("mousedown", start); wrap.addEventListener("mousedown", start);
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", end);
    $("#compareHandle").addEventListener("touchstart", start, { passive: true });
    wrap.addEventListener("touchmove", move, { passive: true }); window.addEventListener("touchend", end);
  })();

  // ===================================================================
  //  NAV BUTTONS
  // ===================================================================
  $("#newImageBtn").addEventListener("click", goLanding);
  $("#brandHome").addEventListener("click", goLanding);
  $("#heroLearnBtn").addEventListener("click", openTutorial);
  $("#tutorialBtn").addEventListener("click", openTutorial);
  $("#historyBtn").addEventListener("click", openHistory);

  function goLanding() {
    state.img = null; state.analysis = null; state.correctedCanvas = null; fileInput.value = "";
    showView("landing");
  }

  // ===================================================================
  //  HISTORY / PROGRESS
  // ===================================================================
  function refreshHistoryCount() {
    const n = ArtHistory.count(), pill = $("#historyCount");
    pill.textContent = n; pill.classList.toggle("hidden", n === 0);
  }
  function openHistory() { renderHistory(); showView("history"); }

  function renderHistory() {
    const records = ArtHistory.load();
    const empty = records.length === 0;
    $("#historyEmpty").classList.toggle("hidden", !empty);
    $("#historyGrid").classList.toggle("hidden", empty);
    $(".chart-panel").classList.toggle("hidden", empty);
    if (empty) return;

    $("#progressChart").innerHTML = ArtHistory.renderChart(records);
    const avg = Math.round(records.reduce((s, r) => s + r.overall, 0) / records.length);
    $("#avgScore").textContent = `avg ${avg}`;
    $("#avgScore").style.color = scoreColor(avg);

    $("#historyGrid").innerHTML = records.map((r) => `
      <button class="hist-card" data-id="${r.id}">
        <img src="${r.thumb}" alt="graded piece" loading="lazy"/>
        <div class="hist-meta">
          <span class="hist-score" style="color:${scoreColor(r.overall)}">${r.overall}</span>
          <span class="hist-date">${new Date(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        </div>
      </button>`).join("");
    $$(".hist-card").forEach((c) => c.addEventListener("click", () => openDetail(+c.dataset.id)));
  }

  $("#clearHistoryBtn").addEventListener("click", () => {
    if (!confirm("Clear your whole progress history? This can't be undone.")) return;
    ArtHistory.clear(); refreshHistoryCount(); renderHistory(); toast("History cleared.");
  });
  $("#historyUploadBtn").addEventListener("click", openPicker);

  // ---- history detail modal ----
  const detailModal = $("#detailModal");
  function openDetail(id) {
    const r = ArtHistory.load().find((x) => x.id === id); if (!r) return;
    const cats = [["Values", "values"], ["Color", "color"], ["Lighting", "lighting"], ["Composition", "composition"]];
    const bars = cats.map(([n, k]) => `
      <div class="scorebar"><div class="sb-label"><span>${n}</span><strong>${r.scores[k]}</strong></div>
      <div class="sb-track"><div class="sb-fill" style="width:${r.scores[k]}%;background:${scoreColor(r.scores[k])}"></div></div></div>`).join("");
    const sections = cats.map(([n, k]) => {
      const rep = r.report[k]; if (!rep) return "";
      return `<div class="detail-cat"><h4>${n} · ${rep.score}</h4>
        ${listBlock("good", "✓ Working", rep.good)}${listBlock("bad", "✕ Hurting it", rep.bad)}${listBlock("tip", "→ Try this", rep.tips)}</div>`;
    }).join("");
    $("#detailBody").innerHTML = `
      <div class="detail-head">
        <img class="detail-thumb" src="${r.thumb}" alt="graded piece"/>
        <div>
          <h2>Graded ${new Date(r.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</h2>
          <div class="detail-overall" style="color:${scoreColor(r.overall)}">${r.overall}<small>/100 · ${gradeLetter(r.overall)}</small></div>
          <div class="detail-bars">${bars}</div>
          <div class="detail-actions">
            <button class="btn small" id="detailShare">📤 Share card</button>
            <button class="btn ghost small" id="detailDelete">Delete this entry</button>
          </div>
        </div>
      </div>
      <div class="detail-sections">${sections}</div>`;
    $("#detailDelete").addEventListener("click", () => {
      ArtHistory.remove(id); refreshHistoryCount(); renderHistory(); closeModal(detailModal); toast("Entry deleted.");
    });
    $("#detailShare").addEventListener("click", () => {
      const im = new Image();
      im.onload = async () => {
        const fake = { overall: r.overall, values: { score: r.scores.values }, color: { score: r.scores.color }, lighting: { score: r.scores.lighting }, composition: { score: r.scores.composition } };
        const res = await ArtShare.share(im, fake);
        if (res !== "cancelled") toast(res === "downloaded" ? "Report card saved." : "Shared!");
      };
      im.src = r.thumb;
    });
    openModal(detailModal);
  }
  $("#detailClose").addEventListener("click", () => closeModal(detailModal));
  detailModal.addEventListener("click", (e) => { if (e.target === detailModal) closeModal(detailModal); });

  // ===================================================================
  //  TUTORIAL
  // ===================================================================
  const tutorialModal = $("#tutorialModal");
  const TUT_STEPS = [
    { icon: "⬆", h: "1 · Upload", p: "Drag a PNG/JPG in, paste from Photoshop with Ctrl+V, or click to browse. It’s analysed on your machine — nothing is uploaded." },
    { icon: "◑", h: "2 · Read the four reads", p: "Values, Color, Lighting and Composition each get a score, the raw numbers behind it, and plain-English notes." },
    { icon: "◫", h: "3 · Flip the views", p: "Toggle Values (grayscale), Notan (the 2-value design), the Thirds grid, and your extracted Palette to see the piece like a designer." },
    { icon: "📖", h: "4 · Learn the theory", p: "Open the “Theory behind this” cards in any tab — every note ties back to a real principle and a concrete way to apply it." },
    { icon: "⇄", h: "5 · Fix or just learn", p: "Apply a real correction to your own image and drag to compare — or choose “just teach me” and keep your pixels untouched." },
    { icon: "📈", h: "6 · Track progress", p: "Every grade is saved to your local Progress page so you can watch your fundamentals climb over weeks." },
  ];
  function renderTutorial() {
    $("#tutGrid").innerHTML = TUT_STEPS.map((s) => `
      <div class="tut-step"><div class="tut-ico">${s.icon}</div><div><strong>${s.h}</strong><p>${s.p}</p></div></div>`).join("");
  }
  function openTutorial() { openModal(tutorialModal); }
  $("#tutorialClose").addEventListener("click", () => closeModal(tutorialModal));
  $("#tutStartBtn").addEventListener("click", () => { closeModal(tutorialModal); if (!state.analysis) openPicker(); });
  tutorialModal.addEventListener("click", (e) => { if (e.target === tutorialModal) closeModal(tutorialModal); });

  // ===================================================================
  //  THEORY TEASER (landing)
  // ===================================================================
  function renderTeaser() {
    $("#theoryTeaser").innerHTML = ArtTheory.featured.map((c) => `
      <div class="teaser-card">
        <span class="t-chip">📖 ${c.tag}</span>
        <h4>${c.title}</h4>
        <p>${c.body}</p>
      </div>`).join("");
  }

  // ===================================================================
  //  MODAL HELPERS + AI
  // ===================================================================
  function openModal(m) { m.classList.remove("hidden"); }
  function closeModal(m) { m.classList.add("hidden"); }

  const aiModal = $("#aiModal");
  $("#aiSettingsBtn").addEventListener("click", () => {
    $("#apiKeyInput").value = ArtAI.getKey(); $("#modelInput").value = ArtAI.getModel(); openModal(aiModal);
  });
  $("#aiModalClose").addEventListener("click", () => closeModal(aiModal));
  aiModal.addEventListener("click", (e) => { if (e.target === aiModal) closeModal(aiModal); });
  $("#saveKeyBtn").addEventListener("click", () => {
    ArtAI.setKey($("#apiKeyInput").value.trim()); ArtAI.setModel($("#modelInput").value.trim());
    closeModal(aiModal); toast(ArtAI.hasKey() ? "Key saved. AI Mentor unlocked." : "Key cleared.");
    $("#aiBlock").classList.toggle("hidden", !(ArtAI.hasKey() && state.analysis));
  });
  $("#clearKeyBtn").addEventListener("click", () => { ArtAI.setKey(""); $("#apiKeyInput").value = ""; toast("Key cleared."); $("#aiBlock").classList.add("hidden"); });

  $("#askAiBtn").addEventListener("click", async () => {
    if (!state.analysis) return;
    if (!ArtAI.hasKey()) return openModal(aiModal);
    const out = $("#aiOutput"); out.classList.remove("muted");
    out.innerHTML = `<div class="spinner"></div> Asking the mentor…`;
    try { out.innerHTML = renderMarkdownish(await ArtAI.critique(state.dataUrl, state.analysis)); }
    catch (err) { out.innerHTML = `<span class="err">Couldn't reach the model: ${escapeHtml(err.message)}</span>`; }
  });

  function renderMarkdownish(text) {
    const lines = escapeHtml(text).split(/\r?\n/); let html = "", inList = false;
    const headers = ["What's working", "What's holding it back", "The one fix that matters most", "How to do it in Photoshop"];
    for (let raw of lines) {
      let line = raw.trim();
      if (!line) { if (inList) { html += "</ul>"; inList = false; } continue; }
      line = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      const hdr = line.replace(/[:#*]/g, "").trim();
      if (headers.some((h) => hdr.toLowerCase().startsWith(h.toLowerCase()))) {
        if (inList) { html += "</ul>"; inList = false; } html += `<h4 class="ai-h">${hdr}</h4>`;
      } else if (/^[-*•]\s+/.test(line)) {
        if (!inList) { html += "<ul>"; inList = true; } html += `<li>${line.replace(/^[-*•]\s+/, "")}</li>`;
      } else { if (inList) { html += "</ul>"; inList = false; } html += `<p>${line}</p>`; }
    }
    if (inList) html += "</ul>"; return html;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ===================================================================
  //  SHARE + FOOTER
  // ===================================================================
  $("#shareBtn").addEventListener("click", async () => {
    if (!state.img || !state.analysis) return;
    const res = await ArtShare.share(state.img, state.analysis);
    if (res !== "cancelled") toast(res === "downloaded" ? "Report card saved as a PNG — post it anywhere." : "Shared!");
  });
  $("#downloadCardBtn").addEventListener("click", () => {
    if (!state.img || !state.analysis) return;
    ArtShare.downloadCard(state.img, state.analysis); toast("Report card saved.");
  });
  $("#footHow").addEventListener("click", openTutorial);

  // ===================================================================
  //  PWA — install prompt + service worker (offline)
  // ===================================================================
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); deferredPrompt = e; $("#footInstall").classList.remove("hidden");
  });
  $("#footInstall").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null;
    $("#footInstall").classList.add("hidden"); toast("Installing…");
  });
  window.addEventListener("appinstalled", () => { $("#footInstall").classList.add("hidden"); toast("Installed! Find ArtGrader in your apps."); });
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  // ===================================================================
  //  INIT
  // ===================================================================
  renderTeaser();
  renderTutorial();
  refreshHistoryCount();
})();
