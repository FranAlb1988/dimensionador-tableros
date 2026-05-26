import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CategoriaAuxiliar, EquipoAuxiliar } from '../types';

let idCounter = 0;
function nuevoId(): string {
  idCounter += 1;
  return `aux-${Date.now().toString(36)}-${idCounter}`;
}

export const CATEGORIAS: readonly CategoriaAuxiliar[] = [
  'instrumentacion',
  'ups',
  'baterias',
  'cargador',
];

export const CATEGORIAS_LABEL: Record<CategoriaAuxiliar, string> = {
  instrumentacion: 'Instrumentación',
  ups: 'UPS',
  baterias: 'Banco de baterías',
  cargador: 'Cargador de baterías',
};

export const CATEGORIAS_DESCRIPCION: Record<CategoriaAuxiliar, string> = {
  instrumentacion: 'Tableros y equipos de instrumentación (PLCs, IO, comunicaciones, fuentes 24 V DC).',
  ups: 'Sistemas de alimentación ininterrumpida — para servicios críticos.',
  baterias: 'Bancos de baterías estacionarias para respaldo DC.',
  cargador: 'Cargadores/rectificadores AC→DC para el banco de baterías.',
};

/** Campo del modelo que se edita como columna de tabla. */
export interface ColumnaAuxiliar {
  campo: keyof EquipoAuxiliar;
  label: string;
  tipo: 'text' | 'number';
  ancho?: string;       // clase Tailwind (w-24, etc.)
  placeholder?: string;
  title?: string;
}

const COMUNES_INI: readonly ColumnaAuxiliar[] = [
  { campo: 'tag', label: 'Tag', tipo: 'text', ancho: 'w-32' },
  { campo: 'descripcion', label: 'Descripción', tipo: 'text' },
  { campo: 'marca', label: 'Marca', tipo: 'text', ancho: 'w-28' },
  { campo: 'modelo', label: 'Modelo', tipo: 'text', ancho: 'w-28' },
  { campo: 'ubicacion', label: 'Ubicación', tipo: 'text', ancho: 'w-32' },
];

const COMUNES_FIN: readonly ColumnaAuxiliar[] = [
  { campo: 'notas', label: 'Notas', tipo: 'text' },
];

export const COLUMNAS_POR_CATEGORIA: Record<CategoriaAuxiliar, readonly ColumnaAuxiliar[]> = {
  instrumentacion: [
    ...COMUNES_INI,
    { campo: 'tensionVdc', label: 'V (DC)', tipo: 'number', ancho: 'w-20' },
    { campo: 'consumoW', label: 'Consumo (W)', tipo: 'number', ancho: 'w-24' },
    { campo: 'modulosIo', label: 'Módulos IO', tipo: 'number', ancho: 'w-24' },
    { campo: 'comunicacion', label: 'Comunicación', tipo: 'text', ancho: 'w-32', placeholder: 'Ethernet/IP, Modbus…' },
    ...COMUNES_FIN,
  ],
  ups: [
    ...COMUNES_INI,
    { campo: 'potenciaKva', label: 'kVA', tipo: 'number', ancho: 'w-20' },
    { campo: 'tensionVac', label: 'V entrada (AC)', tipo: 'number', ancho: 'w-28' },
    { campo: 'tensionVdc', label: 'V salida (DC)', tipo: 'number', ancho: 'w-28' },
    { campo: 'autonomiaMin', label: 'Autonomía (min)', tipo: 'number', ancho: 'w-28' },
    ...COMUNES_FIN,
  ],
  baterias: [
    ...COMUNES_INI,
    { campo: 'tensionVdc', label: 'V nominal (DC)', tipo: 'number', ancho: 'w-28' },
    { campo: 'capacidadAh', label: 'Capacidad (Ah)', tipo: 'number', ancho: 'w-28' },
    { campo: 'cantidadCeldas', label: '# celdas', tipo: 'number', ancho: 'w-24' },
    { campo: 'tipoTecnologia', label: 'Tecnología', tipo: 'text', ancho: 'w-32', placeholder: 'Pb-Ácido, Ni-Cd, Litio…' },
    ...COMUNES_FIN,
  ],
  cargador: [
    ...COMUNES_INI,
    { campo: 'tensionVac', label: 'V entrada (AC)', tipo: 'number', ancho: 'w-28' },
    { campo: 'tensionVdc', label: 'V salida (DC)', tipo: 'number', ancho: 'w-28' },
    { campo: 'corrienteSalidaA', label: 'I salida (A)', tipo: 'number', ancho: 'w-24' },
    { campo: 'potenciaKva', label: 'kVA', tipo: 'number', ancho: 'w-20' },
    ...COMUNES_FIN,
  ],
};

