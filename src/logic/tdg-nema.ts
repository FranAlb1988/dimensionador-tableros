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
import { calcularTransformador, type ConfigTransformador } from './transformador';

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
  /**
   * Advertencias de poder de corte: salidas cuyo Icu mínimo declarado queda
   * bajo la Icc de barra aportada por el trafo alimentador.
   */
  advertenciasIcu?: string[];
}

const FS_MIN = 0.1;
const FS_MAX = 1;

/**
 * Margen del rating del breaker de salida sobre la corriente de diseño.
 * Igual criterio que la vía IEC: 1.25 tanto para motores (evita disparo en
 * la partida / coordinación con la protección del motor aguas abajo) como
 * para alimentadores de régimen continuo (NEC 210.19/215.2 — el breaker no
 * debe operar sobre el 80% de su rating en continuo).
 */
const MARGEN_SALIDA_NEMA = 1.25;

/**
 * Datos del trafo alimentador con esta carga: In del secundario (suma de
 * unidades si es un banco en paralelo) e Icc trifásica de barra.
 */
function datosTrafo(
  cfg: ConfigTransformador,
  corrienteCargaA: number,
): { inSecundarioA: number; iccKa: number } {
  const t = calcularTransformador({ ...cfg, corrienteSecundarioA: corrienteCargaA });
  const inSecundarioA = t.paralelo
    ? t.paralelo.cantidad * t.paralelo.cadaUno.inSecundarioA
    : t.inSecundarioA;
  return { inSecundarioA, iccKa: t.iccSecundarioKa };
}

/**
 * Icu mínimo (kA) declarado en el rango del breaker, p. ej. "65, 100" → 65.
 * El rango depende de la tensión de servicio; se toma el menor (conservador).
 */
function minIcuKa(icuRange: string): number {
  const valores = icuRange.split(',').map((s) => parseFloat(s)).filter(Number.isFinite);
  return valores.length > 0 ? Math.min(...valores) : 0;
}

/**
 * Dimensionamiento TDG (Switchgear BT) — convención NEMA / ANSI.
 * Tabla-driven (lookup por FLC), datos de referencia para convención NEMA / ANSI.
 *  1. Cada salida → breaker (FDR ≤400AF o electronic >400AF) con rating ≥ 1.25 × I.
 *  2. FLC total = salida mayor al 100% + resto × factor de simultaneidad
 *     (regla del mayor consumidor).
 *  3. Barra principal y main breaker se buscan por rango FLC en las tablas del Excel.
 *     Si se entrega la configuración del trafo alimentador (`trafo`), ambos deben
 *     además cubrir la In del secundario del transformador sugerido.
 *
 * `factorDerrateo` es el F2 por altura geográfica (Tabla V — ver derrateo.ts):
 * el equipo pierde capacidad con la altitud, así que salidas, main y barra se
 * seleccionan contra I / F2. No altera la corriente real de las cargas.
 */
