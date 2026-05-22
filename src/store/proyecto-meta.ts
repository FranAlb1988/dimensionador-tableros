import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { factorDerrateoAltura, type NivelTension } from '../logic/derrateo';

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

/**
 * Derrateo por altura geográfica (factor F2). Ajuste global del proyecto: la altitud
 * se define una vez y aplica al dimensionamiento de todos los tableros.
 */
export interface DerrateoConfig {
  /** Si está activo, el dimensionamiento corrige la capacidad de los equipos por F2. */
  activo: boolean;
  /** Altura de operación en metros sobre el nivel del mar. */
  altitudM: number;
}

export const DERRATEO_DEFAULT: DerrateoConfig = { activo: false, altitudM: 2300 };

interface MetaState {
  metadatos: MetadatosProyecto;
  derrateo: DerrateoConfig;
  setMetadato: <K extends keyof MetadatosProyecto>(campo: K, valor: MetadatosProyecto[K]) => void;
  setMetadatos: (m: Partial<MetadatosProyecto>) => void;
  setDerrateo: (parcial: Partial<DerrateoConfig>) => void;
  limpiar: () => void;
}

export const useMetaStore = create<MetaState>()(
  persist(
    (set) => ({
      metadatos: { ...METADATOS_VACIOS },
      derrateo: { ...DERRATEO_DEFAULT },
      setMetadato: (campo, valor) => set((s) => ({ metadatos: { ...s.metadatos, [campo]: valor } })),
      setMetadatos: (m) => set((s) => ({ metadatos: { ...s.metadatos, ...m } })),
      setDerrateo: (parcial) => set((s) => ({ derrateo: { ...s.derrateo, ...parcial } })),
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

/**
 * Hook: factor de derrateo F2 según la configuración global del proyecto.
 * Devuelve 1 si el derrateo está desactivado. `nivel` selecciona BT o MT.
 */
export function useFactorDerrateo(nivel: NivelTension): number {
  const derrateo = useMetaStore((s) => s.derrateo);
  return useMemo(
    () => (derrateo.activo ? factorDerrateoAltura(derrateo.altitudM, nivel) : 1),
    [derrateo, nivel],
  );
}
