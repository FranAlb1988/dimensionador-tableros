// Dimensionamiento de CCM en media tensión.
// Catálogo: Allen-Bradley CENTERLINE 2500 — contactores al vacío 200/400/720 A
// en celdas estándar de 915 × 2290 × 1525 mm (36" × 90" × 60").
//
// Cada celda tiene 2 espacios verticales. Los contactores 200 y 400 A son
// "half-height" (1 espacio); el 720 A es "full-height" (2 espacios).

import centerlineData from '../data/nema-mt/centerline-2500.json';
import type {
  AsignacionCcmMt, Carga, ColumnaCcmMt, ContactorMtCatalogo,
  EnvolventeCcmMtCatalogo, PrincipalMtCatalogo, TableroCcmMt,
} from '../types';
import { corrienteNominal } from './corriente';

const CONTACTORES: readonly ContactorMtCatalogo[] = (centerlineData.contactores as ContactorMtCatalogo[])
  .toSorted((a, b) => a.frameA - b.frameA);

const BARRAS_MT: readonly number[] = (centerlineData.barras as number[]).toSorted((a, b) => a - b);

const PRINCIPALES_MT: readonly PrincipalMtCatalogo[] = (centerlineData.principales as PrincipalMtCatalogo[])
  .toSorted((a, b) => a.frameA - b.frameA);

export const ENVOLVENTE_CCM_MT: EnvolventeCcmMtCatalogo =
  centerlineData.envolvente as EnvolventeCcmMtCatalogo;

/** Celdas fijas del lineup además de las de starters: entrada + medida. */
export const COLUMNAS_FIJAS_MT = 2;

/** Margen sobre la FLA para elegir el contactor (motor régimen permanente). */
const MARGEN_CONTACTOR_MT = 1.25;

/** Barra principal mínima del catálogo que cubre la corriente dada. */
export function sugerirBarraMt(corrienteA: number): number | undefined {
  return BARRAS_MT.find((b) => b >= corrienteA);
}

/** Interruptor de entrada mínimo del catálogo que cubre la corriente dada. */
export function sugerirPrincipalMt(corrienteA: number): PrincipalMtCatalogo | undefined {
  return PRINCIPALES_MT.find((p) => p.frameA >= corrienteA);
}

export interface ResultadoCcmMt {
  asignaciones: AsignacionCcmMt[];
  cargasSinAsignar: Carga[];
  tablero?: TableroCcmMt;
  motivo?: string;
}

/**
 * Umbral de tensión (V) que define media tensión. Las normas internacionales
 * (IEC, NEC) consideran BT ≤ 1000 V; por sobre eso es MT.
 */
export const UMBRAL_MT_V = 1000;

/**
 * Dimensionamiento de un CCM MT con el catálogo CENTERLINE 2500.
 * Solo procesa cargas tipo motor con tensión > 1000 V. El resto va a
 * `cargasSinAsignar`. `factorDerrateo` es el F2 por altura (nivel MT).
 */
export function dimensionarCcmMt(
  cargas: readonly Carga[],
  factorDerrateo = 1,
): ResultadoCcmMt {
  const f = factorDerrateo > 0 ? factorDerrateo : 1;
  const asignaciones: AsignacionCcmMt[] = [];
  const cargasSinAsignar: Carga[] = [];

  for (const c of cargas) {
    if (c.tipo !== 'motor' || c.tensionV <= UMBRAL_MT_V) {
      cargasSinAsignar.push(c);
      continue;
    }
    const fla = c.corrienteA ?? corrienteNominal(c);
    if (!(fla > 0)) {
      cargasSinAsignar.push(c);
      continue;
    }
    const corrienteDisenoA = fla * (c.factorServicio || 1);
    // Margen 1,25 sobre FLA · F2 sobre el equipo (pierde capacidad en altura).
    const Imin = (corrienteDisenoA * MARGEN_CONTACTOR_MT) / f;
    const contactor = CONTACTORES.find((cc) => cc.frameA >= Imin);
    if (!contactor) {
      cargasSinAsignar.push(c);
      continue;
    }
    asignaciones.push({
      carga: c,
      contactor,
      espaciosV: contactor.espaciosColumnaV,
      corrienteDisenoA,
    });
  }

  if (asignaciones.length === 0) {
    return {
      asignaciones, cargasSinAsignar,
      motivo: 'Sin motores MT válidos para asignar (cargas BT o sin datos completos).',
    };
  }

  const columnas = empaquetarEnColumnasMt(asignaciones, ENVOLVENTE_CCM_MT.espaciosVerticales);
  const corrienteTotalA = asignaciones.reduce((s, a) => s + a.corrienteDisenoA, 0);
  const corrienteSeleccionBarraA = corrienteTotalA / f;

  // Barra principal e interruptor de entrada por la corriente (derrateada).
  const barraA = sugerirBarraMt(corrienteSeleccionBarraA);
  const principal = sugerirPrincipalMt(corrienteSeleccionBarraA);
  if (barraA == null || principal == null) {
    const max = Math.max(...BARRAS_MT);
    return {
      asignaciones, cargasSinAsignar,
      motivo: `La corriente total (${corrienteSeleccionBarraA.toFixed(0)} A) supera la barra/interruptor de entrada máximo del catálogo MT (${max} A). Divide las cargas en otro CCM.`,
    };
  }

  // El lineup suma 2 celdas fijas: entrada (interruptor general) y medida (PT/CT).
  const totalColumnas = columnas.length + COLUMNAS_FIJAS_MT;

  const tablero: TableroCcmMt = {
    tipo: 'CCM',
    norma: 'MT',
    columnas,
    corrienteTotalA,
    factorDerrateoAltura: f,
    corrienteSeleccionBarraA,
    barraA,
    principal,
    incluyeMedida: true,
    altoTotalMm: ENVOLVENTE_CCM_MT.altoTotalMm,
    anchoTotalMm: totalColumnas * ENVOLVENTE_CCM_MT.anchoColumnaMm,
    profundidadTotalMm: ENVOLVENTE_CCM_MT.profundidadMm,
  };

  return { asignaciones, cargasSinAsignar, tablero };
}

/** Bin-pack First-Fit Decreasing por espacios verticales. */
function empaquetarEnColumnasMt(
  asignaciones: AsignacionCcmMt[],
  altoUtilV: number,
): ColumnaCcmMt[] {
  const orden = [...asignaciones].sort((a, b) => b.espaciosV - a.espaciosV);
  const columnas: ColumnaCcmMt[] = [];
  for (const a of orden) {
    if (a.espaciosV > altoUtilV) continue; // no debería ocurrir con el catálogo actual
    let destino = columnas.find((c) => c.espaciosLibres >= a.espaciosV);
    if (!destino) {
      destino = {
        indice: columnas.length + 1,
        asignaciones: [],
        espaciosUsados: 0,
        espaciosLibres: altoUtilV,
      };
      columnas.push(destino);
    }
    destino.asignaciones.push(a);
    destino.espaciosUsados += a.espaciosV;
    destino.espaciosLibres -= a.espaciosV;
  }
  return columnas;
}

export const CONTACTORES_MT = CONTACTORES;
