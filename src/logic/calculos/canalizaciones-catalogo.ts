// Catálogo de canalizaciones — ductos y escalerillas portaconductores.
//
// Ductos: área interna total (100%) según NEC Cap. 9, Tabla 4, para tubería
//   metálica EMT y tubería PVC Schedule 40. Designación en pulgadas.
// Escalerillas: anchos normalizados típicos de bandeja portacable (mm).

export type TipoDucto = 'metalico' | 'pvc';

export interface DuctoCatalogo {
  id: string;
  /** Designación comercial, p. ej. '1¼″'. */
  nombre: string;
  tipo: TipoDucto;
  /** Área interna total (100%), mm². */
  areaInternaMm2: number;
}

/** Ductos EMT (metálico) y PVC Sch. 40 — NEC Cap. 9, Tabla 4. */
export const CATALOGO_DUCTOS: readonly DuctoCatalogo[] = [
  { id: 'emt-1-2', nombre: '½″', tipo: 'metalico', areaInternaMm2: 196 },
  { id: 'emt-3-4', nombre: '¾″', tipo: 'metalico', areaInternaMm2: 343 },
  { id: 'emt-1', nombre: '1″', tipo: 'metalico', areaInternaMm2: 573 },
  { id: 'emt-1-1-4', nombre: '1¼″', tipo: 'metalico', areaInternaMm2: 992 },
  { id: 'emt-1-1-2', nombre: '1½″', tipo: 'metalico', areaInternaMm2: 1314 },
  { id: 'emt-2', nombre: '2″', tipo: 'metalico', areaInternaMm2: 2165 },
  { id: 'emt-2-1-2', nombre: '2½″', tipo: 'metalico', areaInternaMm2: 3623 },
  { id: 'emt-3', nombre: '3″', tipo: 'metalico', areaInternaMm2: 5610 },
  { id: 'emt-3-1-2', nombre: '3½″', tipo: 'metalico', areaInternaMm2: 7548 },
  { id: 'emt-4', nombre: '4″', tipo: 'metalico', areaInternaMm2: 9716 },
  { id: 'pvc-1-2', nombre: '½″', tipo: 'pvc', areaInternaMm2: 161 },
  { id: 'pvc-3-4', nombre: '¾″', tipo: 'pvc', areaInternaMm2: 285 },
  { id: 'pvc-1', nombre: '1″', tipo: 'pvc', areaInternaMm2: 458 },
  { id: 'pvc-1-1-4', nombre: '1¼″', tipo: 'pvc', areaInternaMm2: 794 },
  { id: 'pvc-1-1-2', nombre: '1½″', tipo: 'pvc', areaInternaMm2: 1063 },
  { id: 'pvc-2', nombre: '2″', tipo: 'pvc', areaInternaMm2: 1738 },
  { id: 'pvc-2-1-2', nombre: '2½″', tipo: 'pvc', areaInternaMm2: 2477 },
  { id: 'pvc-3', nombre: '3″', tipo: 'pvc', areaInternaMm2: 3831 },
  { id: 'pvc-3-1-2', nombre: '3½″', tipo: 'pvc', areaInternaMm2: 5135 },
  { id: 'pvc-4', nombre: '4″', tipo: 'pvc', areaInternaMm2: 6605 },
];

/** Anchos normalizados de escalerilla portaconductores, mm. */
export const ANCHOS_ESCALERILLA: readonly number[] = [100, 150, 200, 300, 450, 600, 750, 900];

/** Profundidad útil de la escalerilla utilizada en los proyectos del usuario (mm). */
export const PROFUNDIDAD_ESCALERILLA_MM = 100;

/**
 * Máximo de capas en una escalerilla — REGLA DE PROYECTO, no norma.
 *
 * Es una decisión de la oficina, y conviene tenerla clara para no citarla como
 * si fuera un requisito reglamentario:
 *  - NEC 392.22(B)(1) exige CAPA ÚNICA para monopolares de 1/0 a 4/0 AWG y de
 *    1000 kcmil o más. Dos capas no cumplen ese artículo.
 *  - IEC 60364-5-52, Tabla B.52.20 nota 2: los factores de agrupamiento
 *    tabulados NO aplican a cables en más de una capa tocándose; los valores
 *    reales "pueden ser significativamente menores" y hay que determinarlos
 *    por otro método.
 *
 * O sea: con 2 capas el ancho sale bien, pero la ampacidad ya no se puede
 * tomar de las tablas. La calculadora lo advierte cuando se usan 2 capas.
 */
