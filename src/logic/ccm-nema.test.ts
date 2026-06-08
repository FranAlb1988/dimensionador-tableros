import { describe, expect, it } from 'vitest';
import { dimensionarCcmNema, sugerirBarraNema, sugerirBreakerNema } from './ccm-nema';
import type { Carga } from '../types';
import { KW_POR_HP } from '../util/potencia';

function motor(id: string, hp: number, fs = 1): Carga {
  return {
    id,
    descripcion: `M-${id}`,
    tipo: 'motor',
    potenciaKw: hp * KW_POR_HP,
    unidadPotencia: 'HP',
    tensionV: 480,
    fases: '3F',
    factorServicio: fs,
    arranque: 'DOL',
  };
}

function alimentador(id: string, kW: number): Carga {
  return {
    id,
    descripcion: `A-${id}`,
    tipo: 'otro',
    potenciaKw: kW,
    unidadPotencia: 'kW',
    tensionV: 480,
    fases: '3F',
    factorServicio: 1,
  };
}

describe('sugerirBreakerNema', () => {
  it('para 50 A elige FDR 100AF con trip ≥ 50', () => {
    const b = sugerirBreakerNema(50);
    expect(b).toBeDefined();
    expect(b!.frameAF).toBe(100);
    expect(b!.ratingTipo).toBe('AT');
    expect(b!.ratingA).toBeGreaterThanOrEqual(50);
  });

  it('para 200 A elige FDR 225AF', () => {
    const b = sugerirBreakerNema(200);
    expect(b!.frameAF).toBe(225);
    expect(b!.ratingA).toBeGreaterThanOrEqual(200);
  });

  it('para 500 A salta a electronic 600AF (AS)', () => {
    const b = sugerirBreakerNema(500);
    expect(b!.frameAF).toBe(600);
    expect(b!.ratingTipo).toBe('AS');
  });

  it('para 1500 A elige 2000AF electronic', () => {
    const b = sugerirBreakerNema(1500);
    expect(b!.frameAF).toBe(2000);
    expect(b!.ratingTipo).toBe('AS');
    expect(b!.ratingA).toBeGreaterThanOrEqual(1500);
  });
});

describe('sugerirBarraNema', () => {
  it('para 100 A FLC (0-480) elige barra 600 A', () => {
    expect(sugerirBarraNema(100)?.capacidadA).toBe(600);
  });
  it('para 600 A FLC (480-640) elige barra 800 A', () => {
    expect(sugerirBarraNema(600)?.capacidadA).toBe(800);
  });
  it('para 700 A FLC (640-960) elige barra 1200 A', () => {
    expect(sugerirBarraNema(700)?.capacidadA).toBe(1200);
  });
  it('para 1500 A FLC (1280-1600) elige barra 2000 A', () => {
    expect(sugerirBarraNema(1500)?.capacidadA).toBe(2000);
  });
});

