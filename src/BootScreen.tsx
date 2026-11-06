import { useEffect, useLayoutEffect, useRef } from 'react';

/** Intro (power-on, spin, title) before the exit starts. */
export const BOOT_MS = 2680;
/** De-res: resolution halves continuously until the whole screen is one averaged color. */
export const PIXELATE_MS = 1000;
/** Crossfade from that solid color into the activity. */
export const FADE_MS = 500;

export type BootPhase = 'boot' | 'pixelate' | 'fade';

const Q_PATH =
  'M12.586 3.019a9.1 9.1 0 0 0-3.69.528A9 9 0 0 0 5.74 5.512a8.9 8.9 0 0 0-2.083 3.065 8.9 8.9 0 0 0-.652 3.638c.152 4.681 4.004 8.487 8.724 8.623a9 9 0 0 0 4.449-1.011.25.25 0 0 1 .257.014q.393.258.816.464a7.1 7.1 0 0 0 3.136.695.25.25 0 0 0 .234-.154.3.3 0 0 0 .02-.095v-3.029a.245.245 0 0 0-.208-.244 3.5 3.5 0 0 1-.842-.24.25.25 0 0 1-.146-.263.3.3 0 0 1 .039-.1 8.83 8.83 0 0 0 1.502-5.438c-.242-4.488-3.876-8.133-8.4-8.418M6.55 11.922c0-1.068.32-2.113.918-3.001a5.44 5.44 0 0 1 2.446-1.99 5.5 5.5 0 0 1 3.148-.307 5.46 5.46 0 0 1 2.79 1.478 5.4 5.4 0 0 1 1.491 2.766 5.36 5.36 0 0 1-.31 3.122 5.4 5.4 0 0 1-2.007 2.425 5.48 5.48 0 0 1-6.88-.672 5.38 5.38 0 0 1-1.596-3.82';

/** Extrusion depth layers (back → front) to fake a 3D slab while spinning on Y. */
const DEPTH = 7;

function QLogo({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
      <path d={Q_PATH} />
    </svg>
  );
}

/**
 * ~2.7s retro console boot: CRT power-on, Q logo spinning on the Y axis,
 * scanlines / noise / vignette / rolling bar. Exit: the current frame is redrawn
 * to a canvas, de-res'd to a single color, then faded out over the activity.
 * Click or any key skips the intro (not the exit).
 */
export function BootScreen({ phase, onSkip }: { phase: BootPhase; onSkip: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (phase !== 'boot') return;
    const onKey = () => onSkip();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onSkip]);

  const exiting = phase !== 'boot';

  // Snapshot before paint so the DOM → canvas handoff is seamless.
  useLayoutEffect(() => {
    if (!exiting) return;
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const snapshot = drawBootFrame(root);
    if (!snapshot) return;
    const mips = buildMips(snapshot);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = reduced ? 0 : Math.min(1, (now - start) / PIXELATE_MS);
      renderDeres(canvas, mips, t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    tick(start);
    return () => cancelAnimationFrame(raf);
    // Run once when the exit begins; 'pixelate' → 'fade' must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exiting]);

  return (
    <div
      ref={rootRef}
      className={`boot${exiting ? ' boot-exit' : ''}${phase === 'fade' ? ' boot-fade' : ''}`}
      style={{ '--boot-fade-ms': `${FADE_MS}ms` } as React.CSSProperties}
      onPointerDown={phase === 'boot' ? onSkip : undefined}
      role="img"
      aria-label="Quizlet loading"
    >
      <div className="boot-tube">
        <div className="boot-stage">
          <div className="boot-spinner">
            {Array.from({ length: DEPTH }, (_, i) => (
              <QLogo
                key={i}
                className="boot-q boot-q-depth"
                style={{ transform: `translateZ(${(i - DEPTH) * 1.2}px)` }}
              />
            ))}
            <QLogo className="boot-q boot-q-face" />
          </div>
        </div>
        <div className="boot-title">Quizlet</div>
      </div>
      <div className="crt crt-noise" />
      <div className="crt crt-scanlines" />
      <div className="crt crt-roll" />
      <div className="crt crt-vignette" />
      <canvas ref={canvasRef} className="boot-canvas" />
    </div>
  );
}

/* ---------- DOM → canvas snapshot ---------- */

const css = (el: Element) => getComputedStyle(el);

/** Parse `matrix(...)` / `matrix3d(...)` → [scaleX (signed, includes Y-rotation), scaleY]. */
function transformScale(transform: string): [number, number] {
  const m = /matrix(3d)?\(([^)]+)\)/.exec(transform);
  if (!m) return [1, 1];
  const v = m[2].split(',').map(Number);
  return m[1] ? [v[0], v[5]] : [v[0], v[3]];
}

/** Visible width fraction of an element clipped by `inset(t r b l)` (type-in effect). */
function clipRightPx(clipPath: string, width: number): number {
  const m = /inset\(([^)]+)\)/.exec(clipPath);
  if (!m) return 0;
  const parts = m[1].trim().split(/\s+/);
  const right = parts[1] ?? parts[0];
  return right.endsWith('%') ? (parseFloat(right) / 100) * width : parseFloat(right) || 0;
}

