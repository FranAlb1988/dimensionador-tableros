import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Carga } from '../types';
import { OPCIONES_CDC_DEFAULT, type OpcionesCdc } from '../logic/cdc';

let idCounter = 0;
function nuevoId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/**
 * Subtipo del CDC:
 *  - 'general': cofre de distribución mixto (default original)
 *  - 'alumbrado': tablero de alumbrado, defaults pensados para circuitos de iluminación
 */
export type SubtipoCdc = 'general' | 'alumbrado';

export function cargaCdcPorDefecto(_subtipo: SubtipoCdc = 'general'): Carga {
  // Por ahora ambos subtipos tienen los mismos defaults (1F/230V/iluminación);
  // se deja el parámetro para diferenciarlos en una versión futura.
  return {
    id: nuevoId('cdc-c'),
    descripcion: '',
    tipo: 'iluminacion',
    potenciaKw: 0,
    unidadPotencia: 'kW',
    tensionV: 230,
    fases: '1F',
    factorServicio: 1,
  };
}

export interface CdcTablero {
  id: string;
  nombre: string;
  subtipo: SubtipoCdc;
  opciones: OpcionesCdc;
  cargas: Carga[];
}

export const SUBTIPOS_CDC_LABEL: Record<SubtipoCdc, string> = {
  general: 'Distribución',
  alumbrado: 'Alumbrado',
};

interface CdcState {
  tableros: CdcTablero[];
  activoId: string | null;

  crearTablero: (nombre: string, subtipo?: SubtipoCdc) => string;
  renombrarTablero: (id: string, nombre: string) => void;
  duplicarTablero: (id: string) => string;
  eliminarTablero: (id: string) => void;
  setActivo: (id: string) => void;

  setOpciones: (parcial: Partial<OpcionesCdc>) => void;
  agregar: () => void;
  duplicar: (id: string) => void;
  eliminar: (id: string) => void;
  actualizar: (id: string, parcial: Partial<Carga>) => void;
  importar: (cargas: ReadonlyArray<Omit<Carga, 'id'>>, modo: 'reemplazar' | 'agregar') => void;
  cargarEjemplo: () => void;
  limpiar: () => void;
}

function tableroVacio(nombre: string, subtipo: SubtipoCdc = 'general'): CdcTablero {
  return {
    id: nuevoId('cdc'),
    nombre,
    subtipo,
    opciones: { ...OPCIONES_CDC_DEFAULT },
    cargas: [],
  };
}

const EJEMPLO: Carga[] = [
  { id: 'cdc-ej-1', descripcion: 'Iluminación oficinas 1', tipo: 'iluminacion', potenciaKw: 1.8, unidadPotencia: 'kW', tensionV: 230, fases: '1F', factorServicio: 1 },
  { id: 'cdc-ej-2', descripcion: 'Iluminación oficinas 2', tipo: 'iluminacion', potenciaKw: 1.8, unidadPotencia: 'kW', tensionV: 230, fases: '1F', factorServicio: 1 },
  { id: 'cdc-ej-3', descripcion: 'Iluminación pasillos',   tipo: 'iluminacion', potenciaKw: 1.2, unidadPotencia: 'kW', tensionV: 230, fases: '1F', factorServicio: 1 },
  { id: 'cdc-ej-4', descripcion: 'Iluminación exterior',   tipo: 'iluminacion', potenciaKw: 2.5, unidadPotencia: 'kW', tensionV: 230, fases: '1F', factorServicio: 1 },
  { id: 'cdc-ej-5', descripcion: 'Tomas oficinas',         tipo: 'tomas',       potenciaKw: 3.0, unidadPotencia: 'kW', tensionV: 230, fases: '1F', factorServicio: 1 },
  { id: 'cdc-ej-6', descripcion: 'Tomas sala reuniones',   tipo: 'tomas',       potenciaKw: 2.0, unidadPotencia: 'kW', tensionV: 230, fases: '1F', factorServicio: 1 },
  { id: 'cdc-ej-7', descripcion: 'Tomas trifásicas taller', tipo: 'tomas',      potenciaKw: 8.0, unidadPotencia: 'kW', tensionV: 400, fases: '3F', factorServicio: 1 },
  { id: 'cdc-ej-8', descripcion: 'Aire acondicionado split', tipo: 'otro',      potenciaKw: 2.5, unidadPotencia: 'kW', tensionV: 230, fases: '1F', factorServicio: 1.1 },
];

