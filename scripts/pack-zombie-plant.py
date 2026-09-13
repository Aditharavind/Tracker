"""Build the two zombie-plant animation frames from frontend/assets/zombie_plant.png.

Usage: python scripts/pack-zombie-plant.py

The source is a single mouth-open pose on a solid black backdrop, so this
(a) keys the backdrop out to alpha, (b) synthesizes a mouth-CLOSED frame by
flat-filling the mouth cavity/teeth/lip region with the plant's own head
tones (a smudgy photo-inpaint doesn't read as pixel art -- a flat fill plus a
few scab blotches does), and (c) crops + downscales both frames identically
so they land pixel-for-pixel aligned and can be crossfaded in CSS.

Outputs public/assets/zombie-plant-open.webp and zombie-plant-closed.webp for
the animated DOM sprite (ZombiePlant.tsx), and overwrites the original
public/assets/zombie-plant.webp (the open pose) so the two canvas call sites
that still draw a single static frame (PandaRunner.tsx, game/adventure/
render.ts) pick up the new art with no code change.
"""
from pathlib import Path
from PIL import Image
import numpy as np
import cv2

root = Path(__file__).resolve().parents[1]
source = root / 'frontend/assets/zombie_plant.png'
out = root / 'public/assets'

OUT_WIDTH = 300  # native size of the exported sprite; CSS scales it down further


def keyed(rgb: np.ndarray) -> np.ndarray:
    """RGB array -> RGBA with the near-black backdrop keyed to transparent."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    bg = (r < 18) & (g < 18) & (b < 18)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    return np.dstack([rgb, alpha])


def closed_mouth_fill(rgb: np.ndarray) -> np.ndarray:
    """Return a copy of rgb with the open mouth flat-filled into a shut one."""
    r, g, b = rgb[..., 0].astype(int), rgb[..., 1].astype(int), rgb[..., 2].astype(int)
    h, w = r.shape

    region = np.zeros((h, w), bool)
    region[370:740, 500:1120] = True
    # The mouth's own cavity colour (~20-26) sits right at the edge of the
    # near-black backdrop (<18) -- `dark_cavity`'s wider net catches the real
    # backdrop pixels inside this bounding box too, so exclude those or the
    # fill paints a solid rectangle past the creature's actual silhouette.
    backdrop = (r < 18) & (g < 18) & (b < 18)
    dark_cavity = (r < 70) & (g < 45) & (b < 45) & ~backdrop
    teeth = (r > 190) & (g > 170) & (b > 140)
    lip = (r > 110) & (r < 210) & (g < 80) & (b < 80)
    drip = (g > 90) & (g < 170) & (r < 90) & (b < 70)
    mouth = region & (dark_cavity | teeth | lip | drip)

    # The eye sits just above the mouth wedge and shares the teeth's cream
    # tone, so it would otherwise get caught by the `teeth` threshold -- carve
    # out its bounding box (with margin for its dark ring) before masking.
    mouth[150:430, 680:1000] = False

    # The colour thresholds above only catch each part of the mouth (cavity,
    # teeth, lip, drips) -- the anti-aliased pixels between them are left as a
    # speckled boundary. Filling the convex hull instead of the raw mask gives
    # one solid wedge, which is what a flat "closed mouth" patch needs to look
    # clean rather than noisy.
    ys0, xs0 = np.nonzero(mouth)
    hull = cv2.convexHull(np.stack([xs0, ys0], axis=1))
    mouth = np.zeros((h, w), np.uint8)
    cv2.fillConvexPoly(mouth, hull, 255)
    mouth = mouth > 0
    # A hull can bulge past the creature's silhouette at concave spots (e.g.
    # between two drips) -- clip back to real content so the fill never paints
    # into what should stay transparent.
    mouth &= ~backdrop
    # The open mouth's thin dripping fangs poke past the jaw's true outline,
    # so clipping to content alone leaves jagged notches where each drip used
    # to be. A closed mouth shouldn't have dangling drips anyway -- a
    # morphological close bridges those notches into one smooth jaw edge
    # without growing the shape into the surrounding background.
    mouth = (
        cv2.morphologyEx((mouth * 255).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
        > 0
    )

    filled = rgb.copy()
    ys, xs = np.nonzero(mouth)
    rng = np.random.default_rng(7)

    # Flat head-green base (two sampled tones, dithered) reads as pixel art;
    # a smooth inpaint would look like a photo smudge instead.
    greens = np.array([[135, 163, 63], [110, 135, 58], [150, 178, 90]])
    filled[ys, xs] = greens[rng.integers(0, len(greens), len(ys))]

    # A handful of the same brown scab blotches the rest of the head has,
    # so the patch doesn't read as an obviously blanked-out rectangle.
    browns = [(101, 51, 33), (84, 46, 32), (63, 33, 22), (108, 53, 34)]
    cy, cx = ys.mean(), xs.mean()
    spany, spanx = ys.max() - ys.min(), xs.max() - xs.min()
    for i in range(9):
        by = int(cy + (rng.random() - 0.5) * spany * 0.8)
        bx = int(cx + (rng.random() - 0.5) * spanx * 0.8)
        bh, bw = rng.integers(10, 26), rng.integers(14, 34)
        y0, y1 = max(0, by - bh // 2), min(h, by + bh // 2)
        x0, x1 = max(0, bx - bw // 2), min(w, bx + bw // 2)
        local = mouth[y0:y1, x0:x1]
        if local.any():
            filled[y0:y1, x0:x1][local] = browns[i % len(browns)]

    # A thin closed-lip seam so the shut mouth reads as a mouth, not a blank
    # patch -- a short soft arc through the middle of the wedge, drawn as an
    # anti-aliased polyline rather than stamped blocks so it reads as one
    # curve instead of a scratch of dots.
    seam_color = (74, 22, 22)
    mx0, mx1 = xs.min(), xs.max()
    my0, my1 = ys.min(), ys.max()
    t = np.linspace(0.18, 0.75, 24)
    seam_x = mx0 + t * (mx1 - mx0)
    seam_y = my0 + (my1 - my0) * (0.22 + 0.4 * t + 0.12 * np.sin(t * np.pi))
    seam_pts = np.stack([seam_x, seam_y], axis=1).astype(np.int32).reshape(-1, 1, 2)
    cv2.polylines(filled, [seam_pts], False, seam_color, thickness=4, lineType=cv2.LINE_AA)

    return filled


def downscale_rgba(rgba: np.ndarray, width: int) -> Image.Image:
    """Premultiplied-alpha BOX downscale -- keeps the transparent edge from
    bleeding black into the art, same treatment as the grass tiles."""
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
    ys, xs = np.nonzero(~bg)
    pad = 12
    box = (
        max(0, xs.min() - pad),
        max(0, ys.min() - pad),
        min(rgb.shape[1], xs.max() + pad),
        min(rgb.shape[0], ys.max() + pad),
    )

    open_rgba = keyed(rgb)[box[1] : box[3], box[0] : box[2]]
    closed_rgba = keyed(closed_mouth_fill(rgb))[box[1] : box[3], box[0] : box[2]]

    out.mkdir(parents=True, exist_ok=True)
    names = [('zombie-plant-open', open_rgba), ('zombie-plant-closed', closed_rgba), ('zombie-plant', open_rgba)]
    for name, rgba in names:
        img = downscale_rgba(rgba, OUT_WIDTH)
        img.save(out / f'{name}.webp', format='WEBP', lossless=True, method=6)
        print(f'{name}.webp {img.width}x{img.height}')


if __name__ == '__main__':
    main()
