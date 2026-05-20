import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SalidaMt, TipoCeldaMt } from '../types';

let idCounter = 0;
function nuevoId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export const TIPOS_CELDA_MT: readonly TipoCeldaMt[] = ['entrada', 'salida', 'acople', 'medida'];

export function salidaMtPorDefecto(tipoCelda: TipoCeldaMt = 'salida'): SalidaMt {
  return {
    id: nuevoId('mt'),
    descripcion: '',
    tipoCelda,
    corrienteA: 0,
  };
}

export interface MtTablero {
  id: string;
  nombre: string;
  claseTensionKv: number;
  iccKa: number;
  salidas: SalidaMt[];
}

interface MtState {
  tableros: MtTablero[];
  activoId: string | null;

  crearTablero: (nombre: string) => string;
  renombrarTablero: (id: string, nombre: string) => void;
  duplicarTablero: (id: string) => string;
  eliminarTablero: (id: string) => void;
  setActivo: (id: string) => void;

  setClaseTension: (kv: number) => void;
  setIcc: (ka: number) => void;
  agregar: (tipoCelda?: TipoCeldaMt) => void;
  duplicar: (id: string) => void;
  eliminar: (id: string) => void;
  actualizar: (id: string, parcial: Partial<SalidaMt>) => void;
  cargarEjemplo: () => void;
  limpiar: () => void;
}

function tableroVacio(nombre: string): MtTablero {
  return {
    id: nuevoId('mt-t'),
    nombre,
    claseTensionKv: 36,
    iccKa: 25,
    salidas: [],
  };
}

const EJEMPLO: SalidaMt[] = [
  { id: 'mt-e1', descripcion: 'Entrada desde subestación',   tipoCelda: 'entrada', corrienteA: 1200 },
  { id: 'mt-s1', descripcion: 'Alimentador TR1 2 MVA',      tipoCelda: 'salida',  potenciaMva: 2, corrienteA: 0 },
  { id: 'mt-s2', descripcion: 'Alimentador TR2 2 MVA',      tipoCelda: 'salida',  potenciaMva: 2, corrienteA: 0 },
  { id: 'mt-s3', descripcion: 'Alimentador CCM proceso',    tipoCelda: 'salida',  corrienteA: 400 },
  { id: 'mt-a1', descripcion: 'Acople de barras',           tipoCelda: 'acople',  corrienteA: 1200 },
  { id: 'mt-m1', descripcion: 'Celda de medida',            tipoCelda: 'medida' },
];

function modificarActivo(s: MtState, fn: (t: MtTablero) => MtTablero): Partial<MtState> {
  if (s.activoId == null) return {};
  return { tableros: s.tableros.map((t) => (t.id === s.activoId ? fn(t) : t)) };
}

export const useMtStore = create<MtState>()(
  persist(
    (set) => {
      const inicial = tableroVacio('Switchgear 1');
      return {
        tableros: [inicial],
        activoId: inicial.id,

        crearTablero: (nombre) => {
          const t = tableroVacio(nombre || 'Switchgear');
          set((s) => ({ tableros: [...s.tableros, t], activoId: t.id }));
          return t.id;
        },
        renombrarTablero: (id, nombre) => set((s) => ({
          tableros: s.tableros.map((t) => (t.id === id ? { ...t, nombre } : t)),
        })),
        duplicarTablero: (id) => {
          const nuevo: MtTablero = { ...tableroVacio('') };
          set((s) => {
            const orig = s.tableros.find((t) => t.id === id);
            if (!orig) return {};
            nuevo.nombre = `${orig.nombre} (copia)`;
            nuevo.claseTensionKv = orig.claseTensionKv;
            nuevo.iccKa = orig.iccKa;
            nuevo.salidas = orig.salidas.map((c) => ({ ...c, id: nuevoId('mt') }));
            return { tableros: [...s.tableros, nuevo], activoId: nuevo.id };
          });
          return nuevo.id;
        },
        eliminarTablero: (id) => set((s) => {
          const tableros = s.tableros.filter((t) => t.id !== id);
          if (tableros.length === 0) {
            const t = tableroVacio('Switchgear 1');
            return { tableros: [t], activoId: t.id };
          }
          const activoId = s.activoId === id ? tableros[0]!.id : s.activoId;
          return { tableros, activoId };
        }),
        setActivo: (id) => set({ activoId: id }),

        setClaseTension: (kv) => set((s) => modificarActivo(s, (t) => ({ ...t, claseTensionKv: kv }))),
        setIcc: (ka) => set((s) => modificarActivo(s, (t) => ({ ...t, iccKa: ka }))),
        agregar: (tipoCelda = 'salida') => set((s) => modificarActivo(s, (t) => ({
          ...t, salidas: [...t.salidas, salidaMtPorDefecto(tipoCelda)],
        }))),
        duplicar: (id) => set((s) => modificarActivo(s, (t) => {
          const orig = t.salidas.find((x) => x.id === id);
          if (!orig) return t;
          const copia: SalidaMt = { ...orig, id: nuevoId('mt'), descripcion: `${orig.descripcion} (copia)` };
          return { ...t, salidas: [...t.salidas, copia] };
        })),
        eliminar: (id) => set((s) => modificarActivo(s, (t) => ({
          ...t, salidas: t.salidas.filter((x) => x.id !== id),
        }))),
        actualizar: (id, parcial) => set((s) => modificarActivo(s, (t) => ({
          ...t,
          salidas: t.salidas.map((c) => (c.id === id ? { ...c, ...parcial } : c)),
        }))),
        cargarEjemplo: () => set((s) => modificarActivo(s, (t) => ({
          ...t,
          claseTensionKv: 36,
          iccKa: 25,
          salidas: EJEMPLO.map((c) => ({ ...c, id: nuevoId('mt') })),
        }))),
        limpiar: () => set((s) => modificarActivo(s, (t) => ({ ...t, salidas: [] }))),
      };
    },
    {
      name: 'mt-switchgear-v1',
      version: 1,
    },
  ),
);

export const useMtTableroActivo = (): MtTablero | undefined =>
  useMtStore((s) => s.tableros.find((t) => t.id === s.activoId));

export const useMtSalidas = (): SalidaMt[] =>
  useMtStore((s) => s.tableros.find((t) => t.id === s.activoId)?.salidas ?? []);

export const useMtClaseTension = (): number =>
  useMtStore((s) => s.tableros.find((t) => t.id === s.activoId)?.claseTensionKv ?? 36);

export const useMtIcc = (): number =>
  useMtStore((s) => s.tableros.find((t) => t.id === s.activoId)?.iccKa ?? 25);