export const MAX_CAPAS_PROYECTO = 2;

/**
 * Separación mínima entre monopolares, en múltiplos del diámetro.
 *
 * NEC 392.80(A)(2): en bandeja destapada, los monopolares se derratean a 65 %
 * (1/0 AWG a 500 kcmil) o 75 % (600 kcmil y mayores) de la ampacidad al aire
 * de la Tabla 310.17 — salvo que vayan en CAPA ÚNICA con separación mantenida
 * de al menos un diámetro, en cuyo caso se usa el 100 %.
 *
 * IEC 60364-5-52 llega al mismo número por otro camino: "espaciado" en bandeja
 * perforada es separación ≥ 1 diámetro, y el factor de agrupamiento mejora de
 * forma apreciable (6 circuitos en capa única: 0,57 juntos → 0,72 espaciados).
 *
 * La separación no es un lujo: es lo que compra la ampacidad.
 */
export const SEPARACION_MONOPOLAR_DIAMETROS = 1;

/** Separación para agrupamiento en trébol o cuadrado (NEC 392.80(A)(2)). */
export const SEPARACION_TREBOL_DIAMETROS = 2.15;

/**
 * Modo de tendido, que decide el criterio de ancho:
 *  - `alimentadores`: monopolares separados un diámetro entre sí. Es el caso de
 *    los alimentadores de tablero, donde la separación mantiene la ampacidad.
 *  - `circuitos`: cables multiconductores o monopolares agrupados por circuito,
 *    tendidos juntos. Es el caso de los circuitos de fuerza y control.
 */
export type ModoTendido = 'alimentadores' | 'circuitos';

/**
 * Ancho que ocupa una capa, en mm.
 *
 * Con separación, cada hueco entre conductores vale `separacionDiametros` veces
 * el diámetro del conductor mayor de los dos que separa — el criterio
 * conservador cuando la capa mezcla calibres. n conductores dejan n−1 huecos.
 */
export function anchoDeCapa(
  diametros: readonly number[],
  separacionDiametros = 0,
): number {
  if (diametros.length === 0) return 0;
  const suma = diametros.reduce((s, d) => s + d, 0);
  if (separacionDiametros <= 0 || diametros.length < 2) return suma;
  const orden = [...diametros].sort((a, b) => b - a);
  let huecos = 0;
  for (let i = 0; i < orden.length - 1; i += 1) {
    huecos += Math.max(orden[i]!, orden[i + 1]!) * separacionDiametros;
  }
  return suma + huecos;
}

/**
 * Sección mínima de conductor monopolar admitida en escalerilla.
 * NEC 392.10(B)(1): monopolares de 1/0 AWG o mayores. 1/0 AWG ≈ 53,5 mm².
 */
export const SECCION_MINIMA_MONOPOLAR_MM2 = 53.5;

/** Porcentaje de la ampacidad al aire aplicable sin separación mantenida. */
export function derrateoMonopolarSinSeparacion(seccionMm2: number): number {
  // NEC 392.80(A)(2): 600 kcmil ≈ 304 mm² es el corte entre 65 % y 75 %.
  return seccionMm2 >= 304 ? 0.75 : 0.65;
}

/**
 * Capas que caben verticalmente solo por geometría (alto útil / Ø mayor).
 * No aplica el tope normativo. Útil para mensajes.
 */
export function maxCapasGeometrico(diametroMayorMm: number): number {
  if (!(diametroMayorMm > 0)) return 0;
  return Math.floor(PROFUNDIDAD_ESCALERILLA_MM / diametroMayorMm);
}

/**
 * Capas máximas admisibles en la escalerilla — el mínimo entre el límite
 * geométrico (alto útil) y el normativo (2 capas). Devuelve 0 si ni siquiera
 * una capa cabe físicamente.
 */
export function maxCapasEnEscalerilla(diametroMayorMm: number): number {
  const geom = maxCapasGeometrico(diametroMayorMm);
  if (geom <= 0) return 0;
  return Math.min(geom, MAX_CAPAS_PROYECTO);
}

/**
 * Área máxima admisible de cables en la escalerilla, según NEC 392.22(A),
 * Tabla 1, Columna 1 — multicable en bandeja ventilada. Indexada por ancho (mm).
 * El cumplimiento normativo exige Σ áreas de conductores ≤ área permitida.
 */
