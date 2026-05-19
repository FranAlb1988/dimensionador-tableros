// Punto de entrada del importador. Toma filas crudas + mapeo + valores globales
// y produce CargaCandidata[] listas para la vista previa.

import type { Carga, UnidadPotencia } from '../types';
import { aKw } from '../util/potencia';
import {
  parsearArranque,
  parsearFases,
  parsearNumero,
  parsearTipo,
  parsearUnidadPotencia,
} from './normalizar';
import { detectarUnidadPotenciaDeHeader } from './auto-mapeo';
import type {
  CargaCandidata,
  FilaCruda,
  HojaArchivo,
  MapeoColumnas,
  ValoresGlobales,
} from './types';

export { parsearArchivo } from './excel';
export { autoMapear } from './auto-mapeo';
export { VALORES_GLOBALES_DEFAULT } from './types';
export type {
  ArchivoParseado,
  CampoMapeable,
  CargaCandidata,
  HojaArchivo,
  MapeoColumnas,
  ValoresGlobales,
} from './types';

let idCounter = 0;
function nextTempId(): string {
  idCounter += 1;
  return `imp-${Date.now().toString(36)}-${idCounter}`;
}

/** Convierte una hoja parseada en candidatos de Carga aplicando mapeo + valores globales. */
export function construirCandidatas(
  hoja: HojaArchivo,
  mapeo: MapeoColumnas,
  globales: ValoresGlobales,
): CargaCandidata[] {
  const unidadHeader = detectarUnidadPotenciaDeHeader(mapeo.potencia);
  return hoja.filas.map((fila) => construirUna(fila, mapeo, globales, unidadHeader));
}

function construirUna(
  fila: FilaCruda,
  mapeo: MapeoColumnas,
  globales: ValoresGlobales,
  unidadDetectada: UnidadPotencia | undefined,
): CargaCandidata {
  const warnings: string[] = [];

  const descRaw = mapeo.descripcion ? cell(fila, mapeo.descripcion) : '';
  const tagRaw = mapeo.tag ? cell(fila, mapeo.tag) : '';
  const desc = String(descRaw).trim();
  const tag = String(tagRaw).trim();
  const descripcion = tag && desc ? `${tag} — ${desc}` : tag || desc || '(sin descripción)';

  let unidadPotencia: UnidadPotencia = unidadDetectada ?? globales.unidadPotencia;
  // Si una celda dentro de la columna mapeada incluye su unidad (p.ej. "10 HP"), respetarla.
  const potenciaRaw = mapeo.potencia ? cell(fila, mapeo.potencia) : undefined;
  const unidadEnCelda = typeof potenciaRaw === 'string' ? parsearUnidadPotencia(potenciaRaw) : undefined;
  if (unidadEnCelda) unidadPotencia = unidadEnCelda;

  const potencia = parsearNumero(potenciaRaw);
  const potenciaKw =
    potencia != null ? aKw(potencia, unidadPotencia) : undefined;

  const corrienteA = mapeo.corrienteA ? parsearNumero(cell(fila, mapeo.corrienteA)) : undefined;

  const tipoRaw = mapeo.tipo ? String(cell(fila, mapeo.tipo) ?? '') : '';
  // El "tipo" suele venir indirectamente del partidor (MCP/VDF → motor).
  const arranqueCell = mapeo.arranque ? String(cell(fila, mapeo.arranque) ?? '') : '';
  const tipoDesdeArranque = arranqueCell ? parsearTipo(arranqueCell, globales.tipoFallback) : globales.tipoFallback;
  const tipo = tipoRaw
    ? parsearTipo(tipoRaw, tipoDesdeArranque)
    : tipoDesdeArranque;

  let arranque = arranqueCell ? parsearArranque(arranqueCell) : undefined;
  if (tipo === 'motor' && !arranque) arranque = globales.arranqueMotorFallback;

  const tensionV =
    (mapeo.tensionV ? parsearNumero(cell(fila, mapeo.tensionV)) : undefined) ?? globales.tensionV;

  const fasesRaw = mapeo.fases ? String(cell(fila, mapeo.fases) ?? '') : '';
  const fases = parsearFases(fasesRaw, globales.fases);

  const fs =
    (mapeo.factorServicio ? parsearNumero(cell(fila, mapeo.factorServicio)) : undefined) ?? globales.factorServicio;

  if (!desc && !tag) warnings.push('Sin descripción ni tag.');
  if (potenciaKw == null && corrienteA == null) warnings.push('Sin potencia ni corriente.');
  if (tipo === 'motor' && potencia != null && potencia <= 0)
    warnings.push('Potencia 0 para un motor.');

  const carga: Omit<Carga, 'id'> = {
    descripcion,
    tipo,
    tensionV,
    fases,
    factorServicio: fs,
    ...(potenciaKw != null ? { potenciaKw, unidadPotencia } : {}),
    ...(corrienteA != null ? { corrienteA } : {}),
    ...(arranque ? { arranque } : {}),
  };

  return {
    ...carga,
    tempId: nextTempId(),
    incluir: warnings.length === 0,
    warnings,
  };
}

function cell(fila: FilaCruda, key: string): string | number | boolean | null | undefined {
  return fila[key];
}

/** Convierte una candidata aceptada a una Carga con id final. */
export function candidataACarga(c: CargaCandidata, id: string): Carga {
  const carga: Carga = {
    id,
    descripcion: c.descripcion,
    tipo: c.tipo,
    tensionV: c.tensionV,
    fases: c.fases,
    factorServicio: c.factorServicio,
    ...(c.potenciaKw != null ? { potenciaKw: c.potenciaKw } : {}),
    ...(c.unidadPotencia ? { unidadPotencia: c.unidadPotencia } : {}),
    ...(c.corrienteA != null ? { corrienteA: c.corrienteA } : {}),
    ...(c.corrienteProteccionA != null ? { corrienteProteccionA: c.corrienteProteccionA } : {}),
    ...(c.arranque ? { arranque: c.arranque } : {}),
  };
  return carga;
}
