import { describe, expect, it } from 'vitest';
import { corrienteDiseno, corrienteNominal } from './corriente';
import type { Carga } from '../types';

function motor3F(potenciaKw: number, factorServicio = 1): Carga {
  return {
    id: 'm',
    descripcion: 'motor',
    tipo: 'motor',
    potenciaKw,
    tensionV: 400,
    fases: '3F',
    factorServicio,
    arranque: 'DOL',
  };
}

describe('corrienteNominal', () => {
  it('respeta corrienteA si viene en la carga', () => {
    const c: Carga = { ...motor3F(10), corrienteA: 25 };
    expect(corrienteNominal(c)).toBe(25);
  });

  it('para un motor 3F de 11 kW a 400 V calcula ≈ 21 A', () => {
    // 11 000 / (√3·400·0.85·0.9) ≈ 20.75
    const I = corrienteNominal(motor3F(11));
    expect(I).toBeGreaterThan(20);
    expect(I).toBeLessThan(22);
  });

  it('un motor con η<1 y cosφ menor consume más corriente que una resistiva de la misma potencia', () => {
    const motorI = corrienteNominal(motor3F(10));
    const resistivo: Carga = {
      id: 'r', descripcion: 'r', tipo: 'resistivo',
      potenciaKw: 10, tensionV: 400, fases: '3F', factorServicio: 1,
    };
    expect(motorI).toBeGreaterThan(corrienteNominal(resistivo));
  });

  it('para 1F a 230 V da más corriente que el equivalente 3F a 400 V (misma potencia)', () => {
    const c1F: Carga = {
      id: 'r', descripcion: 'r', tipo: 'resistivo',
      potenciaKw: 5, tensionV: 230, fases: '1F', factorServicio: 1,
    };
    const c3F: Carga = { ...c1F, tensionV: 400, fases: '3F' };
    expect(corrienteNominal(c1F)).toBeGreaterThan(corrienteNominal(c3F));
  });

  it('devuelve 0 si no hay potencia ni corriente', () => {
    const c: Carga = {
      id: 'x', descripcion: 'x', tipo: 'otro',
      tensionV: 400, fases: '3F', factorServicio: 1,
    };
    expect(corrienteNominal(c)).toBe(0);
  });
});

describe('corrienteDiseno', () => {
  it('aplica el factor de servicio', () => {
    const I1 = corrienteDiseno(motor3F(11, 1));
    const I2 = corrienteDiseno(motor3F(11, 1.15));
    expect(I2 / I1).toBeCloseTo(1.15, 3);
  });
});
