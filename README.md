# 30 Days of Building

One small project a day for 30 days, designed and built with AI. Each day lives in its own `day-NN-name/` folder and is published to GitHub Pages.

**Live site:** https://tanisha-ach.github.io/30-days-of-building/

| Day | Project | What it is |
| --- | --- | --- |
| 01 | [Beanie Designer](day-01-beanie-designer) · [live](https://tanisha-ach.github.io/30-days-of-building/day-01-beanie-designer/) | Colorwork beanie studio: paint a stitch chart or turn a picture into one, preview it on a live 3D knitted hat, and export the chart and a written pattern based on Purl Soho hat patterns. |

## Adding a day

1. Create `day-NN-name/` with its own `package.json` and a `build` script that outputs to `dist/` (static projects without a `package.json` are copied as they are).
2. Add a row to the table above and a card to [`index.html`](index.html).
3. Push to `main`. The [deploy workflow](.github/workflows/deploy.yml) builds every day and publishes the whole site.
