// Capacidad de corriente de conductores según RIC N°04 (Chile).
//
// La app ya calculaba la corriente de diseño con sus factores, pero ahí
// terminaba: entregaba "la corriente a buscar en la tabla" sin tener la tabla.
// Este módulo aporta las ampacidades reales (tipo × sección × método de
// instalación) y los factores de corrección, para poder cerrar el cálculo y
// devolver la sección.

import datos from '../../data/ric/conductores.json';

/** Método de instalación del RIC N°04 (A1, A2, B1, B2, D1, D2, E, F). */
export type MetodoInstalacion = 'A1' | 'A2' | 'B1' | 'B2' | 'D1' | 'D2' | 'E' | 'F';

export interface TipoConductor {
  tipo: string;
  /** Temperatura de servicio de la aislación: 70 o 90 °C. */
  tServicioC?: number;
  tensionV?: string;
  libreHalogenos?: boolean;
  retardanteLlama?: boolean;
  bajaOpacidad?: boolean;
  bajaToxicidad?: boolean;
  /** Apto para locales de reunión de personas (RIC N°04 Tabla 4.2). */
  aptoReunion?: boolean;
  condicionUso?: number;
  fuente?: number;
}

export interface SeccionConductor {
  tipo: string;
  seccionMm2: number;
  awg?: number;
  r20OhmKm?: number;
  diametroMm?: number;
}

export interface Ampacidad {
  tipo: string;
  seccionMm2: number;
  metodo: string;
  izA: number;
}

const TIPOS = datos.tipos as TipoConductor[];
const SECCIONES = datos.secciones as SeccionConductor[];
const AMPACIDADES = datos.ampacidades as Ampacidad[];
const FT = datos.ft as { desdeC: number; ft70: number; ft90ABEF: number; ft90D: number }[];
const AGRUPAMIENTO = datos.agrupamiento as { rango: string; fn: number }[];
const ITM = datos.itmNormalizado as { desdeA: number; inA: number }[];
const METODOS = datos.metodos as { metodo: string; descripcion?: string; referenciaTermica?: string }[];
const NOTAS = datos.notas as string[];

export function notaRic(i: number | undefined): string | undefined {
  return i == null ? undefined : NOTAS[i];
}

export function tiposConductorRic(): readonly TipoConductor[] {
  return TIPOS;
}

export function metodosInstalacionRic(): readonly { metodo: string; descripcion?: string; referenciaTermica?: string }[] {
  return METODOS;
}

export function tablaAgrupamientoRic(): readonly { rango: string; fn: number }[] {
  return AGRUPAMIENTO;
}

/** Ampacidad de tabla (Iz) sin corregir, en A. */
export function ampacidadRic(tipo: string, seccionMm2: number, metodo: string): number | undefined {
  return AMPACIDADES.find(
    (a) => a.tipo === tipo && a.seccionMm2 === seccionMm2 && a.metodo === metodo,
  )?.izA;
}

/** Métodos de instalación disponibles para un tipo de conductor. */
export function metodosDe(tipo: string): string[] {
  return [...new Set(AMPACIDADES.filter((a) => a.tipo === tipo).map((a) => a.metodo))].sort();
}

/** Secciones disponibles para un tipo y método, de menor a mayor. */
export function seccionesDe(tipo: string, metodo: string): number[] {
  return AMPACIDADES
    .filter((a) => a.tipo === tipo && a.metodo === metodo)
    .map((a) => a.seccionMm2)
    .sort((a, b) => a - b);
}

export function datosSeccion(tipo: string, seccionMm2: number): SeccionConductor | undefined {
  return SECCIONES.find((s) => s.tipo === tipo && s.seccionMm2 === seccionMm2);
}

export function datosTipo(tipo: string): TipoConductor | undefined {
  return TIPOS.find((t) => t.tipo === tipo);
}

/**
 * Factor de corrección por temperatura ambiente (ft), RIC N°04 Tabla 4.4.
 * Depende de la temperatura de servicio de la aislación (70 u 90 °C) y, para
 * los métodos enterrados D1/D2, de la referencia de 20 °C en suelo en vez de
 * los 30 °C de aire. Fuera de la tabla se toma el extremo más cercano.
 */
export function factorTemperaturaRic(
  temperaturaC: number,
  tServicioC: number,
  metodo: string,
): number {
  const enterrado = metodo === 'D1' || metodo === 'D2';
  const columna = (f: (typeof FT)[number]) =>
    tServicioC >= 90 ? (enterrado ? f.ft90D : f.ft90ABEF) : f.ft70;
  // Las filas declaran el inicio de cada banda; se toma la última que empieza
  // en o antes de la temperatura pedida.
  let elegida = FT[0]!;
  for (const f of FT) {
    if (temperaturaC >= f.desdeC) elegida = f;
  }
  return columna(elegida);
}

