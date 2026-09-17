"""Pack World 5 (Arcane Sky Realm) art into web assets.
Usage: python scripts/pack-skyrealm-world.py

Two sources, both already exported with real alpha (no checkerboard keying
needed, same as World 4's platform):

* frontend/assets/world-5/world_5_platform.png -- one floating rune-etched
  platform, gold-trimmed with crystal shards hanging beneath it. Cut the same
  way as World 2/4's ledges: a left cap, a repeating middle and a right cap
  for the crust, plus a tiling strip of the deck's own stone panelling for
  the rock body. Unlike World 2/4's source screenshots there is no separate
  rock-body chunk in this render -- the platform is a single floating slab
  with nothing plain underneath it -- so the "rock" tile is instead sampled
  from a flat, unornamented panel of the deck itself (see ROCK_* below).
* frontend/assets/world-5/world_5_bg.png -- the floating-islands / twin-moons
  backdrop, resized to the same budget as the other world backgrounds.

This world's lore was rewritten to match this art (see worldScenery.ts):
what shipped as a "golden desert canyon" is now the Arcane Sky Realm.
"""
from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[1]
platform_source = root / 'frontend/assets/world-5/world_5_platform.png'
background_source = root / 'frontend/assets/world-5/world_5_bg.png'
out = root / 'public/assets/world-5'

# Ledge geometry in source pixels, measured off the art.
SPIKE_TOP = 260     # top of the gold corner caps, above the deck
DECK_TOP = 430       # the lit surface -- this is what a character stands on
CRUST_BOTTOM = 760  # below the last hanging crystal drip
# Cuts sit just past each gold corner cap, in a dip between drip clusters, so
# the middle tile (which carries the platform's central rune medallion) never
# slices a cap or a drip.
CUT_LEFT, CUT_RIGHT = 225, 1549
OUT_CRUST_HEIGHT = 40  # ~2x the art's own pixel grid

# A flat, unornamented panel of the deck's own stone -- stands in for a
# separate rock-body chunk, which this source doesn't ship. Sized to its own
# output height, not the crust's scale: it's a sampled texture, not a
# geometric continuation of the same slab, so matching the crust's aggressive
# downscale would crush it to a sliver.
ROCK_BOX = (250, 290, 900, 360)
OUT_ROCK_HEIGHT = 22

BACKGROUND_WIDTH = 1600


def downscale_rgba(rgba: np.ndarray, height: int) -> Image.Image:
    """Premultiplied-alpha BOX downscale -- keeps the transparent edge from
    bleeding black into the crystals."""
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
        'skyrealm-crust-left': (left, cuts[0]),
        'skyrealm-crust-mid': cuts,
        'skyrealm-crust-right': (cuts[1], right),
    }.items():
        save(crust.crop((x0, 0, x1, crust.height)), name)

    rock = Image.open(platform_source).convert('RGB').crop(ROCK_BOX)
    rock = rock.resize((round(rock.width * OUT_ROCK_HEIGHT / rock.height), OUT_ROCK_HEIGHT), Image.LANCZOS)
    rock.save(out / 'skyrealm-rock.webp', format='WEBP', quality=88, method=6)
    print(f'skyrealm-rock.webp {rock.width}x{rock.height}')

    print(f'deck at {round((DECK_TOP - SPIKE_TOP) * scale)}px of {OUT_CRUST_HEIGHT}px')

    backdrop = Image.open(background_source).convert('RGB')
    height = round(backdrop.height * BACKGROUND_WIDTH / backdrop.width)
    backdrop = backdrop.resize((BACKGROUND_WIDTH, height), Image.LANCZOS)
    backdrop.save(out / 'skyrealm-bg.webp', format='WEBP', quality=86, method=6)
    print(f'skyrealm-bg.webp {backdrop.width}x{backdrop.height}')


if __name__ == '__main__':
    main()
