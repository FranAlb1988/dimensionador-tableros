import { describe, expect, it } from 'vitest';
import {
  calcularTransformador,
  POTENCIAS_NOMINALES_KVA,
  tensionPredominanteV,
} from './transformador';

describe('calcularTransformador', () => {
  it('1500 A @ 400 V 3F → ~1039 kVA carga; con 25% → 1299 → 1600 kVA estándar', () => {
    const r = calcularTransformador({
      corrienteSecundarioA: 1500,
      tensionSecundariaV: 400,
      tensionPrimariaKv: 13.8,
      margen: 0.25,
    });
    expect(r.kvaRequerido).toBeGreaterThan(1290);
    expect(r.kvaRequerido).toBeLessThan(1310);
    expect(r.kvaNominal).toBe(1600);
    expect(r.excede).toBe(false);
  });

  it('elige la potencia estándar inmediatamente superior a la requerida', () => {
    // 500 A @ 400 V → 346 kVA. Con 0% margen, kvaNominal = 400.
    const r = calcularTransformador({
      corrienteSecundarioA: 500,
      tensionSecundariaV: 400,
      tensionPrimariaKv: 13.8,
      margen: 0,
    });
    expect(r.kvaNominal).toBe(400);
  });

  it('calcula corrientes primaria y secundaria coherentes (potencia nominal)', () => {
    // 1600 kVA @ 13.8 kV → I_pri = 1600 / (√3 × 13.8) ≈ 66.9 A
    // 1600 kVA @ 400 V → I_sec = 1600 × 1000 / (√3 × 400) ≈ 2309 A
    const r = calcularTransformador({
      corrienteSecundarioA: 1500,
      tensionSecundariaV: 400,
      tensionPrimariaKv: 13.8,
      margen: 0.25,
    });
    expect(r.inPrimarioA).toBeCloseTo(66.9, 0);
    expect(r.inSecundarioA).toBeCloseTo(2309, -1);
  });

  it('Ucc típica crece con la potencia (≤630→4%; ≤1250→5%; ≤2500→6%; >2500→7%)', () => {
    const r400 = calcularTransformador({
      corrienteSecundarioA: 400, tensionSecundariaV: 400, tensionPrimariaKv: 13.8, margen: 0,
    });
    const r1000 = calcularTransformador({
      corrienteSecundarioA: 1200, tensionSecundariaV: 400, tensionPrimariaKv: 13.8, margen: 0,
    });
    const r2000 = calcularTransformador({
      corrienteSecundarioA: 2500, tensionSecundariaV: 400, tensionPrimariaKv: 13.8, margen: 0,
    });
    const r4000 = calcularTransformador({
      corrienteSecundarioA: 5000, tensionSecundariaV: 400, tensionPrimariaKv: 13.8, margen: 0,
    });
    expect(r400.uccPorcentaje).toBe(4);
    expect(r1000.uccPorcentaje).toBe(5);
    expect(r2000.uccPorcentaje).toBe(6);
    expect(r4000.uccPorcentaje).toBe(7);
  });

  it('marca excede=true cuando la potencia supera 5000 kVA', () => {
    // 8000 A @ 400 V → 5543 kVA → excede 5000 kVA max del catálogo.
    const r = calcularTransformador({
      corrienteSecundarioA: 8000,
      tensionSecundariaV: 400,
      tensionPrimariaKv: 23,
      margen: 0.25,
    });
    expect(r.excede).toBe(true);
    expect(r.kvaNominal).toBe(POTENCIAS_NOMINALES_KVA[POTENCIAS_NOMINALES_KVA.length - 1]);
  });

  it('grupo vectorial recomendado por defecto es Dyn11', () => {
    const r = calcularTransformador({
      corrienteSecundarioA: 1000, tensionSecundariaV: 400, tensionPrimariaKv: 13.8, margen: 0,
    });
    expect(r.grupoVectorial).toBe('Dyn11');
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
