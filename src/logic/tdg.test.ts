import { describe, expect, it } from 'vitest';
import { dimensionarTdg, salidasPorColumna } from './tdg';
import { CONFIG_TRAFO_DEFAULT, calcularTransformador } from './transformador';
import type { Carga } from '../types';

function salida3F(id: string, kW: number, fs = 1): Carga {
  return {
    id,
    descripcion: `Sub-${id}`,
    tipo: 'otro',
    potenciaKw: kW,
    tensionV: 400,
    fases: '3F',
    factorServicio: fs,
  };
}

describe('dimensionarTdg', () => {
  it('dimensiona un TDG con 3 salidas y produce principal NSX + barra Cu', () => {
    const r = dimensionarTdg(
      [salida3F('1', 30), salida3F('2', 50), salida3F('3', 75)],
      0.8,
    );
    expect(r.tablero).toBeDefined();
    const t = r.tablero!;
    expect(t.salidas).toHaveLength(3);
    expect(t.principal.familia.startsWith('NSX')).toBe(true);
    expect(t.barra.material).toBe('Cu');
    expect(t.corrienteTotalA).toBeGreaterThan(0);
    expect(t.factorSimultaneidad).toBe(0.8);
  });

  it('para suma de salidas grande (>630 A) elige Masterpact', () => {
    // 3 salidas de 250 kW c/u a 400 V trifásico ≈ 415 A cada una; total ≈ 1245 A
    const r = dimensionarTdg(
      [salida3F('1', 250), salida3F('2', 250), salida3F('3', 250)],
      1,
    );
    expect(r.tablero).toBeDefined();
    expect(r.tablero!.principal.familia.startsWith('Masterpact')).toBe(true);
    expect(r.tablero!.barra.inA).toBeGreaterThanOrEqual(r.tablero!.corrienteTotalA);
  });

  it('factor de simultaneidad reduce la corriente total y puede bajar al principal', () => {
    const cargas = [salida3F('1', 200), salida3F('2', 200), salida3F('3', 200)];
    const conFs1 = dimensionarTdg(cargas, 1).tablero!;
    const conFs05 = dimensionarTdg(cargas, 0.5).tablero!;
    expect(conFs05.corrienteTotalA).toBeLessThan(conFs1.corrienteTotalA);
    expect(conFs05.principal.inA).toBeLessThanOrEqual(conFs1.principal.inA);
  });

  it('regla del mayor consumidor: el principal nunca queda bajo una salida individual', () => {
    // 1 sola salida de 300 kW (≈481 A) con fs 0.8: antes fs×Σ = 385 A dejaba
    // un principal de 400 A que dispararía; ahora la salida mayor entra al 100%.
    const unica = salida3F('1', 300);
    const r = dimensionarTdg([unica], 0.8);
    const t = r.tablero!;
    const iSalida = t.salidas[0]!.corrienteDisenoA;
    expect(t.corrienteTotalA).toBeCloseTo(iSalida, 5);
    expect(t.principal.inA).toBeGreaterThanOrEqual(iSalida);
    expect(t.barra.inA).toBeGreaterThanOrEqual(iSalida);
  });

  it('con varias salidas: I total = mayor + fs × resto', () => {
    const r = dimensionarTdg([salida3F('1', 100), salida3F('2', 200), salida3F('3', 50)], 0.8);
    const t = r.tablero!;
    const is = t.salidas.map((s) => s.corrienteDisenoA);
    const suma = is.reduce((a, b) => a + b, 0);
    const mayor = Math.max(...is);
    expect(t.corrienteTotalA).toBeCloseTo(mayor + 0.8 * (suma - mayor), 5);
  });

  it('clamp del factor de simultaneidad: valores fuera de rango se limitan', () => {
    const cargas = [salida3F('1', 100)];
    const r = dimensionarTdg(cargas, 5); // se clampa a 1
    expect(r.tablero!.factorSimultaneidad).toBe(1);
  });

  it('cargas sin potencia ni corriente quedan en cargasSinAsignar', () => {
    const c: Carga = {
      id: 'x', descripcion: 'x', tipo: 'otro',
      tensionV: 400, fases: '3F', factorServicio: 1,
    };
    const r = dimensionarTdg([c], 1);
    expect(r.cargasSinAsignar).toHaveLength(1);
    expect(r.tablero).toBeUndefined();
  });

  it('las salidas no-motor llevan margen 1.25 (In del NSX ≥ 1.25 × I diseño)', () => {
    // 90 kW × FS 1.1 @ 400 V ≈ 158.7 A → ×1.25 = 198.4 → NSX250 TM200 (no TM160).
    const r = dimensionarTdg([salida3F('1', 90, 1.1)], 1);
    const s = r.tablero!.salidas[0]!;
    expect(s.proteccion.inA).toBeGreaterThanOrEqual(s.corrienteDisenoA * 1.25);
  });

  it('con configuración de trafo, el principal y la barra cubren la In del secundario', () => {
    // Carga ≈ 651 A → trafo sugerido 630 kVA (margen 25%) → In sec ≈ 909 A.
    // Sin coordinación el principal quedaba en 800 A (< 909 A).
    const cargas = [salida3F('1', 80), salida3F('2', 120), salida3F('3', 90, 1.1),
      salida3F('4', 25), salida3F('5', 35), salida3F('6', 150)];
    const r = dimensionarTdg(cargas, 0.8, 'Schneider', CONFIG_TRAFO_DEFAULT);
    const t = r.tablero!;
    expect(t.trafoInSecundarioA).toBeDefined();
    const trafo = calcularTransformador({
      ...CONFIG_TRAFO_DEFAULT, corrienteSecundarioA: t.corrienteTotalA,
    });
    expect(t.trafoInSecundarioA).toBeCloseTo(trafo.inSecundarioA, 3);
    expect(t.principal.inA).toBeGreaterThanOrEqual(t.trafoInSecundarioA!);
    expect(t.barra.inA).toBeGreaterThanOrEqual(t.trafoInSecundarioA!);
  });

  it('sin configuración de trafo, el comportamiento anterior se mantiene', () => {
    const r = dimensionarTdg([salida3F('1', 100)], 1);
    expect(r.tablero!.trafoInSecundarioA).toBeUndefined();
    expect(r.tablero!.principal.inA).toBeGreaterThanOrEqual(r.tablero!.corrienteTotalA);
  });

  it('cantidad de columnas crece según el número de salidas', () => {
    const N = salidasPorColumna() + 1;
    const cargas: Carga[] = Array.from({ length: N }, (_, i) => salida3F(String(i + 1), 30));
    const r = dimensionarTdg(cargas, 1);
    // 1 columna principal + 2 columnas de salidas = 3
    expect(r.tablero!.columnas).toBe(3);
  });
});
