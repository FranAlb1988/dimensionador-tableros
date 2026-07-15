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
  TipoArranque,
} from '../types';
import { corrienteDiseno, corrienteNominal } from './corriente';
import { MEDIDA_CCM_DEFAULT } from './medida-ccm';
import { necesitaColumnaIncoming } from './columna';
import { calcularReservas } from './reserva';
import { kwToHp } from '../util/potencia';

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

/** Mayor capacidad de barra del catálogo NEMA (A). */
export const CAPACIDAD_BARRA_MAXIMA_A = Math.max(...BARRAS.map((b) => b.capacidadA));

/**
 * Dimensionamiento CCM convención NEMA. Tabla-driven (no fórmulas):
 *  - Motor → fila de la tabla por HP (contactor NEMA, MCP, espacios X, versión).
 *  - Alimentador → breaker FDR (≤400AF) o electronic (>400AF) por corriente.
 *  - Bin-pack en columnas de 12X (X=6") — estándar NEMA CCM (Square D Model 6, GE 8000…).
 *  - Barra principal por FLC total.
 *
 * `factorDerrateo` es el factor F2 por altura geográfica (Tabla V — ver derrateo.ts).
 * No altera la corriente real de las cargas: reduce la capacidad útil del equipo, lo
 * que equivale a seleccionar barra y breakers contra I / F2.
 */
export function dimensionarCcmNema(
  cargas: readonly Carga[],
  factorDerrateo = 1,
  reservaPorcentaje = 0,
): ResultadoCcmNema {
  const f = factorDerrateo > 0 ? factorDerrateo : 1;
  const asignaciones: AsignacionCcmNema[] = [];
  const cargasSinAsignar: Carga[] = [];

  for (const c of cargas) {
    const a = asignar(c, f);
    if (a) asignaciones.push(a);
    else cargasSinAsignar.push(c);
  }

  if (asignaciones.length === 0) {
    return { asignaciones, cargasSinAsignar, motivo: 'Sin asignaciones válidas para NEMA.' };
  }

  // Unidades de reserva (vacancia) — 1 de cada (tamañoX, versión) usado, más
  // adicionales hasta cubrir el % pedido sobre el X usado por las salidas.
  // La reserva es ESPACIO VACÍO: hereda tamaño (espaciosX) y versión del
  // modelo, pero NO su motor/breaker — de lo contrario el aparellaje
  // "fantasma" aparece dibujado dentro de la vacancia (y un equipped spare
  // real debería, además, sumarse al conteo de materiales).
  const { reservas } = calcularReservas<AsignacionCcmNema>(
    asignaciones,
    (a) => `${a.espaciosX}-${a.version}`,
    (a) => a.espaciosX,
    (modelo, i) => ({
      carga: {
        id: `reserva-${i + 1}`,
        descripcion: `Reserva ${modelo.espaciosX}X`,
        tipo: 'otro',
        tensionV: modelo.carga.tensionV,
        fases: modelo.carga.fases,
        factorServicio: 1,
      },
      espaciosX: modelo.espaciosX,
      version: modelo.version,
      corrienteDisenoA: 0,
      esReserva: true,
    }),
    reservaPorcentaje,
  );
  const asignacionesConReserva: AsignacionCcmNema[] = [...asignaciones, ...reservas];

  const columnasFeeders = empaquetarEnColumnas(asignacionesConReserva, ENVOLVENTE_CCM_NEMA.altoUtilXEspacios);
  const corrienteTotalA = asignaciones.reduce((s, a) => s + a.corrienteDisenoA, 0);
  // Incoming/acometida dedicada cuando hay ≥4 gavetas o I ≥ 250 A.
  const columnas: ColumnaCcmNema[] = necesitaColumnaIncoming(asignaciones.length, corrienteTotalA)
    ? [
        {
          indice: 1,
          altoUtilXEspacios: ENVOLVENTE_CCM_NEMA.altoUtilXEspacios,
          asignaciones: [],
          espaciosUsados: 0,
          espaciosLibres: ENVOLVENTE_CCM_NEMA.altoUtilXEspacios,
          esIncoming: true,
        },
        ...columnasFeeders.map((c, i) => ({ ...c, indice: i + 2 })),
      ]
    : columnasFeeders;
  const corrienteSeleccionBarraA = corrienteTotalA / f;
  const barra = sugerirBarraNema(corrienteSeleccionBarraA);
  if (!barra) {
    const maxFlcA = Math.max(...BARRAS.map((b) => b.flcMax));
    // El derrateo reduce la capacidad efectiva de la barra: el límite real de
    // corriente que puede acumularse es maxFlcA · F2.
    const idsOverflow = calcularIdsOverflow(asignaciones, maxFlcA * f);
    const detalleDerrateo = f < 1
      ? ` (selección ${corrienteSeleccionBarraA.toFixed(0)} A con derrateo F2 = ${f.toFixed(3)})`
      : '';
    return {
      asignaciones, cargasSinAsignar,
      motivo: `Sin barra principal NEMA en catálogo para FLC ${corrienteTotalA.toFixed(0)} A${detalleDerrateo}.`,
      overflowBarra: { corrienteTotalA, maxFlcA, idsOverflow },
    };
  }

  const tablero: TableroCcmNema = {
    norma: 'NEMA', tipo: 'CCM',
    columnas,
    corrienteTotalA,
    medida: MEDIDA_CCM_DEFAULT,
    factorDerrateoAltura: f,
    corrienteSeleccionBarraA,
    barra,
    altoTotalMm: ENVOLVENTE_CCM_NEMA.altoTotalMm,
    anchoTotalMm: columnas.length * ENVOLVENTE_CCM_NEMA.anchoColumnaMm,
    profundidadTotalMm: ENVOLVENTE_CCM_NEMA.profundidadMm,
    xMm: ENVOLVENTE_CCM_NEMA.xMm,
  };

  return { asignaciones, cargasSinAsignar, tablero };
}

