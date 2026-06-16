import pragmaData from '../data/iec/pragma.json';
import type {
  AsignacionCdc,
  Carga,
  Cofre,
  CofreCatalogo,
  DiferencialCircuito,
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
  /** Módulos reservados libres al inicio de cada fila. */
  reservaPorFila: number;
  /**
   * Si está activo, asigna un diferencial individual (Vigi/RCBO) a cada
   * circuito — el modelo más estricto, exigido por RIC N°06 y preferido en
   * proyectos industriales por su selectividad (una falla solo aísla su
   * propio circuito). Cada circuito ocupa 1 módulo extra (bloque Vigi).
   */
  diferencialPorCircuito: boolean;
  /** Sensibilidad del diferencial en mA (RIC N°06 estándar: 30 mA). */
  sensibilidadDiferencialMa: number;
  /** Tipo de RCD: AC (default) o A (cargas con DC). */
  tipoDiferencial: 'AC' | 'A';
}

export const OPCIONES_CDC_DEFAULT: OpcionesCdc = {
  modulosPorFila: 18,
  reservaPorFila: 0,
  diferencialPorCircuito: true,
  sensibilidadDiferencialMa: 30,
  tipoDiferencial: 'AC',
};

/**
 * Módulos extra que añade el bloque Vigi/RCD al breaker. Schneider iC60 Vigi
 * y equivalentes ABB Tmax/Chint ocupan 2 módulos DIN de 18 mm. Resultado:
 *  - 1F (1+N): breaker 1 mód. + Vigi 2 mód. = 3 mód.
 *  - 3F (3+N): breaker 3 mód. + Vigi 2 mód. = 5 mód.
 */
const MODULOS_VIGI_EXTRA = 2;

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
  const utilPorFila = modPorFila - reserva;
  if (utilPorFila <= 0) {
    return {
      asignaciones: [],
      cargasSinAsignar: [...cargas],
      motivo: 'Reserva por fila supera el ancho de la fila.',
    };
  }

  const diActivo = opts.diferencialPorCircuito;
  const diferencialBase: DiferencialCircuito | undefined = diActivo
    ? {
        sensibilidadMa: opts.sensibilidadDiferencialMa,
        tipo: opts.tipoDiferencial,
        modulosExtra: MODULOS_VIGI_EXTRA,
      }
    : undefined;

  const asignaciones: AsignacionCdc[] = [];
  const cargasSinAsignar: Carga[] = [];

  for (const c of cargas) {
    const proteccion = sugerirProteccionIc60(c, factorDerrateo);
    const I = corrienteDiseno(c);
    if (!proteccion || I <= 0) {
      cargasSinAsignar.push(c);
      continue;
    }
    const modulosBreaker = proteccion.modulosDin ?? (proteccion.polos === 3 ? 3 : 1);
    // RIC N°06: cada circuito lleva su propio RCD (Vigi/RCBO) → +1 módulo
    // del bloque Vigi.
    const modulosDin = modulosBreaker + (diActivo ? MODULOS_VIGI_EXTRA : 0);
    if (modulosDin > utilPorFila) {
      cargasSinAsignar.push(c);
      continue;
    }
    asignaciones.push({
      carga: c,
      proteccion,
      modulosDin,
      corrienteDisenoA: I,
      ...(diferencialBase ? { diferencial: { ...diferencialBase } } : {}),
    });
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
