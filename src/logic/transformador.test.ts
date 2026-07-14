import { describe, expect, it } from 'vitest';
import {
  calcularTransformador,
  MAX_KVA_ESTANDAR,
  POTENCIAS_NOMINALES_KVA,
  tensionPredominanteV,
  type ParametrosTransformador,
} from './transformador';

const base: ParametrosTransformador = {
  corrienteSecundarioA: 1500,
  tensionSecundariaV: 400,
  tensionPrimariaKv: 13.8,
  margen: 0.25,
  tipo: 'aceite',
};

describe('calcularTransformador', () => {
  it('1500 A @ 400 V 3F → ~1039 kVA carga; con 25% → 1299 → 1600 kVA estándar', () => {
    const r = calcularTransformador(base);
    expect(r.kvaRequerido).toBeGreaterThan(1290);
    expect(r.kvaRequerido).toBeLessThan(1310);
    expect(r.kvaNominal).toBe(1600);
    expect(r.excede).toBe(false);
  });

  it('elige la potencia estándar inmediatamente superior a la requerida', () => {
    const r = calcularTransformador({ ...base, corrienteSecundarioA: 500, margen: 0 });
    expect(r.kvaNominal).toBe(400);
  });

  it('calcula corrientes primaria y secundaria coherentes (potencia nominal)', () => {
    const r = calcularTransformador(base);
    expect(r.inPrimarioA).toBeCloseTo(66.9, 0);
    expect(r.inSecundarioA).toBeCloseTo(2309, -1);
  });

  it('grupo vectorial recomendado por defecto es Dyn11', () => {
    const r = calcularTransformador({ ...base, corrienteSecundarioA: 1000, margen: 0 });
    expect(r.grupoVectorial).toBe('Dyn11');
  });

  it('Icc secundario = In_sec × 100 / Ucc (red infinita)', () => {
    // base → 1600 kVA, Ucc 6%, In sec ≈ 2309 A → Icc ≈ 38.5 kA.
    const r = calcularTransformador(base);
    expect(r.iccSecundarioKa).toBeCloseTo((r.inSecundarioA * 100) / r.uccPorcentaje / 1000, 6);
    expect(r.iccSecundarioKa).toBeCloseTo(38.5, 0);
  });

  it('Icc de un banco en paralelo suma los aportes de las unidades', () => {
    // 9000 A @ 400 V sin margen ≈ 6235 kVA → excede → 2 × 3150 kVA (Ucc 7%).
    const r = calcularTransformador({ ...base, corrienteSecundarioA: 9000, margen: 0 });
    expect(r.excede).toBe(true);
    expect(r.paralelo).toBeDefined();
    const { cantidad, cadaUno } = r.paralelo!;
    const iccUnidad = (cadaUno.inSecundarioA * 100) / 7 / 1000;
    expect(r.iccSecundarioKa).toBeCloseTo(cantidad * iccUnidad, 6);
  });
});

describe('Ucc según tipo y potencia', () => {
  it('aceite: ≤630→4%, ≤1250→5%, ≤2500→6%, >2500→7%', () => {
    const ace = (kva: number) => calcularTransformador({
      ...base,
      tipo: 'aceite',
      // Corriente que apunta a esa potencia con margen 0.
      corrienteSecundarioA: (kva * 1000) / (Math.sqrt(3) * 400),
      margen: 0,
    }).uccPorcentaje;
    expect(ace(630)).toBe(4);
    expect(ace(1250)).toBe(5);
    expect(ace(2500)).toBe(6);
    expect(ace(3150)).toBe(7);
  });

  it('seco: 6% hasta 2500 kVA, 7% por encima', () => {
    const seco = (kva: number) => calcularTransformador({
      ...base,
      tipo: 'seco',
      corrienteSecundarioA: (kva * 1000) / (Math.sqrt(3) * 400),
      margen: 0,
    }).uccPorcentaje;
    expect(seco(500)).toBe(6);
    expect(seco(1000)).toBe(6);
    expect(seco(2500)).toBe(6);
    expect(seco(3150)).toBe(7);
  });
});

