import { describe, expect, it } from 'vitest';
import { FixedStepper } from '../src/core/loop';

describe('FixedStepper', () => {
  it('runs whole steps and carries the remainder as the interpolation factor', () => {
    const s = new FixedStepper(1 / 60);
    let ticks = 0;
    const alpha = s.advance(2.5 / 60, () => ticks++);
    expect(ticks).toBe(2);
    expect(alpha).toBeCloseTo(0.5, 5);
  });

  it('accumulates small frames until a step is due', () => {
    const s = new FixedStepper(1 / 60);
    let ticks = 0;
    for (let i = 0; i < 4; i++) s.advance(1 / 240, () => ticks++);
    expect(ticks).toBe(1);
  });

  it('caps steps per frame so a long stall cannot snowball', () => {
    const s = new FixedStepper(1 / 60, 5);
    let ticks = 0;
    s.advance(2, () => ticks++);
    expect(ticks).toBe(5);
    ticks = 0;
    s.advance(1 / 60, () => ticks++);
    expect(ticks).toBeLessThanOrEqual(2); // no backlog of skipped steps
  });

  it('ignores negative frame times', () => {
    const s = new FixedStepper();
    let ticks = 0;
    expect(s.advance(-1, () => ticks++)).toBe(0);
    expect(ticks).toBe(0);
  });
});
