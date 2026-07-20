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

  it('la Icc de barra del trafo filtra el Icu del principal y advierte sobre las salidas', () => {
    // 4 × 250 kW @ 400 V, fs 0.8 → I total ≈ 1364 A → trafo 1250 kVA (Ucc 5%)
    // → In sec ≈ 1804 A, Icc ≈ 36.1 kA. El principal debe tener Icu ≥ 36.1
    // (NW, 65 kA — el NT de 42 kA cumple pero no llega a 1804 A) y las salidas
    // NSX F (36 kA) quedan bajo la Icc → 4 advertencias.
    const cargas = [salida3F('1', 250), salida3F('2', 250), salida3F('3', 250), salida3F('4', 250)];
    const r = dimensionarTdg(cargas, 0.8, 'Schneider', CONFIG_TRAFO_DEFAULT);
    const t = r.tablero!;
    expect(t.iccBarraKa).toBeCloseTo(36.1, 0);
    expect(t.principal.icuKA).toBeGreaterThanOrEqual(t.iccBarraKa!);
    expect(r.advertenciasIcu).toBeDefined();
    expect(r.advertenciasIcu).toHaveLength(4);
    expect(r.advertenciasIcu![0]).toContain('Icu 36 kA');
  });

  it('sin superar el Icu de las salidas no hay advertencias', () => {
    // Ejemplo chico: trafo 630 kVA (Ucc 4%) → Icc ≈ 22.7 kA < 36 kA de los NSX F.
    const r = dimensionarTdg([salida3F('1', 100), salida3F('2', 150)], 0.8, 'Schneider', CONFIG_TRAFO_DEFAULT);
    expect(r.tablero!.iccBarraKa).toBeLessThan(36);
    expect(r.advertenciasIcu).toBeUndefined();
  });

  it('sin configuración de trafo, el comportamiento anterior se mantiene', () => {
    const r = dimensionarTdg([salida3F('1', 100)], 1);
    expect(r.tablero!.trafoInSecundarioA).toBeUndefined();
    expect(r.tablero!.iccBarraKa).toBeUndefined();
    expect(r.advertenciasIcu).toBeUndefined();
    expect(r.tablero!.principal.inA).toBeGreaterThanOrEqual(r.tablero!.corrienteTotalA);
  });

  it('CDC grande (4000–6000 A) dimensiona con Masterpact b y barra al tope', () => {
    // 12 × 300 kW @ 400 V (I ≈ 481.3 c/u, Σ ≈ 5776 A, fs 1) → antes:
    // "sin interruptor principal Schneider". Ahora: NW63 (6300 A) con la
    // barra en el tope CDC (6000 A, Ir del ACB ajustado a la barra).
    const cargas = Array.from({ length: 12 }, (_, i) => salida3F(String(i + 1), 300));
    const r = dimensionarTdg(cargas, 1);
    expect(r.tablero).toBeDefined();
    const t = r.tablero!;
    expect(t.principal.referencia).toContain('NW63');
    expect(t.barra.inA).toBe(6000);

    // 10 × 300 kW ≈ 4813 A → NW50b (5000) con barra 2×(200×10) de 5000 A.
    const r10 = dimensionarTdg(
      Array.from({ length: 10 }, (_, i) => salida3F(String(i + 1), 300)), 1,
    );
    expect(r10.tablero!.principal.referencia).toContain('NW50b');
    expect(r10.tablero!.barra.inA).toBe(5000);
  });

  it('la barra nunca queda bajo el In del principal', () => {
    // 2 × 150 kW @ 400 V (I ≈ 240.6 c/u, Σ = 481.3, fs 1) → principal NSX630.
    // Antes la barra se elegía solo por la corriente (Cu 50×5, 500 A < 630 A
    // del principal, que deja pasar hasta su In sin disparar).
    const r = dimensionarTdg([salida3F('1', 150), salida3F('2', 150)], 1);
    const t = r.tablero!;
    expect(t.principal.inA).toBe(630);
    expect(t.barra.inA).toBeGreaterThanOrEqual(t.principal.inA);
  });

  it('el derrateo por altura selecciona salidas, principal y barra contra I / F2', () => {
    // 3 × 75 kW @ 400 V (I ≈ 120.3 c/u, Σ = 360.9 con fs 1).
    // Sin derrateo: selección 360.9 → principal NSX400, barra Cu 40×5 (400 A).
    // Con F2 = 0.9: selección 401 → principal NSX630, barra Cu 50×5 (500 A);
    // la salida sube de TM160 (150.4) a TM200 (167.1).
    const cargas = [salida3F('1', 75), salida3F('2', 75), salida3F('3', 75)];
    const base = dimensionarTdg(cargas, 1).tablero!;
    const derrateado = dimensionarTdg(cargas, 1, 'Schneider', undefined, 0.9).tablero!;

    expect(base.factorDerrateoAltura).toBe(1);
    expect(derrateado.factorDerrateoAltura).toBe(0.9);
    // La corriente real de las cargas no cambia; solo la de selección.
    expect(derrateado.corrienteTotalA).toBeCloseTo(base.corrienteTotalA, 5);
    expect(derrateado.corrienteSeleccionA).toBeCloseTo(base.corrienteTotalA / 0.9, 5);
    expect(derrateado.principal.inA).toBeGreaterThan(base.principal.inA);
    expect(derrateado.barra.inA).toBeGreaterThan(base.barra.inA);
    expect(derrateado.salidas[0]!.proteccion.inA).toBeGreaterThan(base.salidas[0]!.proteccion.inA);
  });

  it('cantidad de columnas crece según el número de salidas', () => {
    const N = salidasPorColumna() + 1;
    const cargas: Carga[] = Array.from({ length: N }, (_, i) => salida3F(String(i + 1), 30));
    const r = dimensionarTdg(cargas, 1);
    // 1 columna principal + 2 columnas de salidas = 3
    expect(r.tablero!.columnas).toBe(3);
  });
});
