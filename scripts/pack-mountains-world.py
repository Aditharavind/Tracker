"""Pack World 4 (Fear Mountains) art into web assets.
Usage: python scripts/pack-mountains-world.py

Two sources:

* frontend/assets/world-4/world_4_platform.png -- one long ice-capped ledge,
  already exported with real alpha (unlike World 2's checkerboard screenshot,
  no keying needed here). Cut the same way as the crystal-crust ledge (see
  pack-caves-world.py): a left cap, a repeating middle and a right cap for
  the icy crust, plus a separate tiling strip of the rock body underneath.
* frontend/assets/world-4/world_4_bg2.png -- the aurora/mountain parallax
  backdrop, which only needs resizing to the same budget as the other world
  backgrounds.
"""
from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[1]
platform_source = root / 'frontend/assets/world-4/world_4_platform.png'
background_source = root / 'frontend/assets/world-4/world_4_bg2.png'
out = root / 'public/assets/world-4'

# Ledge geometry in source pixels, measured off the art.
SPIKE_TOP = 220     # tips of the tall ice-crystal clusters, above the deck
DECK_TOP = 400       # the lit surface -- this is what a character stands on
CRUST_BOTTOM = 605  # below the last hanging icicle
ROCK_BOTTOM = 783    # bottom of the rock body
# Cuts sit in the icicles' shortest gap and never slice a spike cluster, so
# the middle tile repeats without a seam.
CUT_LEFT, CUT_RIGHT = 690, 1160
OUT_CRUST_HEIGHT = 40  # ~2x the art's own pixel grid

BACKGROUND_WIDTH = 1600


def downscale_rgba(rgba: np.ndarray, height: int) -> Image.Image:
    """Premultiplied-alpha BOX downscale, scaled to a target HEIGHT (the
    crop is a long, short strip, not a roughly-square sprite) -- keeps the
    transparent edge from bleeding black into the ice."""
    a = rgba.astype(float)
    alpha = a[..., 3:4] / 255.0
    premultiplied = np.dstack([a[..., :3] * alpha, a[..., 3:4]]).astype(np.uint8)
    width = round(rgba.shape[1] * height / rgba.shape[0])
    small = np.asarray(
        Image.fromarray(premultiplied, 'RGBA').resize((width, height), Image.BOX)
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
    slab = np.asarray(Image.open(platform_source).convert('RGBA'))

    # Crust: ice deck, the crystal spikes standing above it and the icicles
    # hanging below.
    crust = Image.fromarray(slab[SPIKE_TOP:CRUST_BOTTOM])
    scale = OUT_CRUST_HEIGHT / crust.height
    crust = downscale_rgba(np.asarray(crust), OUT_CRUST_HEIGHT)
    cuts = (round(CUT_LEFT * scale), round(CUT_RIGHT * scale))
    bounds = np.where(np.asarray(crust)[..., 3].any(axis=0))[0]
    left, right = int(bounds.min()), int(bounds.max()) + 1
    for name, (x0, x1) in {
        'mountains-crust-left': (left, cuts[0]),
        'mountains-crust-mid': cuts,
        'mountains-crust-right': (cuts[1], right),
    }.items():
        save(crust.crop((x0, 0, x1, crust.height)), name)

    # Rock body: no caps, it just tiles -- the crust above draws the silhouette.
    rock = Image.fromarray(slab[CRUST_BOTTOM:ROCK_BOTTOM])
    save(downscale_rgba(np.asarray(rock), round(rock.height * scale)), 'mountains-rock')

    # The deck sits this far down the crust tile; the stylesheet pulls the
    # tile up by the difference so the spikes overhang without moving the
    # ledge (see world-theme.css's world 1 equivalent for the pattern).
    print(f'deck at {round((DECK_TOP - SPIKE_TOP) * scale)}px of {OUT_CRUST_HEIGHT}px')

    backdrop = Image.open(background_source).convert('RGB')
    height = round(backdrop.height * BACKGROUND_WIDTH / backdrop.width)
    backdrop = backdrop.resize((BACKGROUND_WIDTH, height), Image.LANCZOS)
    backdrop.save(out / 'mountains-bg.webp', format='WEBP', quality=86, method=6)
    print(f'mountains-bg.webp {backdrop.width}x{backdrop.height}')


if __name__ == '__main__':
    main()
