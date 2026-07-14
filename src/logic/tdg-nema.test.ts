import { describe, expect, it } from 'vitest';
import { dimensionarTdgNema, sugerirBarra, sugerirMain } from './tdg-nema';
import { CONFIG_TRAFO_DEFAULT } from './transformador';
import type { Carga } from '../types';

function salida(id: string, kW: number, fs = 1): Carga {
  return {
    id,
    descripcion: `S-${id}`,
    tipo: 'otro',
    potenciaKw: kW,
    unidadPotencia: 'kW',
    tensionV: 480,
    fases: '3F',
    factorServicio: fs,
  };
}

describe('sugerirMain (Switchgear BT NEMA)', () => {
  it('para FLC 100 A elige 800AF · 200AS', () => {
    const m = sugerirMain(100);
    expect(m?.frameAF).toBe(800);
    expect(m?.rating).toBe('200AS');
  });
  it('para FLC 700 A salta a 2000AF · 1000AS', () => {
    const m = sugerirMain(700);
    expect(m?.frameAF).toBe(2000);
    expect(m?.rating).toBe('1000AS');
  });
  it('para FLC 1700 A elige 3200AF · 2500AS', () => {
    const m = sugerirMain(1700);
    expect(m?.frameAF).toBe(3200);
    expect(m?.rating).toBe('2500AS');
  });
  it('para FLC 4500 A elige 6000AF · 6000AS', () => {
    const m = sugerirMain(4500);
    expect(m?.frameAF).toBe(6000);
    expect(m?.rating).toBe('6000AS');
  });
  it('FLC fuera de rango devuelve undefined', () => {
    expect(sugerirMain(5000)).toBeUndefined();
    expect(sugerirMain(0)?.frameAF).toBe(800);
  });
});

describe('sugerirBarra (Switchgear BT NEMA)', () => {
  it('FLC 0-1600 → barra 2000AF', () => {
    expect(sugerirBarra(100)?.frameAF).toBe(2000);
    expect(sugerirBarra(1600)?.frameAF).toBe(2000);
  });
  it('FLC 1601-2560 → barra 3200AF', () => {
    expect(sugerirBarra(2000)?.frameAF).toBe(3200);
  });
  it('FLC 2561-3200 → barra 4000AF', () => {
    expect(sugerirBarra(3000)?.frameAF).toBe(4000);
  });
});

