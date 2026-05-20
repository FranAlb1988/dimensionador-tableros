import motoresData from '../data/nema/motores.json';
import breakersFdrData from '../data/nema/breakers-fdr.json';
import breakersElectronicData from '../data/nema/breakers-electronic.json';
import barrasData from '../data/nema/barras.json';
import envolventeData from '../data/nema/envolvente-ccm.json';
import type {
  AsignacionCcmNema,
  BarraNemaCatalogo,
  BreakerNemaFrame,
  BreakerNemaRating,
  BreakerNemaSeleccionado,
  Carga,
  ColumnaCcmNema,
  EnvolventeCcmNemaCatalogo,
  MotorNemaCatalogo,
  TableroCcmNema,
} from '../types';
import { corrienteDiseno } from './corriente';
import { KW_POR_HP } from '../util/potencia';

const MOTORES: readonly MotorNemaCatalogo[] = (motoresData.filas as MotorNemaCatalogo[])
  .toSorted((a, b) => a.hp - b.hp);
const FDR_FRAMES: readonly BreakerNemaFrame[] = (breakersFdrData.frames as BreakerNemaFrame[])
  .toSorted((a, b) => a.frameAF - b.frameAF);
const FDR_RATINGS: readonly BreakerNemaRating[] = (breakersFdrData.ratings as BreakerNemaRating[])
  .toSorted((a, b) => (a.tripA ?? 0) - (b.tripA ?? 0));
const ELEC_FRAMES: readonly BreakerNemaFrame[] = (breakersElectronicData.frames as BreakerNemaFrame[])
  .toSorted((a, b) => a.frameAF - b.frameAF);
const ELEC_RATINGS: readonly BreakerNemaRating[] = (breakersElectronicData.ratings as BreakerNemaRating[])
  .toSorted((a, b) => (a.settingA ?? 0) - (b.settingA ?? 0));
const BARRAS: readonly BarraNemaCatalogo[] = (barrasData.barras as BarraNemaCatalogo[])
  .toSorted((a, b) => a.capacidadA - b.capacidadA);
export const ENVOLVENTE_CCM_NEMA: EnvolventeCcmNemaCatalogo = envolventeData as EnvolventeCcmNemaCatalogo;

const UMBRAL_ELECTRONIC_AF = 400;

export interface OverflowBarra {
  corrienteTotalA: number;
  maxFlcA: number;
  idsOverflow: string[];
}

export interface ResultadoCcmNema {
  asignaciones: AsignacionCcmNema[];
  cargasSinAsignar: Carga[];
  tablero?: TableroCcmNema;
  motivo?: string;
  overflowBarra?: OverflowBarra;
}

/**
 * Dimensionamiento CCM convención NEMA. Tabla-driven (no fórmulas):
 *  - Motor → fila de la tabla por HP (contactor NEMA, MCP, espacios X, versión).
 *  - Alimentador → breaker FDR (≤400AF) o electronic (>400AF) por corriente.
 *  - Bin-pack en columnas de 12X (X=6") — estándar NEMA CCM (Square D Model 6, GE 8000…).
 *  - Barra principal por FLC total.
 */
export function dimensionarCcmNema(cargas: readonly Carga[]): ResultadoCcmNema {
  const asignaciones: AsignacionCcmNema[] = [];
  const cargasSinAsignar: Carga[] = [];

  for (const c of cargas) {
    const a = asignar(c);
    if (a) asignaciones.push(a);
    else cargasSinAsignar.push(c);
  }

  if (asignaciones.length === 0) {
    return { asignaciones, cargasSinAsignar, motivo: 'Sin asignaciones válidas para NEMA.' };
  }

  const columnas = empaquetarEnColumnas(asignaciones, ENVOLVENTE_CCM_NEMA.altoUtilXEspacios);
  const corrienteTotalA = asignaciones.reduce((s, a) => s + a.corrienteDisenoA, 0);
  const barra = sugerirBarraNema(corrienteTotalA);
  if (!barra) {
    const maxFlcA = Math.max(...BARRAS.map((b) => b.flcMax));
    const idsOverflow = calcularIdsOverflow(asignaciones, maxFlcA);
    return {
      asignaciones, cargasSinAsignar,
      motivo: `Sin barra principal NEMA en catálogo para FLC ${corrienteTotalA.toFixed(0)} A.`,
      overflowBarra: { corrienteTotalA, maxFlcA, idsOverflow },
    };
  }

  const tablero: TableroCcmNema = {
    norma: 'NEMA', tipo: 'CCM',
    columnas,
    corrienteTotalA,
    barra,
    altoTotalMm: ENVOLVENTE_CCM_NEMA.altoTotalMm,
    anchoTotalMm: columnas.length * ENVOLVENTE_CCM_NEMA.anchoColumnaMm,
    profundidadTotalMm: ENVOLVENTE_CCM_NEMA.profundidadMm,
    xMm: ENVOLVENTE_CCM_NEMA.xMm,
  };

  return { asignaciones, cargasSinAsignar, tablero };
}

function asignar(c: Carga): AsignacionCcmNema | undefined {
  if (c.tipo === 'motor') return asignarMotor(c);
  return asignarAlimentador(c);
}

