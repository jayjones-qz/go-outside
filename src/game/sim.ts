import { BIRD_VARIANTS, type BirdFrame } from '../sprites';
import { GROUND_Y, H, W, type Pt, type TreeLayout } from '../layout';

export type BirdMode = 'ground' | 'hop' | 'fly' | 'perch' | 'drag' | 'wobble' | 'fall' | 'matched';
export type Method = 'drag' | 'click';
export type Dest =
  | { kind: 'ground' }
  | { kind: 'perch' }
  | { kind: 'attempt'; branch: number; method: Method };

export interface Bird {
  key: number; // card index
  variant: number;
  x: number; // feet position
  y: number;
  gy: number; // ground depth line for this bird
  facing: 1 | -1;
  mode: BirdMode;
  timer: number;
  from: Pt;
  to: Pt;
  t: number;
  dur: number;
  arc: number;
  dest: Dest;
  vx: number;
  vy: number;
  rot: number;
  perch: number | null;
  flapUntil: number;
}

export interface Sim {
  birds: Bird[];
  tree: TreeLayout;
  matched: Set<number>;
  speaking: { key: number; until: number } | null;
  lastInteraction: number;
  lastAuto: number;
  startedAt: number;
  now: number;
  hoverBranch: number | null;
  wonAt: number | null;
  onMatch: (key: number, elapsedMs: number) => void;
}

export const AUTO_SPEAK_SECONDS = 10;
const GY_MIN = GROUND_Y + 8;
const GY_MAX = H - 4;
const GRAVITY = 520;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function createSim(count: number, tree: TreeLayout, now: number, onMatch: Sim['onMatch']): Sim {
  const birds: Bird[] = Array.from({ length: count }, (_, key) => {
    const gy = rand(GY_MIN, GY_MAX);
    const x = rand(24, W - 24);
    return {
      key,
      variant: key % BIRD_VARIANTS,
      x,
      y: gy,
      gy,
      facing: Math.random() < 0.5 ? 1 : -1,
      mode: 'ground',
      timer: rand(0.2, 2),
      from: { x, y: gy },
      to: { x, y: gy },
      t: 0,
      dur: 1,
      arc: 0,
      dest: { kind: 'ground' },
      vx: 0,
      vy: 0,
      rot: 0,
      perch: null,
      flapUntil: 0,
    };
  });
  return {
    birds,
    tree,
    matched: new Set(),
    speaking: null,
    lastInteraction: now - (AUTO_SPEAK_SECONDS - 3), // first auto-speech ~3s in, to teach the mechanic
    lastAuto: -Infinity,
    startedAt: now,
    now,
    hoverBranch: null,
    wonAt: null,
    onMatch,
  };
}

function startMove(b: Bird, to: Pt, mode: 'hop' | 'fly', dest: Dest) {
  const dx = to.x - b.x;
  const dist = Math.hypot(dx, to.y - b.y);
  b.from = { x: b.x, y: b.y };
  b.to = to;
  b.t = 0;
  b.rot = 0;
  if (mode === 'hop') {
    b.dur = 0.28;
    b.arc = 5;
  } else {
    b.dur = clamp(dist / 140, 0.5, 2.2);
    b.arc = clamp(dist * 0.25, 10, 50);
  }
  if (Math.abs(dx) > 1) b.facing = dx > 0 ? 1 : -1;
  b.mode = mode;
  b.dest = dest;
}

function freePerches(sim: Sim): number[] {
  const taken = new Set(sim.birds.map((b) => b.perch).filter((p): p is number => p !== null));
  return sim.tree.perches.map((_, i) => i).filter((i) => !taken.has(i));
}

function randomGround(b: Bird): Pt {
  b.gy = rand(GY_MIN, GY_MAX);
  return { x: rand(20, W - 20), y: b.gy };
}

function startFall(b: Bird, vx: number) {
  b.mode = 'fall';
  b.vx = vx;
  b.vy = -40;
  b.rot = 0;
  b.perch = null;
  if (b.gy < GY_MIN) b.gy = rand(GY_MIN, GY_MAX);
}

