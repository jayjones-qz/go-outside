import { SIGN_W, branchYAt, type Dims, type TreeLayout } from '../layout';
import { int, mulberry32, pick, range } from '../rng';
import { QZ, type DecorKind, type Theme } from '../themes';

type Ctx = CanvasRenderingContext2D;

interface Cloud { x: number; y: number; speed: number; blobs: { dx: number; dy: number; r: number }[] }
interface Flyer { y: number; speed: number; phase: number; amp: number }
interface Decor { kind: DecorKind; x: number; y: number; s: number }

export interface SceneSpec {
  theme: Theme;
  seed: number;
  tree: TreeLayout;
  sun: { x: number; y: number };
  cliff: { x: number; w: number; top: number };
  fall: { x: number; w: number };
  clouds: Cloud[];
  flyers: Flyer[];
  decor: Decor[];
  hillPhases: number[][];
}

export interface StaticLayers {
  sky: HTMLCanvasElement;
  land: HTMLCanvasElement;
  tree: HTMLCanvasElement;
}

// ---------- pixel helpers ----------

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, c: string) {
  ctx.fillStyle = c;
  const RY = Math.max(1, Math.round(ry));
  for (let dy = -RY; dy <= RY; dy++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (RY * RY))));
    ctx.fillRect(Math.round(cx) - hw, Math.round(cy) + dy, hw * 2 + 1, 1);
  }
}

function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, th0: number, th1: number, c: string) {
  ctx.fillStyle = c;
  const steps = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const th = Math.max(1, Math.round(th0 + (th1 - th0) * t));
    ctx.fillRect(Math.round(x0 + (x1 - x0) * t - th / 2), Math.round(y0 + (y1 - y0) * t - th / 2), th, th);
  }
}

const dimsOf = (d: Dims) => ({ W: d.w, H: d.h, GROUND_Y: d.groundY });
/** Theme hill bases are authored against the 480×270 world (ground at 236). */
const BASE_GROUND = 236;

function makeCanvas(d: Dims): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = d.w;
  c.height = d.h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// ---------- scene spec (seeded) ----------

export function buildScene(theme: Theme, seed: number, tree: TreeLayout): SceneSpec {
  const { W, GROUND_Y } = dimsOf(tree.dims);
  const r = mulberry32(seed ^ 0x9e3779b9);
  const side = r() < 0.5 ? -1 : 1;
  const cliffW = 56;
  const cliff = { x: side < 0 ? 0 : W - cliffW, w: cliffW, top: GROUND_Y - int(r, 98, 124) };
  const fall = { x: cliff.x + 20, w: 14 };
  const sun = { x: side < 0 ? range(r, 300, 440) : range(r, 40, 180), y: range(r, 24, 48) };

  const clouds: Cloud[] = Array.from({ length: int(r, 3, 5) }, () => ({
    x: range(r, 0, W),
    y: range(r, 10, Math.min(90, GROUND_Y * 0.35)),
    speed: range(r, 2, 6),
    blobs: Array.from({ length: int(r, 3, 5) }, () => ({ dx: range(r, -16, 16), dy: range(r, -3, 3), r: int(r, 5, 10) })),
  }));

  const flyers: Flyer[] = Array.from({ length: int(r, 3, 5) }, () => ({
    y: range(r, 30, Math.max(40, Math.min(110, GROUND_Y * 0.45))),
    speed: range(r, 14, 28) * (r() < 0.5 ? -1 : 1),
    phase: range(r, 0, W),
    amp: range(r, 2, 6),
  }));

  const pool = fall.x + fall.w / 2;
  const decor: Decor[] = [];
  const count = int(r, 7, 11);
  for (let tries = 0; decor.length < count && tries < 200; tries++) {
    const x = range(r, 10, W - 10);
    if (Math.abs(x - tree.cx) < 28 || Math.abs(x - pool) < 36) continue;
    decor.push({ kind: pick(r, theme.decor), x, y: GROUND_Y + int(r, 3, 26), s: range(r, 0.8, 1.2) });
  }
  decor.sort((a, b) => a.y - b.y);

  const hillPhases = theme.hills.map((h) => h.waves.map(() => range(r, 0, Math.PI * 2)));

  return { theme, seed, tree, sun, cliff, fall, clouds, flyers, decor, hillPhases };
}

// ---------- static layers ----------

export function renderStatic(spec: SceneSpec): StaticLayers {
  return { sky: renderSky(spec), land: renderLand(spec), tree: renderTree(spec) };
}

