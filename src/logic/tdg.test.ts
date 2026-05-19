import { describe, expect, it } from 'vitest';
import { dimensionarTdg, salidasPorColumna } from './tdg';
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

  it('cantidad de columnas crece según el número de salidas', () => {
    const N = salidasPorColumna() + 1;
    const cargas: Carga[] = Array.from({ length: N }, (_, i) => salida3F(String(i + 1), 30));
    const r = dimensionarTdg(cargas, 1);
    // 1 columna principal + 2 columnas de salidas = 3
    expect(r.tablero!.columnas).toBe(3);
  });
});
