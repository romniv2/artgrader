/* =====================================================================
   analysis.js  —  the measurement engine
   Pure functions over pixel data. No frameworks, no network.
   Everything here is honest math you could verify by hand in Photoshop.
   Exposed as a global:  window.ArtAnalysis
   ===================================================================== */
(function () {
  "use strict";

  // ---- small helpers ----------------------------------------------------
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  // perceptual luminance (Rec.709). This is "value" in art terms.
  function lum(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // RGB (0-255) -> HSL (h:0-360, s:0-1, l:0-1)
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return [h, s, l];
  }

  // Pull a manageable ImageData out of any source image, capped in size so
  // a 6000px Photoshop export still analyses in a few ms.
  function getWorkingPixels(img, maxDim) {
    maxDim = maxDim || 900;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }

  // ---- VALUES -----------------------------------------------------------
  function analyzeValues(data) {
    const px = data.data;
    const hist = new Array(256).fill(0);
    let sum = 0, n = 0;
    for (let i = 0; i < px.length; i += 4) {
      const a = px[i + 3];
      if (a < 8) continue;                 // skip transparent canvas
      const L = lum(px[i], px[i + 1], px[i + 2]) | 0;
      hist[clamp(L, 0, 255)]++;
      sum += L; n++;
    }
    if (n === 0) n = 1;
    const mean = sum / n;

    // percentile-based black/white points (ignore tiny outliers)
    const lowP = percentile(hist, n, 0.005);
    const highP = percentile(hist, n, 0.995);
    const range = highP - lowP;

    // contrast = std-dev of luminance
    let varSum = 0;
    for (let v = 0; v < 256; v++) varSum += hist[v] * (v - mean) * (v - mean);
    const std = Math.sqrt(varSum / n);

    // distribution across 5 zones: shadows / dark mid / mid / light mid / highs
    const zones = [0, 0, 0, 0, 0];
    for (let v = 0; v < 256; v++) zones[clamp(Math.floor(v / 51.2), 0, 4)] += hist[v];
    const zonePct = zones.map((z) => z / n);

    const hasTrueDark = lowP < 35;
    const hasTrueLight = highP > 225;
    const midHeavy = zonePct[2] > 0.5;

    // score: reward full range + healthy contrast, punish flatness/clipping
    let score = 50;
    score += clamp((range - 120) / 135 * 30, -25, 30);   // range usage
    score += clamp((std - 35) / 35 * 20, -20, 20);        // contrast
    if (hasTrueDark) score += 6;
    if (hasTrueLight) score += 6;
    if (midHeavy) score -= 12;
    // clipping penalty (blown/crushed)
    const blown = hist[255] / n, crushed = hist[0] / n;
    if (blown > 0.04) score -= clamp(blown * 60, 0, 14);
    if (crushed > 0.04) score -= clamp(crushed * 60, 0, 14);
    score = clamp(Math.round(score), 0, 100);

    // build human notes
    const good = [], bad = [], tips = [];
    if (range > 200) good.push("You're using a wide value range — there's real punch from your darks to your lights.");
    else if (range < 110) bad.push(`Your values are compressed (range only ~${Math.round(range)} of 255). The piece will read flat and washed-out from across the room.`);
    if (hasTrueDark) good.push("You committed to genuine darks — that anchors the image.");
    else tips.push("Push a few areas to a true near-black. A drawing with no real darks always feels foggy.");
    if (hasTrueLight) good.push("You have clean highlights for the eye to land on.");
    else tips.push("Reserve a small area of true near-white as your brightest accent. Don't spread it everywhere.");
    if (midHeavy) bad.push("Over half your image sits in the midtones — classic 'mud' zone. Squint and you'll see almost no shape.");
    if (blown > 0.04) bad.push("Highlights are clipping to pure white in big patches — you're losing detail and form there.");
    if (crushed > 0.04) bad.push("Shadows are crushing to pure black in big patches — detail is dying in the darks.");
    if (good.length === 0) good.push("Values are workable — nothing is badly broken, there's just room to push.");

    return {
      score, hist, mean, blackPoint: lowP, whitePoint: highP, range, std,
      zonePct, hasTrueDark, hasTrueLight, midHeavy,
      good, bad, tips,
    };
  }

  function percentile(hist, total, p) {
    const target = total * p;
    let acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= target) return v; }
    return 255;
  }

  // ---- COLOR ------------------------------------------------------------
  function analyzeColor(data) {
    const px = data.data;
    let n = 0, satSum = 0, warm = 0, cool = 0, neutral = 0;
    let rSum = 0, gSum = 0, bSum = 0;
    const buckets = new Map();          // coarse color quantization for palette

    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 8) continue;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      rSum += r; gSum += g; bSum += b;
      const [h, s, l] = rgbToHsl(r, g, b);
      satSum += s; n++;
      if (s < 0.12) neutral++;
      else if (h < 70 || h >= 300) warm++;     // reds/oranges/yellows/magenta
      else if (h >= 140 && h < 270) cool++;     // greens/cyans/blues
      // quantize to 5 bits/channel for palette voting, weighted by saturation
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    if (n === 0) n = 1;

    const meanSat = satSum / n;
    const avgR = rSum / n, avgG = gSum / n, avgB = bSum / n;
    // color cast: gray-world says the average should be neutral.
    const avgL = (avgR + avgG + avgB) / 3 || 1;
    const castWarmCool = (avgR - avgB) / avgL;     // + warm, - cool
    const castGreenMag = (avgG - (avgR + avgB) / 2) / avgL;
    const tempBias = warm >= cool ? "warm" : "cool";
    const tempStrength = Math.abs(warm - cool) / (warm + cool + 1);

    // palette: top buckets, then enforce a minimum distance so we don't get
    // six near-identical swatches.
    const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
    const palette = [];
    for (const [key, count] of sorted) {
      const r = ((key >> 10) & 31) << 3, g = ((key >> 5) & 31) << 3, b = (key & 31) << 3;
      if (palette.every((p) => colDist(p.r, p.g, p.b, r, g, b) > 48)) {
        palette.push({ r, g, b, weight: count / n });
        if (palette.length >= 6) break;
      }
    }

    let score = 60;
    // healthy mid saturation band; punish gray-mud and neon-vomit
    if (meanSat < 0.10) score -= 18;
    else if (meanSat > 0.55) score -= 14;
    else score += 10;
    // a clear temperature lean reads as intentional; perfectly 50/50 often reads accidental
    score += clamp(tempStrength * 16, 0, 14);
    // strong uncorrected cast hurts (unless very saturated = stylistic)
    if (Math.abs(castWarmCool) > 0.18 && meanSat < 0.35) score -= 10;
    if (Math.abs(castGreenMag) > 0.10) score -= 8;     // green/magenta cast is almost always a mistake
    score = clamp(Math.round(score), 0, 100);

    const good = [], bad = [], tips = [];
    if (meanSat < 0.10) bad.push("The whole piece is nearly desaturated — it reads grey/muddy. Even a 'realistic' image needs a few pockets of saturated color to breathe.");
    else if (meanSat > 0.55) bad.push("Saturation is cranked almost everywhere. When everything shouts, nothing leads — pick where the color should peak and let the rest fall back.");
    else good.push("Saturation sits in a healthy range — saturated enough to feel alive, restrained enough to control.");

    good.push(`Overall temperature leans ${tempBias}${tempStrength > 0.4 ? " — and confidently so, which gives the piece a mood" : ""}.`);
    if (tempStrength < 0.12) tips.push("Your warm/cool split is almost 50/50. Decide on a dominant temperature and let the opposite be the accent — that's where 'color mood' comes from.");
    if (Math.abs(castGreenMag) > 0.10) bad.push(`There's a ${castGreenMag > 0 ? "green" : "magenta"} cast across the image — usually an unbalanced light or a screen-calibration leak. Easy to neutralize.`);
    if (Math.abs(castWarmCool) > 0.18 && meanSat < 0.35) tips.push(`A ${castWarmCool > 0 ? "warm" : "cool"} cast is sitting over everything. If it's intentional mood, great; if not, balance it and add the warmth deliberately in the light.`);
    tips.push("Strong color design usually = one dominant hue family, one supporting, one small accent. Check your palette strip against that.");

    return {
      score, palette, meanSat, tempBias, tempStrength,
      castWarmCool, castGreenMag, avgR, avgG, avgB,
      good, bad, tips,
    };
  }

  function colDist(r1, g1, b1, r2, g2, b2) {
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  }

  // ---- LIGHTING ---------------------------------------------------------
  // Lighting builds on value but asks a different question: is there a
  // readable light logic (clear lights vs shadows, directional falloff),
  // or is it flat / evenly lit?
  function analyzeLighting(data, valueStats) {
    const w = data.width, h = data.height, px = data.data;

    // luminance map + global stats
    const L = new Float32Array(w * h);
    for (let i = 0, p = 0; i < px.length; i += 4, p++) L[p] = lum(px[i], px[i + 1], px[i + 2]);

    // local contrast: average absolute difference from a cheap box blur.
    // High local contrast across the piece = crisp form modelling.
    let localContrast = 0, lc = 0;
    const step = 2;
    for (let y = 1; y < h - 1; y += step) {
      for (let x = 1; x < w - 1; x += step) {
        const c = L[y * w + x];
        const around = (L[(y - 1) * w + x] + L[(y + 1) * w + x] + L[y * w + x - 1] + L[y * w + x + 1]) / 4;
        localContrast += Math.abs(c - around); lc++;
      }
    }
    localContrast = lc ? localContrast / lc : 0;

    // light direction estimate: compare luminance centroid of the bright
    // pixels vs the dark pixels — the vector between them is the light dir.
    let bx = 0, by = 0, bw = 0, dx = 0, dy = 0, dw = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = L[y * w + x];
        if (v > 175) { bx += x; by += y; bw++; }
        else if (v < 80) { dx += x; dy += y; dw++; }
      }
    }
    let lightDir = null, dirStrength = 0;
    if (bw > 20 && dw > 20) {
      const vx = bx / bw - dx / dw, vy = by / bw - dy / dw;
      const mag = Math.hypot(vx, vy);
      dirStrength = clamp(mag / (Math.hypot(w, h) * 0.5), 0, 1);
      lightDir = describeDir(vx, vy);
    }

    const global = valueStats.std;                 // global contrast from value pass
    const flat = global < 28 && localContrast < 6;

    let score = 50;
    score += clamp((global - 30) / 30 * 22, -22, 22);
    score += clamp((localContrast - 6) / 8 * 16, -14, 16);
    score += clamp(dirStrength * 14, 0, 14);
    if (flat) score -= 14;
    score = clamp(Math.round(score), 0, 100);

    const good = [], bad = [], tips = [];
    if (flat) bad.push("Lighting reads flat — there's no strong separation between lit and shadowed planes. The forms aren't being modelled by light, they're just filled in.");
    else good.push("There's a real light-vs-shadow structure here — forms are being described by the light, not just colored in.");
    if (lightDir) good.push(`I can read a light direction (coming from the ${lightDir}). A readable key light is half the battle.`);
    else tips.push("I can't find a clear dominant light direction. Pick one key light, commit, and let everything turn away from it into shadow.");
    if (localContrast < 5) tips.push("Edges and form-turns are soft everywhere. Add some crisp light-to-shadow terminators where the form turns hardest toward the light.");
    if (global > 45 && localContrast > 9) good.push("Strong contrast plus crisp local transitions — this is what makes a painting feel three-dimensional.");
    tips.push("Reserve your highest contrast for your focal point. Let contrast fall off toward the edges so the eye stays where you want it.");

    return {
      score, localContrast, globalContrast: global, lightDir, dirStrength, flat,
      good, bad, tips,
    };
  }

  function describeDir(vx, vy) {
    const ang = Math.atan2(vy, vx) * 180 / Math.PI;   // 0 = right, 90 = down
    const dirs = [
      [-22.5, "right"], [22.5, "lower-right"], [67.5, "below"], [112.5, "lower-left"],
      [157.5, "left"], [-157.5, "upper-left"], [-112.5, "above"], [-67.5, "upper-right"],
    ];
    for (const [a, name] of dirs) if (ang <= a) return name;
    return "right";
  }

  // ---- COMPOSITION ------------------------------------------------------
  // Focal mass via Sobel edge energy; balance via left/right & top/bottom
  // energy split; rule-of-thirds proximity of the energy centroid.
  function analyzeComposition(data) {
    const w = data.width, h = data.height, px = data.data;
    const L = new Float32Array(w * h);
    for (let i = 0, p = 0; i < px.length; i += 4, p++) L[p] = lum(px[i], px[i + 1], px[i + 2]);

    let cx = 0, cy = 0, total = 0;
    let left = 0, right = 0, top = 0, bottom = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const gx = -L[(y - 1) * w + x - 1] - 2 * L[y * w + x - 1] - L[(y + 1) * w + x - 1]
          + L[(y - 1) * w + x + 1] + 2 * L[y * w + x + 1] + L[(y + 1) * w + x + 1];
        const gy = -L[(y - 1) * w + x - 1] - 2 * L[(y - 1) * w + x] - L[(y - 1) * w + x + 1]
          + L[(y + 1) * w + x - 1] + 2 * L[(y + 1) * w + x] + L[(y + 1) * w + x + 1];
        const e = Math.hypot(gx, gy);
        cx += x * e; cy += y * e; total += e;
        if (x < w / 2) left += e; else right += e;
        if (y < h / 2) top += e; else bottom += e;
      }
    }
    if (total === 0) total = 1;
    const fx = cx / total / w, fy = cy / total / h;        // focal mass, normalized 0-1

    // nearest rule-of-thirds intersection
    const thirds = [[1 / 3, 1 / 3], [2 / 3, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 2 / 3]];
    let best = 1e9;
    for (const [tx, ty] of thirds) best = Math.min(best, Math.hypot(fx - tx, fy - ty));
    const onThirds = best < 0.12;
    const deadCenter = Math.hypot(fx - 0.5, fy - 0.5) < 0.07;

    const hBalance = Math.abs(left - right) / (left + right + 1);   // 0 = balanced
    const vBalance = Math.abs(top - bottom) / (top + bottom + 1);

    let score = 55;
    if (onThirds) score += 16;
    else if (deadCenter) score -= 6;
    score += clamp((0.35 - hBalance) / 0.35 * 12, -12, 12);
    score += clamp((0.4 - vBalance) / 0.4 * 8, -10, 8);
    // a little edge energy away from center is good (breathing room near edges)
    score = clamp(Math.round(score), 0, 100);

    const good = [], bad = [], tips = [];
    if (onThirds) good.push("Your focal mass lands near a rule-of-thirds power point — that's a strong, classic placement.");
    else if (deadCenter) tips.push("The visual weight is parked dead-center. It can work for a portrait/icon, but nudging it onto a thirds line usually adds energy.");
    else good.push("Focal weight is off-center, which keeps the composition dynamic.");
    if (hBalance > 0.35) bad.push("The image is lopsided left-vs-right — one side is carrying almost all the detail. Add a smaller secondary element to counterweight.");
    else good.push("Left/right balance is solid — the frame doesn't tip to one side.");
    if (vBalance > 0.45) tips.push("Most of your detail is stacked top or bottom. Consider what the empty half is doing for you.");
    tips.push("Trace where a first-time viewer's eye enters and travels. If it falls off an edge with no path back, you need a element to bounce it inward.");

    return { score, focal: { x: fx, y: fy }, onThirds, deadCenter, hBalance, vBalance, good, bad, tips };
  }

  // ---- top-level orchestrator ------------------------------------------
  function analyzeImage(img) {
    const data = getWorkingPixels(img, 900);
    const values = analyzeValues(data);
    const color = analyzeColor(data);
    const lighting = analyzeLighting(data, values);
    const composition = analyzeComposition(data);

    // weighted overall — values & lighting are the structural backbone
    const overall = Math.round(
      values.score * 0.32 + lighting.score * 0.26 +
      color.score * 0.22 + composition.score * 0.20
    );

    return { values, color, lighting, composition, overall, dims: { w: data.width, h: data.height } };
  }

  window.ArtAnalysis = { analyzeImage, getWorkingPixels, lum, rgbToHsl };
})();
