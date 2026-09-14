"""Composite a small wooden plank/sign onto each of the 11 moss-stone
platforms baked into frontend/assets/levels.png.

Usage: python scripts/pack-levels-boards.py

levels.png is a single flat background (no per-stone game logic hooks) with
11 stone-disk platforms winding up a vertical forest path. Stone centers and
sizes below were measured once by eye against a coordinate grid overlaid on
the source image (see PR discussion) -- the source art is static, so these
are hard-coded rather than detected at runtime, matching the approach in
pack-grass-platform.py's hard-coded crop bounds.

Each board is drawn as flat, hard-edged pixel shapes (PIL draws without
anti-aliasing by default, which is what keeps the edges crisp/pixel-art
rather than smooth/vector-looking) directly at final on-image size, then
alpha-composited with a soft ellipse drop shadow so it reads as sitting on
the stone rather than floating over it.

Outputs public/assets/levels-boards.webp -- frontend/assets/levels.png (the
source) is left untouched.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math

root = Path(__file__).resolve().parents[1]
source = root / 'frontend/assets/levels.png'
out = root / 'public/assets'

# (center_x, center_y, stone_width, stone_height) measured against a 50px
# grid overlaid on the 1254x1254 source, top stone to bottom stone.
STONES = [
    (725, 109, 88, 36),
    (580, 206, 88, 38),
    (834, 249, 87, 33),
    (517, 329, 92, 36),
    (804, 389, 96, 37),
    (476, 473, 99, 40),
    (857, 537, 98, 43),
    (517, 660, 104, 46),
    (881, 728, 108, 50),
    (579, 855, 116, 52),
    (375, 995, 131, 61),
]

WOOD_FILL = (138, 90, 43, 255)
WOOD_FILL_LIGHT = (156, 106, 56, 255)
WOOD_GRAIN = (98, 61, 26, 255)
WOOD_OUTLINE = (58, 34, 14, 255)
ROPE = (196, 168, 110, 255)
ROPE_SHADE = (140, 114, 68, 255)


def draw_board(w: int, h: int) -> Image.Image:
    """One pixel-art plank sign, hard edges, sized to (w, h)."""
    pad = 3
    canvas = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    x0, y0, x1, y1 = pad, pad, pad + w, pad + h

    # Flattened-hexagon silhouette, echoing the stone disks' own cut shape
    # but at plank scale, so it visibly belongs on top of a stone rather
    # than looking like an unrelated sticker.
    notch = max(3, w // 6)
    points = [
        (x0 + notch, y0), (x1 - notch, y0),
        (x1, y0 + h // 2), (x1 - notch, y1),
        (x0 + notch, y1), (x0, y0 + h // 2),
    ]
    d.polygon(points, fill=WOOD_FILL, outline=WOOD_OUTLINE)

    # Grain streaks.
    for i in range(1, 4):
        gy = y0 + round(h * i / 4)
        d.line([(x0 + notch - 1, gy), (x1 - notch + 1, gy)], fill=WOOD_GRAIN, width=1)

    # A lighter plank seam down the middle -- reads as two boards lashed
    # together, standard "sign" silhouette.
    mid = (x0 + x1) // 2
    d.line([(mid, y0 + 1), (mid, y1 - 1)], fill=WOOD_OUTLINE, width=1)

    band = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    bd.rectangle([mid + 1, y0 + 1, x1 - notch, y1 - 1], fill=WOOD_FILL_LIGHT)
    canvas.alpha_composite(band, (0, 0))
    d = ImageDraw.Draw(canvas)
    d.polygon(points, outline=WOOD_OUTLINE)
    for i in range(1, 4):
        gy = y0 + round(h * i / 4)
        d.line([(x0 + notch - 1, gy), (x1 - notch + 1, gy)], fill=WOOD_GRAIN, width=1)
    d.line([(mid, y0 + 1), (mid, y1 - 1)], fill=WOOD_OUTLINE, width=1)

    # Rope binding crossing the plank near each end.
    for rx in (x0 + notch + 2, x1 - notch - 2):
        d.line([(rx, y0 - 1), (rx - 2, y1 + 1)], fill=ROPE, width=2)
        d.line([(rx, y0 - 1), (rx - 2, y1 + 1)], fill=ROPE_SHADE, width=1)

    return canvas


def main() -> None:
    base = Image.open(source).convert('RGBA')

    for cx, cy, sw, sh in STONES:
        bw = max(24, round(sw * 0.5))
        bh = max(12, round(sh * 0.5))
        board = draw_board(bw, bh)

        shadow = Image.new('RGBA', base.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow)
        sx, sy = cx, cy + round(bh * 0.32)
        sd.ellipse(
            [sx - bw * 0.42, sy - bh * 0.22, sx + bw * 0.42, sy + bh * 0.22],
            fill=(10, 12, 6, 110),
        )
        shadow = shadow.filter(ImageFilter.GaussianBlur(2))
        base.alpha_composite(shadow)

        px = round(cx - board.width / 2)
        py = round(cy - board.height / 2 - sh * 0.06)
        base.alpha_composite(board, (px, py))

    out.mkdir(parents=True, exist_ok=True)
    rgb = base.convert('RGB')
    rgb.save(out / 'levels-boards.webp', format='WEBP', quality=95, method=6)
    print(f'levels-boards.webp {rgb.width}x{rgb.height}, {len(STONES)} boards placed')


if __name__ == '__main__':
    main()
