import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Carga, MarcaProteccion, Norma } from '../types';

let idCounter = 0;
function nuevoId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/**
 * Subtipo del TDG:
 *  - 'general': tablero de distribución general (default)
 *  - 'fuerza': tablero de fuerza — alimentadores a motores y equipos de potencia
 */
export type SubtipoTdg = 'general' | 'fuerza';

export function salidaPorDefecto(subtipo: SubtipoTdg = 'general'): Carga {
  const esFuerza = subtipo === 'fuerza';
  return {
    id: nuevoId('s'),
    descripcion: '',
    tipo: esFuerza ? 'motor' : 'otro',
    potenciaKw: 0,
    unidadPotencia: esFuerza ? 'HP' : 'kW',
    tensionV: 400,
    fases: '3F',
    factorServicio: 1,
    ...(esFuerza ? { arranque: 'DOL' as const } : {}),
  };
}

export interface TdgTablero {
  id: string;
  nombre: string;
  subtipo: SubtipoTdg;
  norma: Norma;
  /** Marca del interruptor principal (solo aplica al catálogo IEC). */
  marca?: MarcaProteccion;
  factorSimultaneidad: number;
  salidas: Carga[];
}

export const SUBTIPOS_TDG_LABEL: Record<SubtipoTdg, string> = {
  general: 'Distribución general',
  fuerza: 'Fuerza',
};

interface TdgState {
  tableros: TdgTablero[];
  activoId: string | null;

  crearTablero: (nombre: string, subtipo?: SubtipoTdg) => string;
  renombrarTablero: (id: string, nombre: string) => void;
  duplicarTablero: (id: string) => string;
  eliminarTablero: (id: string) => void;
  setActivo: (id: string) => void;

  setNorma: (n: Norma) => void;
  setMarca: (m: MarcaProteccion) => void;
  setFactorSimultaneidad: (v: number) => void;
  agregar: () => void;
  duplicar: (id: string) => void;
  eliminar: (id: string) => void;
  actualizar: (id: string, parcial: Partial<Carga>) => void;
  importar: (cargas: ReadonlyArray<Omit<Carga, 'id'>>, modo: 'reemplazar' | 'agregar') => void;
  cargarEjemplo: () => void;
  limpiar: () => void;
}

function tableroVacio(nombre: string, subtipo: SubtipoTdg = 'general'): TdgTablero {
  return {
    id: nuevoId('tdg'),
    nombre,
    subtipo,
    norma: 'NEMA',
    factorSimultaneidad: 0.8,
    salidas: [],
  };
}

const EJEMPLO: Carga[] = [
  { id: 'tdg-1', descripcion: 'Sub-tablero edificio A', tipo: 'otro',         potenciaKw: 80,  tensionV: 400, fases: '3F', factorServicio: 1 },
  { id: 'tdg-2', descripcion: 'Sub-tablero edificio B', tipo: 'otro',         potenciaKw: 120, tensionV: 400, fases: '3F', factorServicio: 1 },
  { id: 'tdg-3', descripcion: 'CCM bombas',             tipo: 'otro',         potenciaKw: 90,  tensionV: 400, fases: '3F', factorServicio: 1.1 },
  { id: 'tdg-4', descripcion: 'Iluminación general',    tipo: 'iluminacion',  potenciaKw: 25,  tensionV: 400, fases: '3F', factorServicio: 1 },
  { id: 'tdg-5', descripcion: 'Tomas y oficinas',       tipo: 'tomas',        potenciaKw: 35,  tensionV: 400, fases: '3F', factorServicio: 1 },
  { id: 'tdg-6', descripcion: 'Climatización chiller',  tipo: 'motor',        potenciaKw: 110, tensionV: 400, fases: '3F', factorServicio: 1.15 },
];

function modificarActivo(s: TdgState, fn: (t: TdgTablero) => TdgTablero): Partial<TdgState> {
  if (s.activoId == null) return {};
  return { tableros: s.tableros.map((t) => (t.id === s.activoId ? fn(t) : t)) };
}

