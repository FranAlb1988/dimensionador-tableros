// Peso de tableros y carga de piso de la sala.
//
// Los datos vienen del listado de equipos de la sala eléctrica 03300-SEL-001
// (PRECISIÓN / CODELCO Rajo Inca), que publica dimensiones y peso REAL de cada
// tablero montado. Es la pieza que faltaba: sumar el peso del aparellaje de
// catálogo da un orden de magnitud menos que el tablero real, porque la
// envolvente, las barras y el cableado son casi todo el peso. Un CCM con
// 19 kg de interruptores y contactores pesa cerca de 2.000 kg armado.
//
// Un matiz que conviene tener claro, porque es fácil equivocarse: la
// sobrecarga de uso de 1000 kg/m² del chasis es un criterio PROMEDIO DE SALA,
// no un límite por huella de tablero. En la sala de referencia el promedio es
// 398 kgf/m², mientras que casi todos los tableros, sobre su propia huella,
// están entre 730 y 2.344 kgf/m². El piso reparte esa concentración.

import datos from '../data/salas/equipos-referencia.json';

/** Tipo de equipo del listado de referencia. */
export type TipoEquipoSala =
  | 'switchgear' | 'cdc' | 'ccm' | 'vdfBt' | 'vdfMt' | 'trafoSeco'
  | 'ups' | 'cargador' | 'baterias' | 'tablero' | 'gabinete' | 'extincion'
  | 'hvac' | 'presurizador';

export interface EquipoSala {
  tag: string;
  descripcion: string;
  tipo: TipoEquipoSala;
  anchoMm?: number;
  profundidadMm?: number;
  altoMm?: number;
  pesoKg: number;
}

export interface SalaReferencia {
  tag: string;
  proyecto: string;
  proveedor: string;
  modulos: number;
  largoM: number;
  anchoM: number;
  pesoEquiposKgf: number;
  cargaPromedioKgM2: number;
  sobrecargaUsoDisenoKgM2: number;
  sobrecargaTechoKgM2: number;
  nieveKgM2: number;
  vientoKgM2: number;
  cargaPermanenteTonf: number;
  pesoSismicoTonf: number;
  fuente: string;
}

export const SALA_REFERENCIA = datos.sala as SalaReferencia;
export const EQUIPOS_REFERENCIA = datos.equipos as EquipoSala[];

/**
 * Sobrecarga de uso de diseño del piso, en kg/m². Es el promedio admisible
 * sobre la superficie de la sala, no un límite por huella de tablero.
 * Requerimiento de cliente en el proyecto de referencia, no una norma.
 */
export const SOBRECARGA_PISO_DISENO_KGM2 = SALA_REFERENCIA.sobrecargaUsoDisenoKgM2;

/** Huella en m² de un equipo del listado, o undefined si no declara medidas. */
export function huellaM2(e: Pick<EquipoSala, 'anchoMm' | 'profundidadMm'>): number | undefined {
  if (!(e.anchoMm != null && e.anchoMm > 0)) return undefined;
  if (!(e.profundidadMm != null && e.profundidadMm > 0)) return undefined;
  return (e.anchoMm / 1000) * (e.profundidadMm / 1000);
}

/**
 * Peso específico por tipo de tablero, en kg por m² de huella.
 * Se calcula del listado real: es el promedio ponderado por huella de todos
 * los equipos del tipo, que es lo mismo que peso total / huella total.
 */
export function pesoEspecificoKgM2(tipo: TipoEquipoSala): number | undefined {
  let peso = 0;
  let area = 0;
  for (const e of EQUIPOS_REFERENCIA) {
    if (e.tipo !== tipo) continue;
    const a = huellaM2(e);
    if (a == null) continue;
    peso += e.pesoKg;
    area += a;
  }
  return area > 0 ? peso / area : undefined;
}

/** Tipos con peso específico calculable. */
export function tiposConPeso(): TipoEquipoSala[] {
  return [...new Set(EQUIPOS_REFERENCIA.map((e) => e.tipo))]
    .filter((t) => pesoEspecificoKgM2(t) != null)
    .sort();
}

export interface PesoEstimado {
  pesoKg: number;
  huellaM2: number;
  /** Peso específico usado, kg/m². */
  especificoKgM2: number;
  tipo: TipoEquipoSala;
}

/**
 * Peso estimado de un tablero a partir de su huella y su tipo.
 *
 * Es una estimación por peso específico, no un dato de catálogo: sirve para
 * la carga de piso y el izaje, no para una orden de compra. La dispersión
 * dentro de un mismo tipo es real — dos CCM del listado difieren entre 879 y
 * 2.344 kgf/m² según cuán cargada esté la columna.
 */
export function pesoEstimadoTablero(
  tipo: TipoEquipoSala,
  anchoMm: number,
  profundidadMm: number,
): PesoEstimado | undefined {
  const area = huellaM2({ anchoMm, profundidadMm });
  if (area == null) return undefined;
  const especifico = pesoEspecificoKgM2(tipo);
  if (especifico == null) return undefined;
  return { pesoKg: especifico * area, huellaM2: area, especificoKgM2: especifico, tipo };
}

export interface CargaPisoSala {
  /** Peso total de los equipos, kg. */
  pesoTotalKg: number;
  /** Superficie de la sala, m². */
  superficieM2: number;
  /** Carga promedio sobre la sala, kgf/m². */
  promedioKgM2: number;
  /** Porcentaje de la sobrecarga de uso de diseño. */
  usoDisenoPct: number;
  excede: boolean;
}

/**
 * Carga de piso de la sala: peso total de los equipos repartido sobre su
 * superficie, que es la forma en que el criterio de 1000 kg/m² se aplica.
 */
export function cargaPisoSala(
  pesosKg: readonly number[],
  superficieM2: number,
  sobrecargaDisenoKgM2 = SOBRECARGA_PISO_DISENO_KGM2,
): CargaPisoSala | undefined {
  if (!(superficieM2 > 0)) return undefined;
  const pesoTotalKg = pesosKg.reduce((s, p) => s + (p > 0 ? p : 0), 0);
  const promedioKgM2 = pesoTotalKg / superficieM2;
  return {
    pesoTotalKg,
    superficieM2,
    promedioKgM2,
    usoDisenoPct: (promedioKgM2 / sobrecargaDisenoKgM2) * 100,
    excede: promedioKgM2 > sobrecargaDisenoKgM2,
  };
}

/**
 * Concentración de un tablero sobre su propia huella, kgf/m².
 * Se informa como dato del chasis local; no se compara contra la sobrecarga
 * de sala, que es un promedio y no aplica a una huella individual.
 */
export function concentracionKgM2(pesoKg: number, anchoMm: number, profundidadMm: number): number | undefined {
  const area = huellaM2({ anchoMm, profundidadMm });
  if (area == null || !(pesoKg >= 0)) return undefined;
  return pesoKg / area;
}
