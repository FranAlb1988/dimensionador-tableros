// Catálogo de conductores de cobre — valores típicos de referencia para
// autocompletar R y X (Ω/km) en las calculadoras de caída de tensión y
// cortocircuito. Cobre en ducto, ~75–90 °C, 50 Hz.
//
// AWG/MCM: derivado de NEC Cap. 9, Tabla 9 (cobre en ducto), reactancia
//   ajustada de 60 a 50 Hz.
// mm²: valores típicos IEC para cobre.
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
}

export const CATALOGO_CONDUCTORES: readonly ConductorCatalogo[] = [
  { id: 'awg-12', nombre: '#12 AWG', R: 6.56, X: 0.148 },
  { id: 'awg-10', nombre: '#10 AWG', R: 3.94, X: 0.137 },
  { id: 'awg-8', nombre: '#8 AWG', R: 2.56, X: 0.142 },
  { id: 'awg-6', nombre: '#6 AWG', R: 1.61, X: 0.139 },
  { id: 'awg-4', nombre: '#4 AWG', R: 1.02, X: 0.131 },
  { id: 'awg-2', nombre: '#2 AWG', R: 0.623, X: 0.123 },
  { id: 'awg-1-0', nombre: '1/0 AWG', R: 0.394, X: 0.12 },
  { id: 'awg-2-0', nombre: '2/0 AWG', R: 0.328, X: 0.118 },
  { id: 'awg-4-0', nombre: '4/0 AWG', R: 0.203, X: 0.112 },
  { id: 'mcm-250', nombre: '250 MCM', R: 0.171, X: 0.112 },
  { id: 'mcm-350', nombre: '350 MCM', R: 0.125, X: 0.109 },
  { id: 'mcm-500', nombre: '500 MCM', R: 0.0886, X: 0.107 },
  { id: 'mcm-750', nombre: '750 MCM', R: 0.0623, X: 0.104 },
  { id: 'mm2-2.5', nombre: '2,5 mm²', R: 9.45, X: 0.11 },
  { id: 'mm2-4', nombre: '4 mm²', R: 5.88, X: 0.107 },
  { id: 'mm2-6', nombre: '6 mm²', R: 3.93, X: 0.1 },
  { id: 'mm2-10', nombre: '10 mm²', R: 2.33, X: 0.094 },
  { id: 'mm2-16', nombre: '16 mm²', R: 1.47, X: 0.09 },
  { id: 'mm2-25', nombre: '25 mm²', R: 0.927, X: 0.086 },
  { id: 'mm2-35', nombre: '35 mm²', R: 0.668, X: 0.083 },
  { id: 'mm2-50', nombre: '50 mm²', R: 0.494, X: 0.083 },
  { id: 'mm2-70', nombre: '70 mm²', R: 0.342, X: 0.082 },
  { id: 'mm2-95', nombre: '95 mm²', R: 0.247, X: 0.082 },
  { id: 'mm2-120', nombre: '120 mm²', R: 0.196, X: 0.08 },
  { id: 'mm2-150', nombre: '150 mm²', R: 0.159, X: 0.08 },
  { id: 'mm2-185', nombre: '185 mm²', R: 0.128, X: 0.08 },
  { id: 'mm2-240', nombre: '240 mm²', R: 0.0981, X: 0.079 },
  { id: 'mm2-300', nombre: '300 mm²', R: 0.079, X: 0.079 },
];

/** Opciones para un campo select de conductor (incluye la opción manual). */
export function opcionesConductor(): OpcionCampo[] {
  return [
    { value: '', label: '— Manual (ingreso directo) —' },
    ...CATALOGO_CONDUCTORES.map((c) => ({ value: c.id, label: c.nombre })),
  ];
}

/**
 * Crea una función `autollenar` que, dado el id de un conductor, devuelve
 * los valores de R y X para las claves de campo indicadas.
 */
export function autollenarConductor(keyR: string, keyX: string) {
  return (valor: string): Record<string, string> => {
    const c = CATALOGO_CONDUCTORES.find((x) => x.id === valor);
    if (!c) return {};
    return { [keyR]: String(c.R), [keyX]: String(c.X) };
  };
}
