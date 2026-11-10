#!/usr/bin/env python3
"""Build Mintiq brand assets into web/public from the logo image.

Usage: python3 scripts/brand-assets.py [path/to/logo.(jpg|png)]
Without a path it uses web/public/mintiq-logo-original.* if present, otherwise
draws an interim green "M" mark so the site never 404s on icons.

Outputs: mintiq-mark.png (trimmed, cream removed -> transparent), favicon-32.png,
favicon.ico, apple-touch-icon.png (180, cream bg), og-image.png (1200x630).
"""
import glob, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "web", "public")
CREAM = (0xF5, 0xF3, 0xEF)
GREEN = (0x94, 0xC4, 0x47)
INK = (0x0B, 0x0B, 0x0B)
os.makedirs(PUB, exist_ok=True)

def remove_cream(im, lo=16, hi=58):
    """Cut the logo out of its cream background by colour saturation.

    The background is a bright, near-neutral cream (saturation < ~12); the logo is
    saturated green. Alpha ramps from 0 to 1 between `lo` and `hi`, and edge colours
    are un-blended from the local cream so there is no light halo on dark themes.
    """
    import numpy as np
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    sat = a.max(axis=2) - a.min(axis=2)
    alpha = np.clip((sat - lo) / (hi - lo), 0, 1)
    # cream estimate from the border
    border = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    safe = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip((a - (1 - alpha[..., None]) * bg) / safe, 0, 255)
    rgb = np.where(alpha[..., None] > 0.98, a, rgb)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")

def trim(im, pad=0.04, square=True):
    bbox = im.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    if not square:
        p = int(max(w, h) * pad / 2)
        out = Image.new("RGBA", (w + 2 * p, h + 2 * p), (0, 0, 0, 0))
        out.paste(im, (p, p), im)
        return out
    s = int(max(w, h) * (1 + pad * 2))
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(im, ((s - w) // 2, (s - h) // 2), im)
    return out

def interim_mark(size=512):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    s = size / 32
    pts = [(6 * s, 25 * s), (6 * s, 8 * s), (16 * s, 17 * s), (26 * s, 8 * s), (26 * s, 25 * s)]
    d.line(pts, fill=GREEN + (255,), width=int(4.2 * s), joint="curve")
    for p in (pts[0], pts[-1]):
        r = 2.1 * s
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=GREEN + (255,))
    return im

def font(size, bold=True):
    for f in glob.glob("/usr/share/fonts/**/Inter*.ttf", recursive=True) + glob.glob("/usr/share/fonts/**/DejaVuSans-Bold.ttf", recursive=True):
        try:
            ft = ImageFont.truetype(f, size)
            try:
                ft.set_variation_by_axes([size if size < 32 else 32, 800 if bold else 400])
            except Exception:
                pass
            return ft
        except Exception:
            continue
    return ImageFont.load_default()

src = sys.argv[1] if len(sys.argv) > 1 else None
if not src:
    found = sorted(glob.glob(os.path.join(PUB, "mintiq-logo-original.*")))
    src = found[0] if found else None
if src:
    if not os.path.basename(src).startswith("mintiq-logo-original"):
        ext = os.path.splitext(src)[1].lower() or ".png"
        im0 = Image.open(src).convert("RGB")
        im0.thumbnail((1024, 1024), Image.LANCZOS)
        im0.save(os.path.join(PUB, "mintiq-logo-original" + ext), quality=88)
    cut = remove_cream(Image.open(src))
    mark = trim(cut)
    wide = trim(cut, pad=0.02, square=False)
    wide.thumbnail((1024, 1024), Image.LANCZOS)
    wide.save(os.path.join(PUB, "mintiq-logo.png"), optimize=True)
    print("logo source:", os.path.basename(src), "wide", wide.size)
else:
    mark = trim(interim_mark())
    mark.save(os.path.join(PUB, "mintiq-logo.png"))
    print("logo source: interim drawn mark (no logo file found)")

mark512 = mark.resize((512, 512), Image.LANCZOS)
mark512.save(os.path.join(PUB, "mintiq-mark.png"))
mark.resize((32, 32), Image.LANCZOS).save(os.path.join(PUB, "favicon-32.png"))
mark512.save(os.path.join(PUB, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
apple = Image.new("RGBA", (180, 180), CREAM + (255,))
m = mark.resize((144, 144), Image.LANCZOS)
apple.paste(m, (18, 18), m)
apple.convert("RGB").save(os.path.join(PUB, "apple-touch-icon.png"))

og = Image.new("RGB", (1200, 630), CREAM)
d = ImageDraw.Draw(og)
d.rectangle([0, 0, 1200, 92], fill=INK)
d.text((60, 28), "FREE ON NEAR TESTNET", font=font(30), fill=GREEN)
m = mark.resize((300, 300), Image.LANCZOS)
og.paste(m, (820, 200), m)
d.text((60, 170), "Mintiq", font=font(110), fill=INK)
d.text((60, 310), "NFTs with a treasury, a mission,", font=font(44, False), fill=INK)
d.text((60, 365), "and an agent that gets work done.", font=font(44, False), fill=INK)
d.rounded_rectangle([60, 470, 470, 550], radius=16, fill=GREEN, outline=INK, width=3)
d.text((88, 490), "mintiq-pink.vercel.app", font=font(30), fill=INK)
og.save(os.path.join(PUB, "og-image.png"))
print("wrote:", ", ".join(sorted(f for f in os.listdir(PUB))))
