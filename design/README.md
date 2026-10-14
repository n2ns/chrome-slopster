# Slopster icon

The selected Parallel mark uses two offset language panels and a downward connector. A red (`#F04444`) tile and black (`#17191E`) shapes express side-by-side translation. The SVG uses vector geometry only, with no font or external asset dependency.

- Source: `icon.svg`
- Extension PNGs: `../public/icon/{16,32,48,128}.png`
- Light/dark size preview: `icon-preview.png`

Regenerate from the repository root using Python and CairoSVG (or uv for an isolated dependency):

```bash
uv run --with cairosvg python design/render-icons.py
```

Then run `npm run build` and reload the unpacked extension in `chrome://extensions` to update the toolbar and side-panel icons.
