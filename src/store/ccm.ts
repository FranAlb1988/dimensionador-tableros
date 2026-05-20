import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Carga, Fases, Norma, TipoArranque, TipoCarga } from '../types';

let idCounter = 0;
function nuevoId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function cargaPorDefecto(): Carga {
  return {
    id: nuevoId('c'),
    descripcion: '',
    tipo: 'motor',
    potenciaKw: 0,
    unidadPotencia: 'HP',
    tensionV: 400,
    fases: '3F',
    factorServicio: 1,
    arranque: 'DOL',
  };
}

export interface CcmTablero {
  id: string;
  nombre: string;
  norma: Norma;
  cargas: Carga[];
}

interface CcmState {
  tableros: CcmTablero[];
  activoId: string | null;

  // Tablero CRUD
  crearTablero: (nombre: string) => string;
  renombrarTablero: (id: string, nombre: string) => void;
  duplicarTablero: (id: string) => string;
  eliminarTablero: (id: string) => void;
  setActivo: (id: string) => void;

  desglosarTablero: (tableId: string, idsOverflow: string[], nombreNuevo: string) => void;

  // Operaciones sobre el tablero activo (mismos nombres que antes)
  setNorma: (n: Norma) => void;
  agregar: () => void;
  duplicar: (cargaId: string) => void;
  eliminar: (cargaId: string) => void;
  actualizar: (cargaId: string, parcial: Partial<Carga>) => void;
  importar: (cargas: ReadonlyArray<Omit<Carga, 'id'>>, modo: 'reemplazar' | 'agregar') => void;
  cargarEjemplo: () => void;
  limpiar: () => void;
}

function tableroVacio(nombre: string, norma: Norma = 'NEMA'): CcmTablero {
  return { id: nuevoId('ccm'), nombre, norma, cargas: [] };
}

const EJEMPLO_CARGAS: Carga[] = [
  { id: 'ej-1', descripcion: 'Bomba agua potable',      tipo: 'motor',       potenciaKw: 10  * 0.7457, unidadPotencia: 'HP', tensionV: 400, fases: '3F', factorServicio: 1,    arranque: 'DOL' },
  { id: 'ej-2', descripcion: 'Bomba contraincendio',    tipo: 'motor',       potenciaKw: 30  * 0.7457, unidadPotencia: 'HP', tensionV: 400, fases: '3F', factorServicio: 1.15, arranque: 'YD',  corrienteProteccionA: 100 },
  { id: 'ej-3', descripcion: 'Compresor',               tipo: 'motor',       potenciaKw: 15  * 0.7457, unidadPotencia: 'HP', tensionV: 400, fases: '3F', factorServicio: 1,    arranque: 'DOL' },
  { id: 'ej-4', descripcion: 'Ventilador extractor',    tipo: 'motor',       potenciaKw: 5   * 0.7457, unidadPotencia: 'HP', tensionV: 400, fases: '3F', factorServicio: 1,    arranque: 'variador' },
  { id: 'ej-5', descripcion: 'Alimentador iluminación', tipo: 'iluminacion', potenciaKw: 18,           unidadPotencia: 'kW', tensionV: 400, fases: '3F', factorServicio: 1 },
];

function aplicarParcial(c: Carga, p: Partial<Carga>): Carga {
  const next: Carga = { ...c, ...p };
  if (next.tipo !== 'motor') delete next.arranque;
  else if (!next.arranque) next.arranque = 'DOL';
  return next;
}

/** Aplica `fn` al tablero activo. Devuelve el patch parcial para `set`. */
function modificarActivo(
  s: CcmState,
  fn: (t: CcmTablero) => CcmTablero,
): Partial<CcmState> {
  if (s.activoId == null) return {};
  return { tableros: s.tableros.map((t) => (t.id === s.activoId ? fn(t) : t)) };
}

