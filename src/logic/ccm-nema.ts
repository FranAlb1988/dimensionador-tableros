import motoresData from '../data/nema/motores.json';
import breakersFdrData from '../data/nema/breakers-fdr.json';
import breakersElectronicData from '../data/nema/breakers-electronic.json';
import barrasData from '../data/nema/barras.json';
import mainsData from '../data/nema/switchgear-bt-mains.json';
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
  SwitchgearBtMainNema,
  TableroCcmNema,
  TipoArranque,
} from '../types';
import { corrienteDiseno, corrienteNominal } from './corriente';
import { MEDIDA_CCM_DEFAULT } from './medida-ccm';
import { necesitaColumnaIncoming } from './columna';
import { calcularReservas } from './reserva';
import { kwToHp } from '../util/potencia';
import { servicioSugerido, sugerirVariadorBt } from './variadores';

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
const MAINS: readonly SwitchgearBtMainNema[] = (mainsData.mains as SwitchgearBtMainNema[])
  .toSorted((a, b) => a.flcMin - b.flcMin);
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
  /**
   * Advertencias de poder de corte: breakers de alimentador cuyo Icu mínimo
   * declarado queda bajo la Icc de barra ingresada. Los partidores (MCP)
   * no declaran Icu en el catálogo y no se validan.
   */
  advertenciasIcu?: string[];
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
  iccBarraKa = 0,
  conInterruptorGeneral = false,
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
  // Barra principal: regla del alimentador de motores (NEC 430.24) — 125% del
  // motor mayor + 100% del resto — más la capacidad para la reserva declarada,
  // seleccionada contra la capacidad derrateada (/ F).
  const corrienteTotalA = asignaciones.reduce((s, a) => s + a.corrienteDisenoA, 0);
  const mayorMotorA = asignaciones
    .filter((a) => a.carga.tipo === 'motor')
    .reduce((m, a) => Math.max(m, a.corrienteDisenoA), 0);
  const factorReserva = 1 + Math.max(0, reservaPorcentaje) / 100;
  const corrienteSeleccionBarraA = ((corrienteTotalA + 0.25 * mayorMotorA) * factorReserva) / f;

  // Interruptor general opcional (main breaker de la tabla de mains del
  // switchgear BT). Sin él, el CCM es main lugs protegido aguas arriba.
  const principal = conInterruptorGeneral
    ? MAINS.find((m) => corrienteSeleccionBarraA <= m.flcMax)
    : undefined;

  // Incoming/acometida dedicada cuando hay ≥4 gavetas, I ≥ 250 A o hay
  // interruptor general (necesita el compartimento de entrada).
  const columnas: ColumnaCcmNema[] =
    necesitaColumnaIncoming(asignaciones.length, corrienteTotalA) || principal != null
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
    ...(principal ? { principal } : {}),
    barra,
    altoTotalMm: ENVOLVENTE_CCM_NEMA.altoTotalMm,
    anchoTotalMm: columnas.length * ENVOLVENTE_CCM_NEMA.anchoColumnaMm,
    profundidadTotalMm: ENVOLVENTE_CCM_NEMA.profundidadMm,
    xMm: ENVOLVENTE_CCM_NEMA.xMm,
  };

  // Validación de poder de corte de los breakers de alimentador contra la
  // Icc de barra declarada (los MCP de motor no declaran Icu en el catálogo).
  const advertenciasIcu = iccBarraKa > 0
    ? asignaciones
        .filter((a) => a.breaker != null && minIcuKa(a.breaker.icuRange) < iccBarraKa)
        .map((a) => `${a.carga.descripcion || a.carga.id}: ${a.breaker!.frameAF}AF · `
          + `${a.breaker!.rating} (Icu mín. ${minIcuKa(a.breaker!.icuRange)} kA) `
          + `< Icc de barra ${iccBarraKa.toFixed(1)} kA`)
    : [];

  return {
    asignaciones,
    cargasSinAsignar,
    tablero,
    ...(advertenciasIcu.length > 0 ? { advertenciasIcu } : {}),
  };
}

/**
 * Icu mínimo (kA) declarado en el rango del breaker, p. ej. "65, 100" → 65.
 * El rango depende de la tensión de servicio; se toma el menor (conservador).
 */
function minIcuKa(icuRange: string): number {
  const valores = icuRange.split(',').map((s) => parseFloat(s)).filter(Number.isFinite);
  return valores.length > 0 ? Math.min(...valores) : 0;
}

