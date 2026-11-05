import { range, shuffle, type Rng } from './rng';
import type { TreeStyle } from './themes';

/** Logical world size; scaled to fit the iframe. */
export const W = 480;
export const H = 270;
export const GROUND_Y = 236;
export const SIGN_W = 92;
export const SIGN_H = 26;
/** Bird sprite size in world px (feet at bottom-center). */
export const BIRD_W = 16;
export const BIRD_H = 14;

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
  cx: number;
  crown: Ellipse[];
  trunkTop: number;
  branches: Branch[];
  perches: Pt[]; // idle perch spots on the crown
}

export function crownFor(style: TreeStyle, cx: number): Ellipse[] {
  const e = (dx: number, cy: number, rx: number, ry: number): Ellipse => ({ cx: cx + dx, cy, rx, ry });
  switch (style) {
    case 'acacia':
      return [e(0, 50, 140, 13), e(-55, 41, 70, 10), e(50, 40, 72, 10)];
    case 'broadleaf':
      return [e(0, 46, 118, 22), e(-58, 34, 56, 18), e(56, 33, 58, 19), e(0, 24, 52, 15)];
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

/**
 * Up to 5 branches per side. ≤3 per side: one column of signs. 4–5 per side: signs
 * alternate between an inner and an outer column so stacked signs + seated birds don't overlap.
 */
export function layoutTree(cardCount: number, rng: Rng, style: TreeStyle): TreeLayout {
  const n = Math.max(1, Math.min(10, cardCount));
  const cx = Math.round(240 + range(rng, -8, 8));
  const crown = crownFor(style, cx);
  const order = shuffle(rng, [...Array(n).keys()]);
  const branches: Branch[] = [];

  const place = (count: number, side: -1 | 1) => {
    const twoCols = count > 3;
    const yTop = 78;
    const yBot = 186;
    const stagger = side === 1 ? 10 : 0;
    for (let r = 0; r < count; r++) {
      const tipY = Math.round((count === 1 ? 128 : yTop + (r * (yBot - yTop)) / (count - 1)) + stagger);
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

  const perches: Pt[] = [];
  for (const dx of [-100, -70, -40, -12, 16, 44, 72, 100]) {
    const x = cx + dx;
    const y = crownTopAt(crown, x);
    if (y !== null) perches.push({ x, y: Math.round(y) + 1 });
  }

  return { cx, crown, trunkTop: crown[0].cy, branches, perches };
}
