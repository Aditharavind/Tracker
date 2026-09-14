"""Build the app logo (frontend/assets/logo.png) into a transparent in-app
asset plus the full PWA icon set.

Usage: python scripts/pack-logo.py

The source is a single square illustration (panda + "ON TRACK" wordmark +
"SMALL STEPS BIGGER YOU" tagline) on a solid black backdrop -- an artifact
of however it was generated, not a designed icon background. This keys that
backdrop out to alpha (same near-black threshold technique as
pack-zombie-plant.py) and crops to content, then produces:

  public/assets/logo.webp        -- transparent, for in-app branding
                                     (Onboard.tsx's sign-in screen)
  public/favicon.png             -- small transparent icon
  public/apple-touch-icon.png    -- 180x180, filled with the theme's own
                                     background colour (--bg / manifest's
                                     background_color, #0b0b0c) because iOS
                                     fills transparent areas of touch icons
                                     with black itself -- better to fill
                                     deliberately with the real theme colour
                                     than get an unintended black square back
  public/icon-192.png            -- 192x192, same background-fill treatment
  public/icon-512.png            -- 512x512, same
  public/icon-maskable-512.png   -- 512x512, background-filled edge-to-edge
                                     with the logo sized to the ~80% "safe
                                     zone" the maskable-icon spec expects,
                                     since OS launchers crop these to a
                                     circle/squircle/etc and anything outside
                                     the safe zone can get clipped

vite.config.ts's manifest already points at these exact filenames/sizes and
already sets background_color/theme_color to the same #0b0b0c, so no config
changes are needed after running this -- it only replaces the files.
"""
from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[1]
source = root / 'frontend/assets/logo.png'
out = root / 'public'
out_assets = root / 'public/assets'

THEME_BG = (11, 11, 12, 255)  # #0b0b0c, matches --bg and the manifest


def keyed_content() -> Image.Image:
    """Source with the black backdrop keyed to alpha, cropped to content."""
    rgb = np.asarray(Image.open(source).convert('RGB'))
    bg = (rgb[..., 0] < 18) & (rgb[..., 1] < 18) & (rgb[..., 2] < 18)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    rgba = np.dstack([rgb, alpha])
    rgba[alpha == 0] = 0

    ys, xs = np.nonzero(~bg)
    pad = 8
    box = (
        max(0, xs.min() - pad),
        max(0, ys.min() - pad),
        min(rgb.shape[1], xs.max() + pad),
        min(rgb.shape[0], ys.max() + pad),
    )
    return Image.fromarray(rgba[box[1]:box[3], box[0]:box[2]], 'RGBA')


def downscale_rgba(art: Image.Image, size: int) -> Image.Image:
    """Premultiplied-alpha BOX downscale -- keeps the transparent edge from
    bleeding black into the art (same technique as pack-zombie-plant.py)."""
    a = np.asarray(art).astype(float)
    alpha = a[..., 3:4] / 255.0
    premultiplied = np.dstack([a[..., :3] * alpha, a[..., 3:4]]).astype(np.uint8)
    ratio = size / max(art.width, art.height)
    dims = (round(art.width * ratio), round(art.height * ratio))
    small = np.asarray(Image.fromarray(premultiplied, 'RGBA').resize(dims, Image.BOX)).astype(float)
    out_alpha = small[..., 3:4]
    rgb = np.zeros_like(small[..., :3])
    np.divide(small[..., :3] * 255.0, out_alpha, out=rgb, where=out_alpha > 0)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), out_alpha]).astype(np.uint8), 'RGBA')


def on_theme_bg(logo: Image.Image, canvas_size: int, content_fraction: float) -> Image.Image:
    """logo centred on an opaque theme-coloured square, sized to
    content_fraction of the canvas (the maskable-icon "safe zone" is
    ~0.8; regular icons use a slightly larger fraction since they aren't
    cropped)."""
    canvas = Image.new('RGBA', (canvas_size, canvas_size), THEME_BG)
    target = round(canvas_size * content_fraction)
    scaled = downscale_rgba(logo, target)
    x = (canvas_size - scaled.width) // 2
    y = (canvas_size - scaled.height) // 2
    canvas.alpha_composite(scaled, (x, y))
    return canvas


def main() -> None:
    logo = keyed_content()

    out_assets.mkdir(parents=True, exist_ok=True)
    transparent = downscale_rgba(logo, 640)
    transparent.save(out_assets / 'logo.webp', format='WEBP', lossless=True, method=6)
    print(f'assets/logo.webp {transparent.width}x{transparent.height}')

    favicon = downscale_rgba(logo, 64)
    favicon.convert('RGBA').save(out / 'favicon.png')
    print(f'favicon.png {favicon.width}x{favicon.height}')

    for name, size, fraction in [
        ('apple-touch-icon.png', 180, 0.82),
        ('icon-192.png', 192, 0.82),
        ('icon-512.png', 512, 0.82),
        ('icon-maskable-512.png', 512, 0.78),
    ]:
        on_theme_bg(logo, size, fraction).convert('RGB').save(out / name)
        print(f'{name} {size}x{size}')


if __name__ == '__main__':
    main()
