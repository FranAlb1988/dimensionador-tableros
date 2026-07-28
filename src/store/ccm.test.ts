import { beforeEach, describe, expect, it } from 'vitest';
import { cargaPorDefecto, useCcmStore, type CcmTablero } from './ccm';
import type { Carga } from '../types';

/** Deja el store con un único tablero vacío, como al abrir la app. */
function reiniciar(): CcmTablero {
  const t: CcmTablero = { id: 'ccm-test', nombre: 'Tablero 1', norma: 'NEMA', cargas: [] };
  useCcmStore.setState({ tableros: [t], activoId: t.id });
  return t;
}

const s = () => useCcmStore.getState();
const activo = () => s().tableros.find((t) => t.id === s().activoId)!;

const CARGA_BASE: Omit<Carga, 'id'> = {
  descripcion: 'Bomba',
  tipo: 'motor',
  potenciaKw: 7.5,
  tensionV: 400,
  fases: '3F',
  factorServicio: 1,
  arranque: 'DOL',
};

beforeEach(() => {
  reiniciar();
});

describe('CRUD de tableros', () => {
  it('crearTablero lo agrega y lo deja activo', () => {
    const id = s().crearTablero('CCM-02');
    expect(s().tableros).toHaveLength(2);
    expect(s().activoId).toBe(id);
    expect(activo().nombre).toBe('CCM-02');
  });

  it('crearTablero sin nombre usa uno por defecto', () => {
    s().crearTablero('');
    expect(activo().nombre).toBe('Tablero');
  });

  it('renombrarTablero cambia solo el indicado', () => {
    const id = s().crearTablero('CCM-02');
    s().renombrarTablero(id, 'CCM-99');
    expect(s().tableros.find((t) => t.id === id)!.nombre).toBe('CCM-99');
    expect(s().tableros[0]!.nombre).toBe('Tablero 1');
  });

  it('duplicarTablero copia las cargas con ids nuevos (no comparte referencias)', () => {
    s().importar([CARGA_BASE], 'reemplazar');
    const idOriginal = s().activoId!;
    const idCopia = s().duplicarTablero(idOriginal);

    const orig = s().tableros.find((t) => t.id === idOriginal)!;
    const copia = s().tableros.find((t) => t.id === idCopia)!;

    expect(copia.nombre).toBe('Tablero 1 (copia)');
    expect(copia.cargas).toHaveLength(1);
    expect(copia.cargas[0]!.id).not.toBe(orig.cargas[0]!.id);
    expect(copia.cargas[0]!.descripcion).toBe('Bomba');

    // Modificar la copia no debe tocar el original.
    s().setActivo(idCopia);
    s().actualizar(copia.cargas[0]!.id, { descripcion: 'Cambiada' });
    expect(s().tableros.find((t) => t.id === idOriginal)!.cargas[0]!.descripcion).toBe('Bomba');
  });

  it('eliminarTablero reasigna el activo si se borró el activo', () => {
    const id2 = s().crearTablero('CCM-02');
    expect(s().activoId).toBe(id2);
    s().eliminarTablero(id2);
    expect(s().tableros).toHaveLength(1);
    expect(s().activoId).toBe(s().tableros[0]!.id);
  });

  it('eliminar el último tablero deja uno vacío en su lugar', () => {
    s().eliminarTablero(s().activoId!);
    expect(s().tableros).toHaveLength(1);
    expect(activo().cargas).toEqual([]);
    expect(s().activoId).toBe(s().tableros[0]!.id);
  });
});

describe('desglosarTablero', () => {
  it('mueve las cargas indicadas a un tablero nuevo y las quita del original', () => {
    s().importar(
      [
        { ...CARGA_BASE, descripcion: 'A' },
        { ...CARGA_BASE, descripcion: 'B' },
        { ...CARGA_BASE, descripcion: 'C' },
      ],
      'reemplazar',
    );
    const idOrig = s().activoId!;
    const cargas = activo().cargas;
    const mover = [cargas[1]!.id, cargas[2]!.id];

    s().desglosarTablero(idOrig, mover, 'CCM-02');

    const orig = s().tableros.find((t) => t.id === idOrig)!;
    const nuevo = s().tableros.find((t) => t.nombre === 'CCM-02')!;
    expect(orig.cargas.map((c) => c.descripcion)).toEqual(['A']);
    expect(nuevo.cargas.map((c) => c.descripcion)).toEqual(['B', 'C']);
    // Ids nuevos en el tablero desglosado.
    expect(nuevo.cargas.map((c) => c.id)).not.toEqual(mover);
  });

  it('no hace nada si la lista de cargas a mover viene vacía', () => {
    s().importar([CARGA_BASE], 'reemplazar');
    s().desglosarTablero(s().activoId!, [], 'CCM-02');
    expect(s().tableros).toHaveLength(1);
  });
});

