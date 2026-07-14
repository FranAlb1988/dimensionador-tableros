import nsxData from '../data/iec/nsx.json';
import ic60Data from '../data/iec/ic60.json';
import abbTmaxData from '../data/iec/abb-tmax.json';
import type { Carga, MarcaProteccion, Proteccion } from '../types';
import { corrienteDiseno } from './corriente';

const NSX: readonly Proteccion[] = (nsxData.interruptores as Proteccion[]);
const IC60: readonly Proteccion[] = (ic60Data.interruptores as Proteccion[]);
const ABB_TMAX: readonly Proteccion[] = (abbTmaxData.interruptores as Proteccion[]);

/**
 * Margen para el In del interruptor sobre la corriente de diseño.
 * No-motor: 1.25 — alimentadores de régimen continuo (subtableros, CCMs,
 * iluminación) no deben cargar el térmico TM-D sobre el 80% de su In
 * (criterio NEC 210.19/215.2 para carga continua; práctica IEC equivalente).
 * Motor: 1.25 sobre I de diseño (la sobrecarga la cubre el relé térmico).
 */
const MARGEN_NSX_NO_MOTOR = 1.25;
const MARGEN_NSX_MOTOR = 1.25;
const MARGEN_IC60 = 1.0;

/**
 * Catálogo de interruptores de caja moldeada (MCCB) por marca para
 * alimentadores/salidas de CCM y CDC:
 *  - Schneider → NSX
 *  - ABB → Tmax (XT/T)
 *  - Chint → no dispone de MCCB en el catálogo incorporado (NA1 es solo ACB);
 *    se usa NSX como complemento de las salidas cuando la marca del principal
 *    es Chint.
 */
const MCCB_POR_MARCA: Record<MarcaProteccion, readonly Proteccion[]> = {
  Schneider: NSX,
  ABB: ABB_TMAX,
  Chint: NSX,
};

/** Marcas con interruptores de alimentador (MCCB) disponibles. */
export const MARCAS_FEEDER: readonly MarcaProteccion[] = ['Schneider', 'ABB'];

/**
 * Sugiere un interruptor de alimentador (MCCB) para una carga de CCM/CDC, según marca.
 * Margen 1.25 sobre I_diseño (motores y alimentadores continuos por igual).
 * Si la carga trae `corrienteProteccionA` (frame mínimo forzado), el In elegido
 * será ≥ ese valor — usado para forzar un frame mayor del necesario por la
 * corriente, lo que define el tamaño de gaveta.
 * El relé térmico hace la protección de sobrecarga; el MCCB corta cortocircuito.
 */
export function sugerirProteccionFeeder(
  carga: Carga,
  marca: MarcaProteccion = 'Schneider',
): Proteccion | undefined {
  const I = corrienteDiseno(carga);
  const frameForzado = carga.corrienteProteccionA && carga.corrienteProteccionA > 0
    ? carga.corrienteProteccionA
    : 0;
  if (I <= 0 && frameForzado <= 0) return undefined;
  const margen = carga.tipo === 'motor' ? MARGEN_NSX_MOTOR : MARGEN_NSX_NO_MOTOR;
  const Imin = Math.max(I * margen, frameForzado);
  return MCCB_POR_MARCA[marca]
    .toSorted((a, b) => a.inA - b.inA)
    .find((p) => p.inA >= Imin);
}

/** Compatibilidad: alimentador Schneider (NSX). */
export function sugerirProteccionNsx(carga: Carga): Proteccion | undefined {
  return sugerirProteccionFeeder(carga, 'Schneider');
}

/**
 * Sugiere un iC60 para una carga de CDC.
 * Curva preferida: C para iluminación/tomas, D para cargas inductivas pequeñas (motor < 4 kW).
 * `factorDerrateo` (F2 por altura): el interruptor se selecciona contra I / F2.
 */
export function sugerirProteccionIc60(carga: Carga, factorDerrateo = 1): Proteccion | undefined {
  const I = corrienteDiseno(carga);
  if (I <= 0) return undefined;
  const f = factorDerrateo > 0 ? factorDerrateo : 1;
  const Imin = (I * MARGEN_IC60) / f;
  const polosNecesarios = carga.fases === '3F' ? 3 : 1;
  return IC60
    .filter((p) => p.polos === polosNecesarios)
    .toSorted((a, b) => a.inA - b.inA)
    .find((p) => p.inA >= Imin);
}

export const NSX_DISPONIBLES = NSX;
export const IC60_DISPONIBLES = IC60;
export const ABB_TMAX_DISPONIBLES = ABB_TMAX;
