"""Key + crop frontend/assets/clock.png (the wooden countdown-frame art) into
public/assets/day-clock-frame.webp.

Usage: python scripts/pack-clock-frame.py

Same treatment as the grass screenshot: the source is a PNG with an editor
checkerboard baked into its RGB pixels rather than real alpha, so this
detects that checkerboard and keys it to transparent, then crops to content.

The frame's blank wood panel -- where DayCountdown.tsx overlays the live
countdown text -- sits at a fixed, hand-measured percentage of the cropped
image (found by isolating the panel's solid dark-wood rectangle with
connected-components). Printed here so styles.css's --clock-panel-* custom
properties stay in sync with the art if this script is ever re-run against a
different crop/pad.
"""
from pathlib import Path
from PIL import Image
import numpy as np
import cv2

root = Path(__file__).resolve().parents[1]
source = root / 'frontend/assets/clock.png'
out = root / 'public/assets/day-clock-frame.webp'

OUT_WIDTH = 640
PAD = 8


def main() -> None:
    rgb = np.asarray(Image.open(source).convert('RGB')).astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lo, hi = rgb.min(axis=2), rgb.max(axis=2)
    backdrop = (hi - lo < 12) & (hi > 180)  # desaturated + bright = checkerboard

    ys, xs = np.nonzero(~backdrop)
    h, w = rgb.shape[:2]
    x0, y0 = max(0, xs.min() - PAD), max(0, ys.min() - PAD)
    x1, y1 = min(w, xs.max() + PAD), min(h, ys.max() + PAD)

    # Locate the blank wood panel (the largest solid dark-wood region) so its
    # position can be reported as a percentage of the crop for the CSS side.
    panel_color = (r > 40) & (r < 110) & (g > 15) & (g < 60) & (b > 5) & (b < 45) & (r > g) & (g >= b)
    mask = (panel_color * 255).astype(np.uint8)
    _, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    px, py, pw, ph, _ = stats[1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])]
    pct = lambda v, lo_, hi_: (v - lo_) / (hi_ - lo_) * 100
    print(
        'panel %: left {:.2f} right {:.2f} top {:.2f} bottom {:.2f}'.format(
            pct(px, x0, x1), pct(px + pw, x0, x1), pct(py, y0, y1), pct(py + ph, y0, y1)
        )
    )

    alpha = np.where(backdrop, 0, 255).astype(np.uint8)
    rgba = np.dstack([rgb.astype(np.uint8), alpha])
    rgba[alpha == 0] = 0
    cropped = rgba[y0:y1, x0:x1]

    # Premultiplied-alpha BOX downscale, same as the grass/plant pipelines, so
    # the transparent edge can't bleed black into the art.
    a = cropped.astype(float)
    premultiplied = np.dstack([a[..., :3] * (a[..., 3:4] / 255.0), a[..., 3:4]]).astype(np.uint8)
    height = round(cropped.shape[0] * OUT_WIDTH / cropped.shape[1])
    small = np.asarray(
        Image.fromarray(premultiplied, 'RGBA').resize((OUT_WIDTH, height), Image.BOX)
    ).astype(float)
    out_alpha = small[..., 3:4]
    out_rgb = np.zeros_like(small[..., :3])
    np.divide(small[..., :3] * 255.0, out_alpha, out=out_rgb, where=out_alpha > 0)
    img = Image.fromarray(np.dstack([np.clip(out_rgb, 0, 255), out_alpha]).astype(np.uint8), 'RGBA')

    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, format='WEBP', lossless=True, method=6)
    print(f'{out.name} {img.width}x{img.height}')


if __name__ == '__main__':
    main()