describe('operaciones sobre el tablero activo', () => {
  it('importar en modo reemplazar sustituye las cargas y asigna ids', () => {
    s().importar([CARGA_BASE, { ...CARGA_BASE, descripcion: 'Otra' }], 'reemplazar');
    expect(activo().cargas).toHaveLength(2);
    expect(activo().cargas.every((c) => typeof c.id === 'string' && c.id.length > 0)).toBe(true);

    s().importar([CARGA_BASE], 'reemplazar');
    expect(activo().cargas).toHaveLength(1);
  });

  it('importar en modo agregar concatena', () => {
    s().importar([CARGA_BASE], 'reemplazar');
    s().importar([{ ...CARGA_BASE, descripcion: 'Segunda' }], 'agregar');
    expect(activo().cargas.map((c) => c.descripcion)).toEqual(['Bomba', 'Segunda']);
  });

  it('importar genera ids distintos aunque las cargas sean idénticas', () => {
    s().importar([CARGA_BASE, CARGA_BASE, CARGA_BASE], 'reemplazar');
    const ids = new Set(activo().cargas.map((c) => c.id));
    expect(ids.size).toBe(3);
  });

  it('agregar añade una carga con los valores por defecto', () => {
    s().agregar();
    const c = activo().cargas[0]!;
    expect(c.tipo).toBe('motor');
    expect(c.tensionV).toBe(cargaPorDefecto().tensionV);
    expect(c.arranque).toBe('DOL');
  });

  it('duplicar copia la carga marcándola como (copia)', () => {
    s().importar([CARGA_BASE], 'reemplazar');
    const id = activo().cargas[0]!.id;
    s().duplicar(id);
    expect(activo().cargas).toHaveLength(2);
    expect(activo().cargas[1]!.descripcion).toBe('Bomba (copia)');
    expect(activo().cargas[1]!.id).not.toBe(id);
  });

  it('duplicar con un id inexistente no altera la lista', () => {
    s().importar([CARGA_BASE], 'reemplazar');
    s().duplicar('no-existe');
    expect(activo().cargas).toHaveLength(1);
  });

  it('eliminar quita solo la carga indicada', () => {
    s().importar([CARGA_BASE, { ...CARGA_BASE, descripcion: 'B' }], 'reemplazar');
    s().eliminar(activo().cargas[0]!.id);
    expect(activo().cargas.map((c) => c.descripcion)).toEqual(['B']);
  });

  it('limpiar vacía el tablero activo', () => {
    s().importar([CARGA_BASE], 'reemplazar');
    s().limpiar();
    expect(activo().cargas).toEqual([]);
  });

  it('cargarEjemplo trae cargas con ids propios', () => {
    s().cargarEjemplo();
    expect(activo().cargas.length).toBeGreaterThan(0);
    const ids = new Set(activo().cargas.map((c) => c.id));
    expect(ids.size).toBe(activo().cargas.length);
  });
});

describe('actualizar: regla de arranque según el tipo', () => {
  it('quita el arranque cuando la carga deja de ser motor', () => {
    s().importar([CARGA_BASE], 'reemplazar');
    const id = activo().cargas[0]!.id;
    s().actualizar(id, { tipo: 'iluminacion' });
    expect(activo().cargas[0]!.arranque).toBeUndefined();
  });

  it('repone DOL cuando pasa a motor sin arranque', () => {
    s().importar([{ ...CARGA_BASE, tipo: 'resistivo', arranque: undefined }], 'reemplazar');
    const id = activo().cargas[0]!.id;
    s().actualizar(id, { tipo: 'motor' });
    expect(activo().cargas[0]!.arranque).toBe('DOL');
  });

  it('respeta el arranque explícito', () => {
    s().importar([CARGA_BASE], 'reemplazar');
    const id = activo().cargas[0]!.id;
    s().actualizar(id, { arranque: 'variador' });
    expect(activo().cargas[0]!.arranque).toBe('variador');
  });
});

describe('parámetros del tablero', () => {
  it('setIccBarra descarta valores no positivos o no finitos', () => {
    s().setIccBarra(25);
    expect(activo().iccBarraKa).toBe(25);
    s().setIccBarra(0);
    expect(activo().iccBarraKa).toBeUndefined();
    s().setIccBarra(Number.NaN);
    expect(activo().iccBarraKa).toBeUndefined();
  });

  it('setInterruptorGeneral guarda undefined en vez de false', () => {
    s().setInterruptorGeneral(true);
    expect(activo().interruptorGeneral).toBe(true);
    s().setInterruptorGeneral(false);
    expect(activo().interruptorGeneral).toBeUndefined();
  });

  it('setNorma y setMarca solo afectan al tablero activo', () => {
    const otro = s().crearTablero('CCM-02');
    s().setNorma('IEC');
    s().setMarca('ABB');
    expect(s().tableros.find((t) => t.id === otro)!.norma).toBe('IEC');
    expect(s().tableros[0]!.norma).toBe('NEMA');
  });
});
