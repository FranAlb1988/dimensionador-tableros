import barrasData from '../data/nema/switchgear-bt-barras.json';
import mainsData from '../data/nema/switchgear-bt-mains.json';
import envolventeData from '../data/nema/envolvente-tdg.json';
import type {
  Carga,
  EnvolventeTdgNemaCatalogo,
  SalidaAsignadaNema,
  SwitchgearBtBarraNema,
  SwitchgearBtMainNema,
  TableroTdgNema,
} from '../types';
import { corrienteDiseno } from './corriente';
import { sugerirBreakerNema } from './ccm-nema';
import { MEDIDA_TDG_DEFAULT } from './medida-tdg';

const BARRAS: readonly SwitchgearBtBarraNema[] = (barrasData.barras as SwitchgearBtBarraNema[])
  .toSorted((a, b) => a.flcMin - b.flcMin);
const MAINS: readonly SwitchgearBtMainNema[] = (mainsData.mains as SwitchgearBtMainNema[])
  .toSorted((a, b) => a.flcMin - b.flcMin);
export const ENVOLVENTE_TDG_NEMA: EnvolventeTdgNemaCatalogo = envolventeData as EnvolventeTdgNemaCatalogo;

export interface ResultadoTdgNema {
  salidas: SalidaAsignadaNema[];
  cargasSinAsignar: Carga[];
  tablero?: TableroTdgNema;
  motivo?: string;
}

const FS_MIN = 0.1;
const FS_MAX = 1;

/**
 * Dimensionamiento TDG (Switchgear BT) — convención NEMA / ANSI.
 * Tabla-driven (lookup por FLC), datos de referencia para convención NEMA / ANSI.
 *  1. Cada salida → breaker (FDR ≤400AF o electronic >400AF) por su corriente.
 *  2. FLC total = Σ I_diseño × factor de simultaneidad.
 *  3. Barra principal y main breaker se buscan por rango FLC en las tablas del Excel.
 */
export function dimensionarTdgNema(
  cargas: readonly Carga[],
  factorSimultaneidad: number,
): ResultadoTdgNema {
  const fs = clamp(factorSimultaneidad, FS_MIN, FS_MAX);
  const salidas: SalidaAsignadaNema[] = [];
  const cargasSinAsignar: Carga[] = [];

  for (const c of cargas) {
    const I = corrienteDiseno(c);
    const Imin = Math.max(I, c.corrienteProteccionA ?? 0);
    if (Imin <= 0) {
      cargasSinAsignar.push(c);
      continue;
    }
    const breaker = sugerirBreakerNema(Imin);
    if (!breaker) {
      cargasSinAsignar.push(c);
      continue;
    }
    salidas.push({ carga: c, breaker, corrienteDisenoA: I });
  }

  if (salidas.length === 0) {
    return { salidas, cargasSinAsignar, motivo: 'Sin salidas válidas para dimensionar.' };
  }

  const corrienteTotalA = salidas.reduce((s, x) => s + x.corrienteDisenoA, 0) * fs;
  const principal = sugerirMain(corrienteTotalA);
  const barra = sugerirBarra(corrienteTotalA);
  if (!principal) {
    return {
      salidas, cargasSinAsignar,
      motivo: `Sin interruptor principal NEMA en catálogo para FLC ${corrienteTotalA.toFixed(0)} A.`,
    };
  }
  if (!barra) {
    return {
      salidas, cargasSinAsignar,
      motivo: `Sin barra principal NEMA en catálogo para FLC ${corrienteTotalA.toFixed(0)} A.`,
    };
  }

  const porColumna = salidasPorColumnaNema();
  const columnasSalidas = Math.max(1, Math.ceil(salidas.length / porColumna));
  const columnas = 1 + columnasSalidas;

  const tablero: TableroTdgNema = {
    norma: 'NEMA', tipo: 'TDG',
    principal,
    barra,
    salidas,
    medida: MEDIDA_TDG_DEFAULT,
    corrienteTotalA,
    factorSimultaneidad: fs,
    columnas,
    altoTotalMm: ENVOLVENTE_TDG_NEMA.altoTotalMm,
    anchoTotalMm: columnas * ENVOLVENTE_TDG_NEMA.anchoColumnaMm,
    profundidadTotalMm: ENVOLVENTE_TDG_NEMA.profundidadMm,
  };

  return { salidas, cargasSinAsignar, tablero };
}

/**
 * El Excel define rangos integer con gaps de 1 entre filas (240/241, 320/321...).
 * Para tolerar FLC fraccionarios, buscamos la primera fila cuyo flcMax cubra el valor.
 * Si ningún rango cubre (flc > último flcMax) devuelve undefined.
 */
export function sugerirMain(flc: number): SwitchgearBtMainNema | undefined {
  if (flc < 0) return undefined;
  return MAINS.find((m) => flc <= m.flcMax);
}

export function sugerirBarra(flc: number): SwitchgearBtBarraNema | undefined {
  if (flc < 0) return undefined;
  return BARRAS.find((b) => flc <= b.flcMax);
}

export function salidasPorColumnaNema(): number {
  return Math.max(1, Math.floor(ENVOLVENTE_TDG_NEMA.altoUtilSalidasMm / ENVOLVENTE_TDG_NEMA.altoCeldaSalidaMm));
}

function clamp(x: number, min: number, max: number): number {
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}
