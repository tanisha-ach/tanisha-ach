# Beanie Designer

A browser studio for designing colorwork beanies. Paint a stranded-colorwork chart (or convert a picture into one), pick a hat style and size, and watch a 3D knitted hat update live. Export the chart as a PNG and get a written pattern with cast-on, rounds and crown shaping.

## Run it

```bash
cd beanie-designer
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

## Features

- **Chart editor**: click or drag to paint with up to 6 colours (MC, CC1…), plus fill, eyedropper, mirror painting, shifting, flipping and undo/redo. Shortcuts: `B` paint, `G` fill, `I` pick, `M` mirror, `1–6` colours, `Ctrl+Z` / `Ctrl+Shift+Z` undo/redo. Designs are saved in `localStorage`.
- **Chart from a picture**: the image is downsampled to the stitch grid (keeping the true stitch aspect ratio) and reduced to 2–6 colours, using a luminance threshold for 2 colours or k-means clustering for more.
- **Hat setup**: style, size (Baby → Adult L), gauge, and whether the motif repeats around the hat (optionally up the body too) or appears once on the front. The app suggests repeat widths that fit the chosen size.
- **3D preview** (three.js / react-three-fiber): knit-stitch textures built from the chart, ribbing (or a rolled edge, hemmed cuff or folded cuff), crown shaping lines matching each style's decreases, optional pom-pom, and orbit controls.
- **Exports**: a chart PNG with numbered rows and columns, a key and a crown-section diagram, and the written pattern as text or copied to the clipboard.

## Hat styles

Each style follows a Purl Soho pattern. The proportions live in [`src/config/hatTypes.ts`](src/config/hatTypes.ts) and the crown schemes in [`src/lib/crown.ts`](src/lib/crown.ts).

| Style | Source | Brim | Crown |
| --- | --- | --- | --- |
| Plain hat with rib | [Hat In The Round](https://www.purlsoho.com/create/2015/07/06/learn-to-knit-a-hat-in-the-round-kit/) | k2, p2 rib | 8 wedges, k2tog (assumed — see below) |
| Plain hat, no rib | [Essential Hat](https://www.purlsoho.com/create/2019/09/20/essential-hat-mitten-and-hand-warmer-set/) | rolled stockinette edge | top-down, 6 increases every 2nd (then 3rd) round |
| Short hat with rib | [Classic Hat in Wigeon](https://www.purlsoho.com/create/2024/02/05/classic-hat-mittens-in-wigeon/) | k2, slip 1 rib, hemmed double cuff | 5 sections, paired ssk/k2tog every 3rd then 2nd round |
| Hat with cuff | [Giving Hat](https://www.purlsoho.com/create/2025/12/06/giving-hat/) | p2, k2 rib, folded up | 4 sections, paired ssk/k2tog every other round |

Proportions are stored in inches per size, so they scale to any gauge. With each pattern's own gauge, the stitch counts match the three free patterns (for example, Giving Hat 60/68/76/84/92 and Wigeon 120/135/144/156). Hat In The Round's full instructions are a paid booklet, so only its sizes, gauge and rib come from the source. Its rib depth, height and crown are standard proportions. Sizes a pattern doesn't include are interpolated, and the app flags them.

To add a style, add an entry to `HAT_TYPES`. If it needs a new decrease scheme, add a crown kind to `lib/crown.ts`.
