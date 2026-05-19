import nsxData from '../data/iec/nsx.json';
import masterpactData from '../data/iec/masterpact.json';
import type { Proteccion } from '../types';

const NSX: readonly Proteccion[] = (nsxData.interruptores as Proteccion[]);
const MASTERPACT: readonly Proteccion[] = (masterpactData.interruptores as Proteccion[]);

/**
 * Umbral por encima del cual se prefiere Masterpact en vez de NSX.
 * Coincide con el rango natural: NSX hasta 630 A, Masterpact desde 630 A.
 */
const UMBRAL_MASTERPACT_A = 630;

/** Margen del In del interruptor principal sobre la corriente total. */
const MARGEN_PRINCIPAL = 1.0;

/**
 * Sugiere el interruptor principal del TDG.
 *  - Hasta 630 A: NSX (mismo catálogo que CCM).
 *  - Por encima: Masterpact NT (≤1600 A) o NW (>1600 A) según In disponible.
 *
 * Devuelve `undefined` si la corriente total no es asignable con el catálogo.
 */
export function sugerirInterruptorPrincipal(corrienteTotalA: number): Proteccion | undefined {
  if (!Number.isFinite(corrienteTotalA) || corrienteTotalA <= 0) return undefined;
  const Imin = corrienteTotalA * MARGEN_PRINCIPAL;

  if (Imin <= UMBRAL_MASTERPACT_A) {
    const candidato = NSX
      .toSorted((a, b) => a.inA - b.inA)
      .find((p) => p.inA >= Imin);
    if (candidato) return candidato;
  }

  return MASTERPACT
    .toSorted((a, b) => a.inA - b.inA)
    .find((p) => p.inA >= Imin);
}

export const PRINCIPAL_DISPONIBLES: readonly Proteccion[] = [...NSX, ...MASTERPACT];
