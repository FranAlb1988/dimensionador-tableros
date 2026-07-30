// Catálogo de variadores de frecuencia Schneider (baja y media tensión).
//
// Hasta ahora la app modelaba el variador como un placeholder: subía el espacio
// de la gaveta y dejaba una nota diciendo que el drive real no estaba incluido.
// Con estos catálogos se puede nombrar el modelo concreto y su corriente.

import btData from '../data/schneider/variadores-bt.json';
import mtData from '../data/schneider/variadores-mt.json';

/** Servicio de la aplicación: normal (ND) o pesado (HD). */
export type ServicioVariador = 'ND' | 'HD';

export interface VariadorBt {
  gama: string;
  referencia: string;
  /** Rango de alimentación cubierto por la referencia. */
  vMin: number;
  vMax: number;
  alimentacion?: string;
  ip?: string;
  bastidor?: string;
  /** Potencia en servicio normal a la tensión mínima / máxima del rango. */
  ndKwVMin?: number;
  ndKwVMax?: number;
  /** Potencia en servicio pesado. */
  hdKwVMin?: number;
  hdKwVMax?: number;
  iSalidaNdA?: number;
  iSalidaHdA?: number;
  iEntradaNdVMinA?: number;
  iEntradaNdVMaxA?: number;
  anchoMm?: number;
  altoMm?: number;
  profundidadMm?: number;
  pesoKg?: number;
  /** Índices dentro de `notas`. */
  alcanceChile?: number;
  montaje?: number;
  observaciones?: number;
}

export interface VariadorMt {
  familia: string;
  referencia: string;
  tensionKv: number;
  kva?: number;
  ndKw?: number;
  hdKw?: number;
  iSalidaNdA?: number;
  iSalidaHdA?: number;
  iSobrecargaNdA?: number;
  iSobrecargaHdA?: number;
  anchoMm?: number;
  altoMm?: number;
  profundidadMm?: number;
  pesoKg?: number;
  configuracion?: number;
  disponibilidad?: number;
  estadoDatosMecanicos?: number;
  observaciones?: number;
}

const BT = btData.modelos as VariadorBt[];
const NOTAS_BT = btData.notas as string[];
const MT = mtData.modelos as VariadorMt[];
const NOTAS_MT = mtData.notas as string[];

/** Resuelve un índice de nota a su texto. */
export function notaBt(i: number | undefined): string | undefined {
  return i == null ? undefined : NOTAS_BT[i];
}
export function notaMt(i: number | undefined): string | undefined {
  return i == null ? undefined : NOTAS_MT[i];
}

export function gamasBt(): string[] {
  return [...new Set(BT.map((m) => m.gama))].sort();
}
export function familiasMt(): string[] {
  return [...new Set(MT.map((m) => m.familia))].sort();
}

/**
 * Potencia que cubre una referencia BT a la tensión pedida.
 * El catálogo publica la potencia en los extremos del rango de alimentación;
 * para una tensión intermedia se toma el valor del extremo inferior, que es el
 * conservador (a menor tensión, menor potencia disponible).
 */
function potenciaBt(m: VariadorBt, tensionV: number, servicio: ServicioVariador): number | undefined {
  const enMin = servicio === 'HD' ? m.hdKwVMin : m.ndKwVMin;
  const enMax = servicio === 'HD' ? m.hdKwVMax : m.ndKwVMax;
  if (enMin == null && enMax == null) return undefined;
  if (enMin == null) return enMax;
  if (enMax == null) return enMin;
  return tensionV >= m.vMax ? enMax : enMin;
}

/** ¿La referencia admite esa tensión de alimentación? Con 5% de tolerancia. */
function cubreTension(m: VariadorBt, tensionV: number): boolean {
  return tensionV >= m.vMin * 0.95 && tensionV <= m.vMax * 1.05;
}

export interface OpcionesVariadorBt {
  servicio?: ServicioVariador;
  /** Limitar a una gama concreta (ATV320, ATV630…). */
  gama?: string;
  /** Excluir referencias fuera del rango comercial publicado en Chile. */
  soloChile?: boolean;
}

/**
 * Menor variador BT que cubre la potencia del motor a esa tensión.
 * Devuelve undefined si ninguna referencia alcanza.
 */
