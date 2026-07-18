import { describe, expect, it } from 'vitest';
import { dimensionarCcmNema, sugerirBarraNema, sugerirBreakerNema } from './ccm-nema';
import type { Carga } from '../types';
import { KW_POR_HP } from '../util/potencia';

function motor(id: string, hp: number, fs = 1, arranque: Carga['arranque'] = 'DOL'): Carga {
  return {
    id,
    descripcion: `M-${id}`,
    tipo: 'motor',
    potenciaKw: hp * KW_POR_HP,
    unidadPotencia: 'HP',
    tensionV: 480,
    fases: '3F',
    factorServicio: fs,
    arranque,
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

  it('HP exacto del catálogo no salta de fila por residuo flotante (15/30/60 HP)', () => {
    for (const hp of [15, 30, 60]) {
      const r = dimensionarCcmNema([motor('1', hp)]);
      expect(r.asignaciones[0]!.motor?.hp).toBe(hp);
    }
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
    // FLA a 480 V = tabla 400 V × 400/480: 100 HP → 119.2 A, 50 HP → 62.3 A
    // → total ≈ 181.5 A → barra 600 A (rango 0–480).
    expect(r.tablero!.corrienteTotalA).toBeGreaterThan(170);
    expect(r.tablero!.corrienteTotalA).toBeLessThan(200);
    expect(r.tablero!.barra.capacidadA).toBe(600);
  });

  it('los alimentadores no-motor llevan margen 1.25 (carga continua) y derratean por F', () => {
    // 18 kW @ 480 V ≈ 24.1 A → ×1.25 = 30.1 → rating ≥ 30.1 A.
    const c = alimentador('1', 18);
    const base = dimensionarCcmNema([c]).asignaciones[0]!;
    expect(base.breaker!.ratingA).toBeGreaterThanOrEqual(base.corrienteDisenoA * 1.25);
    // Con F 0.8 → 37.7 → el rating sube.
    const der = dimensionarCcmNema([c], 0.8).asignaciones[0]!;
    expect(der.breaker!.ratingA).toBeGreaterThanOrEqual(base.breaker!.ratingA);
    expect(der.breaker!.ratingA).toBeGreaterThanOrEqual((base.corrienteDisenoA * 1.25) / 0.8);
  });

  it('la FLA del catálogo (400 V) se escala a la tensión real BT 3F', () => {
    const base = { ...motor('1', 10), tensionV: 400 };
    const a400 = dimensionarCcmNema([base]).asignaciones[0]!;
    const a480 = dimensionarCcmNema([{ ...base, tensionV: 480 }]).asignaciones[0]!;
    const a220 = dimensionarCcmNema([{ ...base, tensionV: 220 }]).asignaciones[0]!;
    expect(a400.corrienteDisenoA).toBeCloseTo(16.1, 3);
    expect(a480.corrienteDisenoA).toBeCloseTo(16.1 * 400 / 480, 3);
    expect(a400.notas).toBeUndefined();
    expect(a480.notas).toContain('400 V');
    // A 220 V la corriente casi se duplica — antes se usaba la FLA de 400 V.
    expect(a220.corrienteDisenoA).toBeCloseTo(16.1 * 400 / 220, 3);
  });

  it('motor 1F no usa la tabla 3F: cae a la fórmula', () => {
    const c: Carga = { ...motor('1', 5), tensionV: 220, fases: '1F' };
    const a = dimensionarCcmNema([c]).asignaciones[0]!;
    // I = P / (V × f.p. × rend.) = 3728.5 / (220 × 0.85 × 0.9) ≈ 22.15 A
    expect(a.corrienteDisenoA).toBeCloseTo(22.15, 1);
  });

  it('la corriente de placa del usuario prevalece sobre la FLA escalada', () => {
    const c: Carga = { ...motor('1', 10), tensionV: 480, corrienteA: 15.5 };
    const a = dimensionarCcmNema([c]).asignaciones[0]!;
    expect(a.corrienteDisenoA).toBeCloseTo(15.5, 5);
    expect(a.notas).toBeUndefined();
  });

  it('la barra aplica NEC 430.24: FLC + 25% del motor mayor', () => {
    // Un solo motor: selección = 1.25 × FLC.
    const r = dimensionarCcmNema([motor('1', 100)]);
    expect(r.tablero!.factorDerrateoAltura).toBe(1);
    expect(r.tablero!.corrienteSeleccionBarraA)
      .toBeCloseTo(r.tablero!.corrienteTotalA * 1.25, 5);
    // Motor + alimentador: solo el motor mayor aporta el 25% extra.
    const mixto = dimensionarCcmNema([motor('1', 50), alimentador('2', 18)]).tablero!;
    const iMotor = mixto.columnas.flatMap((c) => c.asignaciones)
      .find((a) => a.carga.tipo === 'motor' && !a.esReserva)!.corrienteDisenoA;
    expect(mixto.corrienteSeleccionBarraA)
      .toBeCloseTo(mixto.corrienteTotalA + 0.25 * iMotor, 5);
  });

  it('la reserva declarada agrega capacidad eléctrica a la barra', () => {
    const sinReserva = dimensionarCcmNema([alimentador('1', 100)], 1, 0).tablero!;
    const conReserva = dimensionarCcmNema([alimentador('1', 100)], 1, 25).tablero!;
    expect(conReserva.corrienteSeleccionBarraA)
      .toBeCloseTo(sinReserva.corrienteSeleccionBarraA * 1.25, 5);
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

  it('el tipo de arranque amplía el espacio: YD/PSV +1 escalón, VSD +2 (tabla FVNR)', () => {
    // 15 HP FVNR = 1.5X. Con partidor suave → 2X; con variador → 2.5X.
    const dol = dimensionarCcmNema([motor('1', 15)]).asignaciones[0]!;
    const psv = dimensionarCcmNema([motor('1', 15, 1, 'suave')]).asignaciones[0]!;
    const vsd = dimensionarCcmNema([motor('1', 15, 1, 'variador')]).asignaciones[0]!;
    expect(dol.espaciosX).toBe(1.5);
    // El DOL a 480 V lleva la nota de escalado de tensión, pero no la de arranque.
    expect(dol.notas ?? '').not.toContain('Espacio ampliado');
    expect(psv.espaciosX).toBe(2);
    expect(psv.notas).toContain('SMC');
    expect(vsd.espaciosX).toBe(2.5);
    expect(vsd.notas).toContain('PowerFlex');
  });

  it('VSD grande llega a 6X (media sección) y pasa a unidad fija', () => {
    // 100 HP FVNR = 3.5X extraíble; con variador +2 escalones → 6X fijo.
    const a = dimensionarCcmNema([motor('1', 100, 1, 'variador')]).asignaciones[0]!;
    expect(a.espaciosX).toBe(6);
    expect(a.version).toBe('fijo');
  });

  it('el escalado por arranque se topa en 6X', () => {
    // 250 HP ya ocupa 6X: YD/VSD no pueden crecer más allá del tope.
    const a = dimensionarCcmNema([motor('1', 250, 1, 'YD')]).asignaciones[0]!;
    expect(a.espaciosX).toBe(6);
    expect(a.notas).toContain('YD');
  });

  it('interruptor general opcional NEMA: main de la tabla de switchgear e incoming forzado', () => {
    const cargas = [motor('1', 30)];
    const lugs = dimensionarCcmNema(cargas);
    expect(lugs.tablero!.principal).toBeUndefined();
    expect(lugs.tablero!.columnas[0]!.esIncoming).toBeFalsy();

    const conIg = dimensionarCcmNema(cargas, 1, 0, 0, true);
    const t = conIg.tablero!;
    expect(t.principal).toBeDefined();
    expect(t.principal!.ratingA).toBeGreaterThanOrEqual(t.corrienteSeleccionBarraA);
    expect(t.columnas[0]!.esIncoming).toBe(true);
  });

  it('la Icc de barra advierte los breakers de alimentador con Icu mínimo insuficiente', () => {
    // Breakers NEMA declaran Icu mín. 65 kA: con Icc 80 se advierte; con 50 no.
    const cargas = [motor('1', 30), alimentador('2', 18)];
    const con80 = dimensionarCcmNema(cargas, 1, 0, 80);
    expect(con80.advertenciasIcu).toBeDefined();
    expect(con80.advertenciasIcu).toHaveLength(1); // solo el alimentador (MCP sin dato)
    expect(con80.advertenciasIcu![0]).toContain('Icu mín. 65 kA');
    const con50 = dimensionarCcmNema(cargas, 1, 0, 50);
    expect(con50.advertenciasIcu).toBeUndefined();
  });

  it('las reservas son vacancia: heredan tamaño y versión pero no motor ni breaker', () => {
    const r = dimensionarCcmNema([motor('1', 30), alimentador('2', 18)], 1, 25);
    const reservas = r.tablero!.columnas
      .flatMap((c) => c.asignaciones)
      .filter((a) => a.esReserva);
    expect(reservas.length).toBeGreaterThan(0);
    for (const res of reservas) {
      expect(res.motor, res.carga.id).toBeUndefined();
      expect(res.breaker, res.carga.id).toBeUndefined();
      expect(res.espaciosX).toBeGreaterThan(0);
      expect(res.corrienteDisenoA).toBe(0);
    }
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
