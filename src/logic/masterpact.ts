// Catálogo MasterPact MTZ — interruptores de aire (ACB) 630-6300 A.
//
// Reemplaza al placeholder masterpact.json, que tenía 15 referencias con un
// solo Icu por calibre. La diferencia que importa es que el catálogo real trae
// el NIVEL (N1/H1/H1b/H2/H2V/H3/L1…) como dimensión independiente del calibre:
// el mismo In existe en varios niveles con Icu muy distintos. Sin esa
// dimensión, la única forma de subir el poder de corte era subir de calibre,
// que es lo que hacía que un tablero de 170 A con Icc 85 kA terminara con un
// ACB de 4000 A.

import mpData from '../data/schneider/masterpact.json';

export interface Masterpact {
  /** MTZ Active o MTZ MicroLogic X. */
  generacion: string;
  /** MTZ1, MTZ2 o MTZ3. */
  bastidor: string;
  /** Nivel de poder de corte: N1, N2, H1, H1b, H2, H2V, H3, L1, H10. */
  nivel: string;
  inA: number;
  polos: string;
  /** Fijo o Extraíble. */
  ejecucion: string;
  ueMaxV?: number;
  icu415Ka?: number;
  icu440Ka?: number;
  icu525Ka?: number;
  icu690Ka?: number;
  icu1150Ka?: number;
  icsPct?: number;
  /** Corriente admisible de corta duración, 1 s. */
  icw1sKa?: number;
  /** Categoría IEC 60947-2: B admite selectividad cronométrica. */
  categoriaIec?: string;
  anchoMm?: number;
  altoMm?: number;
  profundidadMm?: number;
  pesoKg?: number;
  /**
   * Referencia del interruptor base. No es equipo completo: requiere unidad de
   * control MicroLogic y conexiones. Ausente en los niveles cuyo SKU no publica
   * el catálogo (MTZ2 H1b, N2 y H10).
   */
  referencia?: string;
  fuente?: number;
}

const MP: readonly Masterpact[] = mpData.modelos as Masterpact[];
const NOTAS = mpData.notas as string[];

export function notaMasterpact(i: number | undefined): string | undefined {
  return i == null ? undefined : NOTAS[i];
}

export const MASTERPACT_DISPONIBLES = MP;

export function bastidoresMasterpact(): string[] {
  return [...new Set(MP.map((m) => m.bastidor))].sort();
}

export function nivelesMasterpact(): string[] {
  return [...new Set(MP.map((m) => m.nivel))].sort();
}

/** Icu aplicable a la tensión de servicio, en kA. */
export function capacidadMasterpactKa(m: Masterpact, tensionV: number): number | undefined {
  if (tensionV <= 440) return m.icu415Ka ?? m.icu440Ka;
  if (tensionV <= 525) return m.icu525Ka;
  if (tensionV <= 690) return m.icu690Ka;
  if (tensionV <= 1150) return m.icu1150Ka;
  return undefined;
}

export interface OpcionesMasterpact {
  tensionV?: number;
  /** Cortocircuito de barra: exige Icu ≥ este valor a `tensionV`. */
  iccKa?: number;
  polos?: '3P' | '4P';
  ejecucion?: 'Fijo' | 'Extraíble';
  generacion?: string;
  /** Exigir que el modelo tenga referencia base publicada. */
  soloConReferencia?: boolean;
  /** Icw mínima de corta duración, para selectividad cronométrica. */
  icw1sKaMin?: number;
}

/**
 * Menor MasterPact que cubre la corriente y la Icc pedidas.
 *
 * El orden es deliberado: primero el menor calibre que sirve, y recién dentro
 * de ese calibre el nivel más bajo que alcanza la Icc. Así el poder de corte
 * se consigue subiendo de nivel —que es para lo que existe el nivel— y no
 * subiendo de bastidor.
 */
export function sugerirMasterpact(
  corrienteA: number,
  opciones: OpcionesMasterpact = {},
): Masterpact | undefined {
  if (!(corrienteA > 0)) return undefined;
  const tensionV = opciones.tensionV ?? 400;

  const candidatos = MP.filter((m) => {
    if (m.inA < corrienteA) return false;
    if (opciones.polos && m.polos !== opciones.polos) return false;
    if (opciones.ejecucion && m.ejecucion !== opciones.ejecucion) return false;
    if (opciones.generacion && m.generacion !== opciones.generacion) return false;
    if (opciones.soloConReferencia && !m.referencia) return false;
    if (m.ueMaxV != null && m.ueMaxV < tensionV) return false;
    if (opciones.icw1sKaMin != null && (m.icw1sKa ?? 0) < opciones.icw1sKaMin) return false;
    if (opciones.iccKa != null) {
      const cap = capacidadMasterpactKa(m, tensionV);
      if (cap == null || cap < opciones.iccKa) return false;
    }
    return true;
  });
  if (candidatos.length === 0) return undefined;

  return candidatos.toSorted((a, b) => {
    if (a.inA !== b.inA) return a.inA - b.inA;
    // Dentro del calibre manda el tamaño del bastidor, no la capacidad: el
    // bastidor fija la envolvente del tablero. Entre un MTZ1 nivel L1 (150 kA)
    // y un MTZ2 nivel H2 (100 kA) para una Icc de 100, el MTZ1 cumple y ocupa
    // 276 mm contra 422; ordenar por capacidad primero elegía el MTZ2 solo por
    // no pasarse de kA, y se llevaba un bastidor entero de más.
    const aa = a.anchoMm ?? Infinity;
    const ab = b.anchoMm ?? Infinity;
    if (aa !== ab) return aa - ab;
    // Ya dentro del mismo bastidor: el nivel justo, no el mayor disponible.
    const ca = capacidadMasterpactKa(a, tensionV) ?? Infinity;
    const cb = capacidadMasterpactKa(b, tensionV) ?? Infinity;
    return ca - cb;
  })[0];
}
