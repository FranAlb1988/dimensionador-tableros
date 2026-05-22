import { describe, expect, it } from 'vitest';
import { factorDerrateoAltura } from './derrateo';

describe('factorDerrateoAltura', () => {
  it('por debajo de la tabla no hay derrateo (factor = 1)', () => {
    expect(factorDerrateoAltura(0)).toBe(1);
    expect(factorDerrateoAltura(500, 'MT')).toBe(1);
    expect(factorDerrateoAltura(1000)).toBe(1);
  });

  it('BT no derratea hasta 2000 m.s.n.m.', () => {
    expect(factorDerrateoAltura(1500, 'BT')).toBe(1);
    expect(factorDerrateoAltura(2000, 'BT')).toBe(1);
  });

  it('valores exactos de la Tabla V a 2.300 m', () => {
    expect(factorDerrateoAltura(2300, 'BT')).toBeCloseTo(0.994, 5);
    expect(factorDerrateoAltura(2300, 'MT')).toBeCloseTo(0.974, 5);
  });

  it('BT es el nivel por defecto', () => {
    expect(factorDerrateoAltura(2300)).toBe(factorDerrateoAltura(2300, 'BT'));
  });

  it('interpola linealmente entre puntos de la tabla', () => {
    // BT 2150 m: punto medio entre 2000 (1,000) y 2300 (0,994)
    expect(factorDerrateoAltura(2150, 'BT')).toBeCloseTo(0.997, 5);
    // MT 1250 m: punto medio entre 1000 (1,000) y 1500 (0,991)
    expect(factorDerrateoAltura(1250, 'MT')).toBeCloseTo(0.9955, 5);
  });

  it('hace clamp por encima del último punto de la tabla', () => {
    expect(factorDerrateoAltura(3900, 'BT')).toBeCloseTo(0.96, 5);
    expect(factorDerrateoAltura(5000, 'BT')).toBeCloseTo(0.96, 5);
    expect(factorDerrateoAltura(5000, 'MT')).toBeCloseTo(0.943, 5);
  });

  it('valor no finito devuelve 1', () => {
    expect(factorDerrateoAltura(Number.NaN)).toBe(1);
  });
});
