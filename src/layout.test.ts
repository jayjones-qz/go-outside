import { describe, expect, it } from 'vitest';
import { BIRD_H, BIRD_W, MIN_PERCH_Y, computeDims, layoutTree, type Rect } from './layout';
import { mulberry32 } from './rng';

const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const VIEWPORTS: [number, number][] = [
  [960, 540], // 16:9
  [1024, 768], // 4:3 tablet landscape
  [2000, 500], // ultra-wide (letterboxed)
  [700, 800], // squarish → wide, stretched
  [390, 844], // phone portrait
  [360, 640],
  [320, 400], // short portrait → min height
  [300, 1200], // very tall → capped
];

describe('computeDims', () => {
  it('16:9 stays 480×270', () => expect(computeDims(960, 540)).toEqual({ w: 480, h: 270, groundY: 236 }));
  it('portrait uses the narrow world and stretches', () => {
    const d = computeDims(390, 844);
    expect(d.w).toBe(280);
    expect(d.h).toBe(Math.round((280 * 844) / 390));
  });
  it('4:3 landscape stretches vertically', () => expect(computeDims(1024, 768).h).toBe(360));
});

describe('layoutTree', () => {
  for (const [vw, vh] of VIEWPORTS)
  for (const style of ['acacia', 'broadleaf', 'cedar'] as const) {
    for (let n = 1; n <= 10; n++) {
      it(`${vw}x${vh} ${style} n=${n}: signs + seated birds fit and don't overlap`, () => {
        const dims = computeDims(vw, vh);
        const { w: W, groundY: GROUND_Y } = dims;
        for (let seed = 1; seed < 30; seed++) {
          const t = layoutTree(n, mulberry32(seed), style, dims);
          expect(t.branches).toHaveLength(n);
          expect(new Set(t.branches.map((b) => b.cardIndex)).size).toBe(n);
          const signs = t.branches.map((b) => b.sign);
          const seats = t.branches.map((b) => ({ x: b.seat.x - BIRD_W / 2, y: b.seat.y - BIRD_H, w: BIRD_W, h: BIRD_H }));
          for (const s of signs) {
            expect(s.x).toBeGreaterThanOrEqual(0);
            expect(s.x + s.w).toBeLessThanOrEqual(W);
            expect(s.y + s.h).toBeLessThanOrEqual(GROUND_Y);
          }
          for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++) {
              if (i < j) expect(overlap(signs[i], signs[j])).toBe(false);
              if (i !== j) expect(overlap(seats[i], signs[j])).toBe(false);
            }
          expect(t.perches.length).toBeGreaterThanOrEqual(5);
          for (const p of t.perches) {
            expect(p.y).toBeGreaterThanOrEqual(MIN_PERCH_Y);
            expect(p.x).toBeGreaterThanOrEqual(12);
            expect(p.x).toBeLessThanOrEqual(W - 12);
          }
          for (const s of signs) expect(s.x).toBeGreaterThanOrEqual(0);
        }
      });
    }
  }
});
