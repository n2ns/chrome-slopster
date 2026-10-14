"""Render the source SVG and a light/dark size preview with CairoSVG."""
from pathlib import Path
import re

import cairosvg

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "design/icon.svg").read_text()
for size in (16, 32, 48, 128):
    cairosvg.svg2png(bytestring=SOURCE.encode(), write_to=str(ROOT / f"public/icon/{size}.png"),
                    output_width=size, output_height=size)

mark = re.sub(r"<title.*?</title>", "", SOURCE, flags=re.S)
mark = re.sub(r"^<svg[^>]*>|</svg>\s*$", "", mark)
parts = [f'''<svg xmlns="http://www.w3.org/2000/svg" width="960" height="560" viewBox="0 0 960 560">
<rect width="960" height="560" fill="#F5F3EF"/>
<text x="48" y="60" font-family="sans-serif" font-size="24" font-weight="bold" fill="#232A34">Slopster</text>
<text x="912" y="58" text-anchor="end" font-family="sans-serif" font-size="13" fill="#707784">ICON / PARALLEL</text>
<svg x="80" y="130" width="280" height="280" viewBox="0 0 128 128">{mark}</svg>
<text x="220" y="474" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#707784">RED #F04444 · BLACK #17191E</text>
<rect x="440" y="100" width="472" height="192" rx="16" fill="#FFFFFF"/>
<rect x="440" y="308" width="472" height="192" rx="16" fill="#202530"/>
''']
for top, color in ((100, "#707784"), (308, "#AEB7C5")):
    for center, size in ((486, 16), (562, 32), (650, 48), (802, 128)):
        parts.append(f'<svg x="{center-size/2}" y="{top+82-size/2}" width="{size}" height="{size}" viewBox="0 0 128 128">{mark}</svg>')
        parts.append(f'<text x="{center}" y="{top+169}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="{color}">{size} px</text>')
parts.append('</svg>')
cairosvg.svg2png(bytestring=''.join(parts).encode(), write_to=str(ROOT / "design/icon-preview.png"))