function renderSky(spec: SceneSpec): HTMLCanvasElement {
  const { W, GROUND_Y } = dimsOf(spec.tree.dims);
  const [c, ctx] = makeCanvas(spec.tree.dims);
  const { theme } = spec;
  const stops = theme.sky.map(hexToRgb);
  const img = ctx.createImageData(W, GROUND_Y);
  for (let y = 0; y < GROUND_Y; y++) {
    const p = (y / (GROUND_Y - 1)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(p));
    const frac = p - i;
    for (let x = 0; x < W; x++) {
      const col = frac > (BAYER[y % 4][x % 4] + 0.5) / 16 ? stops[i + 1] : stops[i];
      const o = (y * W + x) * 4;
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ellipse(ctx, spec.sun.x, spec.sun.y, 13, 13, theme.sun);
  ellipse(ctx, spec.sun.x - 2, spec.sun.y - 2, 7, 7, theme.sunCore);
  return c;
}

function renderLand(spec: SceneSpec): HTMLCanvasElement {
  const { W, H, GROUND_Y } = dimsOf(spec.tree.dims);
  const [c, ctx] = makeCanvas(spec.tree.dims);
  const { theme, cliff, fall } = spec;
  const r = mulberry32(spec.seed ^ 0x51ed27);

  // hills
  theme.hills.forEach((hill, hi) => {
    const phases = spec.hillPhases[hi];
    for (let x = 0; x < W; x++) {
      let h = hill.base - BASE_GROUND + GROUND_Y;
      hill.waves.forEach(([a, f], wi) => (h += a * Math.sin(x * f + phases[wi])));
      h = Math.round(h);
      rect(ctx, x, h, 1, GROUND_Y - h, hill.color);
      if (hill.ridge) rect(ctx, x, h, 1, 1, hill.ridge);
      if (hill.snow && h < hill.base - BASE_GROUND + GROUND_Y - 14) rect(ctx, x, h, 1, 3 + ((x * 13) % 3), QZ.offWhite);
    }
    if (hill.pines) {
      for (let x = int(r, 0, 6); x < W; x += int(r, 4, 9)) {
        let h = hill.base - BASE_GROUND + GROUND_Y;
        hill.waves.forEach(([a, f], wi) => (h += a * Math.sin(x * f + phases[wi])));
        pine(ctx, x, Math.round(h) + 3, int(r, 6, 11), theme.leafDark, theme.leaf);
      }
    }
  });

  // cliff with jagged top + strata
  for (let x = cliff.x; x < cliff.x + cliff.w; x++) {
    const top = cliff.top + ((x * 7) % 5);
    rect(ctx, x, top, 1, GROUND_Y + 2 - top, theme.cliff);
    rect(ctx, x, top, 1, 2, theme.cliffLight);
    rect(ctx, x, top - 2, 1, 2, theme.ground);
  }
  for (let y = cliff.top + 8; y < GROUND_Y; y += 7) {
    for (let x = cliff.x; x < cliff.x + cliff.w; x += int(r, 6, 14)) rect(ctx, x, y, int(r, 3, 8), 1, theme.cliffDark);
  }
  const innerEdge = cliff.x === 0 ? cliff.x + cliff.w - 2 : cliff.x;
  rect(ctx, innerEdge, cliff.top, 2, GROUND_Y - cliff.top, theme.cliffDark);

  // ground
  rect(ctx, 0, GROUND_Y, W, H - GROUND_Y, theme.ground);
  rect(ctx, 0, GROUND_Y, W, 1, theme.groundLight);
  for (let x = 0; x < W; x += 2) rect(ctx, x + ((x / 2) % 2), GROUND_Y + 1, 1, 1, theme.groundLight);
  for (let i = 0; i < 260; i++) {
    rect(ctx, range(r, 0, W), range(r, GROUND_Y + 3, H), 1, 1, r() < 0.5 ? theme.groundDark : theme.groundLight);
  }

  // pool under the waterfall
  const px = fall.x + fall.w / 2;
  ellipse(ctx, px, GROUND_Y + 6, 30, 5, theme.water);
  rect(ctx, px - 18, GROUND_Y + 4, 10, 1, theme.waterLight);
  rect(ctx, px + 6, GROUND_Y + 8, 12, 1, theme.waterLight);

  for (const d of spec.decor) drawDecor(ctx, d, theme);
  return c;
}

function pine(ctx: Ctx, x: number, baseY: number, h: number, dark: string, light: string) {
  for (let i = 0; i < h; i++) {
    const w = Math.round(i * 0.45);
    rect(ctx, x - w, baseY - h + i, w * 2 + 1, 1, dark);
    if (i % 3 === 1) rect(ctx, x - w, baseY - h + i, 1, 1, light);
  }
}

function drawDecor(ctx: Ctx, d: Decor, t: Theme) {
  const { x, y, s } = d;
  switch (d.kind) {
    case 'cactus': {
      const h = Math.round(18 * s);
      rect(ctx, x - 2, y - h, 5, h, t.leaf);
      rect(ctx, x - 1, y - h + 1, 1, h - 2, t.leafLight);
      rect(ctx, x + 2, y - h + 1, 1, h - 1, t.leafDark);
      rect(ctx, x - 6, y - h + 9, 4, 2, t.leaf);
      rect(ctx, x - 6, y - h + 4, 2, 6, t.leaf);
      rect(ctx, x + 3, y - h + 11, 4, 2, t.leaf);
      rect(ctx, x + 5, y - h + 6, 2, 6, t.leafDark);
      break;
    }
    case 'rock':
      ellipse(ctx, x, y - 2, 5 * s, 3, t.cliffDark);
      ellipse(ctx, x - 1, y - 3, 3 * s, 2, t.cliff);
      break;
    case 'tuft':
      rect(ctx, x, y - 3, 1, 3, t.groundDark);
      rect(ctx, x - 2, y - 2, 1, 2, t.groundDark);
      rect(ctx, x + 2, y - 2, 1, 2, t.groundDark);
      break;
    case 'palm': {
      const h = Math.round(26 * s);
      let tx = x;
      for (let i = 0; i < h; i++) {
        tx = x + Math.round(Math.sin((i / h) * 1.4) * 4);
        rect(ctx, tx, y - i, 2, 1, i % 3 ? t.trunk : t.trunkDark);
      }
      const ty = y - h;
      for (const [dx, dy] of [[-10, 3], [-7, -4], [0, -6], [7, -4], [10, 3]]) line(ctx, tx, ty, tx + dx, ty + dy, 2, 1, t.leaf);
      line(ctx, tx, ty, tx - 9, ty + 5, 1, 1, t.leafDark);
      line(ctx, tx, ty, tx + 9, ty + 5, 1, 1, t.leafDark);
      break;
    }
    case 'bush':
      ellipse(ctx, x, y - 4, 7 * s, 4, t.leafDark);
      ellipse(ctx, x - 1, y - 5, 5 * s, 3, t.leaf);
      rect(ctx, x - 3, y - 6, 1, 1, t.accent);
      rect(ctx, x + 2, y - 4, 1, 1, t.accent);
      break;
    case 'flower':
      rect(ctx, x, y - 3, 1, 3, t.leafDark);
      rect(ctx, x - 1, y - 4, 3, 1, t.accent);
      rect(ctx, x, y - 5, 1, 1, t.accent);
      break;
    case 'pine':
      pine(ctx, x, y, Math.round(16 * s), t.leafDark, t.leaf);
      rect(ctx, x, y, 1, 2, t.trunkDark);
      break;
    case 'fern':
      for (const dx of [-4, -2, 0, 2, 4]) line(ctx, x, y, x + dx, y - 5 + Math.abs(dx) / 2, 1, 1, t.leafLight);
      break;
  }
}

function renderTree(spec: SceneSpec): HTMLCanvasElement {
  const { GROUND_Y } = dimsOf(spec.tree.dims);
  const [c, ctx] = makeCanvas(spec.tree.dims);
  const { theme, tree } = spec;
  const r = mulberry32(spec.seed ^ 0x7a3e);

  // crown shadow
  for (const e of tree.crown) ellipse(ctx, e.cx, e.cy + 2, e.rx, e.ry, theme.leafDark);

  // trunk
  const top = tree.trunkTop;
  for (let y = top; y < GROUND_Y + 5; y++) {
    const t = (y - top) / (GROUND_Y - top);
    let w = 12 + 6 * t;
    if (y > GROUND_Y - 8) w += (y - (GROUND_Y - 8)) * 1.6;
    const x0 = Math.round(tree.cx - w / 2);
    const wi = Math.round(w);
    rect(ctx, x0, y, wi, 1, theme.trunk);
    rect(ctx, x0, y, 2, 1, theme.trunkLight);
    rect(ctx, x0 + wi - 3, y, 3, 1, theme.trunkDark);
  }
  for (let i = 0; i < 22; i++) {
    rect(ctx, tree.cx + range(r, -5, 5), range(r, top + 6, GROUND_Y - 4), 1, int(r, 2, 5), theme.trunkDark);
  }

  // branches
  for (const br of tree.branches) {
    line(ctx, br.origin.x, br.origin.y, br.tip.x, br.tip.y, 4, 2, theme.trunk);
    line(ctx, br.origin.x, br.origin.y + 1, br.tip.x, br.tip.y + 1, 1, 1, theme.trunkDark);
    const tw = br.tip.x - br.side * 18;
    line(ctx, tw, branchYAt(br, tw), tw + br.side * 6, branchYAt(br, tw) - 7, 1, 1, theme.trunk);
  }

  // crown
  for (const e of tree.crown) {
    ellipse(ctx, e.cx, e.cy, e.rx, e.ry, theme.leaf);
    ellipse(ctx, e.cx - e.rx * 0.25, e.cy - e.ry * 0.35, e.rx * 0.45, e.ry * 0.35, theme.leafLight);
    for (let i = 0; i < 50; i++) {
      const a = range(r, 0, Math.PI * 2);
      const d = Math.sqrt(r());
      const col = r() < 0.6 ? theme.leafDark : theme.leafLight;
      rect(ctx, e.cx + Math.cos(a) * e.rx * d * 0.95, e.cy + Math.sin(a) * e.ry * d * 0.9, 1, 1, col);
    }
    if (theme.tree === 'broadleaf') {
      for (let i = 0; i < 6; i++) rect(ctx, e.cx + range(r, -0.7, 0.7) * e.rx, e.cy + range(r, -0.6, 0.5) * e.ry, 2, 2, theme.accent);
    }
  }

  // leaf clumps at branch tips
  for (const br of tree.branches) {
    if (theme.tree === 'cedar') {
      ellipse(ctx, br.tip.x - br.side * 6, br.tip.y - 2, 22, 4, theme.leafDark);
      ellipse(ctx, br.tip.x - br.side * 6, br.tip.y - 4, 19, 3, theme.leaf);
    } else {
      ellipse(ctx, br.tip.x, br.tip.y - 3, 9, 5, theme.leafDark);
      ellipse(ctx, br.tip.x - 1, br.tip.y - 4, 7, 4, theme.leaf);
      rect(ctx, br.tip.x - 3, br.tip.y - 6, 2, 1, theme.leafLight);
    }
  }

  // ropes to signs
  for (const br of tree.branches) {
    for (const rx of [br.sign.x + 8, br.sign.x + SIGN_W - 9]) {
      const by = Math.round(branchYAt(br, rx));
      rect(ctx, rx, by, 1, br.sign.y - by, QZ.slate);
    }
  }
  return c;
}

// ---------- per-frame ----------

export function drawFrame(ctx: Ctx, spec: SceneSpec, layers: StaticLayers, t: number) {
  const { W, H, GROUND_Y } = dimsOf(spec.tree.dims);
  const { theme, cliff, fall } = spec;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(layers.sky, 0, 0);

  for (const c of spec.clouds) {
    const span = W + 80;
    const x = (((c.x + t * c.speed) % span) + span) % span - 40;
    for (const b of c.blobs) ellipse(ctx, x + b.dx, c.y + b.dy + 1, b.r, b.r * 0.6, theme.cloudShade);
    for (const b of c.blobs) ellipse(ctx, x + b.dx, c.y + b.dy, b.r - 1, b.r * 0.6 - 1, theme.cloud);
  }

  ctx.drawImage(layers.land, 0, 0);

  // waterfall
  const top = cliff.top + 2;
  const bottom = GROUND_Y + 4;
  rect(ctx, fall.x - 2, top - 3, fall.w + 4, 3, theme.water);
  for (let x = fall.x; x < fall.x + fall.w; x++) {
    rect(ctx, x, top, 1, bottom - top, theme.water);
    const off = ((x * 7) % 13) * 3;
    const start = top + (((t * 70 + off) % 14) - 14);
    for (let y = start; y < bottom; y += 14) {
      const y0 = Math.max(top, y);
      const y1 = Math.min(bottom, y + 4);
      if (y1 > y0) rect(ctx, x, y0, 1, y1 - y0, theme.waterLight);
    }
  }
  rect(ctx, fall.x, top, 1, bottom - top, theme.waterLight);
  const fr = mulberry32(Math.floor(t * 8) + spec.seed);
  for (let i = 0; i < 9; i++) {
    ellipse(ctx, fall.x + fall.w / 2 + range(fr, -16, 16), GROUND_Y + 3 + range(fr, -2, 3), int(fr, 1, 3), int(fr, 1, 2), theme.foam);
  }

  // ambient birds
  for (const f of spec.flyers) {
    const span = W + 40;
    const x = Math.round((((f.phase + t * f.speed) % span) + span) % span - 20);
    const y = Math.round(f.y + Math.sin(t * 2 + f.phase) * f.amp);
    if (Math.floor(t * 6 + f.phase) % 2 === 0) {
      rect(ctx, x - 3, y - 2, 1, 1, QZ.slate);
      rect(ctx, x - 2, y - 1, 1, 1, QZ.slate);
      rect(ctx, x - 1, y, 3, 1, QZ.slate);
      rect(ctx, x + 2, y - 1, 1, 1, QZ.slate);
      rect(ctx, x + 3, y - 2, 1, 1, QZ.slate);
    } else {
      rect(ctx, x - 3, y, 7, 1, QZ.slate);
    }
  }

  ctx.drawImage(layers.tree, 0, 0);
}
