import { describe, it, expect } from 'vitest';
import { corrienteDesdeMva, sugerirBarraMt, dimensionarMt } from './mt';
import type { SalidaMt } from '../types';

describe('corrienteDesdeMva', () => {
  it('calcula I = S·1000 / (√3·U)', () => {
    expect(corrienteDesdeMva(2, 36)).toBeCloseTo(32.08, 1);
    expect(corrienteDesdeMva(1, 12)).toBeCloseTo(48.11, 1);
  });
  it('devuelve 0 con datos inválidos', () => {
    expect(corrienteDesdeMva(0, 36)).toBe(0);
    expect(corrienteDesdeMva(2, 0)).toBe(0);
  });
});

describe('sugerirBarraMt', () => {
  it('toma la primera barra que cubre la corriente', () => {
    expect(sugerirBarraMt(500)).toBe(630);
    expect(sugerirBarraMt(630)).toBe(630);
    expect(sugerirBarraMt(700)).toBe(1250);
  });
  it('devuelve undefined si excede el catálogo', () => {
    expect(sugerirBarraMt(99999)).toBeUndefined();
  });
});

describe('dimensionarMt', () => {
  const base: SalidaMt[] = [
    { id: 'a', descripcion: 'Entrada', tipoCelda: 'entrada', corrienteA: 1200 },
    { id: 'b', descripcion: 'Feeder TR1', tipoCelda: 'salida', potenciaMva: 2 },
    { id: 'c', descripcion: 'Medida', tipoCelda: 'medida' },
  ];

  it('dimensiona y ordena celdas entrada→salida→medida', () => {
    const r = dimensionarMt(base, 36, 25);
    expect(r.tablero).toBeDefined();
    expect(r.celdas.map((c) => c.salida.tipoCelda)).toEqual(['entrada', 'salida', 'medida']);
    expect(r.salidasSinAsignar).toHaveLength(0);
  });

  it('barra elegida por la corriente de entrada (1200 A → 1250 A)', () => {
    const r = dimensionarMt(base, 36, 25);
    expect(r.tablero?.corrienteBarraA).toBe(1250);
  });

  it('suma anchos del catálogo (clase 36 kV)', () => {
    const r = dimensionarMt(base, 36, 25);
    // entrada 1000 + salida 1000 + medida 1200
    expect(r.tablero?.anchoTotalMm).toBe(3200);
  });

  it('rechaza clase de tensión fuera de catálogo', () => {
    const r = dimensionarMt(base, 40, 25);
    expect(r.tablero).toBeUndefined();
    expect(r.motivo).toMatch(/Clase de tensión/);
  });

  it('rechaza Icc fuera de catálogo', () => {
    const r = dimensionarMt(base, 36, 99);
    expect(r.tablero).toBeUndefined();
    expect(r.motivo).toMatch(/Icc/);
  });

  it('acepta Icc de 65 kA', () => {
    const r = dimensionarMt(base, 36, 65);
    expect(r.tablero).toBeDefined();
    expect(r.tablero?.iccKa).toBe(65);
  });

  it('sin celdas válidas devuelve motivo', () => {
    const r = dimensionarMt([], 36, 25);
    expect(r.tablero).toBeUndefined();
    expect(r.motivo).toMatch(/Sin celdas/);
  });
});
