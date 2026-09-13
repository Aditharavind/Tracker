"""Slice frontend/assets/grass.png into the three platform-grass tiles.
Usage: python scripts/pack-grass-platform.py

The source is a screenshot of a single long pixel-art grass ledge sitting on an
editor checkerboard, so this (a) keys the checkerboard back out to alpha,
(b) resamples down to roughly 2x the art's own pixel grid (~11.5 source px per
art pixel) so the browser can upscale it with image-rendering: pixelated, and
(c) cuts it into a left cap, a tiling middle and a right cap.

Three tiles rather than one stretched image is the whole point: a platform's
grass keeps its finished ends and its natural pixel density at any base width,
with only the middle repeating. See .platform-moss / .victory-lane in
src/styles.css.
"""
from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[1]
source = root / 'frontend/assets/grass.png'
out = root / 'public/assets'

# Grass body in source pixels. The cuts sit in the notches between the hanging
# tufts, at matching depths, so the middle tile repeats without a visible seam.
CROP_TOP, CROP_BOTTOM = 303, 457
CUT_LEFT, CUT_RIGHT = 143, 1152
OUT_HEIGHT = 27  # ~2x the art's native pixel grid


def keyed(path: Path) -> Image.Image:
    """Load the screenshot and turn its checkerboard backdrop into alpha."""
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(int)
    lo, hi = rgb.min(axis=2), rgb.max(axis=2)
    # The checkerboard is the only desaturated, bright thing in the frame.
    backdrop = (hi - lo < 26) & (hi > 150)
    # JPEG ringing leaves a grey halo one or two pixels into the grass, so grow
    # the backdrop slightly rather than trusting the raw threshold.
    grown = backdrop.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        grown |= np.roll(backdrop, (dy, dx), (0, 1))
    alpha = np.where(grown, 0, 255).astype(np.uint8)
    out = np.dstack([rgb.astype(np.uint8), alpha])
    # Zero the colour of transparent pixels so downscaling can't bleed grey in.
    out[alpha == 0] = 0
    return Image.fromarray(out, 'RGBA')


def downscale(art: Image.Image, height: int) -> Image.Image:
    """Area-average down with premultiplied alpha, so the transparent side of
    an edge can't bleed black into the tufts."""
    a = np.asarray(art).astype(float)
    alpha = a[..., 3:4] / 255.0
    premultiplied = np.dstack([a[..., :3] * alpha, a[..., 3:4]]).astype(np.uint8)
    size = (round(art.width * height / art.height), height)
    small = np.asarray(
        Image.fromarray(premultiplied, 'RGBA').resize(size, Image.BOX)
    ).astype(float)
    out_alpha = small[..., 3:4]
    rgb = np.zeros_like(small[..., :3])
    np.divide(small[..., :3] * 255.0, out_alpha, out=rgb, where=out_alpha > 0)
    return Image.fromarray(
        np.dstack([np.clip(rgb, 0, 255), out_alpha]).astype(np.uint8), 'RGBA'
    )


def main() -> None:
    art = keyed(source).crop((0, CROP_TOP, 1364, CROP_BOTTOM))
    scale = OUT_HEIGHT / art.height
    art = downscale(art, OUT_HEIGHT)

    cuts = [round(CUT_LEFT * scale), round(CUT_RIGHT * scale)]
    tiles = {
        'grass-left': (0, cuts[0]),
        'grass-mid': (cuts[0], cuts[1]),
        'grass-right': (cuts[1], art.width),
    }
    out.mkdir(parents=True, exist_ok=True)
    for name, (x0, x1) in tiles.items():
        tile = art.crop((x0, 0, x1, art.height))
        tile.save(out / f'{name}.webp', format='WEBP', lossless=True, method=6)
        print(f'{name}.webp {tile.width}x{tile.height}')


if __name__ == '__main__':
    main()
