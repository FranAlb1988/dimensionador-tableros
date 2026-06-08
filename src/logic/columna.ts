import type { Columna, Gaveta } from '../types';
import { COLUMNA_CATALOGO } from './gaveta';

let columnaCounter = 0;
function nextColumnaId(): string {
  columnaCounter += 1;
  return `col-${columnaCounter}`;
}

export function resetContadorColumnas(): void {
  columnaCounter = 0;
}

interface OpcionesColumna {
  altoUtilMm?: number;
  anchoMm?: number;
  profundidadMm?: number;
}

function nuevaColumna(altoUtil: number, ancho: number, profundidad: number): Columna {
  return {
    id: nextColumnaId(),
    altoUtilMm: altoUtil,
    anchoMm: ancho,
    profundidadMm: profundidad,
    gavetas: [],
    espacioRemanenteMm: altoUtil,
  };
}

/**
 * Umbral para incluir una columna de incoming/acometida dedicada:
 * 4 o más gavetas, o corriente total ≥ 250 A. Bajo eso, el incoming se
 * integra al primer compartimento y no se modela aparte.
 */
const UMBRAL_INCOMING_GAVETAS = 4;
const UMBRAL_INCOMING_A = 250;

export function necesitaColumnaIncoming(
  gavetas: number,
  corrienteTotalA: number,
): boolean {
  return gavetas >= UMBRAL_INCOMING_GAVETAS || corrienteTotalA >= UMBRAL_INCOMING_A;
}

/**
 * Construye una columna de incoming/acometida (sin gavetas) para anteponerla
 * al lineup del CCM. Hospeda entrada de cables, lugs, conexión a barras y el
 * compartimento de medida.
 */
export function nuevaColumnaIncoming(opts: OpcionesColumna = {}): Columna {
  const altoUtil = opts.altoUtilMm ?? COLUMNA_CATALOGO.altoUtilMm;
  const ancho = opts.anchoMm ?? COLUMNA_CATALOGO.anchoMm;
  const profundidad = opts.profundidadMm ?? COLUMNA_CATALOGO.profundidadMm;
  return {
    id: nextColumnaId(),
    altoUtilMm: altoUtil,
    anchoMm: ancho,
    profundidadMm: profundidad,
    gavetas: [],
    espacioRemanenteMm: altoUtil,
    esIncoming: true,
  };
}

/**
 * Distribuye gavetas en columnas usando First-Fit Decreasing por altura.
 * Es un bin-packing 1D: cada columna es un bin de capacidad `altoUtilMm`,
 * cada gaveta es un ítem de tamaño `altoMm`. FFD da soluciones cercanas al óptimo
 * para conjuntos pequeños y es estable y predecible para el usuario.
 */
export function distribuirEnColumnas(gavetas: readonly Gaveta[], opts: OpcionesColumna = {}): Columna[] {
  const altoUtil = opts.altoUtilMm ?? COLUMNA_CATALOGO.altoUtilMm;
  const ancho = opts.anchoMm ?? COLUMNA_CATALOGO.anchoMm;
  const profundidad = opts.profundidadMm ?? COLUMNA_CATALOGO.profundidadMm;

  if (altoUtil <= 0) throw new Error('Alto útil de columna debe ser > 0');

  const orden = [...gavetas].sort((a, b) => b.altoMm - a.altoMm);
  const columnas: Columna[] = [];

  for (const g of orden) {
    if (g.altoMm > altoUtil) {
      throw new Error(
        `Gaveta ${g.id} (${g.altoMm} mm) excede el alto útil de columna (${altoUtil} mm)`,
      );
    }
    let destino = columnas.find((c) => c.espacioRemanenteMm >= g.altoMm);
    if (!destino) {
      destino = nuevaColumna(altoUtil, ancho, profundidad);
      columnas.push(destino);
    }
    destino.gavetas.push(g);
    destino.espacioRemanenteMm -= g.altoMm;
  }

  return columnas;
}