export const useCcmStore = create<CcmState>()(
  persist(
    (set) => {
      const inicial = tableroVacio('Tablero 1');
      return {
        tableros: [inicial],
        activoId: inicial.id,

        crearTablero: (nombre) => {
          const t = tableroVacio(nombre || 'Tablero');
          set((s) => ({ tableros: [...s.tableros, t], activoId: t.id }));
          return t.id;
        },
        renombrarTablero: (id, nombre) => set((s) => ({
          tableros: s.tableros.map((t) => (t.id === id ? { ...t, nombre } : t)),
        })),
        duplicarTablero: (id) => {
          const nuevo: CcmTablero = { id: nuevoId('ccm'), nombre: '', norma: 'NEMA', cargas: [] };
          set((s) => {
            const orig = s.tableros.find((t) => t.id === id);
            if (!orig) return {};
            nuevo.nombre = `${orig.nombre} (copia)`;
            nuevo.norma = orig.norma;
            nuevo.cargas = orig.cargas.map((c) => ({ ...c, id: nuevoId('c') }));
            return { tableros: [...s.tableros, nuevo], activoId: nuevo.id };
          });
          return nuevo.id;
        },
        eliminarTablero: (id) => set((s) => {
          const tableros = s.tableros.filter((t) => t.id !== id);
          if (tableros.length === 0) {
            const t = tableroVacio('Tablero 1');
            return { tableros: [t], activoId: t.id };
          }
          const activoId = s.activoId === id ? tableros[0]!.id : s.activoId;
          return { tableros, activoId };
        }),
        setActivo: (id) => set({ activoId: id }),

        desglosarTablero: (tableId, idsOverflow, nombreNuevo) => set((s) => {
          const orig = s.tableros.find((t) => t.id === tableId);
          if (!orig || idsOverflow.length === 0) return {};
          const setOverflow = new Set(idsOverflow);
          const cargasNuevo = orig.cargas
            .filter((c) => setOverflow.has(c.id))
            .map((c) => ({ ...c, id: nuevoId('c') }));
          const cargasRestantes = orig.cargas.filter((c) => !setOverflow.has(c.id));
          const nuevo: CcmTablero = {
            id: nuevoId('ccm'),
            nombre: nombreNuevo,
            norma: orig.norma,
            cargas: cargasNuevo,
          };
          return {
            tableros: [
              ...s.tableros.map((t) => (t.id === tableId ? { ...t, cargas: cargasRestantes } : t)),
              nuevo,
            ],
          };
        }),

        setNorma: (n) => set((s) => modificarActivo(s, (t) => ({ ...t, norma: n }))),
        agregar: () => set((s) => modificarActivo(s, (t) => ({
          ...t, cargas: [...t.cargas, cargaPorDefecto()],
        }))),
        duplicar: (cargaId) => set((s) => modificarActivo(s, (t) => {
          const orig = t.cargas.find((c) => c.id === cargaId);
          if (!orig) return t;
          const copia: Carga = { ...orig, id: nuevoId('c'), descripcion: `${orig.descripcion} (copia)` };
          return { ...t, cargas: [...t.cargas, copia] };
        })),
        eliminar: (cargaId) => set((s) => modificarActivo(s, (t) => ({
          ...t, cargas: t.cargas.filter((c) => c.id !== cargaId),
        }))),
        actualizar: (cargaId, parcial) => set((s) => modificarActivo(s, (t) => ({
          ...t,
          cargas: t.cargas.map((c) => (c.id === cargaId ? aplicarParcial(c, parcial) : c)),
        }))),
        importar: (importadas, modo) => set((s) => modificarActivo(s, (t) => {
          const conIds = importadas.map((c) => ({ ...c, id: nuevoId('c') }));
          return { ...t, cargas: modo === 'reemplazar' ? conIds : [...t.cargas, ...conIds] };
        })),
        cargarEjemplo: () => set((s) => modificarActivo(s, (t) => ({
          ...t, cargas: EJEMPLO_CARGAS.map((c) => ({ ...c, id: nuevoId('c') })),
        }))),
        limpiar: () => set((s) => modificarActivo(s, (t) => ({ ...t, cargas: [] }))),
      };
    },
    {
      // Mantenemos el name antiguo y subimos la versión para preservar datos.
      name: 'ccm-cargas-v2',
      version: 1,
      migrate: (persisted, fromVersion) => {
        // v0 = formato single-tablero: { cargas, norma, ... }
        if (fromVersion < 1) {
          const p = (persisted ?? {}) as { cargas?: Carga[]; norma?: Norma };
          const cargas = Array.isArray(p.cargas) ? p.cargas : [];
          const norma: Norma = p.norma === 'IEC' ? 'IEC' : 'NEMA';
          const t: CcmTablero = { id: nuevoId('ccm'), nombre: 'Tablero 1', norma, cargas };
          return { tableros: [t], activoId: t.id } as unknown as CcmState;
        }
        return persisted as CcmState;
      },
    },
  ),
);

// ----- Selectors públicos -----

/** Tablero activo (puede ser undefined si la lista quedó vacía momentáneamente). */
export const useCcmTableroActivo = (): CcmTablero | undefined =>
  useCcmStore((s) => s.tableros.find((t) => t.id === s.activoId));

/** Cargas del tablero activo (array vacío si no hay tablero). */
export const useCcmCargas = (): Carga[] =>
  useCcmStore((s) => s.tableros.find((t) => t.id === s.activoId)?.cargas ?? []);

/** Norma del tablero activo (NEMA por defecto). */
export const useCcmNorma = (): Norma =>
  useCcmStore((s) => s.tableros.find((t) => t.id === s.activoId)?.norma ?? 'NEMA');

export const TIPOS_CARGA: readonly TipoCarga[] = ['motor', 'resistivo', 'iluminacion', 'tomas', 'otro'];
export const FASES: readonly Fases[] = ['1F', '3F'];
export const TIPOS_ARRANQUE: readonly TipoArranque[] = ['DOL', 'YD', 'suave', 'variador'];
export { ARRANQUE_LABEL } from '../types';