export function sugerirVariadorBt(
  potenciaKw: number,
  tensionV: number,
  opciones: OpcionesVariadorBt = {},
): VariadorBt | undefined {
  if (!(potenciaKw > 0) || !(tensionV > 0)) return undefined;
  const servicio = opciones.servicio ?? 'ND';

  const candidatos = BT.filter((m) => {
    if (!cubreTension(m, tensionV)) return false;
    if (opciones.gama && m.gama !== opciones.gama) return false;
    if (opciones.soloChile) {
      const alcance = notaBt(m.alcanceChile) ?? '';
      if (!alcance.startsWith('Chile')) return false;
    }
    const p = potenciaBt(m, tensionV, servicio);
    return p != null && p >= potenciaKw;
  });
  if (candidatos.length === 0) return undefined;

  // El menor que alcanza; ante empate, el de menor corriente de salida.
  return candidatos.toSorted((a, b) => {
    const pa = potenciaBt(a, tensionV, servicio) ?? Infinity;
    const pb = potenciaBt(b, tensionV, servicio) ?? Infinity;
    if (pa !== pb) return pa - pb;
    return (a.iSalidaNdA ?? Infinity) - (b.iSalidaNdA ?? Infinity);
  })[0];
}

export interface OpcionesVariadorMt {
  servicio?: ServicioVariador;
  familia?: string;
  /** Tolerancia sobre la tensión nominal de salida (0.05 = 5%). */
  toleranciaTension?: number;
}

/**
 * Menor variador MT que cubre la potencia del motor a esa tensión de salida.
 * La tensión debe coincidir con una clase del catálogo (2.4 a 13.8 kV).
 */
export function sugerirVariadorMt(
  potenciaKw: number,
  tensionKv: number,
  opciones: OpcionesVariadorMt = {},
): VariadorMt | undefined {
  if (!(potenciaKw > 0) || !(tensionKv > 0)) return undefined;
  const servicio = opciones.servicio ?? 'ND';
  const tol = opciones.toleranciaTension ?? 0.05;

  const candidatos = MT.filter((m) => {
    if (opciones.familia && m.familia !== opciones.familia) return false;
    if (Math.abs(m.tensionKv - tensionKv) > m.tensionKv * tol) return false;
    const p = servicio === 'HD' ? m.hdKw : m.ndKw;
    return p != null && p >= potenciaKw;
  });
  if (candidatos.length === 0) return undefined;

  return candidatos.toSorted((a, b) => {
    const pa = (servicio === 'HD' ? a.hdKw : a.ndKw) ?? Infinity;
    const pb = (servicio === 'HD' ? b.hdKw : b.ndKw) ?? Infinity;
    if (pa !== pb) return pa - pb;
    return (a.iSalidaNdA ?? Infinity) - (b.iSalidaNdA ?? Infinity);
  })[0];
}

/** Clases de tensión de salida disponibles en MT (kV). */
export function clasesTensionMt(): number[] {
  return [...new Set(MT.map((m) => m.tensionKv))].sort((a, b) => a - b);
}

/**
 * Deduce el servicio del variador a partir de la descripción del equipo.
 *
 * Bombas y ventiladores son par cuadrático y arranque suave: les basta el
 * servicio normal. Chancado, correas, molinos y harneros parten con carga y
 * repiten arranques, así que piden servicio pesado.
 *
 * Es solo el valor por defecto: el usuario puede fijarlo por carga.
 */
export function servicioSugerido(descripcion: string): ServicioVariador {
  const d = descripcion
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const pesado = [
    'chancad', 'correa', 'cinta transportadora', 'transportador', 'feeder de placa',
    'molino', 'harnero', 'zaranda', 'apron', 'triturad', 'mill', 'crusher', 'conveyor',
    'agitador', 'mezclador', 'compresor', 'extrusor', 'centrifug',
  ];
  if (pesado.some((k) => d.includes(k))) return 'HD';

  const normal = ['bomba', 'ventilador', 'soplador', 'extractor', 'pump', 'fan', 'blower'];
  if (normal.some((k) => d.includes(k))) return 'ND';

  // Sin pistas: el servicio normal es el más común en planta.
  return 'ND';
}
