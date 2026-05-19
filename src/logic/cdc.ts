import pragmaData from '../data/iec/pragma.json';
import type {
  AsignacionCdc,
  Carga,
  Cofre,
  CofreCatalogo,
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
  /** Módulos reservados al inicio de cada fila (p. ej. 2 para un diferencial cabecera). */
  reservaPorFila: number;
}

export const OPCIONES_CDC_DEFAULT: OpcionesCdc = {
  modulosPorFila: 18,
  reservaPorFila: 0,
};

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
): ResultadoCdc {
  const modPorFila = opts.modulosPorFila;
  const reserva = clampInt(opts.reservaPorFila, 0, modPorFila - 1);
  const utilPorFila = modPorFila - reserva;
  if (utilPorFila <= 0) {
    return {
      asignaciones: [],
      cargasSinAsignar: [...cargas],
      motivo: 'Reserva por fila supera el ancho de la fila.',
    };
  }

  const asignaciones: AsignacionCdc[] = [];
  const cargasSinAsignar: Carga[] = [];

  for (const c of cargas) {
    const proteccion = sugerirProteccionIc60(c);
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

  const filas = empaquetarEnFilas(asignaciones, modPorFila, reserva);
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
  reserva: number,
): FilaDin[] {
  const utilPorFila = modulosPorFila - reserva;
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
        reserva,
        modulosLibres: utilPorFila,
      };
      filas.push(destino);
    }
    destino.modulos.push(a);
    destino.modulosLibres -= a.modulosDin;
  }

  return filas;
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
