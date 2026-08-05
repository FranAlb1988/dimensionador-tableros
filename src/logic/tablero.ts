import type { AsignacionCarga, Carga, Gaveta, MarcaProteccion, Proteccion, Tablero, TipoTablero } from '../types';
import {
  BUS_DISTRIBUCION_VERTICAL_A, verificarBarraVerticalIec,
  type VerificacionBarraVerticalIec,
} from './barra-vertical-iec';
import {
  distribuirEnColumnas, necesitaColumnaIncoming, nuevaColumnaIncoming, resetContadorColumnas,
} from './columna';
import { altoDeGaveta, asignarCargaCcm, COLUMNA_CATALOGO, resetContadorGavetas } from './gaveta';
import { MEDIDA_CCM_DEFAULT } from './medida-ccm';
import { corrienteDiseno } from './corriente';
import { sugerirBarra } from './barra';
import { elevarPrestacion } from './proteccion';
import { sugerirInterruptorPrincipal } from './principal';
import { MAX_BARRA_CCM_A } from './limites-barra';
import { calcularReservas } from './reserva';
import { tamanoEnX } from '../util/x-blokset';

export interface ResultadoCcm {
  asignaciones: AsignacionCarga[];
  cargasSinAsignar: Carga[];
  tablero: Tablero;
  /**
   * Advertencias de poder de corte: salidas cuyo Icu queda bajo la Icc de
   * barra declarada incluso en la prestación mayor disponible (H, 70 kA).
   */
  advertenciasIcu?: string[];
  /**
   * Barra vertical de columna BlokSeT. A diferencia de CENTERLINE, el catálogo
   * IEC publica la resistencia al cortocircuito del arreglo y no su corriente
   * de régimen, así que lo que se verifica es la Icw contra la Icc de barra.
   */
  barraVertical?: VerificacionBarraVerticalIec;
  advertenciasBarraVertical?: string[];
}

/**
 * Punto de entrada para CCM Blokset:
 * 1. Asigna protección + arrancador + gaveta a cada carga
 * 2. Distribuye gavetas en columnas (FFD)
 * 3. Calcula dimensiones totales del tablero
 *
 * Resetea contadores internos para resultados deterministas.
 */
/**
 * Interruptor general del CCM: menor In que cubra la corriente, con la
 * prestación elevada (F→N→H) hasta la Icc de barra. Si ni así alcanza, se
 * intenta un equipo de Icu mayor (Masterpact); si tampoco, se devuelve el
 * mejor disponible y el caller advierte.
 */
function principalCcm(
  corrienteA: number,
  marca: MarcaProteccion,
  iccBarraKa: number,
): Proteccion | undefined {
  const base = sugerirInterruptorPrincipal(corrienteA, marca);
  if (!base) return undefined;
  const elevado = elevarPrestacion(base, iccBarraKa);
  if (!(iccBarraKa > 0) || elevado.icuKA >= iccBarraKa) return elevado;
  return sugerirInterruptorPrincipal(corrienteA, marca, iccBarraKa) ?? elevado;
}

