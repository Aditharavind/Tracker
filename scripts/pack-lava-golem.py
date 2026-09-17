"""Build the lava-golem sprite from frontend/assets/world-6/world_6_boss.png.

Usage: python scripts/pack-lava-golem.py

World 6 (Cinder Peak)'s Forest Dash villain and home-page guardian: a single
horned molten-rock golem pose, already exported with real alpha (no
checkerboard keying needed, same as World 4's ice-beast source). Cropped to
content with a small pad and downscaled with premultiplied alpha so the
transparent edge can't bleed black into the glowing lava cracks.

Outputs public/assets/world-6/lava-golem.webp, drawn by PandaRunner.tsx in
place of the zombie plant for world 5's "golem" hazard kind, and by
GuardianCreature for the home-page guardian.
"""
from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[1]
source = root / 'frontend/assets/world-6/world_6_boss.png'
out = root / 'public/assets/world-6/lava-golem.webp'

OUT_WIDTH = 300  # native size of the exported sprite; canvas scales it down further


def downscale_rgba(rgba: np.ndarray, width: int) -> Image.Image:
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
    rgba = np.asarray(Image.open(source).convert('RGBA'))
    ys, xs = np.nonzero(rgba[..., 3])
    pad = 10
    box = (
        max(0, xs.min() - pad),
        max(0, ys.min() - pad),
        min(rgba.shape[1], xs.max() + pad),
        min(rgba.shape[0], ys.max() + pad),
    )
    cropped = rgba[box[1]:box[3], box[0]:box[2]]
    art = downscale_rgba(cropped, OUT_WIDTH)
    out.parent.mkdir(parents=True, exist_ok=True)
    art.save(out, format='WEBP', lossless=True, method=6)
    print(f'{out.name} {art.width}x{art.height}')


if __name__ == '__main__':
    main()
