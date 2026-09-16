"""Build the ice-beast sprite from frontend/assets/world-4/world_4_boss.png.

Usage: python scripts/pack-ice-beast.py

World 4 (Fear Mountains)'s Forest Dash villain and home-page guardian: a
single roaring yeti pose on a checkerboard editor backdrop. Keyed out by
connected component rather than a plain brightness threshold (see
pack-caves-world.py) -- checked by hand against the source art, since the
character's own white fur is close in tone to the checkerboard: the
technique still isolates it correctly, and preserves the small real gaps
between its claws as transparent rather than papering over them.

Outputs public/assets/world-4/ice-beast.webp, drawn by PandaRunner.tsx in
place of the zombie plant for world 3's "beast" hazard kind, and by
GuardianSlime's sibling for the home-page guardian.
"""
from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage

root = Path(__file__).resolve().parents[1]
source = root / 'frontend/assets/world-4/world_4_boss.png'
out = root / 'public/assets/world-4/ice-beast.webp'

OUT_WIDTH = 280  # native size of the exported sprite; canvas scales it down further


def keyed(path: Path) -> np.ndarray:
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(int)
    lo, hi = rgb.min(axis=2), rgb.max(axis=2)
    art = ~((hi - lo < 26) & (hi > 150))
    labels, count = ndimage.label(art)
    sizes = ndimage.sum(art, labels, range(1, count + 1))
    slab = ndimage.binary_fill_holes(labels == int(np.argmax(sizes)) + 1)
    alpha = np.where(slab, 255, 0).astype(np.uint8)
    rgba = np.dstack([rgb.astype(np.uint8), alpha])
    rgba[alpha == 0] = 0
    return rgba


def downscale_rgba(rgba: np.ndarray, width: int) -> Image.Image:
    """Premultiplied-alpha BOX downscale -- keeps the transparent edge from
    bleeding black into the fur."""
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
    rgba = keyed(source)
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
