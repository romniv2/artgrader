/* =====================================================================
   ai.js  —  OPTIONAL Claude vision critique.
   Everything else works without this. If the user saved an API key, we
   send the image + the measured numbers and ask for a mentor-style read.
   Exposed as:  window.ArtAI
   ===================================================================== */
(function () {
  "use strict";

  const KEY_LS = "artgrader.apiKey";
  const MODEL_LS = "artgrader.model";

  const getKey = () => localStorage.getItem(KEY_LS) || "";
  const getModel = () => localStorage.getItem(MODEL_LS) || "claude-opus-4-8";
  const setKey = (k) => k ? localStorage.setItem(KEY_LS, k) : localStorage.removeItem(KEY_LS);
  const setModel = (m) => localStorage.setItem(MODEL_LS, m || "claude-opus-4-8");
  const hasKey = () => !!getKey();

  // Turn the measured analysis into a compact fact sheet so the model
  // grounds its critique in the same numbers the user sees.
  function factSheet(a) {
    const v = a.values, c = a.color, l = a.lighting, comp = a.composition;
    return [
      `Measured analysis (use these as ground truth, don't contradict them):`,
      `- Overall score: ${a.overall}/100`,
      `- VALUES ${v.score}/100: black point ${Math.round(v.blackPoint)}, white point ${Math.round(v.whitePoint)}, range ${Math.round(v.range)}/255, contrast(std) ${Math.round(v.std)}. ${v.midHeavy ? "Midtone-heavy." : ""} ${v.hasTrueDark ? "" : "No true darks."} ${v.hasTrueLight ? "" : "No true highlights."}`,
      `- COLOR ${c.score}/100: mean saturation ${c.meanSat.toFixed(2)}, temperature leans ${c.tempBias} (strength ${c.tempStrength.toFixed(2)}), warm/cool cast ${c.castWarmCool.toFixed(2)}, green/magenta cast ${c.castGreenMag.toFixed(2)}.`,
      `- LIGHTING ${l.score}/100: global contrast ${Math.round(l.globalContrast)}, local contrast ${l.localContrast.toFixed(1)}, ${l.lightDir ? "light direction ~" + l.lightDir : "no clear light direction"}, ${l.flat ? "reads FLAT." : "has light/shadow structure."}`,
      `- COMPOSITION ${comp.score}/100: focal mass at (${comp.focal.x.toFixed(2)}, ${comp.focal.y.toFixed(2)}), ${comp.onThirds ? "near a rule-of-thirds point" : comp.deadCenter ? "dead center" : "off-center"}, L/R imbalance ${comp.hBalance.toFixed(2)}.`,
    ].join("\n");
  }

  const SYSTEM = `You are a warm but honest senior art mentor — think a beloved atelier teacher who critiques digital paintings and illustrations. You speak plainly to a fellow artist, never to a beginner you condescend to. You are specific and actionable. You never give empty praise. Structure your reply in short sections with these exact headers: "What's working", "What's holding it back", "The one fix that matters most", "How to do it in Photoshop". Keep it under ~350 words. Refer to concrete areas of the image.`;

  async function critique(imgDataUrl, analysis) {
    const key = getKey();
    if (!key) throw new Error("No API key saved.");
    const model = getModel();

    // dataURL -> media type + base64
    const m = /^data:(image\/[a-zA-Z+]+);base64,(.*)$/.exec(imgDataUrl);
    if (!m) throw new Error("Could not read image data.");
    const mediaType = m[1], b64 = m[2];

    const body = {
      model,
      max_tokens: 900,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
          { type: "text", text: factSheet(analysis) + "\n\nCritique this piece for me." },
        ],
      }],
    };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).error?.message || ""; } catch (e) {}
      throw new Error(`Anthropic API ${res.status}. ${detail}`);
    }
    const json = await res.json();
    return (json.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  }

  window.ArtAI = { getKey, getModel, setKey, setModel, hasKey, critique };
})();
