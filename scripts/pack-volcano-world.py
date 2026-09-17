"""Pack World 6 (Cinder Peak) art into web assets.
Usage: python scripts/pack-volcano-world.py

Two sources, both already exported with real alpha (no checkerboard keying
needed, same as World 4's platform):

* frontend/assets/world-6/world_6_platform.png -- a long lava-cracked ledge
  with jagged obsidian drips, flanked at both ends by tall banner-topped rock
  towers. Those towers rise far above the ledge's own crust height, so
  CUT_LEFT/CUT_RIGHT are picked well inside the plain repeating drip field --
  the crust crop (SPIKE_TOP..CRUST_BOTTOM) simply never reaches high enough
  to include the towers' banners or peaks, only their rocky base blending
  into the ledge at each edge. As with World 5, this source has no separate
  rock-body chunk, so the "rock" tile is sampled from a flat cracked-lava
  panel of the deck itself.
* frontend/assets/world-6/world6_bg.png -- the erupting-volcano parallax
  backdrop, resized to the same budget as the other world backgrounds.
"""
from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[1]
platform_source = root / 'frontend/assets/world-6/world_6_platform.png'
background_source = root / 'frontend/assets/world-6/world6_bg.png'
out = root / 'public/assets/world-6'

# Ledge geometry in source pixels, measured off the art.
SPIKE_TOP = 400      # tips of the small obsidian bumps, above the deck
DECK_TOP = 495        # the lit cracked-lava surface -- what a character stands on
CRUST_BOTTOM = 875   # below the last hanging lava drip (image's own bottom edge)
# Cuts sit inside the plain drip field, well clear of both end towers/the
# ruined arch, so the middle tile never slices them.
CUT_LEFT, CUT_RIGHT = 640, 1170
OUT_CRUST_HEIGHT = 42  # ~2x the art's own pixel grid

# A flat, unornamented panel of the deck's cracked lava -- stands in for a
# separate rock-body chunk, which this source doesn't ship. Sized to its own
# output height, not the crust's scale: it's a sampled texture, not a
# geometric continuation of the same slab, so matching the crust's aggressive
# downscale would crush it to a sliver.
ROCK_BOX = (750, 465, 1050, 500)
OUT_ROCK_HEIGHT = 22

BACKGROUND_WIDTH = 1600


def downscale_rgba(rgba: np.ndarray, height: int) -> Image.Image:
    """Premultiplied-alpha BOX downscale -- keeps the transparent edge from
    bleeding black into the embers."""
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

    crust = Image.fromarray(slab[SPIKE_TOP:CRUST_BOTTOM])
    scale = OUT_CRUST_HEIGHT / crust.height
    crust = downscale_rgba(np.asarray(crust), OUT_CRUST_HEIGHT)
    cuts = (round(CUT_LEFT * scale), round(CUT_RIGHT * scale))
    bounds = np.where(np.asarray(crust)[..., 3].any(axis=0))[0]
    left, right = int(bounds.min()), int(bounds.max()) + 1
    for name, (x0, x1) in {
        'volcano-crust-left': (left, cuts[0]),
        'volcano-crust-mid': cuts,
        'volcano-crust-right': (cuts[1], right),
    }.items():
        save(crust.crop((x0, 0, x1, crust.height)), name)

    rock = Image.open(platform_source).convert('RGB').crop(ROCK_BOX)
    rock = rock.resize((round(rock.width * OUT_ROCK_HEIGHT / rock.height), OUT_ROCK_HEIGHT), Image.LANCZOS)
    rock.save(out / 'volcano-rock.webp', format='WEBP', quality=88, method=6)
    print(f'volcano-rock.webp {rock.width}x{rock.height}')

    print(f'deck at {round((DECK_TOP - SPIKE_TOP) * scale)}px of {OUT_CRUST_HEIGHT}px')

    backdrop = Image.open(background_source).convert('RGB')
    height = round(backdrop.height * BACKGROUND_WIDTH / backdrop.width)
    backdrop = backdrop.resize((BACKGROUND_WIDTH, height), Image.LANCZOS)
    backdrop.save(out / 'volcano-bg.webp', format='WEBP', quality=86, method=6)
    print(f'volcano-bg.webp {backdrop.width}x{backdrop.height}')


if __name__ == '__main__':
    main()
