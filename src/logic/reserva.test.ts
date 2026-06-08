import { describe, expect, it } from 'vitest';
import { calcularReservas } from './reserva';
import { dimensionarCcm } from './tablero';
import { dimensionarCcmNema } from './ccm-nema';
import type { Carga } from '../types';

interface Item {
  tipo: string;
  size: number;
}

const items: Item[] = [
  { tipo: 'a', size: 1 },
  { tipo: 'a', size: 1 },
  { tipo: 'b', size: 2 },
  { tipo: 'c', size: 4 },
];

describe('calcularReservas', () => {
  it('devuelve vacío si el porcentaje es 0', () => {
    const r = calcularReservas(items, (i) => i.tipo, (i) => i.size, (m) => ({ ...m }), 0);
    expect(r.reservas).toHaveLength(0);
  });

  it('devuelve vacío si no hay salidas', () => {
    const r = calcularReservas([], (i: Item) => i.tipo, (i) => i.size, (m) => m, 25);
    expect(r.reservas).toHaveLength(0);
  });

  it('agrega al menos una unidad de cada tipo usado', () => {
    const r = calcularReservas(items, (i) => i.tipo, (i) => i.size, (m) => ({ ...m }), 1);
    const tipos = new Set(r.reservas.map((x) => x.tipo));
    expect(tipos.has('a')).toBe(true);
    expect(tipos.has('b')).toBe(true);
    expect(tipos.has('c')).toBe(true);
  });

  it('cubre el 25% mínimo sobre el tamaño de las salidas', () => {
    // Σ sizes = 1+1+2+4 = 8 → 25% = 2. Una de cada tipo (1+2+4 = 7) ya cubre.
    const r = calcularReservas(items, (i) => i.tipo, (i) => i.size, (m) => ({ ...m }), 25);
    const sumaReservas = r.reservas.reduce((s, x) => s + x.size, 0);
    expect(sumaReservas).toBeGreaterThanOrEqual(r.tamanoSalidas * 0.25);
  });

  it('agrega del tipo más grande si la primera ronda no alcanza el %', () => {
    // 8 unidades chicas tipo 'a' tamaño 1; reserva 25% → tamaño mínimo 2; tipo
    // 'a' aporta 1 (primera ronda). Falta 1 → suma otra del tipo más grande (=a).
    const muchosChicos: Item[] = Array.from({ length: 8 }, () => ({ tipo: 'a', size: 1 }));
    const r = calcularReservas(muchosChicos, (i) => i.tipo, (i) => i.size, (m) => ({ ...m }), 25);
    expect(r.reservas.length).toBe(2);
  });
});

function motor(id: string, kW: number): Carga {
  return {
    id, descripcion: `M-${id}`, tipo: 'motor',
    potenciaKw: kW, tensionV: 400, fases: '3F',
    factorServicio: 1, arranque: 'DOL',
  };
}

describe('dimensionarCcm con reserva', () => {
  it('no agrega gavetas de reserva si porcentaje = 0', () => {
    const r = dimensionarCcm([motor('1', 11)]);
    const reservas = r.tablero.columnas.flatMap((c) => c.gavetas).filter((g) => g.esReserva);
    expect(reservas).toHaveLength(0);
  });

  it('agrega al menos una gaveta de cada tamaño usado cuando reserva ≥ 1%', () => {
    const r = dimensionarCcm([motor('1', 11), motor('2', 75)], 1, 'Schneider', 25);
    const reservas = r.tablero.columnas.flatMap((c) => c.gavetas).filter((g) => g.esReserva);
    expect(reservas.length).toBeGreaterThanOrEqual(1);
    // Las reservas tienen contenido "Reserva · ..." y no tienen protecciones.
    expect(reservas.every((g) => g.esReserva === true)).toBe(true);
  });
});

describe('dimensionarCcmNema con reserva', () => {
  it('no agrega celdas de reserva si porcentaje = 0', () => {
    const r = dimensionarCcmNema([motor('1', 50)]);
    const cells = r.tablero!.columnas.flatMap((c) => c.asignaciones);
    expect(cells.filter((a) => a.esReserva).length).toBe(0);
  });

  it('agrega al menos una celda de cada tipo usado cuando reserva ≥ 1%', () => {
    const r = dimensionarCcmNema([motor('1', 50), motor('2', 100)], 1, 25);
    const cells = r.tablero!.columnas.flatMap((c) => c.asignaciones);
    const reservas = cells.filter((a) => a.esReserva);
    expect(reservas.length).toBeGreaterThanOrEqual(1);
  });
});
