"""Regenerate public/social/*.png with Pillow and fontTools after npm install."""

from io import BytesIO
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "node_modules/@fontsource/ibm-plex-mono/files"
OUT = ROOT / "public/social"
PAPER, INK, RULE = "#1b1a17", "#e8e3d4", "#45413a"


def load_font(subset, size):
    font = TTFont(FONT_DIR / f"ibm-plex-mono-{subset}-600-normal.woff")
    chars = set(font.getBestCmap())
    font.flavor = None
    data = BytesIO()
    font.save(data)
    data.seek(0)
    return ImageFont.truetype(data, size), chars


def text(draw, xy, value, size, fill=INK):
    latin, _ = load_font("latin", size)
    cyrillic, chars = load_font("cyrillic", size)
    x, y = xy
    x -= sum((cyrillic if ord(char) in chars else latin).getlength(char) for char in value) / 2
    for char in value:
        font = cyrillic if ord(char) in chars else latin
        draw.text((x, y + size), char, font=font, fill=fill, anchor="ls")
        x += font.getlength(char)


CARDS = [
    (
        "paperclips", "Скрепкус",
        ["Инкрементальная игра «Скрепкус»", "по мотивам Universal Paperclips", "Фрэнка Лантца"],
    ),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for slug, title, description in CARDS:
        image = Image.new("RGB", (1200, 630), PAPER)
        draw = ImageDraw.Draw(image)
        draw.rectangle((24, 24, 1175, 605), outline=RULE, width=2)
        text(draw, (600, 155), title, 88)
        for row, line in enumerate(description):
            text(draw, (600, 325 + row * 46), line, 32)
        image.save(OUT / f"{slug}.png", optimize=True)


if __name__ == "__main__":
    main()