function asignar(c: Carga, factorDerrateo: number): AsignacionCcmNema | undefined {
  if (c.tipo === 'motor') return asignarMotor(c);
  return asignarAlimentador(c, factorDerrateo);
}

/** Escala de espacios X de la envolvente CENTERLINE (1 espacio = 6"). */
const ESCALA_ESPACIOS_X: readonly number[] = [1.5, 2, 2.5, 3.5, 6];

/** Sube `niveles` escalones en la escala de espacios X (tope: 6X = ½ sección). */
function subirEspaciosX(x: number, niveles: number): number {
  let i = ESCALA_ESPACIOS_X.findIndex((v) => v >= x);
  if (i < 0) i = ESCALA_ESPACIOS_X.length - 1;
  return ESCALA_ESPACIOS_X[Math.min(i + niveles, ESCALA_ESPACIOS_X.length - 1)]!;
}

/**
 * La tabla del catálogo es FVNR (partida directa). Para otros arranques la
 * unidad real es más grande y con otro aparellaje; como MVP se amplía el
 * espacio (RVSS/YD: +1 escalón; VSD: +2) y se deja nota del equipamiento no
 * incluido — mismo criterio que la vía IEC.
 */
const NOTA_ARRANQUE_NEMA: Record<Exclude<TipoArranque, 'DOL'>, string> = {
  YD: 'Espacio ampliado por arranque YD (tabla FVNR). El equipamiento real '
    + '(2 contactores línea/triángulo + estrella + temporizador, o unidad RVAT/RVSS '
    + 'CENTERLINE) no está incluido en el conteo.',
  suave: 'Espacio ampliado por partidor suave — RVSS (SMC Flex / SMC-50). El partidor '
    + 'no está incluido en el conteo (tabla FVNR).',
  variador: 'Espacio ampliado por variador — PowerFlex. El drive no está incluido en el '
    + 'conteo (tabla FVNR); frames grandes pueden requerir sección completa y '
    + 'ventilación adicional.',
};

function asignarMotor(c: Carga): AsignacionCcmNema | undefined {
  const hp = hpDeCarga(c);
  if (hp == null || hp <= 0) return undefined;
  const motor = MOTORES.find((m) => m.hp >= hp);
  if (!motor) return undefined;
  // FLA del motor: el catálogo está rateado en BT (400 V); en media tensión
  // (>1000 V) el flaA del catálogo no aplica y se calcula con la fórmula.
  // En BT se usa el flaA del catálogo (o la corriente del usuario si la dio).
  const flaCatalogoMm = c.tensionV > 1000 ? null : motor.flaA;
  const corriente = c.corrienteA ?? flaCatalogoMm ?? corrienteNominal(c);

  // Tipo de arranque: la tabla es FVNR; YD/PSV amplían 1 escalón y VSD 2.
  const tipo: TipoArranque = c.arranque ?? 'DOL';
  let espaciosX = motor.espaciosX;
  let version = motor.version;
  let notas: string | undefined;
  if (tipo !== 'DOL') {
    espaciosX = subirEspaciosX(motor.espaciosX, tipo === 'variador' ? 2 : 1);
    // 6X = media sección: unidad fija, igual que los NEMA 6 del catálogo.
    if (espaciosX >= 6) version = 'fijo';
    notas = NOTA_ARRANQUE_NEMA[tipo];
  }

  return {
    carga: c,
    motor,
    espaciosX,
    version,
    corrienteDisenoA: corriente * (c.factorServicio || 1),
    ...(notas ? { notas } : {}),
  };
}

function asignarAlimentador(c: Carga, factorDerrateo: number): AsignacionCcmNema | undefined {
  const I = corrienteDiseno(c);
  const Imin = Math.max(I, c.corrienteProteccionA ?? 0);
  if (Imin <= 0) return undefined;
  // El breaker pierde capacidad con la altura: se selecciona contra Imin / F2.
  const breaker = sugerirBreakerNema(Imin / factorDerrateo);
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
    return kwToHp(c.potenciaKw);
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

/**
 * Devuelve la etiqueta comercial de la protección para una carga NEMA.
 * Usado para mostrar el frame en la tabla de cargas (solo lectura).
 * - Motor con HP → MCP del catálogo (e.g. "30 A MCP")
 * - Alimentador   → breaker FDR o electrónico mínimo (e.g. "100AF · 50AT")
 */
export function frameProteccionNema(carga: Carga): string | undefined {
  if (carga.tipo === 'motor') {
    const hp = hpDeCarga(carga);
    if (hp == null || hp <= 0) return undefined;
    const motor = MOTORES.find((m) => m.hp >= hp);
    if (!motor || motor.mcpFrameA == null) return undefined;
    return `${motor.mcpFrameA} A MCP`;
  }
  const I = corrienteDiseno(carga);
  const Imin = Math.max(I, carga.corrienteProteccionA ?? 0);
  if (Imin <= 0) return undefined;
  const b = sugerirBreakerNema(Imin);
  if (!b) return undefined;
  return `${b.frameAF}AF · ${b.rating}`;
}

export const MOTORES_NEMA = MOTORES;
export const FDR_FRAMES_NEMA = FDR_FRAMES;
export const ELEC_FRAMES_NEMA = ELEC_FRAMES;
