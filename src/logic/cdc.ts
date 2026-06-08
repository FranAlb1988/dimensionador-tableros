import pragmaData from '../data/iec/pragma.json';
import type {
  AsignacionCdc,
  Carga,
  Cofre,
  CofreCatalogo,
  DiferencialCabecera,
  FilaDin,
  TableroCdc,
} from '../types';
import { corrienteDiseno } from './corriente';
import { sugerirProteccionIc60 } from './proteccion';

const COFRES: readonly CofreCatalogo[] = (pragmaData.cofres as CofreCatalogo[]);

export const COFRES_DISPONIBLES = COFRES;

export interface OpcionesCdc {
  /** Módulos por fila preferidos (12, 18 o 24). El cofre elegido respeta este ancho. */
  modulosPorFila: number;
  /** Módulos reservados libres al inicio de cada fila (adicionales al diferencial). */
  reservaPorFila: number;
  /**
   * Si está activo, agrega un diferencial (RCD) de cabecera a cada fila DIN
   * — exigido por RIC N°06 para todos los circuitos de servicio.
   */
  diferencialPorFila: boolean;
  /** Sensibilidad del diferencial en mA (RIC N°06 estándar: 30 mA). */
  sensibilidadDiferencialMa: number;
  /** Tipo de RCD: AC (default) o A (cargas con DC). */
  tipoDiferencial: 'AC' | 'A';
}

export const OPCIONES_CDC_DEFAULT: OpcionesCdc = {
  modulosPorFila: 18,
  reservaPorFila: 0,
  diferencialPorFila: true,
  sensibilidadDiferencialMa: 30,
  tipoDiferencial: 'AC',
};

/** Módulos DIN que ocupa un RCD según polaridad (Schneider iID estándar). */
function modulosRcd(polos: 2 | 4): number {
  return polos === 2 ? 2 : 4;
}

/**
 * In nominal del RCD por fila — se elige la primera escala estándar
 * (25/40/63/100 A) que cubra la suma de In de los circuitos protegidos.
 */
const ESCALA_RCD_A = [25, 40, 63, 80, 100, 125];
function inRcdParaCircuitos(asignaciones: readonly AsignacionCdc[]): number {
  const sumaIn = asignaciones.reduce((s, a) => s + a.proteccion.inA, 0);
  return ESCALA_RCD_A.find((x) => x >= sumaIn) ?? ESCALA_RCD_A[ESCALA_RCD_A.length - 1]!;
}

export interface ResultadoCdc {
  asignaciones: AsignacionCdc[];
  cargasSinAsignar: Carga[];
  tablero?: TableroCdc;
  motivo?: string;
}

/**
 * Punto de entrada para CDC Pragma.
 *  1. Para cada carga sugiere iC60 (curva C, polos según fases).
 *  2. Cada interruptor ocupa N módulos DIN (1P=1, 3P=3).
 *  3. Bin-pack First-Fit Decreasing en filas de (modulosPorFila − reservaPorFila).
 *  4. Agrupa filas en cofres tomando el cofre Pragma del ancho elegido y filas suficientes.
 */
export function dimensionarCdc(
  cargas: readonly Carga[],
  opts: OpcionesCdc = OPCIONES_CDC_DEFAULT,
  factorDerrateo = 1,
): ResultadoCdc {
  const modPorFila = opts.modulosPorFila;
  const reserva = clampInt(opts.reservaPorFila, 0, modPorFila - 1);
  // Si el diferencial está activo, reservamos 4 módulos al packear (4P, el caso
  // más conservador). Si la fila resulta solo con cargas 1F, lo bajamos a 2P (2
  // módulos) en una segunda pasada.
  const diActivo = opts.diferencialPorFila;
  const modDiReserva = diActivo ? 4 : 0;
  const utilPorFila = modPorFila - reserva - modDiReserva;
  if (utilPorFila <= 0) {
    return {
      asignaciones: [],
      cargasSinAsignar: [...cargas],
      motivo: 'Reserva + diferencial por fila superan el ancho de la fila.',
    };
  }

  const asignaciones: AsignacionCdc[] = [];
  const cargasSinAsignar: Carga[] = [];

  for (const c of cargas) {
    const proteccion = sugerirProteccionIc60(c, factorDerrateo);
    const I = corrienteDiseno(c);
    if (!proteccion || I <= 0) {
      cargasSinAsignar.push(c);
      continue;
    }
    const modulosDin = proteccion.modulosDin ?? (proteccion.polos === 3 ? 3 : 1);
    if (modulosDin > utilPorFila) {
      cargasSinAsignar.push(c);
      continue;
    }
    asignaciones.push({ carga: c, proteccion, modulosDin, corrienteDisenoA: I });
  }

  if (asignaciones.length === 0) {
    return { asignaciones, cargasSinAsignar, motivo: 'Sin asignaciones válidas.' };
  }

  let filas = empaquetarEnFilas(asignaciones, modPorFila, reserva, modDiReserva);
  if (diActivo) {
    filas = asignarDiferencialPorFila(filas, opts);
  }
  const cofres = empaquetarEnCofres(filas, modPorFila);

  if (cofres.length === 0) {
    return {
      asignaciones,
      cargasSinAsignar,
      motivo: `Sin cofre Pragma de ${modPorFila} módulos por fila en catálogo.`,
    };
  }

  const totalModulos = asignaciones.reduce((acc, a) => acc + a.modulosDin, 0);
  const altoTotal = cofres.reduce((acc, c) => Math.max(acc, c.catalogo.altoMm), 0);
  const anchoTotal = cofres.reduce((acc, c) => acc + c.catalogo.anchoMm, 0);
  const profundidadTotal = cofres.reduce((acc, c) => Math.max(acc, c.catalogo.profundidadMm), 0);

  const tablero: TableroCdc = {
    tipo: 'CDC',
    cofres,
    totalAsignaciones: asignaciones.length,
    totalModulos,
    reservaPorFila: reserva,
    altoTotalMm: altoTotal,
    anchoTotalMm: anchoTotal,
    profundidadTotalMm: profundidadTotal,
  };

  return { asignaciones, cargasSinAsignar, tablero };
}

