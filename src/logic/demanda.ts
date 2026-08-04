// Estudio de cargas: potencia conectada, demanda máxima, demanda media y
// consumo. Implementa la metodología del documento 5201-ES-600-12000
// (aprobado por SQM), que la app venía sin cubrir: hasta ahora calculaba
// corriente de diseño para dimensionar aparellaje, pero no la demanda del
// conjunto ni la energía.
//
//   FD = demanda máxima / carga conectada
//   FC = demanda media  / demanda máxima
//
//   kW_E   = kW_MEC / Eff            (5.1)   kVA     = kW_E / f.p.     (5.2)
//   kVAR   = √(kVA² − kW_E²)         (5.3)   kW_MÁX  = kW_E · FD       (5.4)
//   kVA_MÁX= kW_MÁX / f.p.           (5.5)   kW_MED  = kW_MÁX · FC     (5.7)
//   kVA_T  = Σ kVA_i                 (5.10)

import type { Carga, TipoCarga } from '../types';
import { COS_PHI_GENERAL, COS_PHI_MOTOR, COS_PHI_VDF, RENDIMIENTO_MOTOR } from './corriente';

const SQRT3 = Math.sqrt(3);

/**
 * Factores de demanda y carga típicos, Tabla 1 del estudio.
 *
 * El estudio publica rangos, no valores únicos. Se toma el punto medio como
 * default editable: es una estimación declarada, no un número de catálogo, y
 * el proyectista lo ajusta por carga cuando conoce el régimen real.
 */
export interface FactoresTipicos {
  descripcion: string;
  fdMin: number;
  fdMax: number;
  fcMin: number;
  fcMax: number;
}

export const FACTORES_TIPICOS: Readonly<Record<TipoCarga, FactoresTipicos>> = {
  motor: { descripcion: 'Equipamiento mecánico', fdMin: 0.3, fdMax: 0.9, fcMin: 0.5, fcMax: 0.9 },
  resistivo: { descripcion: 'Equipamiento eléctrico', fdMin: 0.3, fdMax: 1, fcMin: 0.3, fcMax: 0.9 },
  otro: { descripcion: 'Equipamiento eléctrico', fdMin: 0.3, fdMax: 1, fcMin: 0.3, fcMax: 0.9 },
  iluminacion: { descripcion: 'Alumbrado general', fdMin: 0.9, fdMax: 0.9, fcMin: 0.3, fcMax: 0.9 },
  tomas: { descripcion: 'Equipamiento instrumentación', fdMin: 0.2, fdMax: 0.5, fcMin: 1, fcMax: 1 },
};

const medio = (a: number, b: number) => (a + b) / 2;

/** Factor de demanda aplicable: el de la carga, o el típico de su tipo. */
export function factorDemandaDe(c: Carga): number {
  if (c.standby) return 0;
  if (c.factorDemanda != null && c.factorDemanda >= 0 && c.factorDemanda <= 1) {
    return c.factorDemanda;
  }
  const t = FACTORES_TIPICOS[c.tipo];
  return medio(t.fdMin, t.fdMax);
}

/** Factor de carga aplicable: el de la carga, o el típico de su tipo. */
export function factorCargaDe(c: Carga): number {
  if (c.standby) return 0;
  if (c.factorCarga != null && c.factorCarga >= 0 && c.factorCarga <= 1) {
    return c.factorCarga;
  }
  const t = FACTORES_TIPICOS[c.tipo];
  return medio(t.fcMin, t.fcMax);
}

/**
 * Factor de potencia de la carga, con el criterio del estudio:
 *  - carga con variador → 0,97 inductivo (valor típico de estos equipos)
 *  - motor directo      → 0,85
 *  - alimentador y resto→ 0,85 inductivo, de forma conservadora
 */
export function cosPhiDe(c: Carga): number {
  if (c.cosPhi != null && c.cosPhi > 0 && c.cosPhi <= 1) return c.cosPhi;
  if (c.tipo === 'motor') return c.arranque === 'variador' ? COS_PHI_VDF : COS_PHI_MOTOR;
  return COS_PHI_GENERAL;
}

/** Terna de potencias de un punto del estudio. */
export interface Potencias {
  kva: number;
  kw: number;
  kvar: number;
  /** Corriente equivalente a esa potencia aparente, en A. */
  corrienteA: number;
}

const cero: Potencias = { kva: 0, kw: 0, kvar: 0, corrienteA: 0 };

/** kVAR = √(kVA² − kW²), acotado a cero por redondeos. */
function reactiva(kva: number, kw: number): number {
  return Math.sqrt(Math.max(kva * kva - kw * kw, 0));
}

