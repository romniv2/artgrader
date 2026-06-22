"""Generate ArtGrader brand assets (app icons + social preview) with Pillow.
Run:  python tools/generate_assets.py   (writes PNGs into the project root)
"""
import math, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIOLET = (124, 92, 255)
TEAL = (52, 214, 200)
ROSE = (224, 85, 111)
INK = (13, 14, 20)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def font(name, size):
    for p in (f"C:/Windows/Fonts/{name}", name):
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    return ImageFont.load_default()


def gradient_square(size):
    N = 96
    g = Image.new("RGB", (N, N))
    px = g.load()
    for y in range(N):
        for x in range(N):
            px[x, y] = lerp(VIOLET, TEAL, (x + y) / (2 * (N - 1)))
    return g.resize((size, size), Image.LANCZOS)


def radial_glow(radius, color, strength):
    N = 128
    g = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    px = g.load()
    for y in range(N):
        for x in range(N):
            dist = math.hypot((x - N / 2) / (N / 2), (y - N / 2) / (N / 2))
            a = max(0.0, 1 - dist)
            px[x, y] = (*color, int(a * a * strength * 255))
    return g.resize((radius * 2, radius * 2), Image.LANCZOS)


def make_icon(size):
    img = gradient_square(size).convert("RGBA")
    d = ImageDraw.Draw(img)
    s = size / 512.0
    cx, cy, rr = 256 * s, 252 * s, 120 * s
    w = max(2, int(46 * s))
    bbox = [cx - rr, cy - rr, cx + rr, cy + rr]
    d.arc(bbox, start=18, end=162, fill=(255, 255, 255, 245), width=w)   # brush swoosh
    for ang in (18, 162):                                                # round caps
        ex = cx + rr * math.cos(math.radians(ang)); ey = cy + rr * math.sin(math.radians(ang))
        d.ellipse([ex - w / 2, ey - w / 2, ex + w / 2, ey + w / 2], fill=(255, 255, 255, 245))
    for col, dx, dy, rad in [((255, 107, 107), 182, 208, 26), ((255, 209, 102), 256, 172, 26),
                             ((78, 205, 196), 330, 208, 26), ((255, 255, 255), 256, 150, 15)]:
        d.ellipse([dx * s - rad * s, dy * s - rad * s, dx * s + rad * s, dy * s + rad * s], fill=col)
    return img


def make_og():
    W, H = 1200, 630
    img = Image.new("RGBA", (W, H), (*INK, 255))
    for cxy, rad, col, st in [((250, 170), 430, VIOLET, 0.50), ((1060, 110), 380, TEAL, 0.34), ((760, 690), 460, ROSE, 0.26)]:
        img.alpha_composite(radial_glow(rad, col, st), (cxy[0] - rad, cxy[1] - rad))
    d = ImageDraw.Draw(img)
    eyebrow = font("segoeuib.ttf", 23); big = font("georgiab.ttf", 118)
    ital = font("georgiai.ttf", 42); body = font("segoeui.ttf", 29)
    bodyb = font("segoeuib.ttf", 27); ringf = font("georgiab.ttf", 80)

    # left column (kept clear of the right motif zone, x < 820)
    d.text((84, 104), "VALUES  ·  COLOR  ·  LIGHTING  ·  COMPOSITION", font=eyebrow, fill=TEAL)
    d.text((80, 146), "ArtGrader", font=big, fill=(233, 235, 242))
    d.text((84, 296), "A studio critique for", font=ital, fill=(199, 204, 221))
    d.text((84, 344), "your digital paintings.", font=ital, fill=(199, 204, 221))
    d.text((84, 420), "Honest feedback on the fundamentals,", font=body, fill=(176, 182, 200))
    d.text((84, 456), "grounded in real art theory.", font=body, fill=(176, 182, 200))
    d.text((84, 548), "Free  ·  No account  ·  No upload  ·  Works offline", font=bodyb, fill=(150, 160, 190))

    # right motif zone (x ~ 860..1090): score ring + value scale
    cx, cy, r = 975, 286, 112
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(42, 47, 64), width=18)
    d.arc([cx - r, cy - r, cx + r, cy + r], start=-90, end=-90 + 360 * 0.82, fill=VIOLET, width=18)
    d.text((cx, cy), "A−", font=ringf, fill=(140, 150, 255), anchor="mm")
    tones = [(242, 239, 233), (185, 182, 176), (124, 122, 118), (68, 66, 64), (20, 19, 18)]
    sw, sx, sy = 44, cx - 110, cy + 148
    for i, t in enumerate(tones):
        d.rounded_rectangle([sx + i * sw, sy, sx + i * sw + sw - 6, sy + 44], radius=6, fill=t)
    return img.convert("RGB")


def main():
    make_icon(512).save(os.path.join(ROOT, "icon-512.png"))
    make_icon(192).save(os.path.join(ROOT, "icon-192.png"))
    make_icon(180).save(os.path.join(ROOT, "apple-touch-icon.png"))
    make_icon(32).save(os.path.join(ROOT, "favicon-32.png"))
    make_og().save(os.path.join(ROOT, "og-image.png"))
    print("Wrote: icon-512, icon-192, apple-touch-icon, favicon-32, og-image")


if __name__ == "__main__":
    main()
