import nsxData from '../data/iec/nsx.json';
import nsxMaData from '../data/iec/nsx-ma.json';
import ic60Data from '../data/iec/ic60.json';
import abbTmaxData from '../data/iec/abb-tmax.json';
import abbTmaxMaData from '../data/iec/abb-tmax-ma.json';
import type { Carga, MarcaProteccion, Proteccion } from '../types';
import { corrienteDiseno } from './corriente';

const NSX: readonly Proteccion[] = (nsxData.interruptores as Proteccion[]);
const NSX_MA: readonly Proteccion[] = (nsxMaData.interruptores as Proteccion[]);
const IC60: readonly Proteccion[] = (ic60Data.interruptores as Proteccion[]);
const ABB_TMAX: readonly Proteccion[] = (abbTmaxData.interruptores as Proteccion[]);
const ABB_TMAX_MA: readonly Proteccion[] = (abbTmaxMaData.interruptores as Proteccion[]);

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

/**
 * Catálogo de interruptores SOLO MAGNÉTICOS por marca, para salidas de motor
 * con arrancador en la misma gaveta (coordinación tipo 2, IEC 60947-4-1):
 * el relé térmico del arrancador cubre la sobrecarga y el interruptor corta
 * solo cortocircuito — un TM-D duplicaría la protección térmica con riesgo de
 * descoordinación con el LRD.
 *  - Schneider → NSX MA / Micrologic 1.3 M
 *  - ABB → Tmax MA / PR221DS-I
 *  - Chint → NSX MA (complemento, igual que en MCCB_POR_MARCA)
 */
const MCCB_MOTOR_POR_MARCA: Record<MarcaProteccion, readonly Proteccion[]> = {
  Schneider: NSX_MA,
  ABB: ABB_TMAX_MA,
  Chint: NSX_MA,
};

/**
 * Margen para unidades solo magnéticas: In ≥ I_diseño (sin 1.25 — el In del
 * MA no es un umbral térmico; el magnético se ajusta luego a 6–14 × In).
 */
const MARGEN_MA = 1.0;

/**
 * Escalas de prestación (poder de corte a 415 V) por línea de producto. Los
 * catálogos base traen la prestación económica; cuando la Icc de barra la
 * supera, la misma unidad se pide en la prestación superior (mismo In y
 * frame — cambia la letra de la referencia y el Icu).
 */
interface Prestacion { sufijo: string; icuKA: number }
const PRESTACIONES_NSX: readonly Prestacion[] = [
  { sufijo: 'F', icuKA: 36 },
  { sufijo: 'N', icuKA: 50 },
  { sufijo: 'H', icuKA: 70 },
];
const PRESTACIONES_TMAX: readonly Prestacion[] = [
  { sufijo: 'N', icuKA: 36 },
  { sufijo: 'S', icuKA: 50 },
  { sufijo: 'H', icuKA: 70 },
];

/**
 * Eleva la prestación del interruptor hasta cubrir `minIcuKA` (Icc de barra).
 * Si ni la prestación mayor alcanza, devuelve la mayor disponible — el caller
 * debe comparar icuKA contra la Icc y advertir. Sin escala conocida (p. ej.
 * ACB) devuelve la unidad tal cual.
 */
export function elevarPrestacion(p: Proteccion, minIcuKA: number): Proteccion {
  if (!(minIcuKA > 0) || p.icuKA >= minIcuKA) return p;
  const esNsx = p.familia.startsWith('NSX');
  const esTmax = p.familia.startsWith('Tmax');
  const escala = esNsx ? PRESTACIONES_NSX : esTmax ? PRESTACIONES_TMAX : null;
  if (!escala) return p;
  const objetivo = escala.find((e) => e.icuKA >= minIcuKA) ?? escala[escala.length - 1]!;
  if (objetivo.icuKA <= p.icuKA) return p;
  const referencia = esNsx
    ? p.referencia.replace(/^(NSX\d+)[FNH]/, `$1${objetivo.sufijo}`)
    : p.referencia.replace(/\b(X?T\d+)[NSH]\b/, `$1${objetivo.sufijo}`);
  return {
    ...p,
    referencia,
    icuKA: objetivo.icuKA,
    placeholder: true,
    notas: `${p.notas ? `${p.notas} ` : ''}Prestación elevada a ${objetivo.sufijo} `
      + `(Icu ${objetivo.icuKA} kA) por la Icc de barra — verificar SKU.`,
  };
}

/** Marcas con interruptores de alimentador (MCCB) disponibles. */
export const MARCAS_FEEDER: readonly MarcaProteccion[] = ['Schneider', 'ABB'];

/**
 * Sugiere un interruptor de alimentador (MCCB) para una carga de CCM/CDC, según marca.
 * Margen 1.25 sobre I_diseño (motores y alimentadores continuos por igual).
 * `factorDerrateo` (F2 por altura): el equipo pierde capacidad con la altitud,
 * por lo que se selecciona contra (I × margen) / F2. El frame forzado
 * (`corrienteProteccionA`) no se escala — es una elección explícita del usuario:
 * si la carga trae ese campo, el In elegido será ≥ ese valor, usado para forzar
 * un frame mayor del necesario por la corriente (define el tamaño de gaveta).
 *
 * `motorConArrancador`: la salida alimenta un arrancador (contactor + relé
 * térmico) en la misma gaveta — para motores se usa entonces una unidad SOLO
 * MAGNÉTICA (MA / Micrologic 1.3 M, margen 1.0) en vez de TM-D: coordinación
 * tipo 2 IEC 60947-4-1, la sobrecarga la cubre el relé del arrancador. Sin ese
 * contexto (p. ej. salida de motor directa desde un CDC) se mantiene el TM-D,
 * que sí aporta protección térmica.
 */
export function sugerirProteccionFeeder(
  carga: Carga,
  marca: MarcaProteccion = 'Schneider',
  factorDerrateo = 1,
  motorConArrancador = false,
  minIcuKA = 0,
): Proteccion | undefined {
  const I = corrienteDiseno(carga);
  const f = factorDerrateo > 0 ? factorDerrateo : 1;
  const frameForzado = carga.corrienteProteccionA && carga.corrienteProteccionA > 0
    ? carga.corrienteProteccionA
    : 0;
  if (I <= 0 && frameForzado <= 0) return undefined;
  const esMotorMa = motorConArrancador && carga.tipo === 'motor';
  const pool = esMotorMa ? MCCB_MOTOR_POR_MARCA[marca] : MCCB_POR_MARCA[marca];
  const margen = esMotorMa
    ? MARGEN_MA
    : (carga.tipo === 'motor' ? MARGEN_NSX_MOTOR : MARGEN_NSX_NO_MOTOR);
  const Imin = Math.max((I * margen) / f, frameForzado);
  const p = pool
    .toSorted((a, b) => a.inA - b.inA)
    .find((x) => x.inA >= Imin);
  // Icc de barra: si la prestación base no la cubre, se sube F→N→H (NSX) o
  // N→S→H (Tmax). Si ni la mayor alcanza, el caller advierte (icuKA < Icc).
  return p ? elevarPrestacion(p, minIcuKA) : undefined;
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
