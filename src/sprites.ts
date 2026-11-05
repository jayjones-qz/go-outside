import { QZ } from './themes';

// 16×14 bird, facing right. o outline, b body, w wing, h belly, k beak, e eye, f feet.
export const BIRD_FRAMES = {
  sit: [
    '........oooo....',
    '.......obbbbo...',
    '......obbbbebo..',
    '......obbbbbbkk.',
    '..oo..obbbbbbo..',
    '.owwooobbbbbo...',
    '.owwwbbbbbbbbo..',
    '..owwwwwbbhhbo..',
    '...owwwwwbhhbo..',
    '....owwwbbhho...',
    '.....obbbbbo....',
    '......ooooo.....',
    '.......f.f......',
    '......ff.ff.....',
  ],
  up: [
    '..ow....oooo....',
    '..oww..obbbbo...',
    '...oww.obbbebo..',
    '...owwwobbbbbkk.',
    '....owwbbbbbbo..',
    '.....owbbbbbo...',
    '....obbbbbbbbo..',
    '...obbbbbbhhbo..',
    '...obbbbbbhhbo..',
    '....obbbbbhho...',
    '.....obbbbbo....',
    '......ooooo.....',
    '.......f.f......',
    '................',
  ],
  down: [
    '........oooo....',
    '.......obbbbo...',
    '......obbbbebo..',
    '......obbbbbbkk.',
    '......obbbbbbo..',
    '.....obbbbbbo...',
    '....obbbbbbbbo..',
    '...obbbbbbhhbo..',
    '..owwwbbbbhhbo..',
    '..owwwwbbbhho...',
    '...owwwobbbo....',
    '....owwoooo.....',
    '.....oo.f.f.....',
    '................',
  ],
} as const;

export type BirdFrame = keyof typeof BIRD_FRAMES;

const VARIANTS: Record<string, string>[] = [
  { b: QZ.indigo, w: QZ.deepIndigo, h: '#AEB8FF', k: QZ.yellow, f: QZ.yellow },
  { b: QZ.yellow, w: QZ.indigo, h: '#FFF0B3', k: '#FF8A3D', f: '#FF8A3D' },
  { b: QZ.offWhite, w: QZ.indigo, h: '#FFFFFF', k: QZ.yellow, f: QZ.yellow },
].map((v) => ({ ...v, o: QZ.navy, e: QZ.navy }));

export const BIRD_VARIANTS = VARIANTS.length;

const cache = new Map<string, string>();

export function birdSprite(frame: BirdFrame, variant: number): string {
  const key = `${frame}:${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rows = BIRD_FRAMES[frame];
  const colors = VARIANTS[variant % VARIANTS.length];
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const ctx = c.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = colors[row[x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}
