import barrasData from '../data/iec/barras-prisma.json';
import type { Barra } from '../types';

const BARRAS: readonly Barra[] = (barrasData.barras as Barra[]);

/** Margen del In de la barra sobre la corriente total. */
const MARGEN_BARRA = 1.0;

/**
 * Sugiere la barra de distribución mínima que cubre la corriente total.
 * Devuelve `undefined` si ninguna barra del catálogo basta.
 */
export function sugerirBarra(corrienteTotalA: number): Barra | undefined {
  if (!Number.isFinite(corrienteTotalA) || corrienteTotalA <= 0) return undefined;
  const Imin = corrienteTotalA * MARGEN_BARRA;
  return BARRAS
    .toSorted((a, b) => a.inA - b.inA)
    .find((b) => b.inA >= Imin);
}

export const BARRAS_DISPONIBLES = BARRAS;
