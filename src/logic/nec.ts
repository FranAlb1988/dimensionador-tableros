// Capítulo 3 del NFPA 70 (NEC): ampacidad de conductores y sus correcciones.
//
// La app dimensionaba conductores siempre con las tablas del RIC, incluso en la
// rama NEMA, que es enteramente de convención norteamericana. Con esto la rama
// NEMA puede dimensionar con su propia norma.
//
// El orden importa y es el que más se equivoca: la ampacidad de la Tabla 310.16
// es un valor BASE a 30 °C que hay que corregir por temperatura ambiente y por
// agrupamiento ANTES de compararlo con la corriente de diseño. Tomar el número
// de tabla tal cual sobredimensiona la capacidad del conductor.

import datos from '../data/nec/capitulo-3.json';

export type MaterialConductor = 'cobre' | 'aluminio';
/** Temperatura de servicio del aislamiento, °C. */
export type TempAislacion = 60 | 75 | 90;

export interface FilaAmpacidad {
  calibre: string;
  cu60: number | null; cu75: number | null; cu90: number | null;
  al60: number | null; al75: number | null; al90: number | null;
}

export interface TramoTemperatura {
  /** null = "esa temperatura o menos". */
  desdeC: number | null;
  hastaC: number;
  c60: number | null; c75: number | null; c90: number | null;
}

export interface TramoAgrupamiento {
  desde: number;
  /** null = sin tope superior. */
  hasta: number | null;
  factor: number;
}

export interface FilaBandeja {
  anchoMm: number;
  anchoPulg: number;
  escaleraMm2: number;
  escaleraPulg2: number;
  fondoSolidoMm2: number;
  fondoSolidoPulg2: number;
}

export const AMPACIDAD = datos.ampacidad as readonly FilaAmpacidad[];
export const CORRECCION_TEMPERATURA_30 = datos.correccionTemperatura30 as readonly TramoTemperatura[];
export const AGRUPAMIENTO = datos.agrupamiento as readonly TramoAgrupamiento[];
export const BANDEJAS = datos.bandejas as readonly FilaBandeja[];

/** Calibres de la 310.16, del más chico al más grande. */
export const CALIBRES: readonly string[] = AMPACIDAD.map((a) => a.calibre);

/**
 * Área de llenado por milímetro de ancho de bandeja, Tabla 392.22(A)(1).
 *
 * Sale de la columna métrica, que da 30 mm²/mm en todos los anchos publicados
 * salvo el de 225 mm: ahí el NEC pone 6.800 mm² donde la razón daría 6.750, así
 * que ese ancho sale a 30,2. Por eso `areaBandejaMm2` devuelve el valor de
 * tabla cuando el ancho está publicado y solo usa esta razón para interpolar.
 *
 * La columna en pulgadas de la misma tabla redondea distinto y equivale a
 * 29,63 mm²/mm: no es un error de ninguna de las dos, son dos redondeos
 * independientes del mismo criterio. Para un proyecto en milímetros manda la
 * métrica.
 */
export const AREA_BANDEJA_POR_MM = 30;

function clave(material: MaterialConductor, temp: TempAislacion): keyof FilaAmpacidad {
  const p = material === 'cobre' ? 'cu' : 'al';
  return `${p}${temp}` as keyof FilaAmpacidad;
}

/**
 * Ampacidad de tabla (310.16), en A. Sin corregir.
 * `undefined` si el calibre no existe en ese material — el 14 AWG no se
 * fabrica en aluminio, por ejemplo.
 */
export function ampacidadTabla(
  calibre: string,
  material: MaterialConductor,
  temp: TempAislacion,
): number | undefined {
  const fila = AMPACIDAD.find((a) => a.calibre === calibre);
  if (!fila) return undefined;
  const v = fila[clave(material, temp)];
  return typeof v === 'number' ? v : undefined;
}

/**
 * Factor de corrección por temperatura ambiente, Tabla 310.15(B)(1)(1).
 *
 * `undefined` cuando la tabla no publica valor: por encima de cierta ambiente
 * un aislamiento de 60 °C ya no sirve, y no corresponde inventar un factor.
 */
export function factorTemperatura(
  ambienteC: number,
  temp: TempAislacion,
): number | undefined {
  const col = `c${temp}` as 'c60' | 'c75' | 'c90';
  for (const t of CORRECCION_TEMPERATURA_30) {
    const desde = t.desdeC ?? -Infinity;
    if (ambienteC >= desde && ambienteC <= t.hastaC) {
      return t[col] ?? undefined;
    }
  }
  return undefined; // fuera del rango publicado
}

/**
 * Factor de ajuste por número de conductores portadores de corriente,
 * Tabla 310.15(C)(1). Hasta tres conductores no se ajusta.
 */
export function factorAgrupamiento(nConductores: number): number {
  if (nConductores <= 3) return 1;
  for (const t of AGRUPAMIENTO) {
    if (nConductores >= t.desde && (t.hasta == null || nConductores <= t.hasta)) {
      return t.factor;
    }
  }
  return AGRUPAMIENTO[AGRUPAMIENTO.length - 1]?.factor ?? 1;
}

export interface AmpacidadCorregida {
  calibre: string;
  base: number;
  factorTemperatura: number;
  factorAgrupamiento: number;
  corregida: number;
}

/** Ampacidad de tabla ya corregida por temperatura y agrupamiento. */
export function ampacidadCorregida(
  calibre: string,
  material: MaterialConductor,
  temp: TempAislacion,
  ambienteC: number,
  nConductores: number,
): AmpacidadCorregida | undefined {
  const base = ampacidadTabla(calibre, material, temp);
  if (base == null) return undefined;
  const ft = factorTemperatura(ambienteC, temp);
  if (ft == null) return undefined;
  const fa = factorAgrupamiento(nConductores);
  return {
    calibre,
    base,
    factorTemperatura: ft,
    factorAgrupamiento: fa,
    corregida: base * ft * fa,
  };
}

/**
 * Calibre más chico cuya ampacidad corregida cubre la corriente de diseño.
 * `undefined` si ni el mayor de la tabla alcanza: ahí corresponde poner
 * conductores en paralelo, y eso lo decide el proyectista.
 */
export function calibrePorCorriente(
  corrienteA: number,
  material: MaterialConductor,
  temp: TempAislacion,
  ambienteC: number,
  nConductores: number,
): AmpacidadCorregida | undefined {
  if (!(corrienteA > 0)) return undefined;
  for (const fila of AMPACIDAD) {
    const r = ampacidadCorregida(fila.calibre, material, temp, ambienteC, nConductores);
    if (r && r.corregida >= corrienteA) return r;
  }
  return undefined;
}

/**
 * Área de llenado admisible de una bandeja tipo escalera o batea ventilada,
 * para cables multiconductores de hasta 2.000 V (Tabla 392.22(A)(1)).
 *
 * Para anchos que están en la tabla se devuelve el valor publicado; para el
 * resto se interpola con los 30 mm²/mm, que es la razón constante de la tabla.
 */
export function areaBandejaMm2(anchoMm: number): number {
  const fila = BANDEJAS.find((b) => b.anchoMm === anchoMm);
  return fila ? fila.escaleraMm2 : anchoMm * AREA_BANDEJA_POR_MM;
}
