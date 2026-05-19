import { describe, expect, it } from 'vitest';
import { aKw, desdeKw, hpToKw, kwToHp, KW_POR_HP } from './potencia';

describe('conversión kW ↔ HP', () => {
  it('1 HP = 0.7457 kW', () => {
    expect(hpToKw(1)).toBeCloseTo(0.7457, 4);
  });

  it('10 HP ≈ 7.457 kW', () => {
    expect(hpToKw(10)).toBeCloseTo(7.457, 3);
  });

  it('round trip kW → HP → kW preserva valor', () => {
    const kw = 11;
    expect(hpToKw(kwToHp(kw))).toBeCloseTo(kw, 6);
  });

  it('aKw / desdeKw son inversos', () => {
    const v = 22;
    expect(aKw(desdeKw(v, 'HP'), 'HP')).toBeCloseTo(v, 6);
    expect(aKw(desdeKw(v, 'kW'), 'kW')).toBe(v);
  });

  it('KW_POR_HP es 0.7457', () => {
    expect(KW_POR_HP).toBe(0.7457);
  });
});
