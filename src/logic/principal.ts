import nsxData from '../data/iec/nsx.json';
import masterpactData from '../data/iec/masterpact.json';
import abbTmaxData from '../data/iec/abb-tmax.json';
import abbEmax2Data from '../data/iec/abb-emax2.json';
import chintNa1Data from '../data/iec/chint-na1.json';
import type { MarcaProteccion, Proteccion } from '../types';

const NSX: readonly Proteccion[] = (nsxData.interruptores as Proteccion[]);
const MASTERPACT: readonly Proteccion[] = (masterpactData.interruptores as Proteccion[]);
const ABB_TMAX: readonly Proteccion[] = (abbTmaxData.interruptores as Proteccion[]);
const ABB_EMAX2: readonly Proteccion[] = (abbEmax2Data.interruptores as Proteccion[]);
const CHINT_NA1: readonly Proteccion[] = (chintNa1Data.interruptores as Proteccion[]);

/**
 * Conjunto de interruptores disponibles por marca para el principal del CDC/TDG.
 *  - Schneider: NSX (MCCB ≤630 A) + Masterpact (ACB 630-4000 A).
 *  - ABB: Tmax (MCCB ≤630 A) + Emax 2 (ACB 800-6300 A).
 *  - Chint: NA1 (ACB 1000-6300 A). No cubre el rango MCCB (<1000 A).
 */
const POOL_POR_MARCA: Record<MarcaProteccion, readonly Proteccion[]> = {
  Schneider: [...NSX, ...MASTERPACT],
  ABB: [...ABB_TMAX, ...ABB_EMAX2],
  Chint: [...CHINT_NA1],
};

/** Marcas disponibles para el interruptor principal. */
export const MARCAS_PRINCIPAL: readonly MarcaProteccion[] = ['Schneider', 'ABB', 'Chint'];

/** Margen del In del interruptor principal sobre la corriente total. */
const MARGEN_PRINCIPAL = 1.0;

/**
 * Sugiere el interruptor principal del CDC/TDG para una marca dada.
 * Elige, dentro del catálogo de la marca, el menor In que cubra la corriente total
 * (MCCB para corrientes bajas, ACB para corrientes altas — el catálogo ya los mezcla
 * ordenados por In).
 *
 * Devuelve `undefined` si la corriente total no es asignable con esa marca
 * (p. ej. Chint por debajo de 1000 A).
 */
export function sugerirInterruptorPrincipal(
  corrienteTotalA: number,
  marca: MarcaProteccion = 'Schneider',
): Proteccion | undefined {
  if (!Number.isFinite(corrienteTotalA) || corrienteTotalA <= 0) return undefined;
  const Imin = corrienteTotalA * MARGEN_PRINCIPAL;
  return POOL_POR_MARCA[marca]
    .toSorted((a, b) => a.inA - b.inA)
    .find((p) => p.inA >= Imin);
}

export const PRINCIPAL_DISPONIBLES: readonly Proteccion[] = [
  ...NSX, ...MASTERPACT, ...ABB_TMAX, ...ABB_EMAX2, ...CHINT_NA1,
];
