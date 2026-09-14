from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "assets" / "characters"
CHARACTERS = {
    "panda": ROOT / "public" / "assets" / "panda-sprite.webp",
    "koala": ROOT / "public" / "assets" / "koala-sprite.webp",
    "redpanda": ROOT / "public" / "assets" / "redpanda-sprite.webp",
}

SIZE = 256
RUN_FRAMES = [
    ((94, 180), (145, 235), (154, 180), (105, 235)),
    ((94, 180), (120, 236), (154, 180), (135, 232)),
    ((94, 180), (106, 231), (154, 180), (152, 235)),
    ((94, 180), (105, 235), (154, 180), (145, 235)),
    ((94, 180), (135, 232), (154, 180), (120, 236)),
    ((94, 180), (152, 235), (154, 180), (106, 231)),
]


def sampled_leg_color(src: Image.Image) -> tuple[int, int, int, int]:
    pixels = []
    for y in range(round(SIZE * 0.70), SIZE):
        for x in range(round(SIZE * 0.18), round(SIZE * 0.82)):
            r, g, b, a = src.getpixel((x, y))
            if a > 80 and r + g + b < 360:
                pixels.append((r, g, b))
    if not pixels:
        return (42, 42, 42, 235)
    pixels.sort(key=sum)
    sample = pixels[len(pixels) // 4]
    return (*sample, 235)


def draw_run_pose(src: Image.Image, pose: tuple[tuple[int, int], tuple[int, int], tuple[int, int], tuple[int, int]]) -> Image.Image:
    leg_color = sampled_leg_color(src)
    outline = (18, 18, 18, 210)
    frame = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    legs = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(legs)

    left_hip, left_foot, right_hip, right_foot = pose
    for hip, foot in ((left_hip, left_foot), (right_hip, right_foot)):
        draw.line([hip, foot], fill=outline, width=20)
        draw.line([hip, foot], fill=leg_color, width=14)
        draw.ellipse((foot[0] - 14, foot[1] - 8, foot[0] + 16, foot[1] + 7), fill=outline)
        draw.ellipse((foot[0] - 11, foot[1] - 6, foot[0] + 13, foot[1] + 5), fill=leg_color)

    frame.alpha_composite(legs)
    frame.alpha_composite(src)

    # Repaint the animated feet on top so the stride remains evident after the
    # original body covers the upper legs. The belly stays untouched.
    feet = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(feet)
    for _, foot in ((left_hip, left_foot), (right_hip, right_foot)):
        draw.ellipse((foot[0] - 14, foot[1] - 8, foot[0] + 16, foot[1] + 7), fill=outline)
        draw.ellipse((foot[0] - 11, foot[1] - 6, foot[0] + 13, foot[1] + 5), fill=leg_color)
    frame.alpha_composite(feet)
    return frame


def build_sheet(src_path: Path, dest: Path) -> None:
    src = Image.open(src_path).convert("RGBA").resize((SIZE, SIZE), Image.Resampling.NEAREST)

    sheet = Image.new("RGBA", (SIZE * len(RUN_FRAMES), SIZE), (0, 0, 0, 0))
    for i, pose in enumerate(RUN_FRAMES):
        frame = draw_run_pose(src, pose)
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
