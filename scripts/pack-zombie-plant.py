"""Build the zombie-plant sprite from frontend/assets/zombie_plant.png.

Usage: python scripts/pack-zombie-plant.py

The source is a single mouth-open pose on a solid black backdrop, so this
keys the backdrop out to alpha, crops to content, and downscales.

Outputs public/assets/zombie-plant-open.webp for the animated DOM sprite
(ZombiePlant.tsx -- the mouth-closed look there is a plain CSS shape animated
over this one frame, not a second baked frame; an earlier attempt at a
synthesized closed-mouth frame left a visible, oddly-tinted edge, so this
script no longer tries), and overwrites the original public/assets/
zombie-plant.webp (the same open pose) so the two canvas call sites that
still draw a single static frame (PandaRunner.tsx, game/adventure/render.ts)
pick up the new art with no code change.
"""
from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[1]
source = root / 'frontend/assets/zombie_plant.png'
out = root / 'public/assets'

OUT_WIDTH = 300  # native size of the exported sprite; CSS scales it down further


def downscale_rgba(rgba: np.ndarray, width: int) -> Image.Image:
    """Premultiplied-alpha BOX downscale -- keeps the transparent edge from
    bleeding black into the art."""
    a = rgba.astype(float)
    alpha = a[..., 3:4] / 255.0
    premultiplied = np.dstack([a[..., :3] * alpha, a[..., 3:4]]).astype(np.uint8)
    height = round(rgba.shape[0] * width / rgba.shape[1])
    small = np.asarray(
        Image.fromarray(premultiplied, 'RGBA').resize((width, height), Image.BOX)
    ).astype(float)
    out_alpha = small[..., 3:4]
    rgb = np.zeros_like(small[..., :3])
    np.divide(small[..., :3] * 255.0, out_alpha, out=rgb, where=out_alpha > 0)
    return Image.fromarray(
        np.dstack([np.clip(rgb, 0, 255), out_alpha]).astype(np.uint8), 'RGBA'
    )


def main() -> None:
    rgb = np.asarray(Image.open(source).convert('RGB'))
    bg = (rgb[..., 0] < 18) & (rgb[..., 1] < 18) & (rgb[..., 2] < 18)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    rgba = np.dstack([rgb, alpha])
    rgba[alpha == 0] = 0

    ys, xs = np.nonzero(~bg)
    pad = 12
    box = (
        max(0, xs.min() - pad),
        max(0, ys.min() - pad),
        min(rgb.shape[1], xs.max() + pad),
        min(rgb.shape[0], ys.max() + pad),
    )
    cropped = rgba[box[1] : box[3], box[0] : box[2]]

    out.mkdir(parents=True, exist_ok=True)
    img = downscale_rgba(cropped, OUT_WIDTH)
    for name in ('zombie-plant-open', 'zombie-plant'):
        img.save(out / f'{name}.webp', format='WEBP', lossless=True, method=6)
        print(f'{name}.webp {img.width}x{img.height}')


if __name__ == '__main__':
    main()
