// Tests de los stores TDG, CDC y auxiliares.
// El CRUD de tableros y las operaciones sobre cargas siguen el mismo patrón que
// el CCM (ya cubierto en ccm.test.ts), así que aquí se prueba lo que cada store
// tiene de propio: subtipo, factor de simultaneidad, opciones del CDC y el
// manejo por categoría de los auxiliares.

import { beforeEach, describe, expect, it } from 'vitest';
import { useTdgStore } from './tdg';
import { useCdcStore } from './cdc';
import { useAuxiliaresStore } from './auxiliares';
import { OPCIONES_CDC_DEFAULT } from '../logic/cdc';
import type { Carga } from '../types';

const CARGA: Omit<Carga, 'id'> = {
  descripcion: 'Salida',
  tipo: 'motor',
  potenciaKw: 5,
  tensionV: 400,
  fases: '3F',
  factorServicio: 1,
  arranque: 'DOL',
};

const tdg = () => useTdgStore.getState();
const cdc = () => useCdcStore.getState();
const aux = () => useAuxiliaresStore.getState();

const tdgActivo = () => tdg().tableros.find((t) => t.id === tdg().activoId)!;
const cdcActivo = () => cdc().tableros.find((t) => t.id === cdc().activoId)!;

beforeEach(() => {
  useTdgStore.setState({
    tableros: [{ id: 'tdg-test', nombre: 'TDG 1', subtipo: 'general', norma: 'NEMA', factorSimultaneidad: 0.8, salidas: [] }],
    activoId: 'tdg-test',
  });
  useCdcStore.setState({
    tableros: [{ id: 'cdc-test', nombre: 'CDC 1', subtipo: 'general', opciones: { ...OPCIONES_CDC_DEFAULT, modulosPorFila: 12, reservaPorFila: 2 }, cargas: [] }],
    activoId: 'cdc-test',
  });
  useAuxiliaresStore.setState({ equipos: [] });
});

describe('store TDG', () => {
  it('crearTablero respeta el subtipo indicado', () => {
    // Los subtipos del TDG son 'general' y 'fuerza' ('alumbrado' es del CDC).
    const id = tdg().crearTablero('Fuerza', 'fuerza');
    expect(tdg().tableros.find((t) => t.id === id)!.subtipo).toBe('fuerza');
  });

  it('crearTablero usa subtipo general por defecto', () => {
    const id = tdg().crearTablero('Otro');
    expect(tdg().tableros.find((t) => t.id === id)!.subtipo).toBe('general');
  });

  it('setFactorSimultaneidad afecta solo al tablero activo', () => {
    const otro = tdg().crearTablero('TDG 2');
    tdg().setFactorSimultaneidad(0.65);
    expect(tdg().tableros.find((t) => t.id === otro)!.factorSimultaneidad).toBe(0.65);
    expect(tdg().tableros.find((t) => t.id === 'tdg-test')!.factorSimultaneidad).toBe(0.8);
  });

  it('duplicarTablero copia las salidas con ids nuevos', () => {
    tdg().importar([CARGA], 'reemplazar');
    const idCopia = tdg().duplicarTablero('tdg-test');
    const copia = tdg().tableros.find((t) => t.id === idCopia)!;
    const orig = tdg().tableros.find((t) => t.id === 'tdg-test')!;
    expect(copia.salidas).toHaveLength(1);
    expect(copia.salidas[0]!.id).not.toBe(orig.salidas[0]!.id);
  });

  it('importar reemplaza o concatena las salidas', () => {
    tdg().importar([CARGA], 'reemplazar');
    expect(tdgActivo().salidas).toHaveLength(1);
    tdg().importar([CARGA], 'agregar');
    expect(tdgActivo().salidas).toHaveLength(2);
    tdg().importar([CARGA], 'reemplazar');
    expect(tdgActivo().salidas).toHaveLength(1);
  });

  it('eliminar el último tablero deja uno vacío', () => {
    tdg().eliminarTablero('tdg-test');
    expect(tdg().tableros).toHaveLength(1);
    expect(tdgActivo().salidas).toEqual([]);
  });
});

describe('store CDC', () => {
  it('setOpciones hace merge parcial sin perder el resto', () => {
    cdc().setOpciones({ modulosPorFila: 24 });
    expect(cdcActivo().opciones.modulosPorFila).toBe(24);
    expect(cdcActivo().opciones.reservaPorFila).toBe(2);
  });

  it('setOpciones solo toca el tablero activo', () => {
    const otro = cdc().crearTablero('CDC 2');
    cdc().setOpciones({ reservaPorFila: 5 });
    expect(cdc().tableros.find((t) => t.id === otro)!.opciones.reservaPorFila).toBe(5);
    expect(cdc().tableros.find((t) => t.id === 'cdc-test')!.opciones.reservaPorFila).toBe(2);
  });

  it('crearTablero respeta el subtipo alumbrado', () => {
    const id = cdc().crearTablero('Alumbrado', 'alumbrado');
    expect(cdc().tableros.find((t) => t.id === id)!.subtipo).toBe('alumbrado');
  });

  it('agregar añade una carga y eliminar la quita', () => {
    cdc().agregar();
    expect(cdcActivo().cargas).toHaveLength(1);
    cdc().eliminar(cdcActivo().cargas[0]!.id);
    expect(cdcActivo().cargas).toEqual([]);
  });
});

describe('store auxiliares', () => {
  it('agregar crea el equipo en la categoría pedida', () => {
    aux().agregar('ups');
    expect(aux().equipos).toHaveLength(1);
    expect(aux().equipos[0]!.categoria).toBe('ups');
  });

  it('limpiar borra solo la categoría indicada', () => {
    aux().agregar('ups');
    aux().agregar('instrumentacion');
    aux().limpiar('ups');
    expect(aux().equipos.map((e) => e.categoria)).toEqual(['instrumentacion']);
  });

  it('duplicar genera un id distinto', () => {
    aux().agregar('ups');
    const id = aux().equipos[0]!.id;
    aux().duplicar(id);
    expect(aux().equipos).toHaveLength(2);
    expect(aux().equipos[1]!.id).not.toBe(id);
  });

  it('actualizar modifica solo el equipo indicado', () => {
    aux().agregar('ups');
    aux().agregar('ups');
    const id = aux().equipos[0]!.id;
    aux().actualizar(id, { tag: 'UPS-999' });
    expect(aux().equipos[0]!.tag).toBe('UPS-999');
    expect(aux().equipos[1]!.tag).not.toBe('UPS-999');
  });

  it('cargarEjemplo deja equipos con ids únicos', () => {
    aux().cargarEjemplo();
    const ids = new Set(aux().equipos.map((e) => e.id));
    expect(aux().equipos.length).toBeGreaterThan(0);
    expect(ids.size).toBe(aux().equipos.length);
  });
});