export function dimensionarTdgNema(
  cargas: readonly Carga[],
  factorSimultaneidad: number,
  trafo?: ConfigTransformador,
  factorDerrateo = 1,
): ResultadoTdgNema {
  const fs = clamp(factorSimultaneidad, FS_MIN, FS_MAX);
  const f = factorDerrateo > 0 ? factorDerrateo : 1;
  const salidas: SalidaAsignadaNema[] = [];
  const cargasSinAsignar: Carga[] = [];

  for (const c of cargas) {
    const I = corrienteDiseno(c);
    // El frame forzado (corrienteProteccionA) no se escala por F2 — es una
    // elección explícita del usuario.
    const Imin = Math.max((I * MARGEN_SALIDA_NEMA) / f, c.corrienteProteccionA ?? 0);
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

  const sumaSalidasA = salidas.reduce((s, x) => s + x.corrienteDisenoA, 0);
  const mayorSalidaA = salidas.reduce((m, x) => Math.max(m, x.corrienteDisenoA), 0);
  // Regla del mayor consumidor: la salida mayor al 100% + el resto con
  // diversidad (análogo a NEC 430.24). Evita que main y barra queden por
  // debajo de una salida individual cuando fs < 1.
  const corrienteTotalA = mayorSalidaA + fs * (sumaSalidasA - mayorSalidaA);
  // Coordinación con el trafo alimentador: main y barra deben cubrir la In
  // del secundario del transformador sugerido, no solo la carga diversificada.
  // El trafo define además la Icc de barra para validar el Icu del aparellaje.
  const datos = trafo ? datosTrafo(trafo, corrienteTotalA) : undefined;
  const trafoInSecundarioA = datos?.inSecundarioA;
  const iccBarraKa = datos?.iccKa;
  // El derrateo por altura reduce la capacidad útil del equipo: main y barra
  // se seleccionan contra la exigencia (carga y piso del trafo) dividida por F2.
  const corrienteSeleccionA = Math.max(corrienteTotalA, trafoInSecundarioA ?? 0) / f;
  const principal = sugerirMain(corrienteTotalA / f, (trafoInSecundarioA ?? 0) / f);
  if (!principal) {
    return {
      salidas, cargasSinAsignar,
      motivo: `Sin interruptor principal NEMA en catálogo para FLC ${corrienteTotalA.toFixed(0)} A`
        + (trafoInSecundarioA ? ` (trafo In secundario ${trafoInSecundarioA.toFixed(0)} A)` : '') + '.',
    };
  }
  // Coordinación barra ↔ main: la barra debe transportar al menos el rating
  // del main (deja pasar hasta su In sin disparar) además del piso del trafo.
  const barra = sugerirBarra(
    corrienteTotalA / f,
    Math.max((trafoInSecundarioA ?? 0) / f, principal.ratingA),
  );
  if (!barra) {
    return {
      salidas, cargasSinAsignar,
      motivo: `Sin barra principal NEMA en catálogo para FLC ${corrienteTotalA.toFixed(0)} A`
        + (trafoInSecundarioA ? ` (trafo In secundario ${trafoInSecundarioA.toFixed(0)} A)` : '') + '.',
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
    ...(trafoInSecundarioA != null ? { trafoInSecundarioA } : {}),
    ...(iccBarraKa != null ? { iccBarraKa } : {}),
    factorDerrateoAltura: f,
    corrienteSeleccionA,
    factorSimultaneidad: fs,
    columnas,
    altoTotalMm: ENVOLVENTE_TDG_NEMA.altoTotalMm,
    anchoTotalMm: columnas * ENVOLVENTE_TDG_NEMA.anchoColumnaMm,
    profundidadTotalMm: ENVOLVENTE_TDG_NEMA.profundidadMm,
  };

  // Validación de poder de corte de las salidas contra la Icc de barra
  // (el catálogo de mains no declara Icu, por lo que solo se validan salidas).
  const advertenciasIcu = iccBarraKa != null
    ? salidas
        .filter((s) => minIcuKa(s.breaker.icuRange) < iccBarraKa)
        .map((s) => `${s.carga.descripcion || s.carga.id}: ${s.breaker.frameAF}AF · ${s.breaker.rating} `
          + `(Icu mín. ${minIcuKa(s.breaker.icuRange)} kA) < Icc de barra ${iccBarraKa.toFixed(1)} kA`)
    : [];

  return {
    salidas,
    cargasSinAsignar,
    tablero,
    ...(advertenciasIcu.length > 0 ? { advertenciasIcu } : {}),
  };
}

/**
 * El Excel define rangos integer con gaps de 1 entre filas (240/241, 320/321...).
 * Para tolerar FLC fraccionarios, buscamos la primera fila cuyo flcMax cubra el valor.
 * `minRatingA` (opcional) exige además rating ≥ ese piso — usado para coordinar
 * el main con la In del secundario del trafo alimentador.
 * Si ningún rango cubre (flc > último flcMax) devuelve undefined.
 */
export function sugerirMain(flc: number, minRatingA = 0): SwitchgearBtMainNema | undefined {
  if (flc < 0) return undefined;
  return MAINS.find((m) => flc <= m.flcMax && m.ratingA >= minRatingA);
}

/** `minCapacidadA` exige barra (frame) ≥ ese piso — coordinación con el trafo. */
export function sugerirBarra(flc: number, minCapacidadA = 0): SwitchgearBtBarraNema | undefined {
  if (flc < 0) return undefined;
  return BARRAS.find((b) => flc <= b.flcMax && b.frameAF >= minCapacidadA);
}

export function salidasPorColumnaNema(): number {
  return Math.max(1, Math.floor(ENVOLVENTE_TDG_NEMA.altoUtilSalidasMm / ENVOLVENTE_TDG_NEMA.altoCeldaSalidaMm));
}

function clamp(x: number, min: number, max: number): number {
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}
