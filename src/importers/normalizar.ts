// Normalizadores: convierten valores crudos del Excel/CSV a los enums del modelo.
// Tolerantes a mayúsculas, espacios, acentos y variantes de escritura.

import type { Fases, TipoArranque, TipoCarga, UnidadPotencia } from '../types';

/** Quita acentos, normaliza Δ→d (estrella-triángulo), pasa a minúsculas. */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[δΔ]/g, 'd')
    .toLowerCase()
    .trim();
}

const RE_HP = /\bhp\b|\bcv\b|caballos/;
const RE_KW = /\bkw\b|kilowatt/;

export function parsearUnidadPotencia(raw: string): UnidadPotencia | undefined {
  const v = norm(raw);
  if (RE_HP.test(v)) return 'HP';
  if (RE_KW.test(v)) return 'kW';
  return undefined;
}

export function parsearTipo(raw: string, fallback: TipoCarga): TipoCarga {
  const v = norm(raw);
  if (!v) return fallback;
  if (v.startsWith('mot') || v === 'mcp' || v === 'vdf' || v === 'vfd' || v === 'sst') return 'motor';
  if (v.includes('ilum') || v.includes('light')) return 'iluminacion';
  if (v.includes('toma') || v.includes('socket') || v.includes('outlet') || v.includes('recep')) return 'tomas';
  if (v.includes('resist') || v.includes('heater') || v.includes('calef')) return 'resistivo';
  if (v.includes('otro') || v.includes('other') || v.includes('feeder') || v.includes('alimentador')) return 'otro';
  return fallback;
}

export function parsearArranque(raw: string): TipoArranque | undefined {
  const v = norm(raw);
  if (!v) return undefined;
  // Partida Directa (DOL): DOL, MCP, pleno voltaje, directo, "partida directa"
  if (v === 'dol' || v === 'mcp' || v.includes('partida') || v.includes('pleno') || v.includes('directo')) return 'DOL';
  // VSD / Variador: VFD, VDF, ATV, variador, drive
  if (v === 'vsd' || v === 'vdf' || v === 'vfd' || v.includes('variad') || v.includes('atv') || v.includes('drive')) return 'variador';
  // PSV / Suave: ATS, soft starter, suave
  if (v === 'psv' || v.includes('suav') || v === 'sst' || v.includes('ats') || v.includes('soft')) return 'suave';
  // Estrella-Triángulo
  if (v === 'yd' || v === 'y-d' || v === 'y-delta' || v.includes('estrella') || v.includes('triangulo')) return 'YD';
  return undefined;
}

export function parsearFases(raw: string, fallback: Fases): Fases {
  const v = norm(raw);
  if (!v) return fallback;
  if (v === '1' || v === '1f' || v === '1ph' || v === 'i' || v.includes('mono')) return '1F';
  if (v === '3' || v === '3f' || v === '3ph' || v === 'iii' || v.includes('tri')) return '3F';
  return fallback;
}

/** Parsea número aceptando coma o punto como decimal. */
export function parsearNumero(raw: string | number | boolean | null | undefined): number | undefined {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'boolean') return raw ? 1 : 0;
  const s = String(raw).replace(',', '.').replace(/[^\d.eE+-]/g, '').trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}