/** First-Fit Decreasing por módulos: ordena de mayor a menor y mete en la primera fila que tenga sitio. */
function empaquetarEnFilas(
  asignaciones: readonly AsignacionCdc[],
  modulosPorFila: number,
  reservaUsuario: number,
  modDiferencialReservado: number,
): FilaDin[] {
  const utilPorFila = modulosPorFila - reservaUsuario - modDiferencialReservado;
  const orden = [...asignaciones].sort((a, b) => b.modulosDin - a.modulosDin);
  const filas: FilaDin[] = [];

  for (const a of orden) {
    let destino = filas.find((f) => f.modulosLibres >= a.modulosDin);
    if (!destino) {
      const idx = filas.length + 1;
      destino = {
        indice: idx,
        modulosTotales: modulosPorFila,
        modulos: [],
        reserva: reservaUsuario,
        modulosLibres: utilPorFila,
      };
      filas.push(destino);
    }
    destino.modulos.push(a);
    destino.modulosLibres -= a.modulosDin;
  }

  return filas;
}

/**
 * Para cada fila ya empaquetada, asigna el diferencial de cabecera. Si la
 * fila no tiene cargas 3F, baja la polaridad a 2P (2 módulos en lugar de 4)
 * y libera 2 módulos extra (suma a `modulosLibres`).
 */
function asignarDiferencialPorFila(filas: FilaDin[], opts: OpcionesCdc): FilaDin[] {
  return filas.map((f) => {
    const tiene3F = f.modulos.some((a) => a.proteccion.polos === 3);
    const polos: 2 | 4 = tiene3F ? 4 : 2;
    const modDi = modulosRcd(polos);
    // Cuando packeamos asumimos 4P (4 mód). Si finalmente es 2P, devolvemos 2
    // módulos al espacio libre.
    const liberados = 4 - modDi;
    const diferencial: DiferencialCabecera = {
      polos,
      modulosDin: modDi,
      sensibilidadMa: opts.sensibilidadDiferencialMa,
      tipo: opts.tipoDiferencial,
      inA: inRcdParaCircuitos(f.modulos),
    };
    return {
      ...f,
      diferencial,
      modulosLibres: f.modulosLibres + liberados,
    };
  });
}

function empaquetarEnCofres(filas: FilaDin[], modulosPorFila: number): Cofre[] {
  const candidatos = COFRES
    .filter((c) => c.modulosPorFila === modulosPorFila)
    .toSorted((a, b) => a.filas - b.filas);
  if (candidatos.length === 0) return [];

  const cofres: Cofre[] = [];
  let restantes = [...filas];
  let cofreIdx = 0;

  while (restantes.length > 0) {
    cofreIdx += 1;
    const necesarias = restantes.length;
    const elegido = candidatos.find((c) => c.filas >= necesarias) ?? candidatos[candidatos.length - 1]!;
    const usadas = Math.min(elegido.filas, restantes.length);
    const filasDelCofre = restantes.slice(0, usadas).map((f, i) => ({ ...f, indice: i + 1 }));
    cofres.push({ indice: cofreIdx, catalogo: elegido, filas: filasDelCofre });
    restantes = restantes.slice(usadas);
  }

  return cofres;
}

function clampInt(x: number, min: number, max: number): number {
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}