function asignarMotor(c: Carga): AsignacionCcmNema | undefined {
  const hp = hpDeCarga(c);
  if (hp == null || hp <= 0) return undefined;
  const motor = MOTORES.find((m) => m.hp >= hp);
  if (!motor) return undefined;
  // FLA del motor del catálogo (o la corriente del usuario si la dio).
  const corriente = c.corrienteA ?? motor.flaA ?? corrienteDiseno(c);
  return {
    carga: c,
    motor,
    espaciosX: motor.espaciosX,
    version: motor.version,
    corrienteDisenoA: corriente * (c.factorServicio || 1),
  };
}

function asignarAlimentador(c: Carga): AsignacionCcmNema | undefined {
  const I = corrienteDiseno(c);
  const Imin = Math.max(I, c.corrienteProteccionA ?? 0);
  if (Imin <= 0) return undefined;
  const breaker = sugerirBreakerNema(Imin);
  if (!breaker) return undefined;
  return {
    carga: c,
    breaker,
    espaciosX: breaker.espaciosX,
    version: breaker.frameAF >= UMBRAL_ELECTRONIC_AF ? 'fijo' : 'extraible',
    corrienteDisenoA: I,
  };
}

/** Convierte la potencia de la carga a HP. Si no hay potencia, devuelve null. */
function hpDeCarga(c: Carga): number | null {
  if (typeof c.potenciaKw === 'number' && c.potenciaKw > 0) {
    return c.potenciaKw / KW_POR_HP;
  }
  return null;
}

/** Selecciona el breaker NEMA mínimo con rating ≥ I (FDR si Imin ≤ 400AF, electronic en otro caso). */
export function sugerirBreakerNema(Imin: number): BreakerNemaSeleccionado | undefined {
  if (Imin <= UMBRAL_ELECTRONIC_AF) {
    const r = FDR_RATINGS.find((x) => (x.tripA ?? 0) >= Imin);
    if (r && r.tripA != null && r.trip) {
      const f = FDR_FRAMES.find((x) => x.frameAF === r.frameAF);
      if (f) {
        return {
          frameAF: r.frameAF, rating: r.trip, ratingA: r.tripA,
          ratingTipo: 'AT', espaciosX: f.espaciosX, icuRange: f.icuRange,
        };
      }
    }
  }
  const r = ELEC_RATINGS.find((x) => (x.settingA ?? 0) >= Imin);
  if (r && r.settingA != null && r.setting) {
    const f = ELEC_FRAMES.find((x) => x.frameAF === r.frameAF);
    if (f) {
      return {
        frameAF: r.frameAF, rating: r.setting, ratingA: r.settingA,
        ratingTipo: 'AS', espaciosX: f.espaciosX, icuRange: f.icuRange,
      };
    }
  }
  return undefined;
}

/**
 * Selecciona la barra cuyo intervalo FLC contiene el valor.
 * El catálogo del Excel usa rangos explícitos (no "capacidad ≥ FLC") para incorporar el
 * factor de servicio típico de la barra.
 */
export function sugerirBarraNema(flc: number): BarraNemaCatalogo | undefined {
  return BARRAS.find((b) => flc >= b.flcMin && flc <= b.flcMax);
}

/**
 * Devuelve los IDs de las cargas que no caben dentro del límite maxFlcA.
 * Procesa en orden original: acumula hasta el límite y el resto es overflow.
 */
function calcularIdsOverflow(asignaciones: AsignacionCcmNema[], maxFlcA: number): string[] {
  let acumulado = 0;
  const overflow: string[] = [];
  for (const a of asignaciones) {
    if (acumulado + a.corrienteDisenoA <= maxFlcA) {
      acumulado += a.corrienteDisenoA;
    } else {
      overflow.push(a.carga.id);
    }
  }
  return overflow;
}

/** Bin-pack First-Fit Decreasing por espacios X. */
function empaquetarEnColumnas(asignaciones: AsignacionCcmNema[], altoUtilX: number): ColumnaCcmNema[] {
  const orden = [...asignaciones].sort((a, b) => b.espaciosX - a.espaciosX);
  const columnas: ColumnaCcmNema[] = [];
  for (const a of orden) {
    if (a.espaciosX > altoUtilX) {
      throw new Error(`Asignación ${a.carga.id} ocupa ${a.espaciosX}X, supera la columna (${altoUtilX}X)`);
    }
    let destino = columnas.find((c) => c.espaciosLibres >= a.espaciosX);
    if (!destino) {
      destino = {
        indice: columnas.length + 1,
        altoUtilXEspacios: altoUtilX,
        asignaciones: [],
        espaciosUsados: 0,
        espaciosLibres: altoUtilX,
      };
      columnas.push(destino);
    }
    destino.asignaciones.push(a);
    destino.espaciosUsados += a.espaciosX;
    destino.espaciosLibres -= a.espaciosX;
  }
  return columnas;
}

export const MOTORES_NEMA = MOTORES;
export const FDR_FRAMES_NEMA = FDR_FRAMES;
export const ELEC_FRAMES_NEMA = ELEC_FRAMES;