describe('dimensionarCcmNema', () => {
  it('motor de 10 HP → NEMA size 1, 1.5X, MCP 30 (AB CENTERLINE 2100)', () => {
    const r = dimensionarCcmNema([motor('1', 10)]);
    expect(r.tablero).toBeDefined();
    const a = r.asignaciones[0]!;
    expect(a.motor?.contactorSize).toBe(1);
    expect(a.espaciosX).toBe(1.5);
    expect(a.motor?.mcpFrameA).toBe(30);
    expect(a.version).toBe('extraible');
  });

  it('motor de 100 HP → NEMA size 5, 3.5X, MCP 400 (AB CENTERLINE 2100)', () => {
    const r = dimensionarCcmNema([motor('1', 100)]);
    const a = r.asignaciones[0]!;
    expect(a.motor?.contactorSize).toBe(5);
    expect(a.espaciosX).toBe(3.5);
    expect(a.motor?.mcpFrameA).toBe(400);
  });

  it('motor de 250 HP → NEMA size 6, fijo, 6X (AB CENTERLINE 2100)', () => {
    const r = dimensionarCcmNema([motor('1', 250)]);
    const a = r.asignaciones[0]!;
    expect(a.motor?.contactorSize).toBe(6);
    expect(a.version).toBe('fijo');
    expect(a.espaciosX).toBe(6);
  });

  it('HP intermedio (12 HP) sube al siguiente estándar (15 HP)', () => {
    const r = dimensionarCcmNema([motor('1', 12)]);
    const a = r.asignaciones[0]!;
    expect(a.motor?.hp).toBe(15);
  });

  it('alimentador no-motor con I diseño de ~30 A elige FDR 100AF', () => {
    const c = alimentador('1', 18); // 18 kW @ 480V 3F ≈ 25 A
    const r = dimensionarCcmNema([c]);
    expect(r.asignaciones).toHaveLength(1);
    const a = r.asignaciones[0]!;
    expect(a.breaker?.frameAF).toBe(100);
  });

  it('ancho del tablero crece con número de columnas (12X por columna, AB CENTERLINE)', () => {
    // 4 motores de 250 HP (6X cada uno) → 24X total → 2 columnas de salidas
    // + 1 columna de incoming/acometida (≥4 gavetas) = 3 columnas en total.
    const cargas = [motor('a', 250), motor('b', 250), motor('c', 250), motor('d', 250)];
    const r = dimensionarCcmNema(cargas);
    const feeders = r.tablero!.columnas.filter((c) => !c.esIncoming);
    expect(feeders).toHaveLength(2);
    expect(r.tablero!.columnas).toHaveLength(3);
  });

  it('agrega columna de incoming cuando hay ≥4 gavetas o I ≥ 250 A', () => {
    // 1 motor de 250 HP (FLA ≈ 302 A) → I ≥ 250 → incoming.
    const r = dimensionarCcmNema([motor('a', 250)]);
    expect(r.tablero!.columnas[0]!.esIncoming).toBe(true);
    // CCM chico (1 motor pequeño) → sin incoming.
    const r2 = dimensionarCcmNema([motor('b', 5)]);
    expect(r2.tablero!.columnas[0]!.esIncoming).toBeFalsy();
  });

  it('FLC total selecciona barra correcta', () => {
    const r = dimensionarCcmNema([motor('1', 100), motor('2', 50)]);
    // Motor 100 HP FLA = 138, motor 50 HP FLA = 72 → total ~210
    expect(r.tablero!.corrienteTotalA).toBeGreaterThan(200);
    expect(r.tablero!.barra.capacidadA).toBe(600);
  });

  it('sin derrateo el factor F2 es 1 y la corriente de selección iguala el FLC', () => {
    const r = dimensionarCcmNema([motor('1', 100)]);
    expect(r.tablero!.factorDerrateoAltura).toBe(1);
    expect(r.tablero!.corrienteSeleccionBarraA).toBeCloseTo(r.tablero!.corrienteTotalA, 5);
  });

  it('el derrateo por altura sube la barra al seleccionar contra FLC / F2', () => {
    const c = alimentador('1', 350); // ≈ 468 A @ 480 V 3F → barra 600
    const base = dimensionarCcmNema([c]);
    expect(base.tablero!.barra.capacidadA).toBe(600);

    const derrateado = dimensionarCcmNema([c], 0.9);
    expect(derrateado.tablero!.factorDerrateoAltura).toBe(0.9);
    // La corriente real de la carga no cambia; solo la corriente de selección.
    expect(derrateado.tablero!.corrienteTotalA).toBeCloseTo(base.tablero!.corrienteTotalA, 1);
    expect(derrateado.tablero!.corrienteSeleccionBarraA).toBeCloseTo(
      base.tablero!.corrienteTotalA / 0.9,
      1,
    );
    expect(derrateado.tablero!.barra.capacidadA).toBe(800);
  });

  it('incluye el compartimento de medida (PT, CT, luces piloto)', () => {
    const r = dimensionarCcmNema([motor('1', 50)]);
    expect(r.tablero!.medida.transformadoresTension).toBeGreaterThan(0);
    expect(r.tablero!.medida.transformadoresCorriente).toBeGreaterThan(0);
    expect(r.tablero!.medida.lucesPiloto).toBeGreaterThan(0);
    expect(r.tablero!.medida.instrumento).toBeTruthy();
  });

  it('en media tensión calcula la FLA con la fórmula (no el catálogo BT)', () => {
    // Motor 100 HP @ 6,6 kV, cosφ 0,85, η 0,9, 3F:
    //   I = (100·0,7457·1000) / (√3 · 6600 · 0,85 · 0,9) ≈ 8,5 A
    // El catálogo NEMA para 100 HP marca FLA ≈ 124 A (a 480 V). Sin la
    // corrección de MT estaríamos sumando 124 A en vez de 8,5 A a la barra.
    const cargaMt: Carga = {
      id: 'm-mt', descripcion: 'Motor MT', tipo: 'motor',
      potenciaKw: 100 * KW_POR_HP, unidadPotencia: 'HP',
      tensionV: 6600, fases: '3F', factorServicio: 1, arranque: 'DOL',
    };
    const r = dimensionarCcmNema([cargaMt]);
    expect(r.asignaciones).toHaveLength(1);
    expect(r.asignaciones[0]!.corrienteDisenoA).toBeCloseTo(8.5, 0);
  });
});
