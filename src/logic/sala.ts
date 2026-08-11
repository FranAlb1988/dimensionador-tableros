// Estimación del tamaño de una sala eléctrica a partir de los equipos que van
// dentro.
//
// Hasta ahora la sala era un dato de entrada: se escribían largo y ancho y la
// app calculaba carga térmica y de piso sobre eso. Este módulo hace el paso
// que faltaba — de la lista de tableros a las dimensiones del recinto.
//
// Lo que decide el resultado no es la huella de los equipos sino las holguras.
// En la sala de referencia los equipos ocupan 69,5 m² y la sala son 166,7 m²:
// el 58 % del recinto es espacio de trabajo y circulación. Por eso las
// holguras son entradas explícitas y no constantes escondidas.

import { EQUIPOS_REFERENCIA, type EquipoSala, type TipoEquipoSala } from './carga-piso';

/**
 * Cómo se ordenan los tableros en planta. Determina el ancho de la sala y,
 * de paso, la condición de trabajo del NEC.
 *
 * Tres y cuatro filas no caben en un contenedor —el transporte lo limita a
 * unos 4,5 m de ancho— pero sí en obra civil, que es de donde salen.
 */
export type Disposicion =
  | 'unaFila' | 'dosFilasEnfrentadas' | 'dosFilasEspalda' | 'tresFilas' | 'cuatroFilas';

export const DISPOSICION_LABEL: Record<Disposicion, string> = {
  unaFila: 'Una fila contra muro',
  dosFilasEnfrentadas: 'Dos filas enfrentadas',
  dosFilasEspalda: 'Dos filas espalda con espalda',
  tresFilas: 'Tres filas (un par enfrentado + una)',
  cuatroFilas: 'Cuatro filas (dos pares enfrentados)',
};

/**
 * Geometría de la sección transversal de cada disposición.
 *
 * `pasillos` son los espacios de trabajo que hay que contar a lo ancho, y
 * `espaldas` las veces que aparece la holgura posterior. Dos filas
 * enfrentadas comparten un solo pasillo; espalda con espalda necesita dos,
 * uno por lado, pero no lleva holgura posterior porque los respaldos se tocan.
 */
const GEOMETRIA: Record<Disposicion, {
  filas: number; pasillos: number; espaldas: number; condicion: 2 | 3;
}> = {
  unaFila: { filas: 1, pasillos: 1, espaldas: 1, condicion: 2 },
  dosFilasEnfrentadas: { filas: 2, pasillos: 1, espaldas: 2, condicion: 3 },
  dosFilasEspalda: { filas: 2, pasillos: 2, espaldas: 0, condicion: 2 },
  tresFilas: { filas: 3, pasillos: 2, espaldas: 2, condicion: 3 },
  cuatroFilas: { filas: 4, pasillos: 2, espaldas: 2, condicion: 3 },
};

/** Tipo de construcción del recinto. Cambia el espesor de muros. */
export type TipoConstruccion = 'prefabricada' | 'hormigon';

export const CONSTRUCCION_LABEL: Record<TipoConstruccion, string> = {
  prefabricada: 'Prefabricada (panel sándwich)',
  hormigon: 'Hormigón armado',
};

/**
 * Espesor de muro por tipo de construcción, en mm. Son valores de partida
 * editables, no un dato normativo: el panel sándwich de una sala tipo
 * contenedor ronda los 100 mm y un muro de hormigón armado los 200.
 */
export const ESPESOR_MURO_MM: Record<TipoConstruccion, number> = {
  prefabricada: 100,
  hormigon: 200,
};

/**
 * Largo útil de un módulo de contenedor de 40 pies, en mm. La sala de
 * referencia son 3 módulos: 3 × 12,19 = 36,56 m, que es exactamente su largo.
 */
export const MODULO_CONTENEDOR_MM = 12187;

/**
 * Holguras de trabajo del NEC Art. 110.26(A)(1), en mm, para tensión a tierra
 * de 151 a 600 V.
 *
 *   Condición 1  partes vivas de un lado, nada del otro          900
 *   Condición 2  partes vivas de un lado, superficie a tierra    1000
 *   Condición 3  partes vivas a ambos lados                      1200
 *
 * OJO: esto es del Capítulo 1, que no está en el libro de tablas cargado —
 * el que se cargó es el Capítulo 3. Van acá como valores por defecto
 * editables, no como tabla consultada: si el proyecto se rige por otra
 * edición o por una especificación propia, se cambian en la entrada.
 */
export const HOLGURA_NEC_MM = {
  condicion1: 900,
  condicion2: 1000,
  condicion3: 1200,
} as const;

