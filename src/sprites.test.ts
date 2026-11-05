import { expect, it } from 'vitest';
import { BIRD_FRAMES } from './sprites';
import { BIRD_H, BIRD_W } from './layout';

it('bird frames are BIRD_W×BIRD_H', () => {
  for (const rows of Object.values(BIRD_FRAMES)) {
    expect(rows).toHaveLength(BIRD_H);
    for (const r of rows) expect(r).toHaveLength(BIRD_W);
  }
});