export const useTdgStore = create<TdgState>()(
  persist(
    (set) => {
      const inicial = tableroVacio('Tablero 1');
      return {
        tableros: [inicial],
        activoId: inicial.id,

        crearTablero: (nombre, subtipo = 'general') => {
          const t = tableroVacio(nombre || 'Tablero', subtipo);
          set((s) => ({ tableros: [...s.tableros, t], activoId: t.id }));
          return t.id;
        },
        renombrarTablero: (id, nombre) => set((s) => ({
          tableros: s.tableros.map((t) => (t.id === id ? { ...t, nombre } : t)),
        })),
        duplicarTablero: (id) => {
          const nuevo: TdgTablero = { ...tableroVacio('') };
          set((s) => {
            const orig = s.tableros.find((t) => t.id === id);
            if (!orig) return {};
            nuevo.nombre = `${orig.nombre} (copia)`;
            nuevo.subtipo = orig.subtipo;
            nuevo.norma = orig.norma;
            nuevo.marca = orig.marca;
            nuevo.factorSimultaneidad = orig.factorSimultaneidad;
            nuevo.salidas = orig.salidas.map((c) => ({ ...c, id: nuevoId('s') }));
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

        setNorma: (n) => set((s) => modificarActivo(s, (t) => ({ ...t, norma: n }))),
        setMarca: (m) => set((s) => modificarActivo(s, (t) => ({ ...t, marca: m }))),
        setFactorSimultaneidad: (v) => set((s) => modificarActivo(s, (t) => ({
          ...t,
          factorSimultaneidad: Math.max(0.1, Math.min(1, Number.isFinite(v) ? v : 0.8)),
        }))),
        agregar: () => set((s) => modificarActivo(s, (t) => ({
          ...t, salidas: [...t.salidas, salidaPorDefecto(t.subtipo)],
        }))),
        duplicar: (id) => set((s) => modificarActivo(s, (t) => {
          const orig = t.salidas.find((x) => x.id === id);
          if (!orig) return t;
          const copia: Carga = { ...orig, id: nuevoId('s'), descripcion: `${orig.descripcion} (copia)` };
          return { ...t, salidas: [...t.salidas, copia] };
        })),
        eliminar: (id) => set((s) => modificarActivo(s, (t) => ({
          ...t, salidas: t.salidas.filter((x) => x.id !== id),
        }))),
        actualizar: (id, parcial) => set((s) => modificarActivo(s, (t) => ({
          ...t,
          salidas: t.salidas.map((c) => (c.id === id ? { ...c, ...parcial } : c)),
        }))),
        importar: (importadas, modo) => set((s) => modificarActivo(s, (t) => {
          const conIds = importadas.map((c) => ({ ...c, id: nuevoId('s') }));
          return { ...t, salidas: modo === 'reemplazar' ? conIds : [...t.salidas, ...conIds] };
        })),
        cargarEjemplo: () => set((s) => modificarActivo(s, (t) => ({
          ...t,
          salidas: EJEMPLO.map((c) => ({ ...c, id: nuevoId('s') })),
          factorSimultaneidad: 0.8,
        }))),
        limpiar: () => set((s) => modificarActivo(s, (t) => ({ ...t, salidas: [] }))),
      };
    },
    {
      name: 'tdg-salidas-v2',
      version: 2,
      migrate: (persisted, fromVersion) => {
        if (fromVersion < 1) {
          const p = (persisted ?? {}) as { salidas?: Carga[]; norma?: Norma; factorSimultaneidad?: number };
          const salidas = Array.isArray(p.salidas) ? p.salidas : [];
          const norma: Norma = p.norma === 'IEC' ? 'IEC' : 'NEMA';
          const fs = typeof p.factorSimultaneidad === 'number' ? p.factorSimultaneidad : 0.8;
          const t: TdgTablero = { id: nuevoId('tdg'), nombre: 'Tablero 1', subtipo: 'general', norma, factorSimultaneidad: fs, salidas };
          return { tableros: [t], activoId: t.id } as unknown as TdgState;
        }
        if (fromVersion < 2) {
          const p = (persisted ?? {}) as { tableros?: Array<Omit<TdgTablero, 'subtipo'> & { subtipo?: SubtipoTdg }>; activoId?: string | null };
          const tableros = (p.tableros ?? []).map((t) => ({ ...t, subtipo: (t.subtipo ?? 'general') as SubtipoTdg }));
          return { tableros, activoId: p.activoId ?? tableros[0]?.id ?? null } as unknown as TdgState;
        }
        return persisted as TdgState;
      },
    },
  ),
);

export const useTdgTableroActivo = (): TdgTablero | undefined =>
  useTdgStore((s) => s.tableros.find((t) => t.id === s.activoId));

export const useTdgSalidas = (): Carga[] =>
  useTdgStore((s) => s.tableros.find((t) => t.id === s.activoId)?.salidas ?? []);

export const useTdgNorma = (): Norma =>
  useTdgStore((s) => s.tableros.find((t) => t.id === s.activoId)?.norma ?? 'NEMA');

export const useTdgMarca = (): MarcaProteccion =>
  useTdgStore((s) => s.tableros.find((t) => t.id === s.activoId)?.marca ?? 'Schneider');

export const useTdgFactorSimultaneidad = (): number =>
  useTdgStore((s) => s.tableros.find((t) => t.id === s.activoId)?.factorSimultaneidad ?? 0.8);

export const useTdgSubtipo = (): SubtipoTdg =>
  useTdgStore((s) => s.tableros.find((t) => t.id === s.activoId)?.subtipo ?? 'general');