/**
 * Condición de trabajo que impone cada disposición.
 *
 * Dos filas enfrentadas dejan partes vivas a ambos lados del pasillo, que es
 * la condición 3. No es un detalle: son 200 mm más de pasillo que contra muro,
 * y con 30 m de fila eso son 6 m² de sala.
 */
export function condicionDe(disposicion: Disposicion): 1 | 2 | 3 {
  return GEOMETRIA[disposicion].condicion;
}

/** Filas de tableros que implica cada disposición. */
export function filasDe(disposicion: Disposicion): number {
  return GEOMETRIA[disposicion].filas;
}

/** Holgura frontal por defecto según la disposición, en mm. */
export function holguraFrontalPorDefecto(disposicion: Disposicion): number {
  return condicionDe(disposicion) === 3 ? HOLGURA_NEC_MM.condicion3 : HOLGURA_NEC_MM.condicion2;
}

export interface EquipoEnSala {
  nombre: string;
  anchoMm: number;
  profundidadMm: number;
  cantidad: number;
  /**
   * Montado en muro exterior, tipo mochila: no ocupa piso ni pide holgura
   * frontal adentro. Los 9 HVAC de la sala de referencia son 11,4 m de frente
   * que no consumen planta.
   */
  enMuro?: boolean;
}

export interface CriteriosSala {
  disposicion: Disposicion;
  /** Espacio de trabajo al frente de los tableros, mm. */
  holguraFrontalMm: number;
  /** Acceso por detrás; 0 si van contra muro. */
  holguraPosteriorMm: number;
  /** Espacio libre en cada extremo de la fila, mm. */
  holguraLateralMm: number;
  construccion: TipoConstruccion;
  /** Espesor de muro, mm. Solo afecta las medidas exteriores. */
  espesorMuroMm: number;
  /**
   * Ajustar el largo interior al siguiente múltiplo de módulo de contenedor.
   * Solo tiene sentido en prefabricada: en hormigón la planta es libre.
   */
  modularContenedor: boolean;
  /**
   * Hay equipo de 1.200 A o más y sobre 1,8 m de ancho. Dispara el requisito
   * de doble acceso del Art. 110.26(C)(2).
   */
  equipoSobre1200A: boolean;
}

export const CRITERIOS_POR_DEFECTO: CriteriosSala = {
  disposicion: 'unaFila',
  holguraFrontalMm: HOLGURA_NEC_MM.condicion2,
  holguraPosteriorMm: 0,
  holguraLateralMm: 600,
  construccion: 'prefabricada',
  espesorMuroMm: ESPESOR_MURO_MM.prefabricada,
  modularContenedor: false,
  equipoSobre1200A: false,
};

/**
 * Dimensiones típicas de cada tipo de equipo, tomadas de la sala real.
 * El ancho es el de la unidad más frecuente y la profundidad la mayor del
 * tipo: es la que manda para el ancho de la sala.
 */
export function dimensionesTipicas(tipo: TipoEquipoSala): { anchoMm: number; profundidadMm: number } | undefined {
  const items = EQUIPOS_REFERENCIA.filter(
    (e): e is EquipoSala & { anchoMm: number; profundidadMm: number } =>
      e.tipo === tipo && e.anchoMm != null && e.profundidadMm != null,
  );
  if (items.length === 0) return undefined;
  const anchos = items.map((e) => e.anchoMm).sort((a, b) => a - b);
  return {
    anchoMm: anchos[Math.floor(anchos.length / 2)]!,
    profundidadMm: Math.max(...items.map((e) => e.profundidadMm)),
  };
}

export interface FilaSala {
  frenteMm: number;
  profundidadMm: number;
  equipos: readonly string[];
}

export interface DimensionSala {
  /** Interior libre: es lo que hay que cumplir con equipos y holguras. */
  largoM: number;
  anchoM: number;
  superficieM2: number;
  /** Exterior, con muros. Es lo que ocupa la sala en el terreno. */
  largoExteriorM: number;
  anchoExteriorM: number;
  superficieExteriorM2: number;
  /** Huella de los equipos que apoyan en piso, m². */
  huellaM2: number;
  /** Fracción de la sala ocupada por esa huella. */
  ocupacionPct: number;
  filas: readonly FilaSala[];
  condicionNec: 1 | 2 | 3;
  /** Frente total montado en muro, que no consume planta. */
  frenteEnMuroMm: number;
  /** Módulos de contenedor, si se pidió modular. */
  modulos?: number;
  /** Milímetros que agregó el redondeo a módulos. */
  holguraPorModulacionMm?: number;
  /** Art. 110.26(C)(2): la sala necesita dos accesos. */
  requiereDobleAcceso: boolean;
}

