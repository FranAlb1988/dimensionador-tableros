import { beforeEach, describe, expect, it } from 'vitest';
import { aplicarProyecto, capturarProyecto, nuevoProyecto } from './proyecto';
import { useCcmStore } from './ccm';
import { useTdgStore } from './tdg';
import { useCdcStore } from './cdc';
import type { Carga } from '../types';

const CARGA: Omit<Carga, 'id'> = {
  descripcion: 'Bomba',
  tipo: 'motor',
  potenciaKw: 7.5,
  tensionV: 400,
  fases: '3F',
  factorServicio: 1,
  arranque: 'DOL',
};

beforeEach(() => {
  nuevoProyecto();
});

describe('capturar / aplicar (ida y vuelta)', () => {
  it('un proyecto capturado y vuelto a aplicar conserva las cargas', () => {
    useCcmStore.getState().importar([CARGA, { ...CARGA, descripcion: 'Compresor' }], 'reemplazar');
    const antes = capturarProyecto();

    nuevoProyecto();
    expect(useCcmStore.getState().tableros[0]!.cargas).toHaveLength(0);

    const avisos = aplicarProyecto(antes);
    expect(avisos).toEqual([]);

    const cargas = useCcmStore.getState().tableros[0]!.cargas;
    expect(cargas.map((c) => c.descripcion)).toEqual(['Bomba', 'Compresor']);
    expect(cargas[0]!.potenciaKw).toBe(7.5);
  });

  it('conserva el tablero activo', () => {
    const id = useCcmStore.getState().crearTablero('CCM-02');
    const snapshot = capturarProyecto();
    nuevoProyecto();
    aplicarProyecto(snapshot);
    expect(useCcmStore.getState().activoId).toBe(id);
    expect(useCcmStore.getState().tableros).toHaveLength(2);
  });

  it('el proyecto capturado lleva la marca de app y la versión', () => {
    const p = capturarProyecto();
    expect(p.app).toBe('dimensionador-tableros');
    expect(typeof p.version).toBe('number');
  });
});

describe('validación del archivo', () => {
  it('rechaza algo que no sea un objeto', () => {
    expect(() => aplicarProyecto(null)).toThrow(/no es un objeto/i);
    expect(() => aplicarProyecto('texto')).toThrow(/no es un objeto/i);
  });

  it('rechaza un JSON de otra aplicación', () => {
    expect(() => aplicarProyecto({ app: 'otra-cosa', version: 3 })).toThrow(/no reconocido/i);
  });

  it('rechaza archivos de una versión más nueva', () => {
    expect(() => aplicarProyecto({ app: 'dimensionador-tableros', version: 999 })).toThrow(
      /versión más nueva/i,
    );
  });

  it('exige al menos un tablero de cada tipo en v3', () => {
    expect(() =>
      aplicarProyecto({
        app: 'dimensionador-tableros',
        version: 3,
        ccm: { tableros: [] },
        tdg: { tableros: [] },
        cdc: { tableros: [] },
      }),
    ).toThrow(/al menos uno/i);
  });
});

describe('migración de archivos v1/v2 (un solo tablero por tipo)', () => {
  const V1 = {
    app: 'dimensionador-tableros',
    version: 1,
    ccm: { norma: 'IEC', cargas: [{ id: 'x1', ...CARGA }] },
    tdg: { norma: 'NEMA', factorSimultaneidad: 0.9, salidas: [{ id: 'x2', ...CARGA }] },
    cdc: { opciones: { modulosPorFila: 10, reservaPorFila: 2 }, cargas: [] },
  };

  it('convierte el formato antiguo a multi-tablero', () => {
    aplicarProyecto(V1);
    const ccm = useCcmStore.getState();
    const tdg = useTdgStore.getState();
    const cdc = useCdcStore.getState();

    expect(ccm.tableros).toHaveLength(1);
    expect(ccm.tableros[0]!.norma).toBe('IEC');
    expect(ccm.tableros[0]!.cargas).toHaveLength(1);
    expect(ccm.activoId).toBe(ccm.tableros[0]!.id);

    expect(tdg.tableros[0]!.factorSimultaneidad).toBe(0.9);
    expect(tdg.tableros[0]!.subtipo).toBe('general');
    expect(cdc.tableros[0]!.subtipo).toBe('general');
  });

  it('cae a 0.8 si el factor de simultaneidad no sirve', () => {
    aplicarProyecto({ ...V1, tdg: { ...V1.tdg, factorSimultaneidad: -1 } });
    expect(useTdgStore.getState().tableros[0]!.factorSimultaneidad).toBe(0.8);
  });

  it('rechaza el formato antiguo si faltan secciones', () => {
    expect(() => aplicarProyecto({ app: 'dimensionador-tableros', version: 1 })).toThrow(
      /faltan secciones/i,
    );
  });
});

describe('saneo del contenido al abrir', () => {
  it('repara cargas corruptas y devuelve los avisos', () => {
    const avisos = aplicarProyecto({
      app: 'dimensionador-tableros',
      version: 3,
      metadatos: {},
      derrateo: {},
      ccm: {
        tableros: [
          {
            id: 'c1',
            nombre: 'CCM Prueba',
            norma: 'NEMA',
            cargas: [{ id: 'a', descripcion: 'Mala', tipo: 'motor', potenciaKw: 5, tensionV: 'abc', fases: '3F', factorServicio: 1 }],
          },
        ],
        activoId: 'c1',
      },
      tdg: { tableros: [{ id: 't1', nombre: 'TDG', subtipo: 'general', norma: 'NEMA', factorSimultaneidad: 0.8, salidas: [] }], activoId: 't1' },
      cdc: { tableros: [{ id: 'd1', nombre: 'CDC', subtipo: 'general', opciones: {}, cargas: [] }], activoId: 'd1' },
      auxiliares: { equipos: [] },
    });

    expect(avisos.length).toBeGreaterThan(0);
    expect(avisos[0]).toContain('CCM Prueba');
    const carga = useCcmStore.getState().tableros[0]!.cargas[0]!;
    expect(carga.tensionV).toBe(400);
    expect(Number.isNaN(carga.tensionV)).toBe(false);
  });

  it('no genera avisos con un archivo limpio', () => {
    useCcmStore.getState().importar([CARGA], 'reemplazar');
    const p = capturarProyecto();
    nuevoProyecto();
    expect(aplicarProyecto(p)).toEqual([]);
  });
});

describe('nuevoProyecto', () => {
  it('deja un tablero vacío de cada tipo', () => {
    useCcmStore.getState().importar([CARGA], 'reemplazar');
    nuevoProyecto();
    expect(useCcmStore.getState().tableros).toHaveLength(1);
    expect(useCcmStore.getState().tableros[0]!.cargas).toEqual([]);
    expect(useTdgStore.getState().tableros[0]!.salidas).toEqual([]);
    expect(useCdcStore.getState().tableros[0]!.cargas).toEqual([]);
  });
});
