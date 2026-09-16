"""Pack the World 2 (Self-Doubt Caves) art into web assets.
Usage: python scripts/pack-caves-world.py

Two sources, both editor screenshots:

* frontend/assets/world-2/caves-platform.png -- one long crystal-topped ledge on a
  checkerboard. Cut the same way as the grass ledge (see pack-grass-platform.py):
  a left cap, a repeating middle and a right cap for the crystal crust, plus a
  separate tiling strip of the rock body underneath. Three tiles rather than one
  stretched image is the point: a ledge keeps its finished ends and its pixel
  density at any width, with only the middle repeating.
* frontend/assets/world-2/caves-platform2.png -- the cave parallax backdrop, which only
  needs resizing to the same budget as the other world backgrounds.

Unlike the grass script this keys the backdrop by connected component rather
than by threshold alone, because this screenshot carries a faint stock-art
watermark that a plain brightness test leaves behind as speckle.
"""
from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage

root = Path(__file__).resolve().parents[1]
platform_source = root / 'frontend/assets/world-2/caves-platform.png'
background_source = root / 'frontend/assets/world-2/caves-platform2.png'
out = root / 'public/assets/world-2'

# Ledge geometry in source pixels, measured off the art.
SPIKE_TOP = 241     # tips of the tall crystal clusters, above the deck
DECK_TOP = 331      # the lit surface -- this is what a character stands on
CRUST_BOTTOM = 555  # below the last hanging crystal drip
ROCK_BOTTOM = 760   # bottom of the rock body
# Cuts sit in drip-free gaps and never slice a crystal cluster, so the middle
# tile repeats without a seam.
CUT_LEFT, CUT_RIGHT = 340, 1520
OUT_CRUST_HEIGHT = 38  # ~2x the art's own pixel grid (~3.4 source px per pixel)

BACKGROUND_WIDTH = 1600


def keyed(path: Path) -> Image.Image:
    """Load the screenshot and turn its checkerboard backdrop into alpha."""
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(int)
    lo, hi = rgb.min(axis=2), rgb.max(axis=2)
    # The checkerboard is the only desaturated, bright thing in the frame, but
    # the watermark breaks it up -- so keep the largest connected blob of
    # non-backdrop pixels and treat everything else as transparent.
    art = ~((hi - lo < 26) & (hi > 150))
    labels, count = ndimage.label(art)
    sizes = ndimage.sum(art, labels, range(1, count + 1))
    slab = ndimage.binary_fill_holes(labels == int(np.argmax(sizes)) + 1)
    alpha = np.where(slab, 255, 0).astype(np.uint8)
    out_rgba = np.dstack([rgb.astype(np.uint8), alpha])
    # Zero the colour of transparent pixels so downscaling can't bleed grey in.
    out_rgba[alpha == 0] = 0
    return Image.fromarray(out_rgba, 'RGBA')


def downscale(art: Image.Image, height: int) -> Image.Image:
    """Area-average down with premultiplied alpha, so the transparent side of
    an edge can't bleed black into the crystals."""
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


def save(image: Image.Image, name: str) -> None:
    image.save(out / f'{name}.webp', format='WEBP', lossless=True, method=6)
    print(f'{name}.webp {image.width}x{image.height}')


def main() -> None:
    out.mkdir(parents=True, exist_ok=True)
    slab = keyed(platform_source)

    # Crust: crystal deck, the clusters standing above it and the drips below.
    crust = slab.crop((0, SPIKE_TOP, slab.width, CRUST_BOTTOM))
    scale = OUT_CRUST_HEIGHT / crust.height
    crust = downscale(crust, OUT_CRUST_HEIGHT)
    cuts = (round(CUT_LEFT * scale), round(CUT_RIGHT * scale))
    bounds = np.where(np.asarray(crust)[..., 3].any(axis=0))[0]
    left, right = int(bounds.min()), int(bounds.max()) + 1
    for name, (x0, x1) in {
        'caves-crust-left': (left, cuts[0]),
        'caves-crust-mid': cuts,
        'caves-crust-right': (cuts[1], right),
    }.items():
        save(crust.crop((x0, 0, x1, crust.height)), name)

    # Rock body: no caps, it just tiles -- the crust above draws the silhouette.
    rock = slab.crop((CUT_LEFT, CRUST_BOTTOM, CUT_RIGHT, ROCK_BOTTOM))
    save(downscale(rock, round(rock.height * scale)), 'caves-rock')

    # The deck sits this far down the crust tile; the stylesheet pulls the tile
    # up by the difference so the clusters overhang without moving the ledge.
    print(f'deck at {round((DECK_TOP - SPIKE_TOP) * scale)}px of {OUT_CRUST_HEIGHT}px')

    backdrop = Image.open(background_source).convert('RGB')
    height = round(backdrop.height * BACKGROUND_WIDTH / backdrop.width)
    backdrop = backdrop.resize((BACKGROUND_WIDTH, height), Image.LANCZOS)
    backdrop.save(out / 'caves-bg.webp', format='WEBP', quality=86, method=6)
    print(f'caves-bg.webp {backdrop.width}x{backdrop.height}')


if __name__ == '__main__':
    main()
