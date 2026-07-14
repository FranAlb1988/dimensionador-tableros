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
  /**
   * Advertencias de poder de corte: salidas cuyo Icu queda bajo la Icc de
   * barra aportada por el trafo alimentador (IEC 61439-2 / RIC N°02).
   */
  advertenciasIcu?: string[];
}

const FACTOR_SIMULTANEIDAD_MIN = 0.1;
const FACTOR_SIMULTANEIDAD_MAX = 1;

/**
 * Datos del transformador que alimentaría el CDC con esta configuración y
 * carga: In del secundario (suma de unidades si es un banco en paralelo) e
 * Icc trifásica que aporta a la barra.
 */
function datosTrafo(
  cfg: ConfigTransformador,
  corrienteCargaA: number,
): { inSecundarioA: number; iccKa: number } {
  const t = calcularTransformador({ ...cfg, corrienteSecundarioA: corrienteCargaA });
  const inSecundarioA = t.paralelo
    ? t.paralelo.cantidad * t.paralelo.cadaUno.inSecundarioA
    : t.inSecundarioA;
  return { inSecundarioA, iccKa: t.iccSecundarioKa };
}

/**
 * Punto de entrada para TDG Prisma.
 *  1. Calcula corriente de diseño y sugiere NSX por salida.
 *  2. Corriente total = salida mayor al 100% + resto × factor de simultaneidad
 *     (regla del mayor consumidor).
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
  const mayorSalidaA = salidasAsignadas.reduce((m, s) => Math.max(m, s.corrienteDisenoA), 0);
  // Regla del mayor consumidor: la salida mayor entra al 100% y la diversidad
  // solo se aplica al resto (análogo a NEC 430.24). Evita que el principal y
  // la barra queden por debajo de una salida individual cuando fs < 1 — con
  // fs×Σ a secas, un CDC con una sola salida de 500 A y fs 0.8 seleccionaba
  // un principal de 400 A que dispararía en operación normal.
  const corrienteTotalA = mayorSalidaA + fs * (sumaSalidasA - mayorSalidaA);

  // Coordinación con el trafo alimentador: principal y barra deben cubrir la
  // In del secundario del transformador sugerido, no solo la carga. Además el
  // trafo define la Icc de barra, que fija el Icu mínimo del aparellaje.
  const datos = trafo ? datosTrafo(trafo, corrienteTotalA) : undefined;
  const trafoInSecundarioA = datos?.inSecundarioA;
  const iccBarraKa = datos?.iccKa;
  const corrienteSeleccionA = Math.max(corrienteTotalA, trafoInSecundarioA ?? 0);

  const principal = sugerirInterruptorPrincipal(corrienteSeleccionA, marca, iccBarraKa ?? 0);
  // CDC: la barra principal puede llegar hasta 6000 A (alimenta CCMs y CDCs
  // aguas abajo).
  const barra = sugerirBarra(corrienteSeleccionA, MAX_BARRA_CDC_A);
  if (!principal) {
    return {
      salidasAsignadas,
      cargasSinAsignar,
      motivo: `Sin interruptor principal ${marca} en catálogo para ${corrienteSeleccionA.toFixed(0)} A`
        + (iccBarraKa ? ` con Icu ≥ ${iccBarraKa.toFixed(1)} kA (Icc de barra del trafo)` : '') + '.',
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
    ...(iccBarraKa != null ? { iccBarraKa } : {}),
    factorSimultaneidad: fs,
    columnas,
    altoTotalMm: ENVOLVENTE_PRISMA.altoTotalMm,
    anchoTotalMm: columnas * ENVOLVENTE_PRISMA.anchoColumnaMm,
    profundidadTotalMm: ENVOLVENTE_PRISMA.profundidadMm,
  };

  // Validación de poder de corte de las salidas contra la Icc de barra.
  // El principal ya se filtró por Icu; las salidas del catálogo actual son de
  // Icu fijo (NSX F 36 kA), así que si la barra las supera se advierte para
  // subir de familia (NSX N/H) o especificar limitación aguas arriba.
  const advertenciasIcu = iccBarraKa != null
    ? salidasAsignadas
        .filter((s) => s.proteccion.icuKA < iccBarraKa)
        .map((s) => `${s.carga.descripcion || s.carga.id}: ${s.proteccion.referencia} `
          + `(Icu ${s.proteccion.icuKA} kA) < Icc de barra ${iccBarraKa.toFixed(1)} kA`)
    : [];

  return {
    salidasAsignadas,
    cargasSinAsignar,
    tablero,
    ...(advertenciasIcu.length > 0 ? { advertenciasIcu } : {}),
  };
}

/** Cantidad máxima de salidas por columna lateral, según el alto útil y el alto de celda. */
export function salidasPorColumna(): number {
  return Math.max(1, Math.floor(ENVOLVENTE_PRISMA.altoUtilSalidasMm / ALTO_CELDA_SALIDA_MM));
}

function clamp(x: number, min: number, max: number): number {
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}
