// Notación "X" de Blokset: cada gaveta se mide en unidades X.
// 1 X = una gaveta "1"; las menores son fracciones (¼ X, ½ X) y las mayores múltiplos (1½ X, 2 X).
// El alto útil de una columna se expresa también en X.

import gavetasData from '../data/iec/gavetas-blokset.json';
import type { TamanoGaveta } from '../types';

/** Cantidad de X (fracción decimal) que ocupa cada tamaño de gaveta. */
export function tamanoEnX(t: TamanoGaveta): number {
  switch (t) {
    case '1/4':   return 0.25;
    case '1/2':   return 0.5;
    case '1':     return 1;
    case '1+1/2': return 1.5;
    case '2':     return 2;
  }
}

/** Etiqueta corta lista para UI: "¼ X", "½ X", "1 X", "1½ X", "2 X". */
export function tamanoEnXTexto(t: TamanoGaveta): string {
  switch (t) {
    case '1/4':   return '¼ X';
    case '1/2':   return '½ X';
    case '1':     return '1 X';
    case '1+1/2': return '1½ X';
    case '2':     return '2 X';
  }
}

/** Formato genérico de un valor X (para sumas). */
export function fmtX(x: number): string {
  if (Math.abs(x - 0.25) < 1e-9) return '¼ X';
  if (Math.abs(x - 0.5)  < 1e-9) return '½ X';
  if (Math.abs(x - 0.75) < 1e-9) return '¾ X';
  if (Math.abs(x - 1.5)  < 1e-9) return '1½ X';
  if (Number.isInteger(x)) return `${x} X`;
  return `${x.toFixed(2).replace('.', ',')} X`;
}

/** Cuántos X equivale el alto útil de la columna Blokset (según catálogo). */
export function altoUtilColumnaEnX(): number {
  const altoUtil = gavetasData.columna.altoUtilMm;
  // 1 X = altoMm de la gaveta tamaño "1" en el catálogo.
  const def1 = (gavetasData.tamanos as { tamano: TamanoGaveta; altoMm: number }[])
    .find((d) => d.tamano === '1');
  if (!def1 || def1.altoMm <= 0) return 0;
  return altoUtil / def1.altoMm;
}
