import { describe, expect, it } from 'vitest';
import { MARCAS_FEEDER, sugerirProteccionFeeder, sugerirProteccionIc60, sugerirProteccionNsx } from './proteccion';
import type { Carga } from '../types';

const motor11kW: Carga = {
  id: 'm', descripcion: 'motor 11 kW', tipo: 'motor',
  potenciaKw: 11, tensionV: 400, fases: '3F', factorServicio: 1, arranque: 'DOL',
};

describe('sugerirProteccionNsx', () => {
  it('para motor 11 kW (≈21 A × 1.25 = 26 A) elige ≥ 25 A o más', () => {
    const p = sugerirProteccionNsx(motor11kW);
    expect(p).toBeDefined();
    expect(p!.inA).toBeGreaterThanOrEqual(26);
  });

  it('elige siempre el menor In que cumpla', () => {
    const p = sugerirProteccionNsx({ ...motor11kW, potenciaKw: 1 });
    expect(p).toBeDefined();
    // Para 1 kW (~1.9 A) cualquier NSX cumple, debe ser el más chico (16 A).
    expect(p!.inA).toBe(16);
  });

  it('devuelve undefined si no hay corriente calculable', () => {
    const c: Carga = { ...motor11kW, potenciaKw: undefined, corrienteA: undefined };
    expect(sugerirProteccionNsx(c)).toBeUndefined();
  });

  it('corrienteProteccionA fuerza el frame mínimo aunque la carga no lo necesite', () => {
    const carga: Carga = { ...motor11kW, potenciaKw: 1, corrienteProteccionA: 200 };
    const p = sugerirProteccionNsx(carga);
    expect(p).toBeDefined();
    expect(p!.inA).toBeGreaterThanOrEqual(200);
    expect(p!.familia).toBe('NSX250');
  });

  it('si la carga ya pide más que corrienteProteccionA, manda la carga', () => {
    // motor 75 kW ≈ 142 A × 1.25 = 178 A, frame forzado solo a 50 A → manda 178 A
    const carga: Carga = { ...motor11kW, potenciaKw: 75, corrienteProteccionA: 50 };
    const p = sugerirProteccionNsx(carga);
    expect(p!.inA).toBeGreaterThanOrEqual(178);
  });

  it('sin potencia pero con corrienteProteccionA, sugiere NSX por el frame', () => {
    const carga: Carga = {
      id: 'x', descripcion: 'spare', tipo: 'otro',
      tensionV: 400, fases: '3F', factorServicio: 1, corrienteProteccionA: 250,
    };
    const p = sugerirProteccionNsx(carga);
    expect(p).toBeDefined();
    expect(p!.familia).toBe('NSX250');
  });
});

describe('sugerirProteccionFeeder (por marca)', () => {
  it('Schneider devuelve NSX', () => {
    const p = sugerirProteccionFeeder(motor11kW, 'Schneider');
    expect(p?.familia.startsWith('NSX')).toBe(true);
  });

  it('ABB devuelve Tmax con marca ABB', () => {
    const p = sugerirProteccionFeeder(motor11kW, 'ABB');
    expect(p).toBeDefined();
    expect(p!.marca).toBe('ABB');
    expect(p!.familia.startsWith('Tmax')).toBe(true);
    expect(p!.inA).toBeGreaterThanOrEqual(26);
  });

  it('Chint (sin MCCB) usa NSX como complemento de alimentadores', () => {
    const p = sugerirProteccionFeeder(motor11kW, 'Chint');
    expect(p?.familia.startsWith('NSX')).toBe(true);
  });

  it('solo Schneider y ABB tienen alimentadores propios', () => {
    expect(MARCAS_FEEDER).toEqual(['Schneider', 'ABB']);
  });
});

describe('sugerirProteccionIc60', () => {
  it('para iluminación 1F de 1.5 kW @ 230 V (~6.5 A) elige iC60 1P de 10 A', () => {
    const c: Carga = {
      id: 'l', descripcion: 'lum', tipo: 'iluminacion',
      potenciaKw: 1.5, tensionV: 230, fases: '1F', factorServicio: 1,
    };
    const p = sugerirProteccionIc60(c);
    expect(p).toBeDefined();
    expect(p!.polos).toBe(1);
    expect(p!.inA).toBeGreaterThanOrEqual(7);
  });

  it('respeta los polos según fases', () => {
    const c: Carga = {
      id: 't', descripcion: 'tomas 3F', tipo: 'tomas',
      potenciaKw: 5, tensionV: 400, fases: '3F', factorServicio: 1,
    };
    const p = sugerirProteccionIc60(c);
    expect(p?.polos).toBe(3);
  });

  it('el factor de derrateo selecciona contra I/F2 (interruptor mayor)', () => {
    const c: Carga = {
      id: 'l', descripcion: 'lum', tipo: 'iluminacion',
      potenciaKw: 1.5, tensionV: 230, fases: '1F', factorServicio: 1,
    };
    const sinDerrateo = sugerirProteccionIc60(c);
    const conDerrateo = sugerirProteccionIc60(c, 0.5);
    expect(sinDerrateo).toBeDefined();
    expect(conDerrateo).toBeDefined();
    expect(conDerrateo!.inA).toBeGreaterThan(sinDerrateo!.inA);
  });
});
