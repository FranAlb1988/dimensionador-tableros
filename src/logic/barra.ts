import barrasData from '../data/iec/barras-prisma.json';
import type { Barra } from '../types';

const BARRAS: readonly Barra[] = (barrasData.barras as Barra[]);

/** Margen del In de la barra sobre la corriente total. */
const MARGEN_BARRA = 1.0;

/**
 * Sugiere la barra de distribución mínima que cubre la corriente total.
 *  - `corrienteTotalA`: corriente requerida en A.
 *  - `maxA` (opcional): tope superior del In de la barra. Sirve para limitar
 *    el rango por tipo de tablero — un CCM se topa en 3200 A; un CDC puede
 *    llegar a 6000 A. Si la corriente excede el tope, devuelve `undefined`.
 */
export function sugerirBarra(corrienteTotalA: number, maxA = Infinity): Barra | undefined {
  if (!Number.isFinite(corrienteTotalA) || corrienteTotalA <= 0) return undefined;
  const Imin = corrienteTotalA * MARGEN_BARRA;
  return BARRAS
    .filter((b) => b.inA <= maxA)
    .toSorted((a, b) => a.inA - b.inA)
    .find((b) => b.inA >= Imin);
}

export const BARRAS_DISPONIBLES = BARRAS;
