"""Render palette studies without changing the extension's selected icon."""
from pathlib import Path
import re
import cairosvg

HERE = Path(__file__).resolve().parent
SOURCE = (HERE / '00-current.svg').read_text()
PALETTES = [
    ('01-red-white', '01 / RED + WHITE', '#EF3F43', '#FFFFFF'),
    ('02-coral-ivory', '02 / CORAL + IVORY', '#F2674B', '#FFF7EB'),
    ('03-wine-blush', '03 / WINE + BLUSH', '#A52C43', '#FFF1F3'),
    ('00-current', 'CURRENT / RED + BLACK', '#F04444', '#17191E'),
]
parts = ['''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="820" viewBox="0 0 1200 820">
<rect width="1200" height="820" fill="#F3F2EF"/>
<text x="40" y="50" font-family="sans-serif" font-size="25" font-weight="bold" fill="#202B3B">Slopster / Color studies</text>
<text x="1160" y="48" text-anchor="end" font-family="sans-serif" font-size="13" fill="#767D88">SAME MARK / FOUR PALETTES</text>
''']
for index, (name, label, bg, fg) in enumerate(PALETTES):
    svg = SOURCE.replace('#F04444', bg).replace('#17191E', fg)
    (HERE / f'{name}.svg').write_text(svg)
    cairosvg.svg2png(bytestring=svg.encode(), write_to=str(HERE/f'{name}.png'), output_width=512, output_height=512)
    mark = re.sub(r'^<svg[^>]*>|</svg>\s*$', '', svg)
    left = 32 + (index % 2) * 588
    top = 80 + (index // 2) * 358
    parts.append(f'<rect x="{left}" y="{top}" width="568" height="338" rx="18" fill="#FFFFFF"/>')
    parts.append(f'<text x="{left+24}" y="{top+36}" font-family="sans-serif" font-size="15" font-weight="bold" fill="#202B3B">{label}</text>')
    parts.append(f'<svg x="{left+26}" y="{top+78}" width="192" height="192" viewBox="0 0 128 128">{mark}</svg>')
    parts.append(f'<text x="{left+122}" y="{top+305}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#767D88">{bg} / {fg}</text>')
    for offset, surface, text_color in [(72, '#F3F4F6', '#767D88'), (194, '#202530', '#ABB5C4')]:
        parts.append(f'<rect x="{left+248}" y="{top+offset}" width="296" height="104" rx="10" fill="{surface}"/>')
        for pos, size in [(296,16),(390,32),(492,48)]:
            parts.append(f'<svg x="{left+pos-size/2}" y="{top+offset+38-size/2}" width="{size}" height="{size}" viewBox="0 0 128 128">{mark}</svg>')
            parts.append(f'<text x="{left+pos}" y="{top+offset+86}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="{text_color}">{size} px</text>')
parts.append('</svg>')
cairosvg.svg2png(bytestring=''.join(parts).encode(), write_to=str(HERE/'comparison.png'))
