import { describe, expect, it } from 'vitest';
import { sugerirInterruptorPrincipal } from './principal';

describe('sugerirInterruptorPrincipal', () => {
  it('para 100 A elige NSX (familia NSX*)', () => {
    const p = sugerirInterruptorPrincipal(100);
    expect(p).toBeDefined();
    expect(p!.familia.startsWith('NSX')).toBe(true);
    expect(p!.inA).toBeGreaterThanOrEqual(100);
  });

  it('para 600 A elige NSX (≤ 630)', () => {
    const p = sugerirInterruptorPrincipal(600);
    expect(p).toBeDefined();
    expect(p!.familia).toBe('NSX630');
    expect(p!.inA).toBe(630);
  });

  it('para 700 A salta a Masterpact NT', () => {
    const p = sugerirInterruptorPrincipal(700);
    expect(p).toBeDefined();
    expect(p!.familia).toBe('MasterpactNT');
    expect(p!.inA).toBeGreaterThanOrEqual(700);
  });

  it('para 1800 A elige Masterpact NW', () => {
    const p = sugerirInterruptorPrincipal(1800);
    expect(p).toBeDefined();
    expect(p!.familia).toBe('MasterpactNW');
    expect(p!.inA).toBeGreaterThanOrEqual(1800);
  });

  it('siempre elige el menor In que cumpla', () => {
    const p = sugerirInterruptorPrincipal(801);
    expect(p!.inA).toBe(1000); // NSX llega a 630 (no aplica), Masterpact NT08 = 800 < 801, siguiente NT10 = 1000
  });

  it('devuelve undefined para corriente cero o negativa', () => {
    expect(sugerirInterruptorPrincipal(0)).toBeUndefined();
    expect(sugerirInterruptorPrincipal(-10)).toBeUndefined();
  });
});