export function dimensionarCcm(
  cargas: readonly Carga[],
  factorDerrateo = 1,
  marca: MarcaProteccion = 'Schneider',
  reservaPorcentaje = 0,
  iccBarraKa = 0,
  conInterruptorGeneral = false,
): ResultadoCcm {
  resetContadorGavetas();
  resetContadorColumnas();

  // F por altura/temperatura: reduce la capacidad útil de todo el aparellaje,
  // por lo que interruptores de salida y barra se seleccionan contra I / F.
  const f = factorDerrateo > 0 ? factorDerrateo : 1;

  const asignaciones: AsignacionCarga[] = [];
  const cargasSinAsignar: Carga[] = [];

  for (const c of cargas) {
    const a = asignarCargaCcm(c, marca, f, iccBarraKa);
    if (a) asignaciones.push(a);
    else cargasSinAsignar.push(c);
  }

  // Gavetas de reserva (vacancia): 1 de cada tamaño usado + adicionales hasta
  // alcanzar el porcentaje pedido sobre el X usado por las salidas reales.
  const gavetasReales = asignaciones.map((a) => a.gaveta);
  const { reservas } = calcularReservas<Gaveta>(
    gavetasReales,
    (g) => g.tamano,
    (g) => tamanoEnX(g.tamano),
    (modelo, i) => ({
      id: `reserva-${i + 1}`,
      tamano: modelo.tamano,
      altoMm: altoDeGaveta(modelo.tamano),
      version: 'extraible',
      contenido: `Reserva · ${modelo.tamano}X`,
      protecciones: [],
      esReserva: true,
    }),
    reservaPorcentaje,
  );

  const gavetas = [...gavetasReales, ...reservas];
  const columnasFeeders = distribuirEnColumnas(gavetas);

  // Barra principal: regla del alimentador de motores (NEC 430.24) — 125% del
  // motor mayor + 100% del resto — más la capacidad para la reserva declarada
  // (las gavetas de vacancia deben poder alimentarse sin cambiar la barra),
  // todo seleccionado contra la capacidad derrateada (/ F).
  const corrienteTotalA = asignaciones.reduce((s, a) => s + corrienteDiseno(a.carga), 0);
  const mayorMotorA = asignaciones
    .filter((a) => a.carga.tipo === 'motor')
    .reduce((m, a) => Math.max(m, corrienteDiseno(a.carga)), 0);
  const factorReserva = 1 + Math.max(0, reservaPorcentaje) / 100;
  const corrienteSeleccionBarraA = ((corrienteTotalA + 0.25 * mayorMotorA) * factorReserva) / f;

  // Interruptor general opcional (main breaker — RIC N°02, medio de
  // seccionamiento). Sin él, el CCM es main lugs protegido aguas arriba.
  const principal = conInterruptorGeneral
    ? principalCcm(corrienteSeleccionBarraA, marca, iccBarraKa)
    : undefined;

  // CCM: la barra principal se topa en 3200 A. Para corrientes mayores el
  // tablero corresponde a un CDC. Con interruptor general, la barra debe
  // transportar al menos su In (deja pasar hasta su In sin disparar).
  const barra = sugerirBarra(
    Math.max(corrienteSeleccionBarraA, principal?.inA ?? 0),
    MAX_BARRA_CCM_A,
  );

  // Incoming/acometida dedicada cuando hay ≥4 gavetas, I ≥ 250 A o hay
  // interruptor general (necesita el compartimento de entrada).
  const columnas = necesitaColumnaIncoming(asignaciones.length, corrienteTotalA) || principal != null
    ? [nuevaColumnaIncoming(), ...columnasFeeders]
    : columnasFeeders;

  const tablero: Tablero = {
    tipo: 'CCM' satisfies TipoTablero,
    columnas,
    reservaCabezalMm: COLUMNA_CATALOGO.reservaCabezalMm,
    reservaZocaloMm: COLUMNA_CATALOGO.reservaZocaloMm,
    medida: MEDIDA_CCM_DEFAULT,
    corrienteTotalA,
    factorDerrateoAltura: f,
    corrienteSeleccionBarraA,
    ...(iccBarraKa > 0 ? { iccBarraKa } : {}),
    ...(principal ? { principal } : {}),
    barra,
    altoTotalMm: COLUMNA_CATALOGO.altoTotalMm,
    anchoTotalMm: columnas.length * COLUMNA_CATALOGO.anchoMm,
    profundidadTotalMm: COLUMNA_CATALOGO.profundidadMm,
  };

  // Validación de poder de corte: la selección ya elevó la prestación
  // (F→N→H); si aun así el Icu queda bajo la Icc declarada, se advierte
  // (IEC 61439-2 / RIC N°02 — filiación o limitación aguas arriba).
  const advertenciasIcu = iccBarraKa > 0
    ? [
        ...(principal && principal.icuKA < iccBarraKa
          ? [`Interruptor general: ${principal.referencia} (Icu ${principal.icuKA} kA) `
            + `< Icc de barra ${iccBarraKa.toFixed(1)} kA`]
          : []),
        ...asignaciones
          .filter((a) => a.proteccion.icuKA < iccBarraKa)
          .map((a) => `${a.carga.descripcion || a.carga.id}: ${a.proteccion.referencia} `
            + `(Icu ${a.proteccion.icuKA} kA) < Icc de barra ${iccBarraKa.toFixed(1)} kA`),
      ]
    : [];

  // Barra vertical de la columna más cargada. Las columnas BlokSeT comparten
  // el mismo arreglo, así que se verifica la peor y ese arreglo aplica a todas.
  const corrienteColumnaMaxA = columnas
    .filter((c) => !c.esIncoming)
    .reduce((max, c) => {
      const I = asignaciones
        .filter((a) => c.gavetas.some((g) => g.cargaId === a.carga.id))
        .reduce((s2, a) => s2 + corrienteDiseno(a.carga), 0);
      return Math.max(max, I);
    }, 0);
  const barraVertical = verificarBarraVerticalIec(corrienteColumnaMaxA, iccBarraKa);

  const advertenciasBarraVertical: string[] = [];
  if (barraVertical) {
    if (barraVertical.excedeIcw) {
      advertenciasBarraVertical.push(
        `Barra vertical: la Icc de ${iccBarraKa.toFixed(1)} kA supera los `
        + `${barraVertical.arreglo.icwKa} kA del arreglo ${barraVertical.arreglo.arreglo}, `
        + 'que es el mayor estándar publicado. Requiere solicitud especial a Schneider.',
      );
    }
    if (barraVertical.excedeCorrienteBus) {
      advertenciasBarraVertical.push(
        `Barra vertical: ${Math.round(corrienteColumnaMaxA)} A en la columna más cargada `
        + `supera los ${BUS_DISTRIBUCION_VERTICAL_A} A del bus de distribución vertical.`,
      );
    }
  }

  return {
    asignaciones,
    cargasSinAsignar,
    tablero,
    ...(barraVertical ? { barraVertical } : {}),
    ...(advertenciasBarraVertical.length > 0 ? { advertenciasBarraVertical } : {}),
    ...(advertenciasIcu.length > 0 ? { advertenciasIcu } : {}),
  };
}
