import { useEffect, useMemo, useRef, useState } from 'react';
import { loadImage, otsuThreshold, quantize, sampleImage } from '../lib/imageToChart';
import { MAX_COLORS, useDesign } from '../store';
import { useSpec } from '../useSpec';
import { Icon } from './Icon';

export function ImageImport() {
  const s = useDesign();
  const spec = useSpec();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [name, setName] = useState('');
  const [colors, setColors] = useState(2);
  const [threshold, setThreshold] = useState(128);
  const [invert, setInvert] = useState(false);
  const [ownColors, setOwnColors] = useState(false);
  const [width, setWidth] = useState(s.chart.w);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  // Rows are shorter than stitches are wide, so a square photo needs more rows than stitches.
  const height = img
    ? Math.max(2, Math.min(120, Math.round((width / spec.stsPerIn) * (img.naturalHeight / img.naturalWidth) * spec.rowsPerIn)))
    : 0;

  const pixels = useMemo(() => (img ? sampleImage(img, width, height) : null), [img, width, height]);

  const result = useMemo(() => {
    if (!pixels) return null;
    return quantize(pixels, {
      colors,
      threshold,
      mode: colors === 2 ? 'threshold' : 'cluster',
      invert,
      palette: ownColors && colors > 2 ? undefined : s.palette.length >= colors ? s.palette : undefined,
    });
  }, [pixels, colors, threshold, invert, ownColors, s.palette]);

  useEffect(() => {
    const cv = previewRef.current;
    if (!cv || !result) return;
    const cell = Math.max(2, Math.floor(260 / Math.max(width, height)));
    cv.width = width * cell;
    cv.height = height * cell;
    const ctx = cv.getContext('2d')!;
    result.cells.forEach((v, i) => {
      ctx.fillStyle = result.palette[v] ?? '#000';
      ctx.fillRect((i % width) * cell, Math.floor(i / width) * cell, cell, cell);
    });
  }, [result, width, height]);

  const open = async (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const im = await loadImage(file);
    setImg(im);
    setName(file.name);
    setWidth(s.placement === 'repeat' ? s.chart.w : Math.min(spec.bodySts, Math.max(s.chart.w, 24)));
    setThreshold(otsuThreshold(sampleImage(im, 48, 48)));
  };

  const apply = () => {
    if (!result) return;
    const imageColors = colors > 2 && (ownColors || s.palette.length < colors);
    s.replaceChart({ w: width, h: height, cells: result.cells }, imageColors ? result.palette : undefined);
  };

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2>Chart from a picture</h2>
          <p className="muted">Downsampled to stitches and reduced to a few colours.</p>
        </div>
      </header>
      {!img ? (
        <button
          className={`drop ${drag ? 'drag' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            open(e.dataTransfer.files[0]);
          }}
        >
          <Icon name="image" size={26} />
          <span>Drop an image or click to choose</span>
          <small>Bold, high-contrast pictures work best</small>
        </button>
      ) : (
        <div className="import">
          <div className="import-previews">
            <figure>
              <img src={img.src} alt="" />
              <figcaption>{name}</figcaption>
            </figure>
            <figure>
              <canvas ref={previewRef} />
              <figcaption>
                {width} × {height} chart
              </figcaption>
            </figure>
          </div>
          <div className="import-controls">
            <label className="slider">
              <span>
                Width <b>{width} sts</b>
              </span>
              <input
                type="range"
                min={6}
                max={Math.min(80, spec.bodySts)}
                value={width}
                onChange={(e) => setWidth(+e.target.value)}
              />
            </label>
            <label className="slider">
              <span>
                Colours <b>{colors}</b>
              </span>
              <input type="range" min={2} max={MAX_COLORS} value={colors} onChange={(e) => setColors(+e.target.value)} />
            </label>
            {colors === 2 && (
              <label className="slider">
                <span>
                  Threshold <b>{threshold}</b>
                </span>
                <input type="range" min={1} max={254} value={threshold} onChange={(e) => setThreshold(+e.target.value)} />
              </label>
            )}
            <label className="check">
              <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
              Swap light and dark
            </label>
            {colors > 2 && (
              <label className="check">
                <input type="checkbox" checked={ownColors} onChange={(e) => setOwnColors(e.target.checked)} />
                Use the picture's own colours
              </label>
            )}
            <div className="row-actions">
              <button className="btn primary" onClick={apply}>
                <Icon name="sparkle" /> Use as chart
              </button>
              <button className="btn ghost" onClick={() => inputRef.current?.click()}>
                Another image
              </button>
              <button className="btn ghost" onClick={() => setImg(null)}>
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => open(e.target.files?.[0] ?? undefined)} />
    </section>
  );
}
