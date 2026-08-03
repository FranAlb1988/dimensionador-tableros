import abbTmaxData from '../data/iec/abb-tmax.json';
import abbTmaxMaData from '../data/iec/abb-tmax-ma.json';
import type { Carga, FamiliaProteccion, MarcaProteccion, Proteccion } from '../types';
import { corrienteDiseno } from './corriente';
import { capacidadMcbKa, sugerirMcb, type Mcb } from './mcb';
import { capacidadMccbKa, sugerirMccb, type Mccb, type OpcionesMccb } from './mccb';

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
 * alimentadores/salidas de CCM y CDC. Schneider sale del catálogo real
 * (mccb.ts, 1.577 referencias); ABB sigue con la tabla incorporada.
 * Chint no dispone de MCCB en el catálogo (NA1 es solo ACB): se complementa
 * con Schneider cuando la marca del principal es Chint.
 */
const MCCB_POR_MARCA: Record<MarcaProteccion, readonly Proteccion[] | 'catalogo'> = {
  Schneider: 'catalogo',
  ABB: ABB_TMAX,
  Chint: 'catalogo',
};

/**
 * Catálogo de interruptores SOLO MAGNÉTICOS por marca, para salidas de motor
 * con arrancador en la misma gaveta (coordinación tipo 2, IEC 60947-4-1):
 * el relé térmico del arrancador cubre la sobrecarga y el interruptor corta
 * solo cortocircuito — un TM-D duplicaría la protección térmica con riesgo de
 * descoordinación con el LRD.
 *  - Schneider → unidades MA del catálogo real (60 referencias, 2,5-500 A)
 *  - ABB → Tmax MA / PR221DS-I
 *  - Chint → Schneider MA (complemento, igual que en MCCB_POR_MARCA)
 */
const MCCB_MOTOR_POR_MARCA: Record<MarcaProteccion, readonly Proteccion[] | 'catalogo'> = {
  Schneider: 'catalogo',
  ABB: ABB_TMAX_MA,
  Chint: 'catalogo',
};

/**
 * Familias Schneider aptas para alimentadores y salidas de tablero
 * industrial: ComPacT NSXm/NSX/NS. EasyPact (CVS, EZC) queda fuera por
 * defecto — es la línea económica, con menor Icu y sin las unidades
 * MicroLogic que el proyecto usa para selectividad.
 */
const FAMILIAS_MCCB_INDUSTRIAL = ['ComPacT NSXm', 'ComPacT NSX', 'ComPacT NS'];

/**
 * Icu mínima cuando el proyecto todavía no declaró la Icc de barra, en kA.
 * El catálogo real ofrece clases desde E (16 kA) y, sin este piso, la
 * selección por "menor capacidad" las elegiría: un tablero industrial con
 * 16 kA de poder de corte es una apuesta, no un diseño. 36 kA es la clase F,
 * el piso que la app usaba cuando el catálogo era una tabla de tres clases.
 * Con `minIcuKA` explícito (Icc calculada) este piso no interviene.
 */
const ICU_MINIMA_POR_DEFECTO = 36;

/** Adapta una referencia del catálogo MCCB al tipo Proteccion del tablero. */
function mccbAProteccion(m: Mccb, tensionV: number): Proteccion {
  const familia = m.bastidor as FamiliaProteccion;
  const curva: Proteccion['curva'] | undefined =
    m.tecnologia === 'Magnética' ? 'MA' : m.tecnologia === 'Termomagnética' ? 'TM-D' : undefined;
  return {
    id: m.referencia.toLowerCase(),
    familia,
    marca: 'Schneider',
    referencia: `${m.bastidor}${m.clase} ${m.unidadDisparo} ${m.inA}A ${m.polosProtegidos} — ${m.referencia}`,
    inA: m.inA,
    icuKA: capacidadMccbKa(m, tensionV) ?? m.icu415Ka ?? 0,
    polos: m.polos,
    ...(curva ? { curva } : {}),
  };
}

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
 * Deriva la variante bipolar del interruptor para cargas monofásicas (fase +
 * neutro). Los catálogos base son 3P; NSX y Tmax existen en 2P para los frames
 * chicos — se marca nota para verificar disponibilidad del frame en 2P.
 */
function variante1F(p: Proteccion): Proteccion {
  if (p.polos !== 3) return p;
  const referencia = p.referencia.includes('3P 3D')
    ? p.referencia.replace('3P 3D', '2P 2D')
    : p.referencia.replace(/\b3P\b/, '2P');
  return {
    ...p,
    polos: 2,
    referencia,
    placeholder: true,
    notas: `${p.notas ? `${p.notas} ` : ''}Variante bipolar para carga 1F (F+N) — `
      + 'verificar disponibilidad del frame en 2P.',
  };
}

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

  if (pool === 'catalogo') return desdeCatalogoMccb(carga, Imin, esMotorMa, minIcuKA);

  const p = pool
    .toSorted((a, b) => a.inA - b.inA)
    .find((x) => x.inA >= Imin);
  if (!p) return undefined;
  // Carga 1F → variante bipolar (F+N); luego, si la Icc de barra supera la
  // prestación base, se sube N→S→H (Tmax). Si ni la mayor alcanza, el caller
  // advierte (icuKA < Icc).
  const conPolos = carga.fases === '1F' ? variante1F(p) : p;
  return elevarPrestacion(conPolos, minIcuKA);
}

