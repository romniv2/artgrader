/* =====================================================================
   corrections.js  —  real, non-destructive fixes to the user's own pixels
   Each fix is a classic, defensible photo/paint correction. They operate
   on a display-resolution canvas so the before/after compare is instant.
   Exposed as:  window.ArtCorrections
   ===================================================================== */
(function () {
  "use strict";
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Build a correction pipeline from the analysis + the toggles the user picked.
  // Returns a new ImageData (does not mutate the source).
  function correct(srcImageData, analysis, fixes) {
    const src = srcImageData.data;
    const out = new Uint8ClampedArray(src);            // copy

    // 1) VALUES — auto-levels: remap [blackPoint, whitePoint] -> [0, 255]
    if (fixes.values) {
      const bp = analysis.values.blackPoint;
      const wp = analysis.values.whitePoint;
      const span = Math.max(1, wp - bp);
      // build a LUT once
      const lut = new Uint8ClampedArray(256);
      for (let v = 0; v < 256; v++) lut[v] = clamp(((v - bp) / span) * 255, 0, 255);
      for (let i = 0; i < out.length; i += 4) {
        out[i] = lut[out[i]];
        out[i + 1] = lut[out[i + 1]];
        out[i + 2] = lut[out[i + 2]];
      }
    }

    // 2) COLOR — gray-world white balance: neutralize the average cast.
    if (fixes.color) {
      const c = analysis.color;
      const avg = (c.avgR + c.avgG + c.avgB) / 3 || 1;
      // gains pull each channel's mean toward the overall mean (damped so we
      // don't fully bleach an intentionally warm piece)
      const damp = 0.6;
      const gR = 1 + ((avg / (c.avgR || 1)) - 1) * damp;
      const gG = 1 + ((avg / (c.avgG || 1)) - 1) * damp;
      const gB = 1 + ((avg / (c.avgB || 1)) - 1) * damp;
      for (let i = 0; i < out.length; i += 4) {
        out[i] = clamp(out[i] * gR, 0, 255);
        out[i + 1] = clamp(out[i + 1] * gG, 0, 255);
        out[i + 2] = clamp(out[i + 2] * gB, 0, 255);
      }
    }

    // 3) LIGHTING — gentle S-curve to restore contrast / form separation.
    if (fixes.lighting) {
      const amount = analysis.lighting.flat ? 0.42 : 0.24;   // push harder if flat
      const lut = new Uint8ClampedArray(256);
      for (let v = 0; v < 256; v++) {
        const x = v / 255;
        // smoothstep-style S-curve around 0.5
        const s = x + amount * Math.sin((x - 0.5) * Math.PI) * 0.5;
        lut[v] = clamp(s * 255, 0, 255);
      }
      for (let i = 0; i < out.length; i += 4) {
        out[i] = lut[out[i]];
        out[i + 1] = lut[out[i + 1]];
        out[i + 2] = lut[out[i + 2]];
      }
    }

    // 4) SATURATION — nudge toward a healthy mid band (~0.32).
    if (fixes.saturation) {
      const cur = analysis.color.meanSat;
      const target = 0.34;
      // factor >1 boosts, <1 calms; clamp so we never go wild
      const factor = clamp(target / Math.max(0.05, cur), 0.6, 1.7);
      for (let i = 0; i < out.length; i += 4) {
        const r = out[i], g = out[i + 1], b = out[i + 2];
        const L = lum(r, g, b);
        out[i] = clamp(L + (r - L) * factor, 0, 255);
        out[i + 1] = clamp(L + (g - L) * factor, 0, 255);
        out[i + 2] = clamp(L + (b - L) * factor, 0, 255);
      }
    }

    return new ImageData(out, srcImageData.width, srcImageData.height);
  }

  // Convenience: render the corrected pixels onto a canvas at a given size.
  function renderCorrected(img, analysis, fixes, maxDim) {
    maxDim = maxDim || 1600;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const srcData = ctx.getImageData(0, 0, w, h);
    const corrected = correct(srcData, analysis, fixes);
    ctx.putImageData(corrected, 0, 0);
    return c;
  }

  window.ArtCorrections = { correct, renderCorrected };
})();
