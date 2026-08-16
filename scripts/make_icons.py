"""Generate the PWA icons. Deterministic -- no browser rasterising involved.

    python3 scripts/make_icons.py

Re-run whenever the mark changes.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BG = (11, 11, 12, 255)
FG = (232, 115, 74, 255)
ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/liberation2/LiberationMono-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def font_path() -> str:
    for p in FONT_CANDIDATES:
        if Path(p).exists():
            return p
    raise SystemExit("no bold font found; install fonts-liberation or fonts-dejavu")


def icon(size: int, scale: float) -> Image.Image:
    """`scale` is the mark's height as a fraction of the canvas. Maskable icons
    use a smaller one so the mark survives Android's circular crop."""
    img = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(font_path(), int(size * scale))
    # anchor="mm" centres on the glyph's own ink box, which is what you want
    # for a two-digit mark -- padding differs per font otherwise.
    draw.text((size / 2, size / 2), "75", font=font, fill=FG, anchor="mm")
    return img


TARGETS = [
    ("icon-192.png", 192, 0.55),
    ("icon-512.png", 512, 0.55),
    ("icon-maskable-512.png", 512, 0.38),
    ("apple-touch-icon.png", 180, 0.55),
]

PUBLIC.mkdir(exist_ok=True)
for name, size, scale in TARGETS:
    icon(size, scale).save(PUBLIC / name)
    print("wrote", name)

(PUBLIC / "favicon.svg").write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">'
    '<rect width="64" height="64" rx="10" fill="#0b0b0c"/>'
    '<text x="32" y="32" dy="0.35em" text-anchor="middle" fill="#e8734a" '
    'font-family="ui-monospace,Menlo,monospace" font-weight="700" font-size="30">75</text>'
    "</svg>\n"
)
print("wrote favicon.svg")