function asignar(c: Carga, factorDerrateo: number): AsignacionCcmNema | undefined {
  // Un motor con variador NO ocupa una unidad de partida en el CCM: el drive va
  // fuera del tablero y el cubículo solo lleva el interruptor que lo alimenta.
  // Así lo trata la planilla de cálculo del proyecto, que rotula esas salidas
  // como "Alimentador" y les asigna el X del frame (100AF → 2X, 225AF → 3X).
  if (c.tipo === 'motor' && c.arranque !== 'variador') return asignarMotor(c);
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
  variador: 'Espacio ampliado por variador (tabla FVNR + 2 escalones). El X no sale de las '
    + 'dimensiones del drive sugerido; frames grandes pueden requerir sección completa y '
    + 'ventilación adicional.',
};

function asignarMotor(c: Carga): AsignacionCcmNema | undefined {
  const hp = hpDeCarga(c);
  if (hp == null || hp <= 0) return undefined;
  const motor = MOTORES.find((m) => m.hp >= hp);
  if (!motor) return undefined;
  // FLA del motor: el catálogo está rateado a 400 V 3F. Para otra tensión BT
  // trifásica se escala por 400/V (I ∝ 1/V a potencia constante — el propio
  // catálogo se construyó así: NEC 430.250 a 460 V × 1,15). Para monofásico o
  // media tensión (>1000 V) la tabla no aplica y se usa la fórmula. La
  // corriente de placa del usuario siempre prevalece.
  const esBt3F = c.tensionV > 0 && c.tensionV <= 1000 && c.fases === '3F';
  const flaCatalogo = esBt3F && motor.flaA != null
    ? motor.flaA * (400 / c.tensionV)
    : null;
  const corriente = c.corrienteA ?? flaCatalogo ?? corrienteNominal(c);

  const notasPartes: string[] = [];
  if (esBt3F && c.tensionV !== 400 && c.corrienteA == null) {
    notasPartes.push(
      `Tabla CENTERLINE rateada a 400 V: FLA escalada a ${c.tensionV} V (× 400/V). `
      + 'Contactor NEMA, MCP y módulo OL deben verificarse para la tensión real.',
    );
  }

  // Tipo de arranque: la tabla es FVNR; YD/PSV amplían 1 escalón y VSD 2.
  const tipo: TipoArranque = c.arranque ?? 'DOL';
  let espaciosX = motor.espaciosX;
  let version = motor.version;
  if (tipo !== 'DOL') {
    espaciosX = subirEspaciosX(motor.espaciosX, tipo === 'variador' ? 2 : 1);
    // 6X = media sección: unidad fija, igual que los NEMA 6 del catálogo.
    if (espaciosX >= 6) version = 'fijo';
    notasPartes.push(NOTA_ARRANQUE_NEMA[tipo]);
  }

  return {
    carga: c,
    motor,
    espaciosX,
    version,
    corrienteDisenoA: corriente * (c.factorServicio || 1),
    ...(notasPartes.length > 0 ? { notas: notasPartes.join(' ') } : {}),
  };
}

/**
 * Margen de los breakers de alimentador no-motor: 1.25 sobre I de diseño
 * (carga continua — NEC 210.19/215.2), igual que las vías IEC y CDC NEMA.
 */
const MARGEN_ALIMENTADOR_NEMA = 1.25;

function asignarAlimentador(c: Carga, factorDerrateo: number): AsignacionCcmNema | undefined {
  const I = corrienteDiseno(c);

  // Si el proyecto ya dimensionó el interruptor, se respeta: la app no vuelve a
  // elegirlo. Evita que el margen de carga continua suba un calibre sobre lo
  // que el proyectista ya decidió.
  if (c.proteccionFrameAF != null && c.proteccionTripA != null) {
    const especificado = breakerEspecificadoNema(c.proteccionFrameAF, c.proteccionTripA);
    if (especificado) {
      return {
        carga: c,
        breaker: especificado,
        espaciosX: especificado.espaciosX,
        version: especificado.frameAF >= UMBRAL_ELECTRONIC_AF ? 'fijo' : 'extraible',
        corrienteDisenoA: I,
        ...variadorDe(c),
      };
    }
  }

  // El breaker pierde capacidad con la altura/temperatura → (I × margen) / F.
  // El frame forzado (corrienteProteccionA) no se escala — elección explícita.
  const Imin = Math.max((I * MARGEN_ALIMENTADOR_NEMA) / factorDerrateo, c.corrienteProteccionA ?? 0);
  if (Imin <= 0) return undefined;
  const breaker = sugerirBreakerNema(Imin);
  if (!breaker) return undefined;
  return {
    carga: c,
    breaker,
    espaciosX: breaker.espaciosX,
    version: breaker.frameAF >= UMBRAL_ELECTRONIC_AF ? 'fijo' : 'extraible',
    corrienteDisenoA: I,
    ...variadorDe(c),
  };
}

