"""Draws the FitFlow icons (teal tile, white progress ring + dot). Run once."""
from PIL import Image, ImageDraw
import os
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "icons")

def tile(size, pad_ratio=0.0, transparent=False):
    s = size * 4  # supersample
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0) if transparent else (11, 127, 122, 255))
    d = ImageDraw.Draw(img)
    if not transparent:
        for y in range(s):  # vertical gradient
            t = y / s
            c = (int(14 + 10 * (1 - t)), int(150 - 40 * t), int(140 - 30 * t), 255)
            d.line([(0, y), (s, y)], fill=c)
    inset = s * (0.5 - (0.5 - pad_ratio) * 0.62)
    box = [inset, inset, s - inset, s - inset]
    w = int(s * 0.085 * (1 - pad_ratio))
    col = (255, 255, 255, 255) if not transparent else (0, 0, 0, 255)
    d.arc(box, start=-60, end=230, fill=col, width=w)
    # dot at the open end of the ring
    import math
    cx, cy = s / 2, s / 2
    r = (box[2] - box[0]) / 2 - w / 2
    ang = math.radians(-60 - 38)
    px, py = cx + r * math.cos(ang), cy + r * math.sin(ang)
    dr = w * 0.75
    d.ellipse([px - dr, py - dr, px + dr, py + dr], fill=col)
    # inner flow stroke
    d.line([(s * 0.40, s * 0.56), (s * 0.48, s * 0.46), (s * 0.54, s * 0.55), (s * 0.62, s * 0.43)], fill=col, width=int(w * 0.8), joint="curve")
    return img.resize((size, size), Image.LANCZOS)

tile(180).convert("RGB").save(os.path.join(OUT, "apple-touch-icon.png"))
tile(192).save(os.path.join(OUT, "icon-192.png"))
tile(512).save(os.path.join(OUT, "icon-512.png"))
tile(512, pad_ratio=0.12).save(os.path.join(OUT, "maskable-512.png"))
tile(72, transparent=True).save(os.path.join(OUT, "badge-72.png"))
tile(32).save(os.path.join(OUT, "favicon-32.png"))
print("icons written")