export const AREA_PERMITIDA_ESCALERILLA: Readonly<Record<number, number>> = {
  100: 2800,
  150: 4200,
  200: 5600,
  300: 8400,
  450: 12600,
  600: 16800,
  750: 21000,
  900: 25200,
};

/** Área admisible (mm²) para el ancho normalizado dado, o 0 si no se conoce. */
export function areaPermitidaEscalerilla(anchoMm: number): number {
  return AREA_PERMITIDA_ESCALERILLA[anchoMm] ?? 0;
}

/** Norma con la que se aplica el porcentaje de relleno del ducto. */
export type NormaRelleno = 'RIC' | 'NEC';

/**
 * Porcentaje de relleno admisible de una tubería. Las dos normas difieren:
 *
 *   Conductores    RIC N°4    NEC Cap. 9 Tabla 1
 *   1                50 %          53 %
 *   2                33 %          31 %
 *   3 o más          33 %          40 %
 *
 * El caso que importa es el de 3 o más, que es el habitual: el NEC admite
 * 40 % donde el RIC solo permite 33 %, así que aplicar el NEC a un proyecto
 * chileno subdimensiona la tubería — se elige un diámetro que no cumple y en
 * el que además cuesta pasar el cable. Antes esta función tenía la tabla del
 * NEC y la calculadora declaraba "RIC N°4 · NEC Cap. 9".
 */
export function porcentajeRelleno(
  nConductores: number,
  norma: NormaRelleno = 'RIC',
): number {
  if (norma === 'RIC') return nConductores <= 1 ? 0.5 : 0.33;
  if (nConductores <= 1) return 0.53;
  if (nConductores === 2) return 0.31;
  return 0.4;
}

/** Ducto más pequeño del tipo dado cuya área interna cubre el área requerida. */
export function sugerirDucto(tipo: TipoDucto, areaRequeridaMm2: number): DuctoCatalogo | undefined {
  return CATALOGO_DUCTOS
    .filter((d) => d.tipo === tipo)
    .toSorted((a, b) => a.areaInternaMm2 - b.areaInternaMm2)
    .find((d) => d.areaInternaMm2 >= areaRequeridaMm2);
}

/** Área interna del ducto más grande del tipo dado, mm². */
export function areaDuctoMaxima(tipo: TipoDucto): number {
  return Math.max(...CATALOGO_DUCTOS.filter((d) => d.tipo === tipo).map((d) => d.areaInternaMm2));
}

/**
 * Ancho normalizado mínimo de escalerilla que cumple ambos criterios:
 * (a) ancho geométrico ≥ suma de diámetros por capa,
 * (b) área permitida (NEC 392.22) ≥ área total de los conductores
 *     (cuando `areaConductoresMm2 > 0`).
 */
export function sugerirAnchoEscalerilla(
  anchoRequeridoMm: number,
  areaConductoresMm2 = 0,
): number | undefined {
  return [...ANCHOS_ESCALERILLA]
    .sort((a, b) => a - b)
    .find((w) => {
      if (w < anchoRequeridoMm) return false;
      if (areaConductoresMm2 > 0 && areaConductoresMm2 > areaPermitidaEscalerilla(w)) return false;
      return true;
    });
}

/**
 * Distribuye los elementos en `capas` filas balanceando la suma de tamaños
 * por fila (bin-packing best-fit decreasing). Resulta en filas cuya suma
 * máxima es aproximadamente Σ tamaños / capas. Determinista: ordena por
 * tamaño descendente y asigna cada elemento a la fila con menor suma actual.
 */
export function distribuirEnCapas<T>(
  items: readonly T[],
  getSize: (item: T) => number,
  capas: number,
): T[][] {
  const n = Math.max(1, Math.round(capas));
  const orden = [...items].sort((a, b) => getSize(b) - getSize(a));
  const filas: T[][] = Array.from({ length: n }, () => [] as T[]);
  const sumas = new Array<number>(n).fill(0);
  for (const item of orden) {
    let idx = 0;
    for (let i = 1; i < n; i += 1) if (sumas[i]! < sumas[idx]!) idx = i;
    filas[idx]!.push(item);
    sumas[idx]! += getSize(item);
  }
  return filas;
}