/**
 * Factor de corrección por agrupamiento (fn), RIC N°04 Tabla 4.6.
 * Se lee de la tabla del catálogo, no de una escalera escrita a mano.
 */
export function factorAgrupamientoRic(nConductores: number): number {
  for (const { rango, fn } of AGRUPAMIENTO) {
    const nums = rango.match(/\d+/g)?.map(Number) ?? [];
    if (/sobre/i.test(rango)) {
      if (nConductores > nums[0]!) return fn;
      continue;
    }
    if (nums.length >= 2 && nConductores >= nums[0]! && nConductores <= nums[1]!) return fn;
  }
  return AGRUPAMIENTO[AGRUPAMIENTO.length - 1]?.fn ?? 1;
}

/**
 * Calibre comercial de protección (ITM) para una corriente de diseño.
 * Devuelve undefined sobre los 100 A, donde la tabla del RIC deja de
 * enumerar y el calibre se toma del catálogo del fabricante.
 */
export function itmNormalizadoRic(corrienteA: number): number | undefined {
  if (!(corrienteA > 0)) return undefined;
  const mayor = ITM[ITM.length - 1]?.inA;
  // Sobre el último calibre tabulado la tabla deja de enumerar; devolverlo
  // igual daría un ITM menor que la corriente de diseño.
  if (mayor != null && corrienteA > mayor) return undefined;
  let elegido: number | undefined;
  for (const { desdeA, inA } of ITM) {
    if (corrienteA >= desdeA) elegido = inA;
  }
  return elegido;
}

export interface OpcionesSeccion {
  tipo: string;
  metodo: string;
  /** Temperatura ambiente (o del suelo para D1/D2), en °C. */
  temperaturaC?: number;
  /** Conductores activos agrupados en la misma canalización. */
  nConductores?: number;
  /** Exigir conductor apto para locales de reunión de personas. */
  aptoReunion?: boolean;
  /** Sección mínima impuesta por el tipo de circuito, en mm². */
  seccionMinimaMm2?: number;
}

export interface ResultadoSeccion {
  seccionMm2: number;
  /** Ampacidad de tabla, sin corregir. */
  izTablaA: number;
  /** Ampacidad corregida por temperatura y agrupamiento. */
  izCorregidaA: number;
  ft: number;
  fn: number;
  r20OhmKm?: number;
  diametroMm?: number;
  tServicioC?: number;
  aptoReunion?: boolean;
}

/**
 * Menor sección cuya ampacidad corregida cubre la corriente de diseño.
 *
 *   Iz_corregida = Iz_tabla × ft × fn ≥ I_diseño
 *
 * Devuelve undefined si ninguna sección del tipo/método alcanza, o si el tipo
 * no sirve para el uso pedido (p. ej. local de reunión de personas).
 */
export function seccionPorAmpacidad(
  corrienteDisenoA: number,
  opciones: OpcionesSeccion,
): ResultadoSeccion | undefined {
  if (!(corrienteDisenoA > 0)) return undefined;
  const tipo = datosTipo(opciones.tipo);
  if (!tipo) return undefined;
  if (opciones.aptoReunion && !tipo.aptoReunion) return undefined;

  const tServicio = tipo.tServicioC ?? 70;
  const ft = factorTemperaturaRic(opciones.temperaturaC ?? 30, tServicio, opciones.metodo);
  const fn = factorAgrupamientoRic(opciones.nConductores ?? 1);
  const minima = opciones.seccionMinimaMm2 ?? 0;

  for (const seccion of seccionesDe(opciones.tipo, opciones.metodo)) {
    if (seccion < minima) continue;
    const izTabla = ampacidadRic(opciones.tipo, seccion, opciones.metodo);
    if (izTabla == null) continue;
    const izCorregida = izTabla * ft * fn;
    if (izCorregida >= corrienteDisenoA) {
      const s = datosSeccion(opciones.tipo, seccion);
      return {
        seccionMm2: seccion,
        izTablaA: izTabla,
        izCorregidaA: izCorregida,
        ft,
        fn,
        r20OhmKm: s?.r20OhmKm,
        diametroMm: s?.diametroMm,
        tServicioC: tipo.tServicioC,
        aptoReunion: tipo.aptoReunion,
      };
    }
  }
  return undefined;
}
