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
 */
export type Disposicion = 'unaFila' | 'dosFilasEnfrentadas' | 'dosFilasEspalda';

export const DISPOSICION_LABEL: Record<Disposicion, string> = {
  unaFila: 'Una fila contra muro',
  dosFilasEnfrentadas: 'Dos filas enfrentadas',
  dosFilasEspalda: 'Dos filas espalda con espalda',
};

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
  return disposicion === 'dosFilasEnfrentadas' ? 3 : 2;
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
}

export const CRITERIOS_POR_DEFECTO: CriteriosSala = {
  disposicion: 'unaFila',
  holguraFrontalMm: HOLGURA_NEC_MM.condicion2,
  holguraPosteriorMm: 0,
  holguraLateralMm: 600,
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
  largoM: number;
  anchoM: number;
  superficieM2: number;
  /** Huella de los equipos que apoyan en piso, m². */
  huellaM2: number;
  /** Fracción de la sala ocupada por esa huella. */
  ocupacionPct: number;
  filas: readonly FilaSala[];
  condicionNec: 1 | 2 | 3;
  /** Frente total montado en muro, que no consume planta. */
  frenteEnMuroMm: number;
}

/**
 * Reparte los equipos en dos filas equilibrando el frente.
 *
 * Es un reparto codicioso: se ordena de mayor a menor y cada equipo va a la
 * fila más corta. No busca el óptimo — el largo de la sala lo fija la fila más
 * larga, y con tableros de anchos dispares el óptimo exacto no cambia el
 * resultado en más de un ancho de columna.
 */
function repartirEnDos(unidades: readonly { nombre: string; anchoMm: number; profundidadMm: number }[]): [FilaSala, FilaSala] {
  const filas: [FilaSala, FilaSala] = [
    { frenteMm: 0, profundidadMm: 0, equipos: [] },
    { frenteMm: 0, profundidadMm: 0, equipos: [] },
  ];
  const orden = [...unidades].sort((a, b) => b.anchoMm - a.anchoMm);
  for (const u of orden) {
    const i = filas[0].frenteMm <= filas[1].frenteMm ? 0 : 1;
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

  const { disposicion, holguraFrontalMm, holguraPosteriorMm, holguraLateralMm } = criterios;
  const filas: FilaSala[] = disposicion === 'unaFila'
    ? [{
        frenteMm: unidades.reduce((s, u) => s + u.anchoMm, 0),
        profundidadMm: Math.max(...unidades.map((u) => u.profundidadMm)),
        equipos: unidades.map((u) => u.nombre),
      }]
    : repartirEnDos(unidades);

  const largoMm = Math.max(...filas.map((f) => f.frenteMm)) + 2 * holguraLateralMm;

  let anchoMm: number;
  if (disposicion === 'unaFila') {
    anchoMm = filas[0]!.profundidadMm + holguraFrontalMm + holguraPosteriorMm;
  } else if (disposicion === 'dosFilasEnfrentadas') {
    // Un solo pasillo compartido: el espacio de trabajo de las dos filas es el
    // mismo pasillo, no se suman. Detrás de cada fila va su holgura posterior.
    anchoMm = filas[0]!.profundidadMm + filas[1]!.profundidadMm
      + holguraFrontalMm + 2 * holguraPosteriorMm;
  } else {
    // Espalda con espalda: los frentes miran hacia afuera, así que hay dos
    // pasillos de trabajo, uno por lado.
    anchoMm = filas[0]!.profundidadMm + filas[1]!.profundidadMm + 2 * holguraFrontalMm;
  }

  const largoM = largoMm / 1000;
  const anchoM = anchoMm / 1000;
  const superficieM2 = largoM * anchoM;
  const huellaM2 = unidades.reduce((s, u) => s + (u.anchoMm / 1000) * (u.profundidadMm / 1000), 0);

  return {
    largoM,
    anchoM,
    superficieM2,
    huellaM2,
    ocupacionPct: (huellaM2 / superficieM2) * 100,
    filas,
    condicionNec: condicionDe(disposicion),
    frenteEnMuroMm,
  };
}
