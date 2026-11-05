import { describe, expect, it, vi } from 'vitest';
import { layoutTree } from '../layout';
import { mulberry32 } from '../rng';
import { AUTO_SPEAK_SECONDS, autoSpeak, createSim, resolveAttempt, sendToBranch, speak, step } from './sim';

const setup = (n = 3) => {
  const tree = layoutTree(n, mulberry32(42), 'broadleaf');
  const onMatch = vi.fn();
  const sim = createSim(n, tree, 0, onMatch);
  const branchFor = (key: number) => tree.branches.findIndex((b) => b.cardIndex === key);
  return { sim, tree, onMatch, branchFor };
};

const run = (sim: ReturnType<typeof setup>['sim'], seconds: number, from = sim.now) => {
  for (let t = from; t < from + seconds; t += 1 / 60) step(sim, 1 / 60, t);
};

describe('sim', () => {
  it('correct drop seats the bird and reports elapsed ms', () => {
    const { sim, onMatch, branchFor } = setup();
    sim.now = 2.5;
    resolveAttempt(sim, sim.birds[1], branchFor(1));
    expect(sim.birds[1].mode).toBe('matched');
    expect(sim.matched.has(1)).toBe(true);
    expect(onMatch).toHaveBeenCalledWith(1, 2500);
  });

  it('wrong drop wobbles, falls, and lands on the ground', () => {
    const { sim, onMatch, branchFor } = setup();
    resolveAttempt(sim, sim.birds[0], branchFor(1));
    const b = sim.birds[0];
    expect(b.mode).toBe('wobble');
    let t = 0;
    while (b.mode !== 'ground' && t < 5) step(sim, 1 / 60, (t += 1 / 60));
    expect(b.mode).toBe('ground');
    expect(b.y).toBeGreaterThan(236);
    expect(sim.matched.size).toBe(0);
    expect(onMatch).not.toHaveBeenCalled();
  });

  it('speaking bird + branch click flies there and matches', () => {
    const { sim, onMatch, branchFor } = setup();
    speak(sim, 2, 5);
    expect(sendToBranch(sim, 2, branchFor(2))).toBe(true);
    expect(sim.speaking).toBeNull();
    run(sim, 3);
    expect(sim.birds[2].mode).toBe('matched');
    expect(onMatch).toHaveBeenCalledTimes(1);
  });

  it('all matched → wonAt set', () => {
    const { sim, branchFor } = setup(2);
    resolveAttempt(sim, sim.birds[0], branchFor(0));
    resolveAttempt(sim, sim.birds[1], branchFor(1));
    expect(sim.wonAt).not.toBeNull();
  });

  it('auto-speaks after idle, not before', () => {
    const { sim } = setup();
    sim.lastInteraction = 0;
    sim.now = AUTO_SPEAK_SECONDS - 1;
    autoSpeak(sim, () => 3);
    expect(sim.speaking).toBeNull();
    sim.now = AUTO_SPEAK_SECONDS + 0.1;
    autoSpeak(sim, () => 3);
    expect(sim.speaking).not.toBeNull();
  });
});
