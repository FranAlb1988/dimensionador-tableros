import { describe, expect, it } from 'vitest';
import { CONTACTORES_MT, ENVOLVENTE_CCM_MT, dimensionarCcmMt } from './ccm-mt';
import type { Carga } from '../types';
import { KW_POR_HP } from '../util/potencia';

function motorMt(id: string, hp: number, tensionV = 4160, fs = 1): Carga {
  return {
    id, descripcion: `M-${id}`, tipo: 'motor',
    potenciaKw: hp * KW_POR_HP, unidadPotencia: 'HP',
    tensionV, fases: '3F', factorServicio: fs, arranque: 'DOL',
  };
}

describe('Catálogo CENTERLINE 2500', () => {
  it('tiene contactores 200, 400 y 720 A', () => {
    expect(CONTACTORES_MT.map((c) => c.frameA)).toEqual([200, 400, 720]);
  });
  it('envolvente con celda 915 × 2290 × 1525 y 2 espacios verticales', () => {
    expect(ENVOLVENTE_CCM_MT.anchoColumnaMm).toBe(915);
    expect(ENVOLVENTE_CCM_MT.altoTotalMm).toBe(2290);
    expect(ENVOLVENTE_CCM_MT.profundidadMm).toBe(1525);
    expect(ENVOLVENTE_CCM_MT.espaciosVerticales).toBe(2);
  });
});

describe('dimensionarCcmMt', () => {
  it('motor 100 HP @ 6,6 kV → FLA ≈ 8,5 A → contactor 200 A', () => {
    const r = dimensionarCcmMt([motorMt('1', 100, 6600)]);
    expect(r.asignaciones).toHaveLength(1);
    expect(r.asignaciones[0]!.contactor.frameA).toBe(200);
    expect(r.asignaciones[0]!.corrienteDisenoA).toBeCloseTo(8.5, 0);
    expect(r.asignaciones[0]!.espaciosV).toBe(1);
  });

  it('motor 2000 HP @ 4,16 kV → FLA ≈ 271 A → contactor 400 A', () => {
    const r = dimensionarCcmMt([motorMt('1', 2000, 4160)]);
    expect(r.asignaciones[0]!.contactor.frameA).toBe(400);
    expect(r.asignaciones[0]!.corrienteDisenoA).toBeCloseTo(270, -1);
  });

  it('motor 4000 HP @ 4,16 kV → FLA ≈ 541 A → contactor 720 A (2 espacios)', () => {
    const r = dimensionarCcmMt([motorMt('1', 4000, 4160)]);
    expect(r.asignaciones[0]!.contactor.frameA).toBe(720);
    expect(r.asignaciones[0]!.espaciosV).toBe(2);
  });

  it('motor demasiado grande (sin contactor que cubra) queda sin asignar', () => {
    // 7000 HP @ 4,16 kV: FLA ≈ 947 A, Imin = 1184 > 720 → no contactor.
    const r = dimensionarCcmMt([motorMt('1', 7000, 4160)]);
    expect(r.asignaciones).toHaveLength(0);
    expect(r.cargasSinAsignar).toHaveLength(1);
  });

  it('cargas BT y no-motor van a cargasSinAsignar', () => {
    const cargas: Carga[] = [
      motorMt('m-mt', 200, 6600),                         // OK
      { ...motorMt('m-bt', 200, 400) },                   // BT
      { id: 'a', descripcion: 'Alim', tipo: 'otro',
        potenciaKw: 50, unidadPotencia: 'kW',
        tensionV: 6600, fases: '3F', factorServicio: 1 }, // no-motor
    ];
    const r = dimensionarCcmMt(cargas);
    expect(r.asignaciones).toHaveLength(1);
    expect(r.cargasSinAsignar).toHaveLength(2);
  });

  it('bin-pack: dos contactores half-height caben en una columna', () => {
    const r = dimensionarCcmMt([motorMt('1', 100, 6600), motorMt('2', 200, 6600)]);
    expect(r.tablero!.columnas).toHaveLength(1);
    expect(r.tablero!.anchoTotalMm).toBe(915);
  });

  it('bin-pack: un full-height (720 A) ocupa toda la columna', () => {
    const r = dimensionarCcmMt([
      motorMt('big', 4000, 4160),  // 720 A full-height
      motorMt('chico', 100, 6600), // 200 A half-height
    ]);
    expect(r.tablero!.columnas).toHaveLength(2);
    expect(r.tablero!.anchoTotalMm).toBe(2 * 915);
  });

  it('aplica derrateo F2 al elegir el contactor', () => {
    // Motor 2000 HP @ 4,16 kV: Imin = 270 × 1,25 = 337 → 400 A.
    // Con F2 = 0,5: Imin/F2 = 674 → debería saltar a 720 A.
    const r = dimensionarCcmMt([motorMt('1', 2000, 4160)], 0.5);
    expect(r.asignaciones[0]!.contactor.frameA).toBe(720);
    expect(r.tablero!.factorDerrateoAltura).toBe(0.5);
  });
});