export function step(sim: Sim, dt: number, now: number) {
  sim.now = now;
  if (sim.speaking && now > sim.speaking.until) sim.speaking = null;

  for (const b of sim.birds) {
    switch (b.mode) {
      case 'ground': {
        b.timer -= dt;
        if (b.timer > 0) break;
        const roll = Math.random();
        const free = freePerches(sim);
        if (roll < 0.55) {
          const dir = Math.random() < 0.5 ? -1 : 1;
          b.gy = clamp(b.gy + rand(-4, 4), GY_MIN, GY_MAX);
          startMove(b, { x: clamp(b.x + dir * rand(8, 36), 16, W - 16), y: b.gy }, 'hop', { kind: 'ground' });
        } else if (roll < 0.85 && free.length) {
          const p = free[Math.floor(Math.random() * free.length)];
          b.perch = p;
          startMove(b, sim.tree.perches[p], 'fly', { kind: 'perch' });
        } else {
          startMove(b, randomGround(b), 'fly', { kind: 'ground' });
        }
        break;
      }
      case 'hop':
      case 'fly': {
        b.t += dt / b.dur;
        if (b.t >= 1) {
          b.x = b.to.x;
          b.y = b.to.y;
          arrive(sim, b);
        } else {
          b.x = b.from.x + (b.to.x - b.from.x) * b.t;
          b.y = b.from.y + (b.to.y - b.from.y) * b.t - b.arc * 4 * b.t * (1 - b.t);
        }
        break;
      }
      case 'perch':
        b.timer -= dt;
        if (b.timer <= 0) {
          b.perch = null;
          startMove(b, randomGround(b), 'fly', { kind: 'ground' });
        }
        break;
      case 'wobble':
        b.timer -= dt;
        if (b.timer <= 0) startFall(b, (Math.random() < 0.5 ? -1 : 1) * rand(25, 45));
        break;
      case 'fall':
        b.vy += GRAVITY * dt;
        b.x = clamp(b.x + b.vx * dt, 12, W - 12);
        b.y += b.vy * dt;
        b.rot += 540 * dt * (b.vx < 0 ? -1 : 1);
        if (b.vy > 0 && b.y >= b.gy) {
          b.y = b.gy;
          b.rot = 0;
          b.mode = 'ground';
          b.timer = rand(0.8, 1.8);
        }
        break;
      case 'matched':
        if (sim.wonAt !== null && now > b.flapUntil + 0.4 && Math.random() < dt * 0.8) b.flapUntil = now + 0.6;
        break;
      case 'drag':
        break;
    }
  }
}

function arrive(sim: Sim, b: Bird) {
  const d = b.dest;
  if (d.kind === 'ground') {
    b.mode = 'ground';
    b.timer = rand(0.4, 2.2);
  } else if (d.kind === 'perch') {
    b.mode = 'perch';
    b.timer = rand(3, 9);
    b.facing = Math.random() < 0.5 ? 1 : -1;
  } else {
    resolveAttempt(sim, b, d.branch);
  }
}

/** Bird lands on a branch sign: correct → seated + flap; wrong → wobble then fall. */
export function resolveAttempt(sim: Sim, b: Bird, branchIdx: number) {
  const br = sim.tree.branches[branchIdx];
  b.x = br.seat.x;
  b.y = br.seat.y;
  b.rot = 0;
  b.perch = null;
  if (br.cardIndex === b.key && !sim.matched.has(b.key)) {
    b.mode = 'matched';
    b.flapUntil = sim.now + 1.2;
    b.facing = br.side;
    sim.matched.add(b.key);
    if (sim.speaking?.key === b.key) sim.speaking = null;
    sim.onMatch(b.key, (sim.now - sim.startedAt) * 1000);
    if (sim.matched.size === sim.birds.length) sim.wonAt = sim.now;
  } else {
    b.mode = 'wobble';
    b.timer = 0.35;
    b.flapUntil = sim.now + 0.35;
  }
}

/** Released mid-air, not over a sign. */
export function dropBird(b: Bird) {
  if (b.y >= GROUND_Y + 4) {
    b.gy = clamp(b.y, GY_MIN, GY_MAX);
    b.y = b.gy;
    b.mode = 'ground';
    b.timer = 0.6;
  } else {
    startFall(b, 0);
  }
}

export function speak(sim: Sim, key: number, seconds: number) {
  sim.speaking = { key, until: sim.now + seconds };
}

/** If idle for AUTO_SPEAK_SECONDS, a random unmatched bird speaks. */
export function autoSpeak(sim: Sim, seconds: (key: number) => number) {
  const now = sim.now;
  if (sim.wonAt !== null || sim.speaking) return;
  if (now - sim.lastInteraction < AUTO_SPEAK_SECONDS || now - sim.lastAuto < AUTO_SPEAK_SECONDS) return;
  const pool = sim.birds.filter((b) => !sim.matched.has(b.key) && b.mode !== 'drag');
  if (!pool.length) return;
  const b = pool[Math.floor(Math.random() * pool.length)];
  speak(sim, b.key, seconds(b.key));
  sim.lastAuto = now;
}

/** Speaking bird + branch click → bird flies to that sign. */
export function sendToBranch(sim: Sim, key: number, branchIdx: number): boolean {
  const b = sim.birds[key];
  const br = sim.tree.branches[branchIdx];
  if (sim.matched.has(key) || sim.matched.has(br.cardIndex) || b.mode === 'drag') return false;
  b.perch = null;
  startMove(b, br.seat, 'fly', { kind: 'attempt', branch: branchIdx, method: 'click' });
  sim.speaking = null;
  return true;
}

export function birdFrame(b: Bird, now: number): BirdFrame {
  const flapping =
    b.mode === 'fly' || b.mode === 'drag' || b.mode === 'fall' || b.mode === 'wobble' || now < b.flapUntil;
  if (flapping) return Math.floor(now * 12) % 2 ? 'up' : 'down';
  return 'sit';
}
