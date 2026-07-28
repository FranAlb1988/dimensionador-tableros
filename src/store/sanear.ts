// Saneamiento del contenido de un proyecto abierto desde archivo.
//
// validar() en proyecto.ts comprueba la ESTRUCTURA (marca de app, versión,
// que las secciones sean arrays). Esto complementa comprobando el CONTENIDO:
// un JSON editado a mano o corrompido puede traer `tensionV: "abc"` o una
// potencia negativa, y hoy eso entra tal cual y se propaga como NaN a los
// cálculos, sin ningún aviso.
//
// Criterio: reparar en vez de rechazar. Un valor inválido se reemplaza por un
// defecto razonable y se deja constancia en la lista de avisos, para que el
// usuario sepa que su archivo venía con algo raro.

import type { Carga, Fases, TipoArranque, TipoCarga, UnidadPotencia } from '../types';

const TIPOS: readonly TipoCarga[] = ['motor', 'resistivo', 'iluminacion', 'tomas', 'otro'];
const FASES: readonly Fases[] = ['1F', '3F'];
const ARRANQUES: readonly TipoArranque[] = ['DOL', 'YD', 'suave', 'variador'];
const UNIDADES: readonly UnidadPotencia[] = ['kW', 'HP'];

/** Tensión por defecto cuando la del archivo no sirve. */
export const TENSION_FALLBACK = 400;

export interface ResultadoSaneo<T> {
  valor: T;
  avisos: string[];
}

/** Número finito y positivo, o undefined. Acepta strings numéricas. */
function numeroPositivo(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/** Número en el rango (0, 1]. Sirve para cosPhi y rendimiento. */
function fraccion(v: unknown): number | undefined {
  const n = numeroPositivo(v);
  if (n === undefined || n > 1) return undefined;
  return n;
}

function unoDe<T extends string>(v: unknown, opciones: readonly T[]): T | undefined {
  return typeof v === 'string' && (opciones as readonly string[]).includes(v) ? (v as T) : undefined;
}

/**
 * Deja una carga en un estado con el que los cálculos no produzcan NaN.
 * `etiqueta` sirve para que los avisos digan de qué carga se trata.
 */
export function sanearCarga(cruda: unknown, etiqueta: string): ResultadoSaneo<Carga> {
  const avisos: string[] = [];
  const c = (cruda ?? {}) as Partial<Carga> & Record<string, unknown>;

  const tension = numeroPositivo(c.tensionV);
  if (tension === undefined) {
    avisos.push(`${etiqueta}: tensión inválida, se usa ${TENSION_FALLBACK} V.`);
  }

  const tipo = unoDe(c.tipo, TIPOS);
  if (tipo === undefined && c.tipo !== undefined) {
    avisos.push(`${etiqueta}: tipo de carga desconocido ("${String(c.tipo)}"), se usa "otro".`);
  }

  const fases = unoDe(c.fases, FASES);
  if (fases === undefined && c.fases !== undefined) {
    avisos.push(`${etiqueta}: fases inválidas ("${String(c.fases)}"), se usa 3F.`);
  }

  const fs = numeroPositivo(c.factorServicio);
  if (fs === undefined && c.factorServicio !== undefined) {
    avisos.push(`${etiqueta}: factor de servicio inválido, se usa 1.`);
  }

  const potencia = numeroPositivo(c.potenciaKw);
  const corriente = numeroPositivo(c.corrienteA);
  if (potencia === undefined && corriente === undefined) {
    avisos.push(`${etiqueta}: no tiene potencia ni corriente utilizable.`);
  }

  const arranque = unoDe(c.arranque, ARRANQUES);
  if (arranque === undefined && c.arranque !== undefined) {
    avisos.push(`${etiqueta}: arranque desconocido ("${String(c.arranque)}"), se omite.`);
  }

  const saneada: Carga = {
    id: typeof c.id === 'string' && c.id !== '' ? c.id : `c-sane-${Math.random().toString(36).slice(2, 9)}`,
    descripcion: typeof c.descripcion === 'string' ? c.descripcion : '',
    tipo: tipo ?? 'otro',
    tensionV: tension ?? TENSION_FALLBACK,
    fases: fases ?? '3F',
    factorServicio: fs ?? 1,
  };

  if (potencia !== undefined) saneada.potenciaKw = potencia;
  if (corriente !== undefined) saneada.corrienteA = corriente;

  const proteccion = numeroPositivo(c.corrienteProteccionA);
  if (proteccion !== undefined) saneada.corrienteProteccionA = proteccion;

  const unidad = unoDe(c.unidadPotencia, UNIDADES);
  if (unidad !== undefined) saneada.unidadPotencia = unidad;

  const cosPhi = fraccion(c.cosPhi);
  if (cosPhi !== undefined) saneada.cosPhi = cosPhi;

  const rendimiento = fraccion(c.rendimiento);
  if (rendimiento !== undefined) saneada.rendimiento = rendimiento;

  if (arranque !== undefined) saneada.arranque = arranque;

  return { valor: saneada, avisos };
}

/** Sanea una lista de cargas, numerando los avisos por posición. */
export function sanearCargas(crudas: unknown, contexto: string): ResultadoSaneo<Carga[]> {
  if (!Array.isArray(crudas)) return { valor: [], avisos: [] };
  const avisos: string[] = [];
  const valor = crudas.map((c, i) => {
    const r = sanearCarga(c, `${contexto} fila ${i + 1}`);
    avisos.push(...r.avisos);
    return r.valor;
  });
  return { valor, avisos };
}