describe('Pérdidas según tipo', () => {
  it('seco tiene más pérdidas en vacío que aceite (mismo kVA)', () => {
    const aceite = calcularTransformador({ ...base, tipo: 'aceite', corrienteSecundarioA: 1500, margen: 0.25 });
    const seco = calcularTransformador({ ...base, tipo: 'seco', corrienteSecundarioA: 1500, margen: 0.25 });
    expect(seco.kvaNominal).toBe(aceite.kvaNominal);
    expect(seco.perdidasVacioW).toBeGreaterThan(aceite.perdidasVacioW);
  });

  it('pérdidas en carga (Pk) son similares entre tipos', () => {
    const aceite = calcularTransformador({ ...base, tipo: 'aceite', corrienteSecundarioA: 1500, margen: 0.25 });
    const seco = calcularTransformador({ ...base, tipo: 'seco', corrienteSecundarioA: 1500, margen: 0.25 });
    expect(Math.abs(seco.perdidasCargaW - aceite.perdidasCargaW)).toBeLessThan(500);
  });

  it('reporta perdidasVacioW y perdidasCargaW > 0', () => {
    const r = calcularTransformador(base);
    expect(r.perdidasVacioW).toBeGreaterThan(0);
    expect(r.perdidasCargaW).toBeGreaterThan(0);
  });
});

describe('Sugerencia de transformadores en paralelo', () => {
  it('cuando 1 unidad excede 5000 kVA, sugiere paralelo de 2 unidades', () => {
    // 8000 A @ 400 V → 5543 kVA × 1.25 = 6929 → excede 5000.
    const r = calcularTransformador({
      ...base, corrienteSecundarioA: 8000, tensionPrimariaKv: 23, margen: 0.25,
    });
    expect(r.excede).toBe(true);
    expect(r.kvaNominal).toBe(MAX_KVA_ESTANDAR);
    expect(r.paralelo).toBeDefined();
    expect(r.paralelo!.cantidad).toBe(2);
    // 6929/2 = 3465 → primer estándar ≥ es 4000.
    expect(r.paralelo!.cadaUno.kvaNominal).toBe(4000);
  });

  it('sin paralelo cuando 1 unidad alcanza', () => {
    const r = calcularTransformador(base);
    expect(r.paralelo).toBeUndefined();
  });

  it('paralelo: corrientes por unidad coherentes con su kVA', () => {
    const r = calcularTransformador({
      ...base, corrienteSecundarioA: 8000, tensionPrimariaKv: 23, margen: 0.25,
    });
    const u = r.paralelo!.cadaUno;
    // 4000 kVA @ 400 V → ~5774 A; @ 23 kV → ~100.4 A.
    expect(u.inSecundarioA).toBeCloseTo(5774, -1);
    expect(u.inPrimarioA).toBeCloseTo(100.4, 0);
  });
});

describe('tensionPredominanteV', () => {
  it('detecta la tensión BT más frecuente', () => {
    expect(tensionPredominanteV([400, 400, 400, 230])).toBe(400);
    expect(tensionPredominanteV([480, 480, 230, 480, 400])).toBe(480);
  });

  it('ignora tensiones MT (>1000 V)', () => {
    expect(tensionPredominanteV([4160, 6600, 400])).toBe(400);
  });

  it('devuelve 400 V por defecto si no hay tensiones válidas', () => {
    expect(tensionPredominanteV([])).toBe(400);
    expect(tensionPredominanteV([4160, 6600])).toBe(400);
  });
});

describe('POTENCIAS_NOMINALES_KVA', () => {
  it('está ordenado y termina en MAX_KVA_ESTANDAR (5000)', () => {
    for (let i = 1; i < POTENCIAS_NOMINALES_KVA.length; i += 1) {
      expect(POTENCIAS_NOMINALES_KVA[i]!).toBeGreaterThan(POTENCIAS_NOMINALES_KVA[i - 1]!);
    }
    expect(POTENCIAS_NOMINALES_KVA[POTENCIAS_NOMINALES_KVA.length - 1]).toBe(MAX_KVA_ESTANDAR);
  });
});
