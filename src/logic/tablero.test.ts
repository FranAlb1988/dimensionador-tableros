import { describe, expect, it } from 'vitest';
import { dimensionarCcm } from './tablero';
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

  it('cada asignación trae protección NSX y, para motor, arrancador TeSys', () => {
    const r = dimensionarCcm([motor('m1', 15)]);
    const a = r.asignaciones[0]!;
    expect(a.proteccion.familia.startsWith('NSX')).toBe(true);
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

  it('el derrateo por altura sube la barra (selección contra FLC/F2)', () => {
    const cargas: Carga[] = [motor('1', 110)];
    const base = dimensionarCcm(cargas).tablero.barra!.inA;
    const conDerrateo = dimensionarCcm(cargas, 0.7);
    expect(conDerrateo.tablero.factorDerrateoAltura).toBe(0.7);
    expect(conDerrateo.tablero.corrienteSeleccionBarraA).toBeCloseTo(
      conDerrateo.tablero.corrienteTotalA / 0.7,
      1,
    );
    expect(conDerrateo.tablero.barra!.inA).toBeGreaterThanOrEqual(base);
  });

  it('incluye el compartimento de medida', () => {
    const r = dimensionarCcm([motor('1', 11)]);
    expect(r.tablero.medida.transformadoresCorriente).toBeGreaterThan(0);
    expect(r.tablero.medida.lucesPiloto).toBeGreaterThan(0);
  });

  it('marca ABB usa interruptores Tmax en las gavetas', () => {
    const r = dimensionarCcm([motor('m1', 15)], 1, 'ABB');
    const a = r.asignaciones[0]!;
    expect(a.proteccion.marca).toBe('ABB');
    expect(a.proteccion.familia.startsWith('Tmax')).toBe(true);
    expect(a.arrancador?.contactor.startsWith('LC1')).toBe(true);
  });

  it('marca por defecto (Schneider) usa NSX', () => {
    const r = dimensionarCcm([motor('m1', 15)]);
    expect(r.asignaciones[0]!.proteccion.familia.startsWith('NSX')).toBe(true);
  });

  it('IDs de gavetas y columnas son deterministas entre llamadas', () => {
    const r1 = dimensionarCcm([motor('a', 11)]);
    const r2 = dimensionarCcm([motor('a', 11)]);
    expect(r1.asignaciones[0]!.gaveta.id).toBe(r2.asignaciones[0]!.gaveta.id);
    expect(r1.tablero.columnas[0]!.id).toBe(r2.tablero.columnas[0]!.id);
  });
});
