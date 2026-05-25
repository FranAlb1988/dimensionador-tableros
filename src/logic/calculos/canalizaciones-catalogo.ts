// Catálogo de canalizaciones — ductos y escalerillas portaconductores.
//
// Ductos: área interna total (100%) según NEC Cap. 9, Tabla 4, para tubería
//   metálica EMT y tubería PVC Schedule 40. Designación en pulgadas.
// Escalerillas: anchos normalizados típicos de bandeja portacable (mm).

export type TipoDucto = 'metalico' | 'pvc';

export interface DuctoCatalogo {
  id: string;
  /** Designación comercial, p. ej. '1¼″'. */
  nombre: string;
  tipo: TipoDucto;
  /** Área interna total (100%), mm². */
  areaInternaMm2: number;
}

/** Ductos EMT (metálico) y PVC Sch. 40 — NEC Cap. 9, Tabla 4. */
export const CATALOGO_DUCTOS: readonly DuctoCatalogo[] = [
  { id: 'emt-1-2', nombre: '½″', tipo: 'metalico', areaInternaMm2: 196 },
  { id: 'emt-3-4', nombre: '¾″', tipo: 'metalico', areaInternaMm2: 343 },
  { id: 'emt-1', nombre: '1″', tipo: 'metalico', areaInternaMm2: 573 },
  { id: 'emt-1-1-4', nombre: '1¼″', tipo: 'metalico', areaInternaMm2: 992 },
  { id: 'emt-1-1-2', nombre: '1½″', tipo: 'metalico', areaInternaMm2: 1314 },
  { id: 'emt-2', nombre: '2″', tipo: 'metalico', areaInternaMm2: 2165 },
  { id: 'emt-2-1-2', nombre: '2½″', tipo: 'metalico', areaInternaMm2: 3623 },
  { id: 'emt-3', nombre: '3″', tipo: 'metalico', areaInternaMm2: 5610 },
  { id: 'emt-3-1-2', nombre: '3½″', tipo: 'metalico', areaInternaMm2: 7548 },
  { id: 'emt-4', nombre: '4″', tipo: 'metalico', areaInternaMm2: 9716 },
  { id: 'pvc-1-2', nombre: '½″', tipo: 'pvc', areaInternaMm2: 161 },
  { id: 'pvc-3-4', nombre: '¾″', tipo: 'pvc', areaInternaMm2: 285 },
  { id: 'pvc-1', nombre: '1″', tipo: 'pvc', areaInternaMm2: 458 },
  { id: 'pvc-1-1-4', nombre: '1¼″', tipo: 'pvc', areaInternaMm2: 794 },
  { id: 'pvc-1-1-2', nombre: '1½″', tipo: 'pvc', areaInternaMm2: 1063 },
  { id: 'pvc-2', nombre: '2″', tipo: 'pvc', areaInternaMm2: 1738 },
  { id: 'pvc-2-1-2', nombre: '2½″', tipo: 'pvc', areaInternaMm2: 2477 },
  { id: 'pvc-3', nombre: '3″', tipo: 'pvc', areaInternaMm2: 3831 },
  { id: 'pvc-3-1-2', nombre: '3½″', tipo: 'pvc', areaInternaMm2: 5135 },
  { id: 'pvc-4', nombre: '4″', tipo: 'pvc', areaInternaMm2: 6605 },
];

/** Anchos normalizados de escalerilla portaconductores, mm. */
export const ANCHOS_ESCALERILLA: readonly number[] = [100, 150, 200, 300, 450, 600, 750, 900];

/**
 * Porcentaje de relleno admisible de un ducto según NEC Cap. 9, Tabla 1:
 * 1 conductor 53%, 2 conductores 31%, 3 o más 40%.
 */
export function porcentajeRelleno(nConductores: number): number {
  if (nConductores <= 1) return 0.53;
  if (nConductores === 2) return 0.31;
  return 0.4;
}

/** Ducto más pequeño del tipo dado cuya área interna cubre el área requerida. */
export function sugerirDucto(tipo: TipoDucto, areaRequeridaMm2: number): DuctoCatalogo | undefined {
  return CATALOGO_DUCTOS
    .filter((d) => d.tipo === tipo)
    .toSorted((a, b) => a.areaInternaMm2 - b.areaInternaMm2)
    .find((d) => d.areaInternaMm2 >= areaRequeridaMm2);
}

/** Área interna del ducto más grande del tipo dado, mm². */
export function areaDuctoMaxima(tipo: TipoDucto): number {
  return Math.max(...CATALOGO_DUCTOS.filter((d) => d.tipo === tipo).map((d) => d.areaInternaMm2));
}

/** Ancho normalizado de escalerilla que cubre el ancho requerido. */
export function sugerirAnchoEscalerilla(anchoRequeridoMm: number): number | undefined {
  return [...ANCHOS_ESCALERILLA].sort((a, b) => a - b).find((w) => w >= anchoRequeridoMm);
}

/**
 * Distribuye los elementos en `capas` filas balanceando la suma de tamaños
 * por fila (bin-packing best-fit decreasing). Resulta en filas cuya suma
 * máxima es aproximadamente Σ tamaños / capas. Determinista: ordena por
 * tamaño descendente y asigna cada elemento a la fila con menor suma actual.
 */
export function distribuirEnCapas<T>(
  items: readonly T[],
  getSize: (item: T) => number,
  capas: number,
): T[][] {
  const n = Math.max(1, Math.round(capas));
  const orden = [...items].sort((a, b) => getSize(b) - getSize(a));
  const filas: T[][] = Array.from({ length: n }, () => [] as T[]);
  const sumas = new Array<number>(n).fill(0);
  for (const item of orden) {
    let idx = 0;
    for (let i = 1; i < n; i += 1) if (sumas[i]! < sumas[idx]!) idx = i;
    filas[idx]!.push(item);
    sumas[idx]! += getSize(item);
  }
  return filas;
}
