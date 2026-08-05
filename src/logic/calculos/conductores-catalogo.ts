// Catálogo de conductores de cobre — valores típicos de referencia.
// R y X (Ω/km): para caída de tensión y cortocircuito. Cobre en ducto,
//   ~75–90 °C, 50 Hz. AWG/MCM derivado de NEC Cap. 9, Tabla 9; mm² típicos IEC.
// areaMm2 y diametroMm: del conductor con aislación (THHN/THWN para AWG,
//   XLPE típico para mm²), para el cálculo de canalizaciones.
//
// Son valores de referencia y quedan editables tras autocompletar:
// verificar siempre contra la hoja de datos del cable del proyecto.

import type { OpcionCampo } from './tipos';

export interface ConductorCatalogo {
  id: string;
  nombre: string;
  /** Resistencia, Ω/km. */
  R: number;
  /** Reactancia, Ω/km. */
  X: number;
  /** Área del conductor con aislación, mm². */
  areaMm2: number;
  /** Diámetro exterior del conductor con aislación, mm. */
  diametroMm: number;
  /** Sección del conductor (cobre), mm². Distinta del área con aislación. */
  seccionMm2?: number;
}

export const CATALOGO_CONDUCTORES: readonly ConductorCatalogo[] = [
  { id: 'awg-12', nombre: '#12 AWG', R: 6.56, X: 0.148, areaMm2: 8.58, diametroMm: 3.3, seccionMm2: 3.31 },
  { id: 'awg-10', nombre: '#10 AWG', R: 3.94, X: 0.137, areaMm2: 13.61, diametroMm: 4.17, seccionMm2: 5.26 },
  { id: 'awg-8', nombre: '#8 AWG', R: 2.56, X: 0.142, areaMm2: 23.61, diametroMm: 5.49, seccionMm2: 8.37 },
  { id: 'awg-6', nombre: '#6 AWG', R: 1.61, X: 0.139, areaMm2: 32.71, diametroMm: 6.45, seccionMm2: 13.3 },
  { id: 'awg-4', nombre: '#4 AWG', R: 1.02, X: 0.131, areaMm2: 53.16, diametroMm: 8.23, seccionMm2: 21.2 },
  { id: 'awg-2', nombre: '#2 AWG', R: 0.623, X: 0.123, areaMm2: 74.71, diametroMm: 9.75, seccionMm2: 33.6 },
  { id: 'awg-1-0', nombre: '1/0 AWG', R: 0.394, X: 0.12, areaMm2: 119.7, diametroMm: 12.34, seccionMm2: 53.5 },
  { id: 'awg-2-0', nombre: '2/0 AWG', R: 0.328, X: 0.118, areaMm2: 143.4, diametroMm: 13.51, seccionMm2: 67.4 },
  { id: 'awg-4-0', nombre: '4/0 AWG', R: 0.203, X: 0.112, areaMm2: 208.8, diametroMm: 16.31, seccionMm2: 107.2 },
  { id: 'mcm-250', nombre: '250 MCM', R: 0.171, X: 0.112, areaMm2: 256.1, diametroMm: 18.06, seccionMm2: 127 },
  { id: 'mcm-350', nombre: '350 MCM', R: 0.125, X: 0.109, areaMm2: 322.7, diametroMm: 20.27, seccionMm2: 177 },
  { id: 'mcm-500', nombre: '500 MCM', R: 0.0886, X: 0.107, areaMm2: 431.4, diametroMm: 23.44, seccionMm2: 253 },
  { id: 'mcm-750', nombre: '750 MCM', R: 0.0623, X: 0.104, areaMm2: 655.4, diametroMm: 28.88, seccionMm2: 380 },
  { id: 'mm2-2.5', nombre: '2,5 mm²', R: 9.45, X: 0.11, areaMm2: 28.3, diametroMm: 6.0, seccionMm2: 2.5 },
  { id: 'mm2-4', nombre: '4 mm²', R: 5.88, X: 0.107, areaMm2: 34.2, diametroMm: 6.6, seccionMm2: 4 },
  { id: 'mm2-6', nombre: '6 mm²', R: 3.93, X: 0.1, areaMm2: 40.7, diametroMm: 7.2, seccionMm2: 6 },
  { id: 'mm2-10', nombre: '10 mm²', R: 2.33, X: 0.094, areaMm2: 56.7, diametroMm: 8.5, seccionMm2: 10 },
  { id: 'mm2-16', nombre: '16 mm²', R: 1.47, X: 0.09, areaMm2: 72.4, diametroMm: 9.6, seccionMm2: 16 },
  { id: 'mm2-25', nombre: '25 mm²', R: 0.927, X: 0.086, areaMm2: 102.1, diametroMm: 11.4, seccionMm2: 25 },
  { id: 'mm2-35', nombre: '35 mm²', R: 0.668, X: 0.083, areaMm2: 124.7, diametroMm: 12.6, seccionMm2: 35 },
  { id: 'mm2-50', nombre: '50 mm²', R: 0.494, X: 0.083, areaMm2: 158.4, diametroMm: 14.2, seccionMm2: 50 },
  { id: 'mm2-70', nombre: '70 mm²', R: 0.342, X: 0.082, areaMm2: 201.1, diametroMm: 16.0, seccionMm2: 70 },
  { id: 'mm2-95', nombre: '95 mm²', R: 0.247, X: 0.082, areaMm2: 254.5, diametroMm: 18.0, seccionMm2: 95 },
  { id: 'mm2-120', nombre: '120 mm²', R: 0.196, X: 0.08, areaMm2: 307.9, diametroMm: 19.8, seccionMm2: 120 },
  { id: 'mm2-150', nombre: '150 mm²', R: 0.159, X: 0.08, areaMm2: 366.4, diametroMm: 21.6, seccionMm2: 150 },
  { id: 'mm2-185', nombre: '185 mm²', R: 0.128, X: 0.08, areaMm2: 444.9, diametroMm: 23.8, seccionMm2: 185 },
  { id: 'mm2-240', nombre: '240 mm²', R: 0.0981, X: 0.079, areaMm2: 555.7, diametroMm: 26.6, seccionMm2: 240 },
  { id: 'mm2-300', nombre: '300 mm²', R: 0.079, X: 0.079, areaMm2: 669.7, diametroMm: 29.2, seccionMm2: 300 },
];

