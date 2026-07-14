// Sección "Criterios de selección" para las memorias PDF.
//
// Documenta las fórmulas y márgenes con que el dimensionador elige el
// aparellaje — en particular el DOBLE MARGEN de las protecciones: la
// corriente de diseño ya viene mayorada por el factor de servicio (FS) y el
// margen del interruptor se aplica sobre ese valor. Es deliberadamente
// conservador y debe quedar declarado en la memoria para ser defendible en
// revisión.
//
// Nota tipográfica: jsPDF con fuentes estándar usa WinAnsi (cp1252) — evitar
// glifos fuera de ese set (≥, √, Σ, φ, η); usar ">=", "1,73", "f.p.", etc.

import type { jsPDF } from 'jspdf';

/** Criterios del CCM IEC (NSX/Tmax + TeSys, gavetas Blokset). */
export const CRITERIOS_CCM_IEC: readonly string[] = [
  'Corriente de diseño: I = In placa (o calculada) × FS. Con FS > 1 el margen del '
    + 'interruptor se aplica sobre la corriente ya mayorada por el factor de servicio — '
    + 'doble margen deliberadamente conservador: con FS 1,15 y margen 1,25 el In del '
    + 'interruptor queda >= 1,44 × I de placa.',
  'Motor con arrancador en la gaveta: interruptor solo magnético (NSX MA / Micrologic 1.3 M; '
    + 'Tmax MA / PR221DS-I) con In >= I de diseño. La sobrecarga la cubre el relé térmico '
    + 'del arrancador — coordinación tipo 2, IEC 60947-4-1.',
  'Motor sin arrancador y alimentadores de régimen continuo: unidad termomagnética o '
    + 'electrónica con In >= 1,25 × I de diseño (referencia NEC 430.52 y 210.19/215.2).',
  'I nominal de motor calculada: I = P / (1,73 × V × f.p. × rend.), con f.p. 0,85 y '
    + 'rendimiento 0,9 típicos. El valor de placa ("In placa") prevalece si se ingresa.',
  'Derrateo por altura: el aparellaje se selecciona contra I / F2 '
    + '(Tabla V, IEEE C37.20.1-1993).',
  'Barra principal: In >= suma de I de diseño / F2. Tope de fábrica del CCM: 3200 A.',
];

/** Criterios del CCM NEMA (CENTERLINE 2100, X = 6"). */
export const CRITERIOS_CCM_NEMA: readonly string[] = [
  'Corriente de diseño: I = FLA × FS. FLA de la tabla Allen-Bradley CENTERLINE 2100 a '
    + '400 V (NEC 430.250 a 460 V × 1,15); en media tensión (> 1 kV) la FLA se calcula '
    + 'con la fórmula. Con FS > 1 la corriente queda mayorada antes de seleccionar.',
  'Motor: fila de la tabla por HP — contactor NEMA + MCP (solo magnético) + módulo de '
    + 'sobrecarga E300. La protección térmica la aporta el E300.',
  'Alimentadores no-motor: breaker FDR (hasta 400 AF) o electrónico con rating >= '
    + 'I de diseño / F2.',
  'Derrateo por altura: selección contra I / F2 (Tabla V, IEEE C37.20.1-1993).',
  'Barra principal por rango de FLC total; tope 3200 A — sobre ese valor el tablero se '
    + 'divide en un segundo CCM.',
];

export interface OpcionesCriterios {
  /** Posición vertical inicial (mm). */
  y: number;
  xInicio: number;
  /** Ancho útil para el texto (mm). */
  ancho: number;
  /** Alto de página (mm) — para saltar de página si no cabe. */
  pageHeight: number;
  lineas: readonly string[];
}

/**
 * Dibuja la sección "Criterios de selección" como lista de viñetas con salto
 * de página automático. Devuelve la posición Y final.
 */
export function dibujarCriteriosSeleccion(doc: jsPDF, opts: OpcionesCriterios): number {
  const salto = 4.2;
  let y = opts.y;
  const asegurar = (necesitaMm: number) => {
    if (y + necesitaMm > opts.pageHeight - 14) {
      doc.addPage();
      y = 22;
    }
  };

  asegurar(12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Criterios de selección (memoria de cálculo)', opts.xInicio, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (const linea of opts.lineas) {
    const wrapped = doc.splitTextToSize(`• ${linea}`, opts.ancho) as string[];
    asegurar(wrapped.length * salto);
    doc.text(wrapped, opts.xInicio, y);
    y += wrapped.length * salto + 1.2;
  }
  return y;
}