function equipoPorDefecto(categoria: CategoriaAuxiliar): EquipoAuxiliar {
  return {
    id: nuevoId(),
    categoria,
    tag: '',
    descripcion: '',
  };
}

interface AuxiliaresState {
  equipos: EquipoAuxiliar[];
  agregar: (categoria: CategoriaAuxiliar) => void;
  duplicar: (id: string) => void;
  eliminar: (id: string) => void;
  actualizar: (id: string, parcial: Partial<EquipoAuxiliar>) => void;
  limpiar: (categoria: CategoriaAuxiliar) => void;
  cargarEjemplo: () => void;
  setEquipos: (eq: EquipoAuxiliar[]) => void;
}

const EJEMPLO: EquipoAuxiliar[] = [
  { id: 'aux-ej-1', categoria: 'instrumentacion', tag: 'TIN-101', descripcion: 'Panel de control PLC', marca: 'Schneider', modelo: 'M580 BMEH', ubicacion: 'Sala eléctrica', tensionVdc: 24, consumoW: 120, modulosIo: 16, comunicacion: 'Ethernet/IP' },
  { id: 'aux-ej-2', categoria: 'instrumentacion', tag: 'TIN-102', descripcion: 'IO remoto sala bombas', marca: 'Schneider', modelo: 'X80', ubicacion: 'Sala bombas', tensionVdc: 24, consumoW: 80, modulosIo: 8, comunicacion: 'Ethernet/IP' },
  { id: 'aux-ej-3', categoria: 'ups', tag: 'UPS-101', descripcion: 'UPS servicios críticos', marca: 'APC', modelo: 'Smart-UPS SRT', ubicacion: 'Sala eléctrica', potenciaKva: 10, tensionVac: 400, tensionVdc: 120, autonomiaMin: 30 },
  { id: 'aux-ej-4', categoria: 'baterias', tag: 'BAT-101', descripcion: 'Banco baterías 110 Vdc', marca: 'Saft', modelo: 'SBL', ubicacion: 'Sala baterías', tensionVdc: 110, capacidadAh: 200, cantidadCeldas: 92, tipoTecnologia: 'Ni-Cd' },
  { id: 'aux-ej-5', categoria: 'cargador', tag: 'CB-101', descripcion: 'Cargador 110 Vdc', marca: 'AEG', modelo: 'Protect Rectifier', ubicacion: 'Sala eléctrica', tensionVac: 400, tensionVdc: 110, corrienteSalidaA: 50, potenciaKva: 6 },
];

export const useAuxiliaresStore = create<AuxiliaresState>()(
  persist(
    (set) => ({
      equipos: [],
      agregar: (categoria) => set((s) => ({ equipos: [...s.equipos, equipoPorDefecto(categoria)] })),
      duplicar: (id) => set((s) => {
        const orig = s.equipos.find((e) => e.id === id);
        if (!orig) return {};
        const copia: EquipoAuxiliar = { ...orig, id: nuevoId(), tag: `${orig.tag} (copia)`.trim() };
        return { equipos: [...s.equipos, copia] };
      }),
      eliminar: (id) => set((s) => ({ equipos: s.equipos.filter((e) => e.id !== id) })),
      actualizar: (id, parcial) => set((s) => ({
        equipos: s.equipos.map((e) => (e.id === id ? { ...e, ...parcial } : e)),
      })),
      limpiar: (categoria) => set((s) => ({ equipos: s.equipos.filter((e) => e.categoria !== categoria) })),
      cargarEjemplo: () => set({ equipos: EJEMPLO.map((e) => ({ ...e })) }),
      setEquipos: (eq) => set({ equipos: eq }),
    }),
    { name: 'auxiliares-v1', version: 1 },
  ),
);

/**
 * Equipos filtrados por categoría. Se memoiza para evitar el loop infinito de
 * re-renders: si el selector hiciera `.filter()` directamente, cada llamada
 * devolvería un array nuevo y zustand detectaría un cambio en cada render.
 */
export function useAuxiliaresPorCategoria(categoria: CategoriaAuxiliar): EquipoAuxiliar[] {
  const equipos = useAuxiliaresStore((s) => s.equipos);
  return useMemo(() => equipos.filter((e) => e.categoria === categoria), [equipos, categoria]);
}
