# ArtGrader

A friendly web app that critiques your digital paintings — values, color, lighting and
composition — and can show you a *corrected version of your own image*, or just teach you
with words. Built for illustrators working out of Photoshop.

Everything runs **locally in your browser**. Your art never gets uploaded anywhere
(unless you turn on the optional AI Mentor — see below).

It's a **shippable static product**: no build step, no server, no database. It installs as
an app, works offline, generates a shareable report-card image, and deploys free to any
static host. **To put it online, see [DEPLOY.md](DEPLOY.md)** (Netlify drop / GitHub Pages /
Vercel / Cloudflare / itch.io — pick one, ~1 minute). There's also a ready-made
`artgrader.zip` you can drag onto a host or upload to itch.io.

## How to open it

**Easiest:** double-click `index.html`. Done.

**Or run a tiny local server** (nicer; avoids a couple of browser file:// quirks):

```bash
python -m http.server 5177
```

then open <http://localhost:5177> in your browser.

## How to use it

1. Drag a PNG/JPG onto the drop zone — or paste straight from Photoshop with **Ctrl+V**
   (use *Edit → Copy Merged* first to flatten).
2. Read the scorecard: an overall grade plus **Values / Color / Lighting / Composition**,
   each with the actual numbers behind the score and plain-English "working / hurting it /
   try this" notes.
3. Flip the image view between **Original · Values (grayscale) · Notan (5-value squint
   test) · Thirds grid · Palette**.
4. Open the **Theory behind this** cards in any tab — every note ties back to a real
   principle (notan, color temperature, the key light, the rule of thirds…) with a
   concrete way to apply it.
5. Decide what you want:
   - **"Show me the corrected version"** → real edits applied to *your* pixels
     (auto-leveled values, neutralized color cast, restored contrast, optional saturation).
     Drag the divider to compare, then **Download corrected**.
   - **"Just teach me"** → no pixels touched; learn from the written feedback.
6. Every grade is saved to the local **Progress** page — a score-over-time chart plus a
   thumbnail gallery — so you can watch your fundamentals climb. Click any past piece to
   re-read its full critique.

New to it? Hit **? How it works** in the header for a quick tour of the purpose and flow.

## Sharing & shipping

- **Report card** — on any grade, hit **📤 Share report card** to generate a clean 1080×1350
  PNG (artwork + grades + headline) for Instagram / Discord / ArtStation. Uses the native
  share sheet where available, otherwise downloads. Past pieces can be shared from their
  Progress detail too.
- **Installable PWA** — served over HTTPS, browsers offer **Install app**; it then opens in
  its own window and **works fully offline** (a service worker caches the app shell).
- **Social link previews** — sharing the site URL unfurls a branded `og-image.png` card.
- **Privacy as a feature** — no upload, no account, no analytics, no trackers. Every pixel is
  analysed locally. That's the honest pitch in the footer.
- **Deploy anywhere** — see [DEPLOY.md](DEPLOY.md).

## What the grade actually measures (it's real math, not vibes)

- **Values** — luminance histogram, black/white points, value range usage, contrast (std-dev),
  midtone-mud and clipping detection.
- **Color** — palette extraction, mean saturation, warm/cool balance, and color-cast
  (gray-world) detection.
- **Lighting** — global + local contrast, flatness detection, and an estimated key-light
  direction from the bright-vs-dark centroids.
- **Composition** — focal mass via Sobel edge energy, rule-of-thirds proximity, left/right
  and top/bottom balance.

## Optional: AI Mentor (Claude vision)

Click **✦ AI Mentor**, paste an Anthropic API key, and you get a written, atelier-style
critique layered on top of the measured numbers. The key is stored only in your browser
(localStorage) and calls go directly from your machine to Anthropic.

⚠️ This is for your own local use. Don't publish the site with your key baked in.

## Honest limitations

- The grade is a **fundamentals coach**, not a taste judge. A deliberately flat, low-contrast,
  desaturated style will "score" lower even when it's intentional and good. Read it as
  "here's what the pixels are objectively doing," then decide what's a choice vs. a mistake.
- The "corrected version" is a set of honest *technical* fixes (levels, balance, contrast) —
  not an AI repaint of your drawing. That's a feature: it shows what your image would look
  like with its fundamentals cleaned up, without inventing things you didn't paint.

## Files

| File | What it does |
|------|--------------|
| `index.html` | structure / markup |
| `styles.css` | dark studio theme + artistic background |
| `analysis.js` | the measurement engine (all the math) |
| `corrections.js` | real pixel-level fixes |
| `theory.js` | art-theory knowledge base (the “why” behind each note) |
| `history.js` | local progress journal + score-over-time chart |
| `share.js` | shareable report-card image + native share |
| `ai.js` | optional Claude vision critique |
| `app.js` | UI wiring |
| `sw.js` · `manifest.webmanifest` | offline + installable PWA |
| `tools/generate_assets.py` | regenerates icons + the social preview image (Pillow) |
| `DEPLOY.md` · `netlify.toml` · `vercel.json` · `LICENSE` | shipping kit |

No build step, no dependencies, no `npm install`. The only optional tooling is Python +
Pillow, and only if you want to regenerate the brand images.