describe('dimensionarTdgNema', () => {
  it('TDG con 3 salidas pequeñas elige principal 800AF y barra 2000AF', () => {
    const cargas = [salida('1', 100), salida('2', 80), salida('3', 60)];
    const r = dimensionarTdgNema(cargas, 1);
    expect(r.tablero).toBeDefined();
    const t = r.tablero!;
    expect(t.principal.frameAF).toBe(800);
    expect(t.barra.frameAF).toBe(2000);
    expect(t.salidas).toHaveLength(3);
  });

  it('FLC alto (varios motores grandes) escala a Masterpact-equivalent', () => {
    // 4 salidas de 250 kW c/u a 480V trifásico ≈ 347 A cada una; total ≈ 1390 A
    const cargas = [salida('1', 250), salida('2', 250), salida('3', 250), salida('4', 250)];
    const r = dimensionarTdgNema(cargas, 1);
    expect(r.tablero).toBeDefined();
    expect(r.tablero!.principal.frameAF).toBe(2000);
    expect(r.tablero!.barra.frameAF).toBe(2000);
  });

  it('factor de simultaneidad reduce FLC y puede bajar al principal', () => {
    const cargas = [salida('1', 200), salida('2', 200), salida('3', 200)];
    const fs10 = dimensionarTdgNema(cargas, 1).tablero!;
    const fs05 = dimensionarTdgNema(cargas, 0.5).tablero!;
    expect(fs05.corrienteTotalA).toBeLessThan(fs10.corrienteTotalA);
    expect(fs05.principal.ratingA).toBeLessThanOrEqual(fs10.principal.ratingA);
  });

  it('regla del mayor consumidor: main y barra nunca quedan bajo una salida individual', () => {
    // 1 sola salida de 300 kW @ 480 V (≈433 A) con fs 0.5: antes fs×Σ = 217 A
    // elegía un main de 250-300 A bajo la corriente real de la salida.
    const r = dimensionarTdgNema([salida('1', 300)], 0.5);
    const t = r.tablero!;
    const iSalida = t.salidas[0]!.corrienteDisenoA;
    expect(t.corrienteTotalA).toBeCloseTo(iSalida, 5);
    expect(t.principal.ratingA).toBeGreaterThanOrEqual(iSalida);
  });

  it('con varias salidas: FLC total = mayor + fs × resto', () => {
    const r = dimensionarTdgNema([salida('1', 100), salida('2', 200), salida('3', 50)], 0.8);
    const t = r.tablero!;
    const is = t.salidas.map((s) => s.corrienteDisenoA);
    const suma = is.reduce((a, b) => a + b, 0);
    const mayor = Math.max(...is);
    expect(t.corrienteTotalA).toBeCloseTo(mayor + 0.8 * (suma - mayor), 5);
  });

  it('clamp del factor de simultaneidad', () => {
    const r = dimensionarTdgNema([salida('1', 100)], 5);
    expect(r.tablero!.factorSimultaneidad).toBe(1);
  });

  it('cargas sin potencia ni corriente quedan sin asignar', () => {
    const c: Carga = {
      id: 'x', descripcion: 'x', tipo: 'otro',
      tensionV: 480, fases: '3F', factorServicio: 1,
    };
    const r = dimensionarTdgNema([c], 1);
    expect(r.cargasSinAsignar).toHaveLength(1);
    expect(r.tablero).toBeUndefined();
  });

  it('cada salida obtiene un breaker FDR o electronic según corriente', () => {
    const cargas = [salida('peq', 30), salida('grd', 300)];
    const r = dimensionarTdgNema(cargas, 1);
    const peq = r.tablero!.salidas[0]!;
    const grd = r.tablero!.salidas[1]!;
    expect(peq.breaker.ratingTipo).toBe('AT');
    expect(grd.breaker.ratingTipo).toBe('AS');
  });

  it('las salidas llevan margen 1.25 (rating ≥ 1.25 × I diseño), motor incluido', () => {
    const motor: Carga = {
      id: 'chiller', descripcion: 'Chiller', tipo: 'motor',
      potenciaKw: 110, tensionV: 400, fases: '3F', factorServicio: 1.15, arranque: 'DOL',
    };
    const r = dimensionarTdgNema([motor, salida('otro', 90, 1.1)], 1);
    for (const s of r.tablero!.salidas) {
      expect(s.breaker.ratingA).toBeGreaterThanOrEqual(s.corrienteDisenoA * 1.25);
    }
  });

  it('con configuración de trafo, main y barra cubren la In del secundario', () => {
    // Carga ≈ 651 A → main por rango sería 1000AS; el trafo 630 kVA a 400 V
    // tiene In sec ≈ 909 A → main y barra deben quedar ≥ 909 A.
    const cargas = [salida('1', 200), salida('2', 200), salida('3', 200)];
    const r = dimensionarTdgNema(cargas, 1, { ...CONFIG_TRAFO_DEFAULT, tensionSecundariaV: 480 });
    const t = r.tablero!;
    expect(t.trafoInSecundarioA).toBeDefined();
    expect(t.principal.ratingA).toBeGreaterThanOrEqual(t.trafoInSecundarioA!);
    expect(t.barra.frameAF).toBeGreaterThanOrEqual(t.trafoInSecundarioA!);
  });

  it('sugerirMain con piso de rating salta a una fila con rating suficiente', () => {
    // FLC 100 A cae en la fila 200AS; con piso 900 A debe subir a 1000AS.
    expect(sugerirMain(100)?.ratingA).toBe(200);
    expect(sugerirMain(100, 900)?.ratingA).toBeGreaterThanOrEqual(900);
  });
});
