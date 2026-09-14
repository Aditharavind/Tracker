"""Split frontend/assets/zombie_plant.png into a fixed head layer and a
hinge-rotatable lower-jaw layer, for a real open/close mouth animation
instead of the old flat green shutter.

Usage: python scripts/pack-zombie-plant-jaw.py

The source has one painted frame (mouth wide open). This crops out the
lower jaw (bottom teeth, lower lip rim, chin, drips) as its own layer and
blanks that same region in the head layer, so the two stack back into the
original open-mouth art at 0deg rotation. CSS then rotates the jaw layer a
few degrees around the mouth's back-left corner (the true hinge point) to
swing the front of the jaw up and close the mouth, while the hinge corner
itself barely moves -- "stuck at one end, closing at the other," per the
brief.

Both layers share one canvas (the same padded content bbox
pack-zombie-plant.py crops to) so a single hinge point, expressed as a
canvas-relative percentage, lines up for both the head and the jaw --
no per-layer offset math needed in CSS, just position:absolute; inset:0
on both and transform-origin: <hx>% <hy>% on the jaw.

The crop box and hinge point were measured by eye once against a
coordinate grid overlaid on the source (the source art is static, so this
doesn't need runtime detection); the rotation angle used by the CSS
animation was picked by rendering a sweep of angles and eyeballing which
one closes the gap without the far (non-hinge) end of the jaw visibly
detaching from the head -- see PR discussion. PIL's rotate() is
counter-clockwise-positive; CSS's rotate() is clockwise-positive, so a
PIL-positive test angle here is a CSS-negative angle in styles.css.

Outputs public/assets/zombie-plant-head.webp and
public/assets/zombie-plant-jaw.webp, and prints the hinge's canvas-relative
percentage for styles.css's transform-origin.
"""
from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage

root = Path(__file__).resolve().parents[1]
source = root / 'frontend/assets/zombie_plant.png'
out = root / 'public/assets'

OUT_WIDTH = 300  # matches pack-zombie-plant.py's sprite width

# Lower-jaw region in ORIGINAL image coordinates: just the bottom teeth and
# lower lip rim, not the chin/drips/stem below it (an earlier, taller crop
# down to y=800 dragged a big slab of chin flesh along with the rotation,
# which read as an oversized second jaw rather than a thin lower jaw). Wider
# than that first tight crop (x extended both directions) so the jaw reads
# as a full lower mandible spanning the mouth, not just a thin tooth strip.
JAW_BOX = (525, 495, 1040, 670)

# The mouth's back-left corner, where the upper and lower lip rims meet --
# the true pivot of a real jaw hinge.
HINGE = (598, 445)


def downscale_rgba(rgba: np.ndarray, width: int) -> Image.Image:
    """Premultiplied-alpha BOX downscale -- keeps the transparent edge from
    bleeding black into the art (same technique as pack-zombie-plant.py)."""
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
    cropped = rgba[box[1]:box[3], box[0]:box[2]]
    canvas_h, canvas_w = cropped.shape[:2]

    # Downscale the WHOLE (unsplit) sprite first, then split into head/jaw
    # on the downscaled pixels. Splitting before downscaling would hand the
    # box-filter a hard alpha edge in the middle of otherwise-opaque art
    # (not at the sprite's natural silhouette, which is the only place the
    # premultiplied-alpha trick is meant to handle), and unpremultiplying
    # near-zero alpha there blows up into a visible white fringe along the
    # cut. Splitting after downscaling has no such edge to mishandle -- it's
    # just zeroing already-finished pixels.
    full_img = downscale_rgba(cropped, OUT_WIDTH)
    scale = full_img.width / canvas_w
    full = np.array(full_img)
    out_h, out_w = full.shape[:2]

    jx0, jy0 = round((JAW_BOX[0] - box[0]) * scale), round((JAW_BOX[1] - box[1]) * scale)
    jx1, jy1 = round((JAW_BOX[2] - box[0]) * scale), round((JAW_BOX[3] - box[1]) * scale)
    jaw_mask = np.zeros((out_h, out_w), dtype=bool)
    jaw_mask[jy0:jy1, jx0:jx1] = True

    jaw_layer = full.copy()
    jaw_layer[~jaw_mask] = 0
    head_layer = full.copy()

    # A rotated rigid jaw piece can't stay flush with a straight cut line
    # except right at the pivot, so a sliver of the head's cut-out hole
    # peeks out at the far (non-hinge) end once closed. Leaving that hole
    # fully transparent made the peeking sliver read as a broken black
    # notch (the page background showing through a hard-edged rectangle);
    # an earlier attempt outlined the hole's edge instead, but the outline
    # was baked at the jaw's resting position and stayed fixed there while
    # the jaw rotated away from it, which looked worse. Filling the whole
    # rectangular hole with the mouth's dark throat colour fixed the notch
    # but introduced a new bug: JAW_BOX is a rectangle and the mouth isn't,
    # so most of the box's corners are background outside the character's
    # silhouette, and those got the dark fill too, showing as a big flat
    # slab jutting past the mouth's real edges even at rest.
    #
    # Only fill the part of the hole actually enclosed by the mouth's own
    # painted rim (the throat, the gaps between teeth) -- found the same way
    # as the silhouette itself: flood-fill transparency in from the full
    # canvas border, anything unreached is enclosed.
    transparent = full[..., 3] == 0
    labeled, _ = ndimage.label(transparent)
    border_labels = set(labeled[0, :]) | set(labeled[-1, :]) | set(labeled[:, 0]) | set(labeled[:, -1])
    border_labels.discard(0)
    enclosed = transparent & ~np.isin(labeled, list(border_labels))
    head_layer[jaw_mask & enclosed] = (32, 12, 13, 255)
    head_layer[jaw_mask & ~enclosed] = 0

    hinge_x, hinge_y = HINGE[0] - box[0], HINGE[1] - box[1]
    hinge_pct_x = 100 * hinge_x / canvas_w
    hinge_pct_y = 100 * hinge_y / canvas_h

    out.mkdir(parents=True, exist_ok=True)
    head_img = Image.fromarray(head_layer, 'RGBA')
    jaw_img = Image.fromarray(jaw_layer, 'RGBA')
    head_img.save(out / 'zombie-plant-head.webp', format='WEBP', lossless=True, method=6)
    jaw_img.save(out / 'zombie-plant-jaw.webp', format='WEBP', lossless=True, method=6)
    print(f'zombie-plant-head.webp {head_img.width}x{head_img.height}')
    print(f'zombie-plant-jaw.webp {jaw_img.width}x{jaw_img.height}')
    print(f'hinge: {hinge_pct_x:.2f}% {hinge_pct_y:.2f}%')


if __name__ == '__main__':
    main()
