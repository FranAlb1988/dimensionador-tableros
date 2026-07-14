import prismaData from '../data/iec/prisma.json';
import type { Carga, EnvolventePrismaCatalogo, MarcaProteccion, SalidaAsignada, TableroTdg } from '../types';
import { corrienteDiseno } from './corriente';
import { sugerirProteccionFeeder } from './proteccion';
import { sugerirInterruptorPrincipal } from './principal';
import { sugerirBarra } from './barra';
import { MAX_BARRA_CDC_A } from './limites-barra';
import { MEDIDA_TDG_DEFAULT } from './medida-tdg';
import { calcularTransformador, type ConfigTransformador } from './transformador';

export const ENVOLVENTE_PRISMA: EnvolventePrismaCatalogo = prismaData.envolvente as EnvolventePrismaCatalogo;
export const ALTO_CELDA_SALIDA_MM: number = (prismaData.salida as { altoCeldaMm: number }).altoCeldaMm;

export interface ResultadoTdg {
  salidasAsignadas: SalidaAsignada[];
  cargasSinAsignar: Carga[];
  tablero?: TableroTdg;
  /** Razón por la que no se pudo dimensionar (si tablero es undefined). */
  motivo?: string;
}

const FACTOR_SIMULTANEIDAD_MIN = 0.1;
const FACTOR_SIMULTANEIDAD_MAX = 1;

/**
 * Corriente nominal del secundario del transformador que alimentaría el CDC
 * con esta configuración y carga. Si el trafo sugerido requiere N unidades en
 * paralelo, la barra recibe la suma de los secundarios.
 */
function inSecundarioTrafo(cfg: ConfigTransformador, corrienteCargaA: number): number {
  const t = calcularTransformador({ ...cfg, corrienteSecundarioA: corrienteCargaA });
  return t.paralelo
    ? t.paralelo.cantidad * t.paralelo.cadaUno.inSecundarioA
    : t.inSecundarioA;
}

/**
 * Punto de entrada para TDG Prisma.
 *  1. Calcula corriente de diseño y sugiere NSX por salida.
 *  2. Suma las corrientes y aplica factor de simultaneidad.
 *  3. Sugiere interruptor principal y barra de distribución. Si se entrega la
 *     configuración del transformador alimentador (`trafo`), el principal y la
 *     barra se seleccionan además con In ≥ In del secundario del trafo — el
 *     principal es también la protección BT del transformador, y el margen de
 *     crecimiento del trafo debe poder circular por el tablero.
 *  4. Calcula dimensiones de la envolvente.
 *
 * Si no hay salidas válidas, devuelve `tablero: undefined` con `motivo`.
 */
export function dimensionarTdg(
  cargas: readonly Carga[],
  factorSimultaneidad: number,
  marca: MarcaProteccion = 'Schneider',
  trafo?: ConfigTransformador,
): ResultadoTdg {
  const fs = clamp(factorSimultaneidad, FACTOR_SIMULTANEIDAD_MIN, FACTOR_SIMULTANEIDAD_MAX);
  const salidasAsignadas: SalidaAsignada[] = [];
  const cargasSinAsignar: Carga[] = [];

  for (const c of cargas) {
    const proteccion = sugerirProteccionFeeder(c, marca);
    const corrienteDisenoA = corrienteDiseno(c);
    if (!proteccion || corrienteDisenoA <= 0) {
      cargasSinAsignar.push(c);
      continue;
    }
    salidasAsignadas.push({ carga: c, proteccion, corrienteDisenoA });
  }

  if (salidasAsignadas.length === 0) {
    return { salidasAsignadas, cargasSinAsignar, motivo: 'Sin salidas válidas para dimensionar.' };
  }

  const sumaSalidasA = salidasAsignadas.reduce((acc, s) => acc + s.corrienteDisenoA, 0);
  const corrienteTotalA = sumaSalidasA * fs;

  // Coordinación con el trafo alimentador: principal y barra deben cubrir la
  // In del secundario del transformador sugerido, no solo la carga.
  const trafoInSecundarioA = trafo ? inSecundarioTrafo(trafo, corrienteTotalA) : undefined;
  const corrienteSeleccionA = Math.max(corrienteTotalA, trafoInSecundarioA ?? 0);

  const principal = sugerirInterruptorPrincipal(corrienteSeleccionA, marca);
  // CDC: la barra principal puede llegar hasta 6000 A (alimenta CCMs y CDCs
  // aguas abajo).
  const barra = sugerirBarra(corrienteSeleccionA, MAX_BARRA_CDC_A);
  if (!principal) {
    return {
      salidasAsignadas,
      cargasSinAsignar,
      motivo: `Sin interruptor principal ${marca} en catálogo para ${corrienteSeleccionA.toFixed(0)} A.`,
    };
  }
  if (!barra) {
    return {
      salidasAsignadas,
      cargasSinAsignar,
      motivo: `Sin barra de distribución en catálogo para ${corrienteSeleccionA.toFixed(0)} A.`,
    };
  }

  const columnasSalidas = Math.max(
    1,
    Math.ceil(salidasAsignadas.length / salidasPorColumna()),
  );
  const columnas = 1 + columnasSalidas; // 1 columna para principal + barra superior

  const tablero: TableroTdg = {
    tipo: 'TDG',
    principal,
    barra,
    salidas: salidasAsignadas,
    medida: MEDIDA_TDG_DEFAULT,
    corrienteTotalA,
    ...(trafoInSecundarioA != null ? { trafoInSecundarioA } : {}),
    factorSimultaneidad: fs,
    columnas,
    altoTotalMm: ENVOLVENTE_PRISMA.altoTotalMm,
    anchoTotalMm: columnas * ENVOLVENTE_PRISMA.anchoColumnaMm,
    profundidadTotalMm: ENVOLVENTE_PRISMA.profundidadMm,
  };

  return { salidasAsignadas, cargasSinAsignar, tablero };
}

/** Cantidad máxima de salidas por columna lateral, según el alto útil y el alto de celda. */
export function salidasPorColumna(): number {
  return Math.max(1, Math.floor(ENVOLVENTE_PRISMA.altoUtilSalidasMm / ALTO_CELDA_SALIDA_MM));
}

function clamp(x: number, min: number, max: number): number {
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}
