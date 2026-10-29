"""Trim Geist Variable to the weights, features and tables the app uses.

Run by hand after changing the @fontsource-variable/geist version, the font
weights in src/styles.css, or font-variant settings:

    python3 -m venv /tmp/fontenv && /tmp/fontenv/bin/pip install fonttools brotli
    /tmp/fontenv/bin/python tools/fonts/subset-geist.py

It writes src/assets/fonts/geist.woff2.
"""

from io import BytesIO
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2"
OUT = ROOT / "src/assets/fonts/geist.woff2"

# Lowest weight is `normal`. The top stays at 900 because preflight sets
# `strong { font-weight: bolder }`, and bolder inside 550/600 text resolves to 900.
WEIGHT_RANGE = (400, 900)

# kern, mark, ccmp and locl shape text; liga and tnum are on in the CSS.
FEATURES = ["ccmp", "locl", "kern", "mark", "liga", "tnum"]


def main():
    # Keep the source timestamp so reruns on the same input give identical bytes.
    font = TTFont(SOURCE, recalcTimestamp=False)
    codepoints = set(font.getBestCmap())
    instantiateVariableFont(font, {"wght": WEIGHT_RANGE}, inplace=True)
    # The subsetter fails on the instancer's in-memory gvar, so reload it first.
    buffer = BytesIO()
    font.save(buffer)
    buffer.seek(0)
    font = TTFont(buffer, recalcTimestamp=False)

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = FEATURES
    options.hinting = False
    options.notdef_outline = True
    options.name_IDs = ["*"]
    # Dropping glyph names (post format 3) shifts anti-aliasing in Chrome on macOS.
    options.glyph_names = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    font.save(OUT)

    print(f"{OUT.relative_to(ROOT)}  {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
