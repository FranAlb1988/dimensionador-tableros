// Heurísticas de auto-detección de columnas para archivos Excel/CSV.

import type { CampoMapeable, MapeoColumnas } from './types';
import { norm, parsearUnidadPotencia } from './normalizar';
import type { UnidadPotencia } from '../types';

interface Regla {
  campo: CampoMapeable;
  patrones: RegExp[];
}

// Columnas que DATAEXTRACTION de AutoCAD agrega automáticamente y nunca son útiles para nosotros.
const HEADERS_IGNORADOS = new Set(['count', 'name', 'cantidad', 'nombre bloque', 'block name', 'block', 'bloque']);

// El orden importa: la primera regla que matchea gana.
const REGLAS: readonly Regla[] = [
  { campo: 'tag', patrones: [/^tag$/, /^tag\s*id$/, /^tagid$/, /equip.*tag/, /id\s*equip/, /n[º°]\s*tag/, /tag\s*motor/, /tag\s*equip/] },
  { campo: 'descripcion', patrones: [/^desc/, /servicio/, /descripcion/, /equipo/, /servicio$/, /service/, /denominacion/] },
  { campo: 'potencia', patrones: [/p\s*\(hp\)/, /p\s*\(kw\)/, /pot.*hp/, /pot.*kw/, /^hp$/, /^kw$/, /potencia/, /power/, /^p$/, /\bkva\b/] },
  { campo: 'corrienteA', patrones: [/fla/, /\bin\b/, /amp(?!ere\s*frame)/, /^i\s*\(a\)$/, /corriente/, /current/, /flc/] },
  { campo: 'tipo', patrones: [/^tipo$/, /^type$/, /^carga$/, /tipo\s*carga/, /tipo\s*equipo/, /load\s*type/] },
  // "tipo de salida" es como la planilla de unilineales rotula la columna que
  // define el partidor (Partida Directa / Partida VSD / Feeder).
  { campo: 'arranque', patrones: [/arranque/, /starter/, /partidor/, /tipo\s*partidor/, /starter\s*type/, /tipo\s*de\s*salida/, /tipo\s*salida/] },
  { campo: 'tensionV', patrones: [/tensi[oó]n/, /voltaje/, /voltage/, /^v$/, /\bvolts?\b/] },
  { campo: 'fases', patrones: [/fase/, /phase/, /φ/, /^ph$/] },
  { campo: 'factorServicio', patrones: [/factor\s*serv/, /service\s*factor/, /^fs$/, /^sf$/] },
];

/** Detecta automáticamente el mapeo de columnas a campos del modelo. */
export function autoMapear(headers: readonly string[]): MapeoColumnas {
  const mapeo: MapeoColumnas = {};
  const usados = new Set<string>();
  for (const r of REGLAS) {
    for (const h of headers) {
      if (usados.has(h)) continue;
      const n = norm(h);
      if (HEADERS_IGNORADOS.has(n)) continue;
      if (r.patrones.some((p) => p.test(n))) {
        mapeo[r.campo] = h;
        usados.add(h);
        break;
      }
    }
  }
  return mapeo;
}

/** Heurística: si el header de potencia contiene "HP" o "kW", úsalo como unidad. */
export function detectarUnidadPotenciaDeHeader(header: string | undefined): UnidadPotencia | undefined {
  if (!header) return undefined;
  return parsearUnidadPotencia(header);
}
