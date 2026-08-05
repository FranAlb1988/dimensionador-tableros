// Barra vertical de la columna BlokSeT (IEC).
//
// El catálogo BlokSeT declara el bus vertical de otra forma que CENTERLINE, y
// conviene no forzar el mismo modelo:
//
//   CENTERLINE 2100   capacidad de régimen repartida en mitades (300+300 A) y
//                     un límite de 225 A por stab de unidad.
//   BlokSeT           arreglo de barras (1 o 2 de 60 × 5 mm) con su Icw y la
//                     separación de soportes que esa Icw exige. El bus de
//                     distribución vertical se publica en 3.200 A.
//
// Es decir: en NEMA el dato que limita es la CORRIENTE DE RÉGIMEN por mitad;
// en IEC el que publica el catálogo es la RESISTENCIA AL CORTOCIRCUITO. Por eso
// aquí se verifica la Icw contra la Icc de barra, no la corriente por mitad —
// el catálogo no publica Ie para los arreglos Mw2 y no se va a inventar.

import datos from '../data/iec/blokset.json';

export interface ArregloBarraVerticalIec {
  /** Descripción del arreglo, p. ej. "2 × 60 × 5 mm". */
  arreglo: string;
  /** Corriente admisible de corta duración, kA durante 1 s. */
  icwKa: number;
  /** Separación de soportes que exige esa Icw, en mm. */
  separacionSoportesMm?: number;
  nota?: string;
}

interface BarraJson {
  sistema: string;
  construccion?: string;
  ieA?: number;
  icw?: string;
  ipkKa?: number;
  dimensional?: string;
  aplicacion?: string;
}

const BARRAS = datos.barras as BarraJson[];

function kaDe(texto: string | undefined): number | undefined {
  const m = texto?.match(/(\d+(?:[.,]\d+)?)\s*kA/i);
  return m ? Number(m[1]!.replace(',', '.')) : undefined;
}

function mmDe(texto: string | undefined): number | undefined {
  const m = texto?.match(/cada\s+(\d+)\s*mm/i);
  return m ? Number(m[1]) : undefined;
}

/** Duración declarada de la Icw, en segundos (por defecto 1 s). */
function segundosDe(texto: string | undefined): number {
  const m = texto?.match(/\/\s*(\d+(?:[.,]\d+)?)\s*s/i);
  return m ? Number(m[1]!.replace(',', '.')) : 1;
}

/** Arreglos de barra vertical de la columna Mw2 (MCC), de menor a mayor Icw. */
export const ARREGLOS_MW2: readonly ArregloBarraVerticalIec[] = BARRAS
  .filter((b) => /bus vertical mw2/i.test(b.sistema))
  .map((b) => {
    const icwKa = kaDe(b.icw);
    return {
      arreglo: b.construccion ?? '',
      icwKa: icwKa ?? 0,
      ...(mmDe(b.dimensional) != null ? { separacionSoportesMm: mmDe(b.dimensional) } : {}),
      ...(b.aplicacion ? { nota: b.aplicacion } : {}),
    };
  })
  .filter((a) => a.icwKa > 0)
  .sort((a, b) => a.icwKa - b.icwKa || a.arreglo.localeCompare(b.arreglo));

/** Corriente del bus de distribución vertical publicada, en A. */
export const BUS_DISTRIBUCION_VERTICAL_A =
  BARRAS.find((b) => /bus de distribuci/i.test(b.sistema))?.ieA ?? 3200;

/** Icw del bus de distribución vertical, en kA durante 1 s. */
export const BUS_DISTRIBUCION_VERTICAL_ICW_KA =
  kaDe(BARRAS.find((b) => /bus de distribuci/i.test(b.sistema))?.icw) ?? 100;

/**
 * Prestaciones fuera del estándar, por solicitud especial a Schneider.
 *
 * No se pueden comparar por kA a secas: la fila de distribución publica
 * 65 kA durante 3 s, que en kA es menos que los 85 kA / 1 s del arreglo Mw2
 * estándar pero en energía (I²t) es bastante más — 65² × 3 contra 85² × 1. Por
 * eso se guarda la duración y se ofrece la comparación por I²t.
 */
export interface IcwEspecial {
  ambito: string;
  icwKa: number;
  segundos: number;
}

export const ICW_SOLICITUD_ESPECIAL: readonly IcwEspecial[] = BARRAS
  .filter((b) => /solicitud especial/i.test(b.sistema))
  .map((b) => ({
    ambito: b.construccion ?? '',
    icwKa: kaDe(b.icw) ?? 0,
    segundos: segundosDe(b.icw),
  }))
  .filter((x) => x.icwKa > 0);

/** Energía específica I²t en kA²·s, que es lo comparable entre duraciones. */
export function i2t(icwKa: number, segundos: number): number {
  return icwKa * icwKa * segundos;
}

export interface VerificacionBarraVerticalIec {
  /** Arreglo elegido, o el mayor disponible si ninguno alcanza. */
  arreglo: ArregloBarraVerticalIec;
  iccBarraKa: number;
  /** true si la Icc supera la Icw del arreglo elegido. */
  excedeIcw: boolean;
  /**
   * true si la Icc supera el mayor arreglo estándar. Lo que sigue es pedir una
   * prestación especial; cuál corresponde depende también de la duración
   * exigida, por eso se listan en ICW_SOLICITUD_ESPECIAL en vez de resolverlo.
   */
  fueraDeEstandar: boolean;
  corrienteColumnaA: number;
  excedeCorrienteBus: boolean;
}

/**
 * Verifica la barra vertical de una columna BlokSeT contra la Icc de barra y
 * la corriente que acumula la columna.
 *
 * `iccBarraKa` en 0 significa que el proyecto no la declaró: entonces no se
 * elige arreglo ni se advierte, porque el criterio del catálogo es justamente
 * esa Icc.
 */
export function verificarBarraVerticalIec(
  corrienteColumnaA: number,
  iccBarraKa: number,
): VerificacionBarraVerticalIec | undefined {
  if (ARREGLOS_MW2.length === 0) return undefined;
  const mayor = ARREGLOS_MW2[ARREGLOS_MW2.length - 1]!;
  const arreglo = iccBarraKa > 0
    ? (ARREGLOS_MW2.find((a) => a.icwKa >= iccBarraKa) ?? mayor)
    : ARREGLOS_MW2[0]!;
  return {
    arreglo,
    iccBarraKa,
    excedeIcw: iccBarraKa > 0 && iccBarraKa > arreglo.icwKa,
    fueraDeEstandar: iccBarraKa > mayor.icwKa,
    corrienteColumnaA,
    excedeCorrienteBus: corrienteColumnaA > BUS_DISTRIBUCION_VERTICAL_A,
  };
}