/** Opciones para un campo select de conductor (incluye la opción manual). */
export function opcionesConductor(): OpcionCampo[] {
  return [
    { value: '', label: '— Manual (ingreso directo) —' },
    ...CATALOGO_CONDUCTORES.map((c) => ({ value: c.id, label: c.nombre })),
  ];
}

/** Función `autollenar` que carga R y X (Ω/km) en las claves indicadas. */
export function autollenarConductor(keyR: string, keyX: string) {
  return (valor: string): Record<string, string> => {
    const c = CATALOGO_CONDUCTORES.find((x) => x.id === valor);
    if (!c) return {};
    return { [keyR]: String(c.R), [keyX]: String(c.X) };
  };
}

/** Función `autollenar` que carga el área del conductor con aislación (mm²). */
export function autollenarArea(keyArea: string) {
  return (valor: string): Record<string, string> => {
    const c = CATALOGO_CONDUCTORES.find((x) => x.id === valor);
    if (!c) return {};
    return { [keyArea]: String(c.areaMm2) };
  };
}

/** Función `autollenar` que carga el diámetro exterior del conductor (mm). */
export function autollenarDiametro(keyDiam: string) {
  return (valor: string): Record<string, string> => {
    const c = CATALOGO_CONDUCTORES.find((x) => x.id === valor);
    if (!c) return {};
    return { [keyDiam]: String(c.diametroMm) };
  };
}

/** Sección del conductor (mm²) por id de catálogo, o undefined si es manual. */
export function seccionDeConductor(id: string | undefined): number | undefined {
  if (!id) return undefined;
  return CATALOGO_CONDUCTORES.find((c) => c.id === id)?.seccionMm2;
}

/**
 * Equivalencia AWG/MCM → mm² usada en los proyectos, tomada de la Tabla 1 del
 * plano de diseño mecánico 03350-CCM-007 (PRECISIÓN / Rajo Inca).
 *
 * No es la conversión geométrica sino la sección comercial que se especifica
 * en su lugar, que suele ser el escalón métrico siguiente: 2 AWG mide
 * 33,6 mm² y se especifica 35; 4/0 mide 107,2 y se especifica 120; 500 MCM
 * mide 253 y se especifica 240. Sirve para leer un plano en AWG y comprar en
 * mm², que es lo que se hace en obra.
 */
export const EQUIVALENCIA_AWG_MM2: Readonly<Record<string, number>> = {
  '20': 0.5, '18': 1, '16': 1.5, '14': 2.5, '12': 4, '10': 6, '8': 10,
  '6': 16, '4': 25, '3': 35, '2': 35, '1': 50,
  '1/0': 70, '2/0': 70, '3/0': 95, '4/0': 120,
  '250': 150, '300': 185, '350': 185, '400': 240, '500': 240,
};

/** Sección comercial en mm² equivalente a un calibre AWG/MCM, según proyecto. */
export function mm2EquivalenteAwg(awg: string): number | undefined {
  return EQUIVALENCIA_AWG_MM2[awg.trim().toUpperCase().replace(/\s*(AWG|MCM|KCMIL)\s*/g, '')];
}
