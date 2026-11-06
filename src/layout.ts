import { range, shuffle, type Rng } from './rng';
import type { TreeStyle } from './themes';

/** Logical world size (world px). Width is one of two modes; height stretches to the viewport. */
export interface Dims {
  w: number;
  h: number;
  groundY: number;
}
export const WIDE_W = 480;
export const NARROW_W = 280;
export const BASE_H = 270;
const GROUND_DEPTH = 34;
/** Viewport h/w at or above this uses the narrow (portrait) world. */
export const PORTRAIT_RATIO = 1.15;
const NARROW_MIN_H = 360;
const MAX_RATIO = 2.4;

const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** World dims for a viewport: fills it exactly within the allowed aspect range, letterboxes beyond. */
export function computeDims(vw: number, vh: number): Dims {
  const ratio = vh / Math.max(1, vw);
  const w = ratio >= PORTRAIT_RATIO ? NARROW_W : WIDE_W;
  const minH = w === NARROW_W ? NARROW_MIN_H : BASE_H;
  const maxH = Math.round(w * (w === NARROW_W ? MAX_RATIO : PORTRAIT_RATIO));
  const h = clampN(Math.round(w * ratio), minH, maxH);
  return { w, h, groundY: h - GROUND_DEPTH };
}

export const DEFAULT_DIMS: Dims = computeDims(WIDE_W, BASE_H); // 480×270, ground 236
export const SIGN_W = 92;
export const SIGN_H = 26;
/** Bird sprite size in world px (feet at bottom-center). */
export const BIRD_W = 16;
export const BIRD_H = 14;
/** Lowest allowed feet-y for crown perches (bird hitbox is 20px tall). */
export const MIN_PERCH_Y = 24;

export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Ellipse { cx: number; cy: number; rx: number; ry: number }

export interface Branch {
  slot: number;
  cardIndex: number;
  side: -1 | 1;
  origin: Pt; // on trunk
  tip: Pt;
  sign: Rect; // hangs under the branch
  seat: Pt; // where a matched bird stands (feet), on top of the sign
}

export interface TreeLayout {
  dims: Dims;
  cx: number;
  crown: Ellipse[];
  trunkTop: number;
  branches: Branch[];
  perches: Pt[]; // idle perch spots on the crown
}

/** k < 1 squeezes the crown horizontally for narrow worlds. */
export function crownFor(style: TreeStyle, cx: number, k = 1): Ellipse[] {
  const e = (dx: number, cy: number, rx: number, ry: number): Ellipse => ({ cx: cx + dx * k, cy, rx: rx * k, ry });
  switch (style) {
    case 'acacia':
      return [e(0, 50, 140, 13), e(-55, 41, 70, 10), e(50, 40, 72, 10)];
    case 'broadleaf':
      return [e(0, 50, 120, 20), e(-58, 42, 56, 16), e(56, 41, 58, 17), e(0, 34, 50, 12)];
    case 'cedar':
      return [e(0, 56, 118, 9), e(0, 43, 92, 8), e(0, 31, 64, 7), e(0, 20, 36, 6), e(0, 12, 14, 4)];
  }
}

/** Top surface y of the crown at x, or null if x is outside it. */
export function crownTopAt(crown: Ellipse[], x: number): number | null {
  let best: number | null = null;
  for (const e of crown) {
    const d = (x - e.cx) / e.rx;
    if (Math.abs(d) >= 1) continue;
    const y = e.cy - e.ry * Math.sqrt(1 - d * d);
    if (best === null || y < best) best = y;
  }
  return best;
}

export function branchYAt(br: Branch, x: number): number {
  const t = Math.max(0, Math.min(1, (x - br.origin.x) / (br.tip.x - br.origin.x)));
  return br.origin.y + (br.tip.y - br.origin.y) * t;
}

const MIN_ROW_SPACING = 44; // sign (26) + seated bird (14) + gap

/**
 * Up to 5 branches per side, rows spread between the crown and the ground.
 * If one column per side doesn't fit vertically and the world is wide, signs alternate
 * between an inner and an outer column so stacked signs + seated birds don't overlap.
 */
export function layoutTree(cardCount: number, rng: Rng, style: TreeStyle, dims: Dims = DEFAULT_DIMS): TreeLayout {
  const n = Math.max(1, Math.min(10, cardCount));
  const narrow = dims.w < WIDE_W;
  const cx = Math.round(dims.w / 2 + range(rng, narrow ? -4 : -8, narrow ? 4 : 8));
  const k = Math.min(1, (dims.w / 2 - 4) / 140);
  const crown = crownFor(style, cx, k);
  const order = shuffle(rng, [...Array(n).keys()]);
  const branches: Branch[] = [];

  const yTop = 78;
  const yBot = dims.groundY - (narrow ? 72 : 50); // narrow: keep low signs clear of ground birds
  const place = (count: number, side: -1 | 1) => {
    const singleFits = count <= 1 || (yBot - yTop) / (count - 1) >= MIN_ROW_SPACING;
    const twoCols = !singleFits && !narrow;
    const stagger = side === 1 ? 10 : 0;
    for (let r = 0; r < count; r++) {
      const tipY = Math.round((count === 1 ? (yTop + yBot) / 2 - 8 : yTop + (r * (yBot - yTop)) / (count - 1)) + stagger);
      const outer = twoCols && r % 2 === 1;
      const reach = (outer ? 204 : 105) + Math.round(range(rng, -2, 2));
      const tip = { x: cx + side * reach, y: tipY };
      const origin = { x: cx + side * 7, y: tipY + (outer ? 26 : 8) };
      const signX = side < 0 ? tip.x - 8 : tip.x + 8 - SIGN_W;
      const sign = { x: signX, y: tipY + 12, w: SIGN_W, h: SIGN_H };
      const slot = branches.length;
      branches.push({
        slot,
        cardIndex: order[slot],
        side,
        origin,
        tip,
        sign,
        seat: { x: sign.x + SIGN_W / 2, y: sign.y },
      });
    }
  };
  place(Math.ceil(n / 2), -1);
  place(Math.floor(n / 2), 1);

  // Idle perches on the crown, low enough that the bird + its hitbox stay fully on-screen.
  const perches: Pt[] = [];
  for (let dx = -130; dx <= 130; dx += 6) {
    const x = cx + dx;
    if (x < 12 || x > dims.w - 12) continue;
    const top = crownTopAt(crown, x);
    if (top === null) continue;
    const y = Math.round(top) + 1;
    if (y < MIN_PERCH_Y) continue;
    if (perches.length && x - perches[perches.length - 1].x < 24) continue;
    perches.push({ x, y });
  }

  return { dims, cx, crown, trunkTop: crown[0].cy, branches, perches };
}