/**
 * Selección Schneider desde el catálogo real. A diferencia de la vía por
 * tabla, aquí los polos y la clase de corte son referencias existentes: la
 * carga 1F toma una referencia 2P de catálogo (no una fabricada por texto) y
 * la Icc de barra se resuelve pidiendo Icu ≥ Icc a la tensión de servicio, que
 * el propio filtro traduce a la clase correcta (F→N→H→S→L→R).
 *
 * Prefiere referencias publicadas en Chile y familias ComPacT; si nada alcanza
 * abre el filtro por pasos antes de rendirse, para no dejar la salida sin
 * protección solo por un tema de disponibilidad.
 */
function desdeCatalogoMccb(
  carga: Carga,
  Imin: number,
  esMotorMa: boolean,
  minIcuKA: number,
): Proteccion | undefined {
  const tensionV = carga.tensionV > 0 ? carga.tensionV : 400;
  const base: OpcionesMccb = {
    polos: carga.fases === '1F' ? 2 : 3,
    tensionV,
    // Motor con arrancador: unidad solo magnética (sin L, la sobrecarga la
    // cubre el relé térmico). Cualquier otra salida exige la función L, o una
    // unidad MA de 3 A ganaría por In y dejaría el cable sin protección.
    ...(esMotorMa ? { tecnologia: 'magnetica' as const } : { protegeSobrecarga: true }),
    soloCompletos: true,
    iccKa: minIcuKA > 0 ? minIcuKA : ICU_MINIMA_POR_DEFECTO,
  };
  // De lo más restrictivo a lo más amplio: Chile + ComPacT → ComPacT →
  // cualquier familia (incluye EasyPact) → sin exigir unidad integrada.
  const intentos: OpcionesMccb[] = [
    { ...base, soloChile: true, familias: FAMILIAS_MCCB_INDUSTRIAL },
    { ...base, familias: FAMILIAS_MCCB_INDUSTRIAL },
    { ...base },
    { ...base, soloCompletos: false },
  ];
  for (const opciones of intentos) {
    const m = sugerirMccb(Imin, opciones);
    if (m) return mccbAProteccion(m, tensionV);
  }
  // Ninguna clase alcanza la Icc pedida (o el piso por defecto: a 690 V los
  // frames chicos no llegan a 36 kA). Mejor esfuerzo — la mayor Icu dentro de
  // las familias industriales — y el caller advierte comparando icuKA vs Icc.
  const mejor = sugerirMccb(Imin, {
    ...base,
    iccKa: undefined,
    preferirMayorIcu: true,
    familias: FAMILIAS_MCCB_INDUSTRIAL,
  }) ?? sugerirMccb(Imin, { ...base, iccKa: undefined, preferirMayorIcu: true });
  return mejor ? mccbAProteccion(mejor, tensionV) : undefined;
}

/** Compatibilidad: alimentador Schneider (NSX). */
export function sugerirProteccionNsx(carga: Carga): Proteccion | undefined {
  return sugerirProteccionFeeder(carga, 'Schneider');
}

/**
 * Familias del catálogo MCB aptas para un CDC industrial: Acti9 iC60 (hasta
 * 63 A) y C120 (80-125 A). Quedan fuera las gamas domésticas (iK60N, Easy9)
 * y NG125, que se reserva para cortocircuitos altos vía `iccKa`.
 */
const FAMILIAS_CDC = ['Acti9 iC60N', 'Acti9 iC60H', 'Acti9 iC60L', 'Acti9 C120N', 'Acti9 C120H'];

/** Adapta una referencia del catálogo MCB al tipo Proteccion del CDC. */
function mcbAProteccion(m: Mcb, tensionV: number, fases: '1F' | '3F'): Proteccion {
  const familia = m.familia.replace('Acti9 ', '') as FamiliaProteccion;
  return {
    id: m.referencia.toLowerCase(),
    familia,
    marca: 'Schneider',
    referencia: `${familia} ${m.curva} ${m.inA}A ${m.polos} — ${m.referencia}`,
    inA: m.inA,
    icuKA: capacidadMcbKa(m, tensionV, fases) ?? 0,
    polos: m.polosProtegidos,
    curva: m.curva as Proteccion['curva'],
    // El CDC cuenta módulos DIN de 18 mm; C120 1P (27 mm) ocupa 1,5.
    ...(m.anchoMm != null ? { modulosDin: m.anchoMm / 18 } : {}),
  };
}

/**
 * Sugiere un MCB Acti9 para una carga de CDC.
 * Curva C para iluminación/tomas y D para motores pequeños (inrush alto).
 * `factorDerrateo` (F2 por altura): el interruptor se selecciona contra I / F2.
 * `iccKa`: si se conoce el cortocircuito en la barra, exige capacidad ≥ Icc
 * (sube de iC60N a iC60H/L o C120H automáticamente).
 * Prefiere referencias publicadas en Chile; si ninguna alcanza, abre el rango.
 */
export function sugerirProteccionIc60(carga: Carga, factorDerrateo = 1, iccKa?: number): Proteccion | undefined {
  const I = corrienteDiseno(carga);
  if (I <= 0) return undefined;
  const f = factorDerrateo > 0 ? factorDerrateo : 1;
  const Imin = (I * MARGEN_IC60) / f;
  const opciones = {
    fases: carga.fases,
    curva: carga.tipo === 'motor' ? 'D' as const : 'C' as const,
    tensionV: carga.tensionV,
    familias: FAMILIAS_CDC,
    ...(iccKa != null ? { iccKa } : {}),
  };
  const m = sugerirMcb(Imin, { ...opciones, soloChile: true }) ?? sugerirMcb(Imin, opciones);
  return m ? mcbAProteccion(m, carga.tensionV, carga.fases) : undefined;
}

export const ABB_TMAX_DISPONIBLES = ABB_TMAX;
