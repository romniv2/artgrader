/* =====================================================================
   theory.js  —  art-theory knowledge layer.
   Maps what the analysis *measured* to the concept an artist should learn.
   Each tab in the report pulls relevant lessons from here so feedback is
   never just "do X" — it's "here's the principle, and why it matters."
   Exposed as:  window.ArtTheory
   ===================================================================== */
(function () {
  "use strict";

  // A concept = a teachable idea. tag = tiny category label for the chip.
  const C = {
    valueStructure: {
      title: "Value structure (the 3-value plan)",
      tag: "Values",
      body: "Before color, a strong image reads as a simple arrangement of lights, mid-tones and darks. If you can't tell the big shapes apart in grayscale, no amount of rendering will save it.",
      why: "The eye reads value before it reads hue. A clear value design is what lets a thumbnail work from across the room.",
      tip: "Squint at your piece until detail disappears. You should still see 3–4 distinct shapes. If it turns to one grey blur, your values are too close.",
    },
    notan: {
      title: "Notan — the 2-value light/dark design",
      tag: "Values",
      body: "Notan is the Japanese idea of designing the pure black-vs-white pattern of an image first. Reduce everything to two values and ask: is the shape pleasing on its own?",
      why: "A composition that fails in 2 values will always feel weak in full color. Strong notan = strong bones.",
      tip: "Use the Notan overlay (the value-zones view) and check that your darks group into a few intentional masses instead of scattering.",
    },
    fullRange: {
      title: "Using the full value range",
      tag: "Values",
      body: "Most flat-looking digital paintings never commit to a true near-black or a true near-white — everything hovers in the safe mid-greys.",
      why: "Contrast is what gives an image presence. Reserving one true dark and one true light anchor gives the eye somewhere to land.",
      tip: "Add a Levels adjustment, then pull a small area to near-0 (your deepest accent shadow) and a small area to near-255 (your brightest highlight). Keep them small.",
    },
    colorTemperature: {
      title: "Color temperature & mood",
      tag: "Color",
      body: "Every light has a temperature. A warm key light implies cool shadows (and vice-versa). The interplay of warm vs cool is where 'color mood' actually comes from.",
      why: "A piece with a deliberate dominant temperature feels authored. A 50/50 warm-cool split usually reads as accidental or muddy.",
      tip: "Pick a dominant temperature for your light, then push the shadows the opposite way. The contrast of temperature sells the lighting more than value alone.",
    },
    limitedPalette: {
      title: "Limited palette (e.g. the Zorn palette)",
      tag: "Color",
      body: "Master painters often restrict themselves to 3–4 pigments. Anders Zorn famously used roughly yellow ochre, red, black and white — and got an enormous range from it.",
      why: "Constraint forces harmony. When every color is mixed from the same few parents, the whole image feels like it belongs together.",
      tip: "Try recoloring with one dominant hue family, one supporting, and one small saturated accent. Compare it against your current palette strip.",
    },
    saturationHierarchy: {
      title: "Saturation hierarchy",
      tag: "Color",
      body: "Saturation is a spotlight. If everything is fully saturated, nothing stands out; if everything is grey, the piece feels dead.",
      why: "Reserving your most intense color for the focal area guides the eye exactly where you want it.",
      tip: "Desaturate the supporting areas and let your highest chroma sit on or near your focal point.",
    },
    colorCast: {
      title: "Color cast & white balance",
      tag: "Color",
      body: "A green or magenta tint across the whole image is almost always an unintended cast — from a bad screen calibration or an unbalanced light setup.",
      why: "An accidental cast pollutes every mix and makes neutrals feel 'off' in a way that's hard to diagnose by eye.",
      tip: "Use Curves: sample what should be a neutral grey and balance the channels until it reads neutral. Then add color back deliberately.",
    },
    keyLight: {
      title: "The key light & light logic",
      tag: "Lighting",
      body: "Pick one dominant light source, commit to its direction, and let every form turn away from it into shadow consistently. A readable key light is half of believable lighting.",
      why: "When light direction is inconsistent, forms stop feeling solid — the brain can't reconstruct the 3D shape.",
      tip: "Draw an arrow for your key light before painting. Every plane facing it gets light; everything turning away gets shadow. No exceptions without a reason.",
    },
    terminator: {
      title: "The terminator (core shadow)",
      tag: "Lighting",
      body: "The terminator is the transition line where a form turns from light into shadow. On hard light it's crisp; on soft light it's gradual.",
      why: "It's the single most form-describing edge in the whole image. Mush it and the form goes flat.",
      tip: "Find where each form turns hardest away from the light and place a clear core-shadow there, slightly darker than the cast shadow nearby.",
    },
    flatLighting: {
      title: "Why your lighting reads flat",
      tag: "Lighting",
      body: "Flat lighting = not enough separation between lit and shadowed planes. The forms get filled in with local color instead of being modeled by light.",
      why: "Form is communicated by the difference between light and shadow. No difference, no form.",
      tip: "Increase the value gap between your light family and shadow family. A useful rule: shadows roughly 30–40% darker than their lit side, grouped — not noisy.",
    },
    contrastFocus: {
      title: "Contrast as a focal tool",
      tag: "Lighting",
      body: "The eye is pulled to the area of highest contrast. You can direct attention by where you place your sharpest light-to-dark transition.",
      why: "Spreading maximum contrast everywhere creates competing focal points and a restless image.",
      tip: "Reserve your highest contrast for the focal point and gently lower contrast toward the edges of the frame.",
    },
    ruleOfThirds: {
      title: "Rule of thirds & power points",
      tag: "Composition",
      body: "Divide the frame into thirds horizontally and vertically. The four intersections are natural resting spots for the eye — placing your focal mass near one adds energy.",
      why: "Dead-center placement can feel static; a thirds placement creates a more dynamic, intentional read.",
      tip: "Turn on the Thirds overlay and nudge your subject so its visual weight lands near a power point.",
    },
    focalPoint: {
      title: "Establishing a focal point",
      tag: "Composition",
      body: "Every image needs one clear 'first stop' for the eye. You create it with the highest contrast, sharpest edges, most saturation, or most detail — ideally several at once.",
      why: "Without a focal point the viewer's eye wanders and bounces off the edges. With one, you control the story.",
      tip: "Decide your focal point, then stack 2–3 'attention tools' (contrast + edge + chroma) there and pull them back everywhere else.",
    },
    visualBalance: {
      title: "Visual weight & balance",
      tag: "Composition",
      body: "Detail, contrast and saturation all carry 'visual weight'. If one side of the frame holds nearly all of it, the image tips like an unbalanced scale.",
      why: "Balance doesn't mean symmetry — it means a small heavy element can counterweight a large quiet one across the frame.",
      tip: "If your detail is stacked on one side, add a smaller secondary element on the empty side to settle the composition.",
    },
  };

  function forValues(v) {
    const out = [C.valueStructure];
    if (v.midHeavy || v.range < 130) out.push(C.fullRange);
    out.push(C.notan);
    return out;
  }
  function forColor(c) {
    const out = [C.colorTemperature];
    if (Math.abs(c.castGreenMag) > 0.1 || (Math.abs(c.castWarmCool) > 0.18 && c.meanSat < 0.35)) out.push(C.colorCast);
    if (c.meanSat > 0.5) out.push(C.saturationHierarchy);
    else out.push(C.limitedPalette);
    return out;
  }
  function forLighting(l) {
    const out = [];
    if (l.flat) out.push(C.flatLighting);
    out.push(C.keyLight, C.terminator);
    if (!l.flat) out.push(C.contrastFocus);
    return out.slice(0, 3);
  }
  function forComposition(c) {
    const out = [C.ruleOfThirds];
    if (c.hBalance > 0.3 || c.vBalance > 0.4) out.push(C.visualBalance);
    out.push(C.focalPoint);
    return out;
  }

  function forCategory(cat, data) {
    switch (cat) {
      case "values": return forValues(data);
      case "color": return forColor(data);
      case "lighting": return forLighting(data);
      case "composition": return forComposition(data);
      default: return [];
    }
  }

  // a few featured concepts for the landing-page theory teaser
  const featured = [C.notan, C.colorTemperature, C.keyLight, C.ruleOfThirds];

  window.ArtTheory = { concepts: C, forCategory, featured };
})();
