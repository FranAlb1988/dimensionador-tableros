import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Metadatos del proyecto. Aparecen en el cajetín del PDF y se guardan junto al estado.
 * Todos los campos son opcionales — la app funciona con o sin ellos.
 */
export interface MetadatosProyecto {
  nombre: string;         // Nombre del proyecto
  cliente: string;        // Nombre del cliente
  planta: string;         // Planta / Área de proceso
  codigoHqr: string;      // Código de plano (propio)
  codigoCliente: string;  // Código de plano cliente
  revision: string;       // "B"
  fecha: string;          // ISO YYYY-MM-DD ("2026-05-11")
  proyecto: string;       // dibujante / proyectó
  reviso: string;
  aprobo: string;
  aproboCliente: string;
  notas: string;
}

export const METADATOS_VACIOS: MetadatosProyecto = {
  nombre: '',
  cliente: '',
  planta: '',
  codigoHqr: '',
  codigoCliente: '',
  revision: '',
  fecha: '',
  proyecto: '',
  reviso: '',
  aprobo: '',
  aproboCliente: '',
  notas: '',
};

interface MetaState {
  metadatos: MetadatosProyecto;
  setMetadato: <K extends keyof MetadatosProyecto>(campo: K, valor: MetadatosProyecto[K]) => void;
  setMetadatos: (m: Partial<MetadatosProyecto>) => void;
  limpiar: () => void;
}

export const useMetaStore = create<MetaState>()(
  persist(
    (set) => ({
      metadatos: { ...METADATOS_VACIOS },
      setMetadato: (campo, valor) => set((s) => ({ metadatos: { ...s.metadatos, [campo]: valor } })),
      setMetadatos: (m) => set((s) => ({ metadatos: { ...s.metadatos, ...m } })),
      limpiar: () => set({ metadatos: { ...METADATOS_VACIOS } }),
    }),
    { name: 'proyecto-meta-v1', version: 1 },
  ),
);

/** Helper para PDF/headers: extrae los metadatos actuales sin necesitar hook. */
export function getMetadatos(): MetadatosProyecto {
  return useMetaStore.getState().metadatos;
}

/** Indica si hay al menos un campo con valor no vacío. */
export function tieneMetadatos(m: MetadatosProyecto = getMetadatos()): boolean {
  return Object.values(m).some((v) => typeof v === 'string' && v.trim() !== '');
}