/** Redraws the boot screen's current look (tube, logo, title, scanlines, vignette) to a canvas. */
function drawBootFrame(root: HTMLElement): HTMLCanvasElement | null {
  const W = root.clientWidth;
  const H = root.clientHeight;
  if (!W || !H) return null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);
  const vmin = Math.min(W, H) / 100;
  const origin = root.getBoundingClientRect();

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Tube: rounded rect + elliptical radial gradient (matches `.boot-tube`).
  const tube = root.querySelector('.boot-tube');
  if (tube) {
    const r = tube.getBoundingClientRect();
    const x = r.left - origin.left;
    const y = r.top - origin.top;
    if (r.width > 0 && r.height > 0) {
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, r.width, r.height, [{ x: 4 * vmin, y: 3 * vmin }]);
      else ctx.rect(x, y, r.width, r.height);
      ctx.clip();
      const rx = (r.width / 2) * Math.SQRT2;
      const ry = (r.height / 2) * Math.SQRT2;
      ctx.translate(x + r.width / 2, y + r.height / 2);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, '#15134a');
      g.addColorStop(0.55, '#0a092d');
      g.addColorStop(1, '#03020f');
      ctx.fillStyle = g;
      ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
      ctx.restore();
    }
  }

  // Logo: face with chromatic offsets + glow (matches `.boot-stage` drop-shadows).
  const spinner = root.querySelector<HTMLElement>('.boot-spinner');
  if (spinner) {
    const r = spinner.getBoundingClientRect();
    const size = spinner.offsetWidth;
    const st = css(spinner);
    const [sx, sy] = transformScale(st.transform);
    const opacity = parseFloat(st.opacity) || 0;
    const cx = r.left - origin.left + r.width / 2;
    const cy = r.top - origin.top + r.height / 2;
    const path = new Path2D(Q_PATH);
    const shadows: [string, number, number][] = [
      ['rgba(66, 85, 255, 0.75)', 0, 3 * vmin],
      ['rgba(255, 40, 90, 0.55)', -0.5 * vmin, 0],
      ['rgba(40, 230, 255, 0.5)', 0.5 * vmin, 0],
      ['transparent', 0, 0],
    ];
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(cx, cy);
    ctx.scale((sx * size) / 24, (sy * size) / 24);
    ctx.translate(-12, -12);
    ctx.fillStyle = '#4255FF';
    for (const [color, dx, blur] of shadows) {
      ctx.shadowColor = color;
      ctx.shadowOffsetX = dx * dpr; // shadow params ignore the transform: bitmap px
      ctx.shadowBlur = blur * dpr;
      ctx.fill(path);
    }
    ctx.restore();
  }

  // Title: typed-in portion only.
  const title = root.querySelector<HTMLElement>('.boot-title');
  if (title) {
    const r = title.getBoundingClientRect();
    const st = css(title);
    const x = r.left - origin.left;
    const y = r.top - origin.top;
    const visibleW = r.width - clipRightPx(st.clipPath, r.width);
    if (visibleW > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, visibleW, r.height);
      ctx.clip();
      ctx.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      const ls = parseFloat(st.letterSpacing);
      if ('letterSpacing' in ctx && ls) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${ls}px`;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#F6F7FB';
      const shadows: [string, number, number][] = [
        ['rgba(66, 85, 255, 0.9)', 0, 2 * vmin],
        ['rgba(255, 40, 90, 0.7)', -0.4 * vmin, 0],
        ['rgba(40, 230, 255, 0.7)', 0.4 * vmin, 0],
        ['transparent', 0, 0],
      ];
      for (const [color, dx, blur] of shadows) {
        ctx.shadowColor = color;
        ctx.shadowOffsetX = dx * dpr;
        ctx.shadowBlur = blur * dpr;
        ctx.fillText(title.textContent ?? '', x, y + r.height / 2);
      }
      ctx.restore();
    }
  }

  // Scanlines + vignette (noise/roll omitted: they average out within the first steps).
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  ctx.save();
  const rx = (W / 2) * Math.SQRT2;
  ctx.translate(W / 2, H / 2);
  ctx.scale(1, H / W);
  const v = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  v.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
  v.addColorStop(0.85, 'rgba(0, 0, 0, 0.55)');
  v.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
  ctx.fillStyle = v;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();

  return c;
}

/* ---------- de-res ---------- */

/** Mip chain: each level halves the previous with smoothing (2×2 box average) down to 1×1. */
function buildMips(src: HTMLCanvasElement): HTMLCanvasElement[] {
  const mips = [src];
  let prev = src;
  while (prev.width > 1 || prev.height > 1) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(prev.width / 2));
    c.height = Math.max(1, Math.ceil(prev.height / 2));
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(prev, 0, 0, c.width, c.height);
    mips.push(c);
    prev = c;
  }
  return mips;
}

/**
 * t=0: full resolution. t=1: 1×1 (one averaged color). Block size grows exponentially,
 * so each halving of resolution gets equal time. The canvas is set to the low resolution
 * and upscaled by CSS with `image-rendering: pixelated` for hard-edged blocks.
 */
function renderDeres(canvas: HTMLCanvasElement, mips: HTMLCanvasElement[], t: number) {
  const full = mips[0];
  const levels = mips.length - 1;
  const k = t * levels;
  const w = Math.max(1, Math.round(full.width / 2 ** k));
  const h = Math.max(1, Math.round(full.height / 2 ** k));
  const src = mips[Math.min(levels, Math.floor(k))];
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
}
