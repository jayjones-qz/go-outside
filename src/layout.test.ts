import { describe, expect, it } from 'vitest';
import { BIRD_H, BIRD_W, GROUND_Y, W, layoutTree, type Rect } from './layout';
import { mulberry32 } from './rng';

const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('layoutTree', () => {
  for (const style of ['acacia', 'broadleaf', 'cedar'] as const) {
    for (let n = 1; n <= 10; n++) {
      it(`${style} n=${n}: signs + seated birds fit and don't overlap`, () => {
        for (let seed = 1; seed < 30; seed++) {
          const t = layoutTree(n, mulberry32(seed), style);
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
        }
      });
    }
  }
});
