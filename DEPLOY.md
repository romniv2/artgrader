# Deploying ArtGrader

ArtGrader is a **static site** — plain HTML/CSS/JS, no build step, no server, no database.
That means you can host it free, almost anywhere, in a couple of minutes. Pick one.

> The whole app is the files in this folder. Whatever host you choose, you're just
> publishing this folder, with `index.html` at the root.

---

## Option A — Netlify Drop (easiest, ~60 seconds, no account-linking, no CLI)

1. Go to <https://app.netlify.com/drop>.
2. Drag this entire project folder onto the page.
3. Done — you get a live URL like `https://your-name.netlify.app`. Share it.

To update later, drag the folder again (or connect the GitHub repo from step C).

## Option B — Vercel

1. Install nothing — go to <https://vercel.com/new>, import the GitHub repo (Option C first),
   **or** use drag-and-drop at <https://vercel.com>.
2. Framework preset: **Other** (it's static). Build command: *(leave empty)*. Output dir: `./`.
3. Deploy. You get `https://your-project.vercel.app`.

## Option C — GitHub Pages (best if you want the source public + a stable URL)

This repo is already a git repo with a first commit. You just need a GitHub remote.

```bash
# 1. Create an empty repo on github.com (no README), then:
git remote add origin https://github.com/<you>/artgrader.git
git branch -M main
git push -u origin main

# 2. On github.com: Settings → Pages → Source: "Deploy from a branch" → main / root → Save.
```

Your site goes live at `https://<you>.github.io/artgrader/` within a minute.
(Relative paths are used everywhere, so the `/artgrader/` sub-path works fine.)

## Option D — Cloudflare Pages

<https://dash.cloudflare.com> → Pages → Create → connect the GitHub repo →
Build command empty, output dir `/` → Deploy.

## Option E — itch.io (great for reaching artists)

1. Zip the folder (there's a ready-made `artgrader.zip`, or re-zip after edits).
2. itch.io → Upload new project → Kind: **HTML** → upload the zip → tick
   *"This file will be played in the browser"* → set `index.html` as the entry → Save.

## Option F — any other static host

Caddy, nginx, Apache, Surge, Render static, Firebase Hosting, an S3 bucket… just serve
this folder with `index.html` as the index. Locally you can always run:

```bash
python -m http.server 5177    # then open http://localhost:5177
```

---

## After you have a real URL (optional polish)

- **Social link previews:** the preview image (`og-image.png`) is referenced with a relative
  path, which works for Discord, Slack, iMessage, WhatsApp and LinkedIn. For the strictest
  scrapers (old Facebook), edit `index.html` and make the `og:image` / `twitter:image` and
  `og:url` / `canonical` **absolute** (e.g. `https://your-domain/og-image.png`).
- **Custom domain:** every host above supports adding your own domain in its dashboard.
- **The “Install app” button** and **offline mode** activate automatically once the site is
  served over HTTPS (every host above is HTTPS by default).

## Regenerating brand assets

Icons and the social image are produced by `tools/generate_assets.py`:

```bash
python -m pip install pillow
python tools/generate_assets.py
```

## Privacy

There's no backend and no analytics: every visitor's artwork is analysed entirely in their
own browser and never uploaded. Nothing to configure, nothing to leak.
