"""Render independent icon concepts without changing the installed assets."""
from pathlib import Path
import re
import cairosvg

HERE = Path(__file__).resolve().parent
concepts = [('01-relay', '01 / RELAY', 'Conversation turns'),
            ('02-parallel', '02 / PARALLEL', 'Two languages, side by side'),
            ('03-inkfold', '03 / INKFOLD', 'Read, compose, express')]
parts = ['''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700">
<rect width="1200" height="700" fill="#F4F3F0"/>
<text x="48" y="55" font-family="sans-serif" font-size="25" font-weight="bold" fill="#202B3B">Slopster</text>
<text x="1152" y="52" text-anchor="end" font-family="sans-serif" font-size="13" fill="#7A8089">THREE DIRECTIONS / ORIGINAL VECTOR STUDIES</text>
''']
for index, (name, title, subtitle) in enumerate(concepts):
    source = (HERE / f'{name}.svg').read_text()
    mark = re.sub(r'^<svg[^>]*>|</svg>\s*$', '', source)
    left = 40 + index * 388
    parts.append(f'<rect x="{left}" y="88" width="368" height="560" rx="20" fill="#FFFFFF"/>')
    parts.append(f'<text x="{left+24}" y="128" font-family="sans-serif" font-size="15" font-weight="bold" fill="#202B3B">{title}</text>')
    parts.append(f'<text x="{left+24}" y="155" font-family="sans-serif" font-size="13" fill="#7A8089">{subtitle}</text>')
    parts.append(f'<svg x="{left+88}" y="192" width="192" height="192" viewBox="0 0 128 128">{mark}</svg>')
    for top, background, label in [(430, '#F5F6F8', '#7A8089'), (528, '#171F2B', '#A9B5C5')]:
        parts.append(f'<rect x="{left+20}" y="{top}" width="328" height="88" rx="12" fill="{background}"/>')
        for offset, size in [(64,16),(156,32),(264,48)]:
            parts.append(f'<svg x="{left+offset-size/2}" y="{top+31-size/2}" width="{size}" height="{size}" viewBox="0 0 128 128">{mark}</svg>')
            parts.append(f'<text x="{left+offset}" y="{top+76}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="{label}">{size} px</text>')
    cairosvg.svg2png(bytestring=source.encode(), write_to=str(HERE/f'{name}.png'), output_width=512, output_height=512)
parts.append('</svg>')
cairosvg.svg2png(bytestring=''.join(parts).encode(), write_to=str(HERE/'comparison.png'))