/**
 * Reparte los equipos en `n` filas equilibrando el frente.
 *
 * Es un reparto codicioso: se ordena de mayor a menor y cada equipo va a la
 * fila más corta. No busca el óptimo — el largo de la sala lo fija la fila más
 * larga, y con tableros de anchos dispares el óptimo exacto no cambia el
 * resultado en más de un ancho de columna.
 */
function repartirEnFilas(
  unidades: readonly { nombre: string; anchoMm: number; profundidadMm: number }[],
  n: number,
): FilaSala[] {
  const filas: FilaSala[] = Array.from({ length: n }, () => ({
    frenteMm: 0, profundidadMm: 0, equipos: [],
  }));
  const orden = [...unidades].sort((a, b) => b.anchoMm - a.anchoMm);
  for (const u of orden) {
    let i = 0;
    for (let k = 1; k < n; k++) if (filas[k]!.frenteMm < filas[i]!.frenteMm) i = k;
    const f = filas[i]!;
    filas[i] = {
      frenteMm: f.frenteMm + u.anchoMm,
      profundidadMm: Math.max(f.profundidadMm, u.profundidadMm),
      equipos: [...f.equipos, u.nombre],
    };
  }
  return filas;
}

/**
 * Estima largo y ancho de la sala.
 *
 * `undefined` si no hay ningún equipo que apoye en piso: una sala con solo
 * equipos de muro no tiene planta que dimensionar por este camino.
 */
export function dimensionarSala(
  equipos: readonly EquipoEnSala[],
  criterios: CriteriosSala = CRITERIOS_POR_DEFECTO,
): DimensionSala | undefined {
  const unidades: { nombre: string; anchoMm: number; profundidadMm: number }[] = [];
  let frenteEnMuroMm = 0;
  for (const e of equipos) {
    const n = Math.max(0, Math.round(e.cantidad));
    if (e.enMuro) { frenteEnMuroMm += e.anchoMm * n; continue; }
    for (let i = 0; i < n; i++) {
      unidades.push({ nombre: e.nombre, anchoMm: e.anchoMm, profundidadMm: e.profundidadMm });
    }
  }
  if (unidades.length === 0) return undefined;

  const {
    disposicion, holguraFrontalMm, holguraPosteriorMm, holguraLateralMm,
    espesorMuroMm, modularContenedor, equipoSobre1200A,
  } = criterios;
  const geo = GEOMETRIA[disposicion];

  const filas: FilaSala[] = geo.filas === 1
    ? [{
        frenteMm: unidades.reduce((s, u) => s + u.anchoMm, 0),
        profundidadMm: Math.max(...unidades.map((u) => u.profundidadMm)),
        equipos: unidades.map((u) => u.nombre),
      }]
    : repartirEnFilas(unidades, geo.filas);

  const largoNetoMm = Math.max(...filas.map((f) => f.frenteMm)) + 2 * holguraLateralMm;

  // El ancho es la sección transversal: las profundidades de todas las filas,
  // más un pasillo de trabajo por cada uno que exija la disposición, más la
  // holgura posterior de las filas que dan la espalda a un muro.
  const anchoMm = filas.reduce((s, f) => s + f.profundidadMm, 0)
    + geo.pasillos * holguraFrontalMm
    + geo.espaldas * holguraPosteriorMm;

  // La modulación solo tiene sentido en prefabricada: el largo se lleva al
  // siguiente múltiplo de módulo de contenedor, y eso deja holgura de sobra.
  let largoMm = largoNetoMm;
  let modulos: number | undefined;
  let holguraPorModulacionMm: number | undefined;
  if (modularContenedor) {
    modulos = Math.ceil(largoNetoMm / MODULO_CONTENEDOR_MM);
    largoMm = modulos * MODULO_CONTENEDOR_MM;
    holguraPorModulacionMm = largoMm - largoNetoMm;
  }

  const largoM = largoMm / 1000;
  const anchoM = anchoMm / 1000;
  const superficieM2 = largoM * anchoM;
  const huellaM2 = unidades.reduce((s, u) => s + (u.anchoMm / 1000) * (u.profundidadMm / 1000), 0);

  const largoExteriorM = (largoMm + 2 * espesorMuroMm) / 1000;
  const anchoExteriorM = (anchoMm + 2 * espesorMuroMm) / 1000;

  return {
    largoM,
    anchoM,
    superficieM2,
    largoExteriorM,
    anchoExteriorM,
    superficieExteriorM2: largoExteriorM * anchoExteriorM,
    huellaM2,
    ocupacionPct: (huellaM2 / superficieM2) * 100,
    filas,
    condicionNec: geo.condicion,
    frenteEnMuroMm,
    ...(modulos != null ? { modulos, holguraPorModulacionMm } : {}),
    requiereDobleAcceso: equipoSobre1200A,
  };
}