/**
 * Variador sugerido para una salida con VSD. El servicio lo elige el usuario;
 * si no lo fijó, se deduce del equipo (bombas/ventiladores ND, chancado y
 * correas HD) y queda marcado como deducido para poder avisarlo en pantalla.
 */
function variadorDe(c: Carga): Pick<AsignacionCcmNema, 'variador'> {
  if (c.arranque !== 'variador') return {};
  if (!(c.potenciaKw != null && c.potenciaKw > 0)) return {};
  const servicioDeducido = c.servicioVariador == null;
  const servicio = c.servicioVariador ?? servicioSugerido(c.descripcion);
  const m = sugerirVariadorBt(c.potenciaKw, c.tensionV, { servicio, soloChile: true })
    ?? sugerirVariadorBt(c.potenciaKw, c.tensionV, { servicio });
  if (!m) return {};
  return {
    variador: {
      referencia: m.referencia,
      gama: m.gama,
      servicio,
      servicioDeducido,
      ...(m.ndKwVMin != null ? { potenciaKw: m.ndKwVMin } : {}),
      ...(m.iSalidaNdA != null ? { corrienteA: m.iSalidaNdA } : {}),
      ...(m.anchoMm != null ? { anchoMm: m.anchoMm } : {}),
      ...(m.altoMm != null ? { altoMm: m.altoMm } : {}),
      ...(m.profundidadMm != null ? { profundidadMm: m.profundidadMm } : {}),
      ...(m.pesoKg != null ? { pesoKg: m.pesoKg } : {}),
    },
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
/**
 * Arma el interruptor que el proyecto ya dimensionó (frame + calibre) en vez de
 * volver a elegirlo. El frame define el espacio de la gaveta, así que se busca
 * en el catálogo; si no está, no se puede respetar y se devuelve undefined para
 * que el llamador caiga en la sugerencia normal.
 */
export function breakerEspecificadoNema(
  frameAF: number,
  tripA: number,
): BreakerNemaSeleccionado | undefined {
  if (!(frameAF > 0) || !(tripA > 0)) return undefined;
  const esElectronic = frameAF >= UMBRAL_ELECTRONIC_AF;
  const frames = esElectronic ? ELEC_FRAMES : FDR_FRAMES;
  const f = frames.find((x) => x.frameAF === frameAF)
    ?? [...FDR_FRAMES, ...ELEC_FRAMES].find((x) => x.frameAF === frameAF);
  if (!f) return undefined;
  const tipo: 'AT' | 'AS' = f.frameAF >= UMBRAL_ELECTRONIC_AF ? 'AS' : 'AT';
  return {
    frameAF: f.frameAF,
    rating: `${tripA}${tipo}`,
    ratingA: tripA,
    ratingTipo: tipo,
    espaciosX: f.espaciosX,
    icuRange: f.icuRange,
  };
}

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
 * - Alimentador   → breaker FDR o electrónico mínimo (e.g. "100AF · 50AT"),
 *   con el mismo margen 1.25 y derrateo F que usa la asignación real.
 */
export function frameProteccionNema(carga: Carga, factorDerrateo = 1): string | undefined {
  const f = factorDerrateo > 0 ? factorDerrateo : 1;
  if (carga.tipo === 'motor') {
    const hp = hpDeCarga(carga);
    if (hp == null || hp <= 0) return undefined;
    const motor = MOTORES.find((m) => m.hp >= hp);
    if (!motor || motor.mcpFrameA == null) return undefined;
    return `${motor.mcpFrameA} A MCP`;
  }
  const I = corrienteDiseno(carga);
  const Imin = Math.max((I * MARGEN_ALIMENTADOR_NEMA) / f, carga.corrienteProteccionA ?? 0);
  if (Imin <= 0) return undefined;
  const b = sugerirBreakerNema(Imin);
  if (!b) return undefined;
  return `${b.frameAF}AF · ${b.rating}`;
}

export const MOTORES_NEMA = MOTORES;
export const FDR_FRAMES_NEMA = FDR_FRAMES;
export const ELEC_FRAMES_NEMA = ELEC_FRAMES;