function corriente(kva: number, tensionV: number, fases: Carga['fases']): number {
  if (!(tensionV > 0)) return 0;
  return (kva * 1000) / ((fases === '3F' ? SQRT3 : 1) * tensionV);
}

/**
 * Potencia conectada de una carga: la nominal en régimen, sin factores.
 *
 * Para motores la potencia de placa es mecánica al eje, así que la eléctrica
 * absorbida es kW_MEC / Eff (ec. 5.1). Para el resto la potencia declarada ya
 * es eléctrica. Si la carga solo trae corriente, se reconstruye desde ella.
 */
export function potenciaConectada(c: Carga): Potencias {
  const cosPhi = cosPhiDe(c);
  let kw: number;
  if (typeof c.potenciaKw === 'number' && c.potenciaKw > 0) {
    const eta = c.tipo === 'motor'
      ? (c.rendimiento && c.rendimiento > 0 && c.rendimiento <= 1 ? c.rendimiento : RENDIMIENTO_MOTOR)
      : 1;
    kw = c.potenciaKw / eta;
  } else if (typeof c.corrienteA === 'number' && c.corrienteA > 0 && c.tensionV > 0) {
    const kva = ((c.fases === '3F' ? SQRT3 : 1) * c.tensionV * c.corrienteA) / 1000;
    kw = kva * cosPhi;
  } else {
    return cero;
  }
  const kva = kw / cosPhi;
  return { kva, kw, kvar: reactiva(kva, kw), corrienteA: corriente(kva, c.tensionV, c.fases) };
}

/** Demanda máxima: potencia conectada × FD (ec. 5.4 y 5.5). */
export function demandaMaxima(c: Carga): Potencias {
  const base = potenciaConectada(c);
  const fd = factorDemandaDe(c);
  const kw = base.kw * fd;
  const kva = kw / cosPhiDe(c);
  return { kva, kw, kvar: reactiva(kva, kw), corrienteA: corriente(kva, c.tensionV, c.fases) };
}

/** Demanda media: demanda máxima × FC (ec. 5.7 y 5.8). */
export function demandaMedia(c: Carga): Potencias {
  const max = demandaMaxima(c);
  const fc = factorCargaDe(c);
  const kw = max.kw * fc;
  const kva = kw / cosPhiDe(c);
  return { kva, kw, kvar: reactiva(kva, kw), corrienteA: corriente(kva, c.tensionV, c.fases) };
}

export interface ResumenDemanda {
  conectada: Potencias;
  maxima: Potencias;
  media: Potencias;
  /** Energía a partir de la demanda media y las horas declaradas. */
  energiaDiariaKwh: number;
  energiaAnualKwh: number;
  /** Cargas contadas y cuántas de ellas son stand-by. */
  cargas: number;
  standby: number;
}

/** Horas de operación al día por defecto: operación continua. */
export const HORAS_DIA_DEFECTO = 24;
const DIAS_ANIO = 365;

/**
 * Suma el estudio sobre un conjunto de cargas.
 *
 * Las potencias se suman aritméticamente por componente (kW con kW, kVAR con
 * kVAR) y el kVA del conjunto se recompone de esa suma — no se suman kVA
 * directamente, que sobreestimaría al ignorar los desfases distintos. La
 * corriente se calcula a la tensión declarada, que debe ser la del punto de
 * suma (la barra), no la de cada carga.
 */
export function resumirDemanda(
  cargas: readonly Carga[],
  tensionBarraV: number,
  fases: Carga['fases'] = '3F',
): ResumenDemanda {
  const acumular = (fn: (c: Carga) => Potencias): Potencias => {
    let kw = 0;
    let kvar = 0;
    for (const c of cargas) {
      const p = fn(c);
      kw += p.kw;
      kvar += p.kvar;
    }
    const kva = Math.hypot(kw, kvar);
    return { kva, kw, kvar, corrienteA: corriente(kva, tensionBarraV, fases) };
  };

  const media = acumular(demandaMedia);
  let energiaDiariaKwh = 0;
  for (const c of cargas) {
    const horas = c.horasDia != null && c.horasDia >= 0 && c.horasDia <= 24
      ? c.horasDia
      : HORAS_DIA_DEFECTO;
    energiaDiariaKwh += demandaMedia(c).kw * horas;
  }

  return {
    conectada: acumular(potenciaConectada),
    maxima: acumular(demandaMaxima),
    media,
    energiaDiariaKwh,
    energiaAnualKwh: energiaDiariaKwh * DIAS_ANIO,
    cargas: cargas.length,
    standby: cargas.filter((c) => c.standby).length,
  };
}
