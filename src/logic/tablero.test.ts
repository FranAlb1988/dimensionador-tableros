import { describe, expect, it } from 'vitest';
import { dimensionarCcm } from './tablero';
import { corrienteDiseno } from './corriente';
import type { Carga } from '../types';

function motor(id: string, kW: number): Carga {
  return {
    id, descripcion: `M-${id}`, tipo: 'motor',
    potenciaKw: kW, tensionV: 400, fases: '3F',
    factorServicio: 1, arranque: 'DOL',
  };
}

describe('dimensionarCcm', () => {
  it('dimensiona un CCM con 3 motores y produce al menos una columna', () => {
    const cargas: Carga[] = [motor('1', 11), motor('2', 22), motor('3', 7.5)];
    const r = dimensionarCcm(cargas);

    expect(r.asignaciones).toHaveLength(3);
    expect(r.cargasSinAsignar).toEqual([]);
    expect(r.tablero.columnas.length).toBeGreaterThanOrEqual(1);
    expect(r.tablero.anchoTotalMm).toBe(r.tablero.columnas.length * 600);
    expect(r.tablero.altoTotalMm).toBeGreaterThan(0);
  });

  it('cada asignación trae protección y, para motor, arrancador TeSys', () => {
    const r = dimensionarCcm([motor('m1', 15)]);
    const a = r.asignaciones[0]!;
    // Motor con arrancador en la gaveta: MCP compacto TeSys GV (Frame 2),
    // no un NSX — el relé térmico del arrancador cubre la sobrecarga.
    expect(a.proteccion.curva).toBe('MA');
    expect(a.proteccion.referencia).toMatch(/^GV/);
    expect(a.arrancador?.contactor.startsWith('LC1')).toBe(true);
    expect(a.gaveta.protecciones).toHaveLength(1);
  });

  it('motor con arranque suave aumenta el tamaño de gaveta vs DOL equivalente', () => {
    const dolCarga: Carga = motor('m', 30);
    const suaveCarga: Carga = { ...dolCarga, arranque: 'suave' };
    const dol = dimensionarCcm([dolCarga]).asignaciones[0]!.gaveta.tamano;
    const suave = dimensionarCcm([suaveCarga]).asignaciones[0]!.gaveta.tamano;
    const escala = ['1/4', '1/2', '1', '1+1/2', '2'];
    expect(escala.indexOf(suave)).toBeGreaterThan(escala.indexOf(dol));
  });

  it('calcula FLC total y selecciona barra principal', () => {
    const cargas: Carga[] = [motor('1', 30), motor('2', 22)];
    const r = dimensionarCcm(cargas);
    expect(r.tablero.corrienteTotalA).toBeGreaterThan(0);
    expect(r.tablero.barra).toBeDefined();
    expect(r.tablero.barra!.inA).toBeGreaterThanOrEqual(r.tablero.corrienteTotalA);
  });

  it('el derrateo por altura sube la barra (selección contra I/F2)', () => {
    const cargas: Carga[] = [motor('1', 110)];
    const base = dimensionarCcm(cargas).tablero.barra!.inA;
    const conDerrateo = dimensionarCcm(cargas, 0.7);
    expect(conDerrateo.tablero.factorDerrateoAltura).toBe(0.7);
    // Un solo motor: selección = 1.25 × FLC (NEC 430.24) / F.
    expect(conDerrateo.tablero.corrienteSeleccionBarraA).toBeCloseTo(
      (conDerrateo.tablero.corrienteTotalA * 1.25) / 0.7,
      1,
    );
    expect(conDerrateo.tablero.barra!.inA).toBeGreaterThanOrEqual(base);
  });

  it('la barra incluye el 25% del motor mayor y la capacidad de la reserva', () => {
    const iluminacion: Carga = {
      id: 'i1', descripcion: 'Iluminación', tipo: 'iluminacion',
      potenciaKw: 18, tensionV: 400, fases: '3F', factorServicio: 1,
    };
    const cargas: Carga[] = [motor('m1', 30), iluminacion];
    const r = dimensionarCcm(cargas, 1, 'Schneider', 25);
    const t = r.tablero;
    const iMotor = r.asignaciones.find((a) => a.carga.tipo === 'motor')!;
    const esperado = (t.corrienteTotalA + 0.25 * corrienteDiseno(iMotor.carga)) * 1.25;
    expect(t.corrienteSeleccionBarraA).toBeCloseTo(esperado, 5);
    expect(t.barra!.inA).toBeGreaterThanOrEqual(esperado);
  });

  it('incluye el compartimento de medida', () => {
    const r = dimensionarCcm([motor('1', 11)]);
    expect(r.tablero.medida.transformadoresCorriente).toBeGreaterThan(0);
    expect(r.tablero.medida.lucesPiloto).toBeGreaterThan(0);
  });

  it('la Icc de barra declarada eleva la prestación de todo el aparellaje', () => {
    const iluminacion: Carga = {
      id: 'i1', descripcion: 'Iluminación', tipo: 'iluminacion',
      potenciaKw: 18, tensionV: 400, fases: '3F', factorServicio: 1,
    };
    const r = dimensionarCcm([motor('m1', 11), iluminacion], 1, 'Schneider', 0, 45);
    expect(r.tablero.iccBarraKa).toBe(45);
    for (const a of r.asignaciones) {
      expect(a.proteccion.icuKA, a.carga.id).toBeGreaterThanOrEqual(45);
    }
    expect(r.advertenciasIcu).toBeUndefined();
  });

  it('una Icc de 85 kA ya se cubre con el catálogo real (antes se advertía)', () => {
    // La tabla anterior topaba en la clase H (70 kA) y obligaba a advertir.
    // ComPacT NSX llega a S/L/R: 85 kA se resuelve con equipo de verdad.
    const r = dimensionarCcm([motor('m1', 11)], 1, 'Schneider', 0, 85);
    expect(r.asignaciones[0]!.proteccion.icuKA).toBeGreaterThanOrEqual(85);
    expect(r.advertenciasIcu).toBeUndefined();
  });

  it('sobre la mayor clase de catálogo sí se advierte por salida', () => {
    const r = dimensionarCcm([motor('m1', 11)], 1, 'Schneider', 0, 250);
    expect(r.asignaciones[0]!.proteccion.icuKA).toBeLessThan(250);
    expect(r.advertenciasIcu).toBeDefined();
    expect(r.advertenciasIcu![0]).toContain('< Icc de barra 250.0 kA');
  });

  it('el derrateo F selecciona los interruptores de salida contra I / F', () => {
    const iluminacion: Carga = {
      id: 'i1', descripcion: 'Iluminación', tipo: 'iluminacion',
      potenciaKw: 18, tensionV: 400, fases: '3F', factorServicio: 1,
    };
    // Motor 11 kW (I ≈ 21.1 A, MA margen 1.0): sin F → MA25; con F 0.8 →
    // 26.4 A → MA50. Iluminación 18 kW (28.9 A × 1.25 = 36.1 → TM40); con
    // F 0.8 → 45.2 → TM63.
    const base = dimensionarCcm([motor('m1', 11), iluminacion]);
    const derrateado = dimensionarCcm([motor('m1', 11), iluminacion], 0.8);
    const mBase = base.asignaciones.find((a) => a.carga.tipo === 'motor')!;
    const mDer = derrateado.asignaciones.find((a) => a.carga.tipo === 'motor')!;
    const iBase = base.asignaciones.find((a) => a.carga.tipo !== 'motor')!;
    const iDer = derrateado.asignaciones.find((a) => a.carga.tipo !== 'motor')!;
    expect(mDer.proteccion.inA).toBeGreaterThan(mBase.proteccion.inA);
    expect(iDer.proteccion.inA).toBeGreaterThan(iBase.proteccion.inA);
    // La corriente real de las cargas no cambia.
    expect(derrateado.tablero.corrienteTotalA).toBeCloseTo(base.tablero.corrienteTotalA, 5);
  });

  it('motor con arrancador recibe unidad solo magnética (MA); no-motor recibe TM-D', () => {
    const iluminacion: Carga = {
      id: 'i1', descripcion: 'Iluminación', tipo: 'iluminacion',
      potenciaKw: 18, tensionV: 400, fases: '3F', factorServicio: 1,
    };
    const r = dimensionarCcm([motor('m1', 15), iluminacion]);
    const m = r.asignaciones.find((a) => a.carga.tipo === 'motor')!;
    const nm = r.asignaciones.find((a) => a.carga.tipo !== 'motor')!;
    // El LRD del arrancador cubre la sobrecarga → el interruptor es MA.
    expect(m.arrancador).toBeDefined();
    expect(m.proteccion.curva).toBe('MA');
    expect(nm.proteccion.curva).toBe('TM-D');
  });

  it('interruptor general opcional: main breaker con barra e incoming coordinados', () => {
    const cargas = [motor('m1', 30), motor('m2', 22)];
    // Sin interruptor general (default): main lugs, sin principal.
    const lugs = dimensionarCcm(cargas);
    expect(lugs.tablero.principal).toBeUndefined();

    // Con interruptor general: principal con In ≥ FLC, barra ≥ In del
    // principal e incoming forzado aunque no se alcancen los umbrales.
    const conIg = dimensionarCcm(cargas, 1, 'Schneider', 0, 0, true);
    const t = conIg.tablero;
    expect(t.principal).toBeDefined();
    expect(t.principal!.inA).toBeGreaterThanOrEqual(t.corrienteTotalA);
    expect(t.barra!.inA).toBeGreaterThanOrEqual(t.principal!.inA);
    expect(t.columnas[0]!.esIncoming).toBe(true);
  });

  it('el interruptor general eleva prestación por Icc y advierte si no alcanza', () => {
    const cargas = [motor('m1', 30)];
    // Icc 45 → NSX del principal elevado a N (50 kA), sin advertencia.
    const r45 = dimensionarCcm(cargas, 1, 'Schneider', 0, 45, true);
    expect(r45.tablero.principal!.icuKA).toBeGreaterThanOrEqual(45);
    expect(r45.advertenciasIcu ?? []).toHaveLength(0);
    // Icc 85 → ni H (70) ni Masterpact NT alcanzan para este In chico → NW o
    // advertencia del interruptor general incluida.
    const r85 = dimensionarCcm(cargas, 1, 'Schneider', 0, 85, true);
    const p = r85.tablero.principal!;
    if (p.icuKA < 85) {
      expect(r85.advertenciasIcu!.some((a) => a.includes('Interruptor general'))).toBe(true);
    }
  });

  it('marca ABB usa interruptores Tmax en las gavetas', () => {
    const r = dimensionarCcm([motor('m1', 15)], 1, 'ABB');
    const a = r.asignaciones[0]!;
    expect(a.proteccion.marca).toBe('ABB');
    expect(a.proteccion.familia.startsWith('Tmax')).toBe(true);
    expect(a.arrancador?.contactor.startsWith('LC1')).toBe(true);
  });

  it('marca por defecto (Schneider) usa catálogo Schneider', () => {
    const r = dimensionarCcm([motor('m1', 15)]);
    expect(r.asignaciones[0]!.proteccion.marca).toBe('Schneider');
  });

  it('IDs de gavetas y columnas son deterministas entre llamadas', () => {
    const r1 = dimensionarCcm([motor('a', 11)]);
    const r2 = dimensionarCcm([motor('a', 11)]);
    expect(r1.asignaciones[0]!.gaveta.id).toBe(r2.asignaciones[0]!.gaveta.id);
    expect(r1.tablero.columnas[0]!.id).toBe(r2.tablero.columnas[0]!.id);
  });
});
