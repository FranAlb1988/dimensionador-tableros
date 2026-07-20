import prismaData from '../data/iec/prisma.json';
import type { Carga, EnvolventePrismaCatalogo, MarcaProteccion, Proteccion, SalidaAsignada, TableroTdg } from '../types';
import { corrienteDiseno } from './corriente';
import { elevarPrestacion, sugerirProteccionFeeder } from './proteccion';
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
 * Protección de una salida del CDC. Hasta 630 A: MCCB del catálogo de
 * alimentadores (NSX/Tmax, margen 1.25). Sobre eso, la salida pasa a un ACB
 * del pool del principal (Masterpact/Emax/NA1) con el mismo margen — antes
 * caía a "sin asignar" con un mensaje engañoso.
 */
function proteccionSalidaCdc(
  c: Carga,
  marca: MarcaProteccion,
  f: number,
): Proteccion | undefined {
  const mccb = sugerirProteccionFeeder(c, marca, f);
  if (mccb) return mccb;
  const I = corrienteDiseno(c);
  const frameForzado = c.corrienteProteccionA && c.corrienteProteccionA > 0
    ? c.corrienteProteccionA
    : 0;
  if (I <= 0 && frameForzado <= 0) return undefined;
  const Imin = Math.max((I * 1.25) / f, frameForzado);
  return sugerirInterruptorPrincipal(Imin, marca);
}

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
 * `factorDerrateo` es el F2 por altura geográfica (Tabla V — ver derrateo.ts):
 * el aparellaje pierde capacidad con la altitud, así que salidas, principal y
 * barra se seleccionan contra I / F2. No altera la corriente real de las cargas.
 *
 * Si no hay salidas válidas, devuelve `tablero: undefined` con `motivo`.
 */
export function dimensionarTdg(
  cargas: readonly Carga[],
  factorSimultaneidad: number,
  marca: MarcaProteccion = 'Schneider',
  trafo?: ConfigTransformador,
  factorDerrateo = 1,
): ResultadoTdg {
  const fs = clamp(factorSimultaneidad, FACTOR_SIMULTANEIDAD_MIN, FACTOR_SIMULTANEIDAD_MAX);
  const f = factorDerrateo > 0 ? factorDerrateo : 1;
  const salidasAsignadas: SalidaAsignada[] = [];
  const cargasSinAsignar: Carga[] = [];

  for (const c of cargas) {
    const proteccion = proteccionSalidaCdc(c, marca, f);
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
  // Segunda pasada sobre las salidas: la Icc del trafo (que depende de la
  // carga total, por eso no puede aplicarse al asignar) eleva la prestación
  // F→N→H de los MCCB. No cambia In ni márgenes, solo Icu y referencia; las
  // salidas que ni así alcanzan quedan en las advertencias de más abajo.
  if (iccBarraKa != null && iccBarraKa > 0) {
    for (const s of salidasAsignadas) {
      s.proteccion = elevarPrestacion(s.proteccion, iccBarraKa);
    }
  }
  // El derrateo por altura reduce la capacidad útil del equipo: la selección
  // se hace contra la exigencia (carga o trafo, la mayor) dividida por F2.
  const corrienteSeleccionA = Math.max(corrienteTotalA, trafoInSecundarioA ?? 0) / f;

  const principal = sugerirInterruptorPrincipal(corrienteSeleccionA, marca, iccBarraKa ?? 0);
  if (!principal) {
    return {
      salidasAsignadas,
      cargasSinAsignar,
      motivo: `Sin interruptor principal ${marca} en catálogo para ${corrienteSeleccionA.toFixed(0)} A`
        + (iccBarraKa ? ` con Icu ≥ ${iccBarraKa.toFixed(1)} kA (Icc de barra del trafo)` : '') + '.',
    };
  }
  // Coordinación barra ↔ principal: la barra debe transportar al menos el In
  // del interruptor principal — el breaker deja pasar hasta su In sin
  // disparar, y una barra menor quedaría sobrecargable (IEC 61439-1).
  // CDC: la barra principal puede llegar hasta 6000 A (alimenta CCMs y CDCs
  // aguas abajo). El piso del principal se topa en ese máximo: los ACB
  // grandes (p. ej. NW63, 6300 A) llevan Ir ajustable que se fija <= a la
  // capacidad de la barra.
  const corrienteBarraA = Math.max(
    corrienteSeleccionA,
    Math.min(principal.inA, MAX_BARRA_CDC_A),
  );
  const barra = sugerirBarra(corrienteBarraA, MAX_BARRA_CDC_A);
  if (!barra) {
    return {
      salidasAsignadas,
      cargasSinAsignar,
      motivo: `Sin barra de distribución en catálogo para ${corrienteBarraA.toFixed(0)} A (≥ In del principal).`,
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
    factorDerrateoAltura: f,
    corrienteSeleccionA,
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
