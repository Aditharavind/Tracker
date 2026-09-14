from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "assets" / "characters"
CHARACTERS = {
    "panda": ROOT / "public" / "assets" / "panda-sprite.webp",
    "koala": ROOT / "public" / "assets" / "koala-sprite.webp",
    "redpanda": ROOT / "public" / "assets" / "redpanda-sprite.webp",
}

SIZE = 256
LEG_TOP = round(SIZE * 0.79)
LEG_RECTS = {
    "left": (round(SIZE * 0.31), LEG_TOP, round(SIZE * 0.51), SIZE),
    "right": (round(SIZE * 0.49), LEG_TOP, round(SIZE * 0.69), SIZE),
}
RUN_FRAMES = [
    (18, -18, 1.1, 0),
    (9, -9, 1.04, -1),
    (-16, 16, 1.08, 0),
    (-18, 18, 1.12, 1),
    (-8, 8, 1.04, -1),
    (16, -16, 1.08, 0),
]


def rotated_leg(src: Image.Image, rect: tuple[int, int, int, int], angle: int, stretch: float) -> Image.Image:
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    leg = src.crop(rect)
    leg_w, leg_h = leg.size
    stretched_h = min(SIZE - rect[1] + 6, round(leg_h * stretch))
    leg = leg.resize((leg_w, stretched_h), Image.Resampling.NEAREST)
    # Pull stretched feet slightly upward so the whole paw remains inside the
    # 256px frame while still reading longer during the stride extension.
    y = max(0, rect[1] - max(0, stretched_h - leg_h))
    layer.alpha_composite(leg, (rect[0], y))
    pivot = ((rect[0] + rect[2]) / 2, rect[1])
    return layer.rotate(angle, resample=Image.Resampling.NEAREST, center=pivot)


def build_sheet(src_path: Path, dest: Path) -> None:
    src = Image.open(src_path).convert("RGBA").resize((SIZE, SIZE), Image.Resampling.NEAREST)

    sheet = Image.new("RGBA", (SIZE * len(RUN_FRAMES), SIZE), (0, 0, 0, 0))
    for i, (left_angle, right_angle, stretch, lift) in enumerate(RUN_FRAMES):
        frame = src.copy()
        frame.alpha_composite(rotated_leg(src, LEG_RECTS["left"], left_angle, stretch))
        frame.alpha_composite(rotated_leg(src, LEG_RECTS["right"], right_angle, stretch))
        if lift:
            grounded = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
            grounded.alpha_composite(frame, (0, lift))
            frame = grounded
        sheet.alpha_composite(frame, (i * SIZE, 0))

    dest.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(dest, "WEBP", lossless=True, exact=True, method=6)


def main() -> None:
    for character, src in CHARACTERS.items():
        dest = OUT_DIR / f"{character}-run-sheet.webp"
        build_sheet(src, dest)
        print(f"wrote {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