function modificarActivo(s: CdcState, fn: (t: CdcTablero) => CdcTablero): Partial<CdcState> {
  if (s.activoId == null) return {};
  return { tableros: s.tableros.map((t) => (t.id === s.activoId ? fn(t) : t)) };
}

export const useCdcStore = create<CdcState>()(
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
          const nuevo = tableroVacio('');
          set((s) => {
            const orig = s.tableros.find((t) => t.id === id);
            if (!orig) return {};
            nuevo.nombre = `${orig.nombre} (copia)`;
            nuevo.subtipo = orig.subtipo;
            nuevo.opciones = { ...orig.opciones };
            nuevo.cargas = orig.cargas.map((c) => ({ ...c, id: nuevoId('cdc-c') }));
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

        setOpciones: (parcial) => set((s) => modificarActivo(s, (t) => ({
          ...t, opciones: { ...t.opciones, ...parcial },
        }))),
        agregar: () => set((s) => modificarActivo(s, (t) => ({
          ...t, cargas: [...t.cargas, cargaCdcPorDefecto(t.subtipo)],
        }))),
        duplicar: (id) => set((s) => modificarActivo(s, (t) => {
          const orig = t.cargas.find((c) => c.id === id);
          if (!orig) return t;
          const copia: Carga = { ...orig, id: nuevoId('cdc-c'), descripcion: `${orig.descripcion} (copia)` };
          return { ...t, cargas: [...t.cargas, copia] };
        })),
        eliminar: (id) => set((s) => modificarActivo(s, (t) => ({
          ...t, cargas: t.cargas.filter((c) => c.id !== id),
        }))),
        actualizar: (id, parcial) => set((s) => modificarActivo(s, (t) => ({
          ...t,
          cargas: t.cargas.map((c) => (c.id === id ? { ...c, ...parcial } : c)),
        }))),
        importar: (importadas, modo) => set((s) => modificarActivo(s, (t) => {
          const conIds = importadas.map((c) => ({ ...c, id: nuevoId('cdc-c') }));
          return { ...t, cargas: modo === 'reemplazar' ? conIds : [...t.cargas, ...conIds] };
        })),
        cargarEjemplo: () => set((s) => modificarActivo(s, (t) => ({
          ...t, cargas: EJEMPLO.map((c) => ({ ...c, id: nuevoId('cdc-c') })),
        }))),
        limpiar: () => set((s) => modificarActivo(s, (t) => ({ ...t, cargas: [] }))),
      };
    },
    {
      name: 'cdc-cargas-v1',
      version: 2,
      migrate: (persisted, fromVersion) => {
        if (fromVersion < 1) {
          // De v0 (single-tablero, sin subtipo) → v2 (multi-tablero con subtipo).
          const p = (persisted ?? {}) as { cargas?: Carga[]; opciones?: OpcionesCdc };
          const cargas = Array.isArray(p.cargas) ? p.cargas : [];
          const opciones: OpcionesCdc = p.opciones ?? { ...OPCIONES_CDC_DEFAULT };
          const t: CdcTablero = { id: nuevoId('cdc'), nombre: 'Tablero 1', subtipo: 'general', opciones, cargas };
          return { tableros: [t], activoId: t.id } as unknown as CdcState;
        }
        if (fromVersion < 2) {
          // De v1 (multi-tablero sin subtipo) → v2: rellenar subtipo='general'.
          const p = (persisted ?? {}) as { tableros?: Array<Omit<CdcTablero, 'subtipo'> & { subtipo?: SubtipoCdc }>; activoId?: string | null };
          const tableros = (p.tableros ?? []).map((t) => ({ ...t, subtipo: (t.subtipo ?? 'general') as SubtipoCdc }));
          return { tableros, activoId: p.activoId ?? tableros[0]?.id ?? null } as unknown as CdcState;
        }
        return persisted as CdcState;
      },
    },
  ),
);

export const useCdcTableroActivo = (): CdcTablero | undefined =>
  useCdcStore((s) => s.tableros.find((t) => t.id === s.activoId));

export const useCdcCargas = (): Carga[] =>
  useCdcStore((s) => s.tableros.find((t) => t.id === s.activoId)?.cargas ?? []);

export const useCdcOpciones = (): OpcionesCdc =>
  useCdcStore((s) => s.tableros.find((t) => t.id === s.activoId)?.opciones ?? OPCIONES_CDC_DEFAULT);

export const useCdcSubtipo = (): SubtipoCdc =>
  useCdcStore((s) => s.tableros.find((t) => t.id === s.activoId)?.subtipo ?? 'general');

export const MODULOS_POR_FILA_OPCIONES: readonly number[] = [12, 13, 18, 24];
