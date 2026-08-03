// Catálogo de interruptores miniatura (MCB) Schneider BT — Acti9 y afines.
//
// Reemplaza al placeholder ic60.json: referencias comerciales reales (A9F…,
// A9N…) con Icn/Icu por tensión, curvas B/C/D/K/Z, disponibilidad en Chile y
// dimensiones. El JSON está normalizado: la familia lleva el valor modal de
// cada campo y el modelo solo guarda el override (null = sin dato).

import mcbData from '../data/schneider/mcb.json';

export type EstadoChileMcb = 'chile' | 'global' | 'noVerificado' | 'noChile';
export type CurvaMcb = 'B' | 'C' | 'D' | 'K' | 'Z';

export interface Mcb {
  familia: string;
  referencia: string;
  estadoChile: EstadoChileMcb;
  /** Configuración de polos: 1P, 1P+N, 2P, 3P, 3P+N, 4P. */
  polos: string;
  polosProtegidos: 1 | 2 | 3 | 4;
  inA: number;
  curva: CurvaMcb;
  /** AC, AC/DC, DC o PV DC. */
  servicio: string;
  iec60898?: boolean;
  icn230Ka?: number;
  icn400Ka?: number;
  iec60947?: boolean;
  icu230FnKa?: number;
  icu240FfKa?: number;
  icu415FfKa?: number;
  /** Ics como porcentaje de Icu. */
  icsPct?: number;
  ueDcMaxV?: number;
  icuDc125Ka?: number;
  icuDc250Ka?: number;
  icuDc500Ka?: number;
  icuDc800Ka?: number;
  ueAcMaxV?: number;
  uiV?: number;
  uimpKv?: number;
  claseLimitacion?: number;
  /** Ancho en módulos de 9 mm (un paso DIN de 18 mm = 2). */
  modulos9mm?: number;
  anchoMm?: number;
  altoMm?: number;
  profundidadMm?: number;
  pesoKg?: number;
  vidaElectrica?: number;
  vidaMecanica?: number;
  /** Índices dentro de `notas`. */
  aplicacion?: number;
  accesorios?: number;
  conexion?: number;
  fuente?: number;
  url?: number;
  notaTecnica?: number;
}

export interface CurvaMcbInfo {
  curva: string;
  banda60898?: string;
  umbral60947?: string;
  comportamiento?: string;
  cargaTipica?: string;
  verificacion?: string;
}

interface FamiliaJson extends Partial<Record<string, unknown>> {
  nombre: string;
}

// El JSON guarda familia (modal) + modelo (override); aquí se aplana una vez.
const FAMILIAS_JSON = mcbData.familias as FamiliaJson[];
const POR_FAMILIA = new Map(FAMILIAS_JSON.map((f) => [f.nombre, f]));

const MCB: readonly Mcb[] = (mcbData.modelos as Record<string, unknown>[]).map((m) => {
  const base = POR_FAMILIA.get(m.familia as string) ?? { nombre: '' };
  const fusion: Record<string, unknown> = { ...base, ...m };
  delete fusion.nombre;
  for (const k of Object.keys(fusion)) {
    if (fusion[k] == null) delete fusion[k];
  }
  return fusion as unknown as Mcb;
});

const NOTAS = mcbData.notas as string[];
const CURVAS: readonly CurvaMcbInfo[] = mcbData.curvas as CurvaMcbInfo[];

export function notaMcb(i: number | undefined): string | undefined {
  return i == null ? undefined : NOTAS[i];
}

export function familiasMcb(): string[] {
  return [...new Set(MCB.map((m) => m.familia))].sort();
}

/** Tabla de curvas de disparo (banda magnética, carga típica, verificación). */
export function curvasMcb(): readonly CurvaMcbInfo[] {
  return CURVAS;
}

export const MCB_DISPONIBLES = MCB;

/**
 * Capacidad de ruptura aplicable a la tensión de la carga, en kA.
 * 1F usa las columnas F-N (230 V); 2F/3F las F-F (240 o 380/415 V según
 * tensión). Icu (IEC 60947-2) prevalece; Icn (IEC 60898-1) es el respaldo.
 */
export function capacidadMcbKa(m: Mcb, tensionV: number, fases: '1F' | '2F' | '3F'): number | undefined {
  if (fases === '1F') return m.icu230FnKa ?? m.icn230Ka;
  if (tensionV <= 250) return m.icu240FfKa ?? m.icn230Ka;
  return m.icu415FfKa ?? m.icn400Ka;
}

export interface OpcionesMcb {
  /** Fases de la carga: determina polos protegidos y columna de capacidad. */
  fases?: '1F' | '2F' | '3F';
  /** Curva de disparo requerida (C por defecto). */
  curva?: CurvaMcb;
  /** Cortocircuito en la barra: exige capacidad ≥ este valor. */
  iccKa?: number;
  /** Tensión de la carga (para elegir la columna de capacidad). */
  tensionV?: number;
  /** Con neutro seccionado (1P+N / 3P+N en vez de 1P / 3P). */
  conNeutro?: boolean;
  /** Excluir referencias no publicadas en Chile. */
  soloChile?: boolean;
  /** Limitar a una familia concreta (p.ej. "Acti9 iC60N"). */
  familia?: string;
  /** Limitar a un conjunto de familias (allowlist). */
  familias?: readonly string[];
}

const POLOS_POR_FASES: Record<'1F' | '2F' | '3F', 1 | 2 | 3> = { '1F': 1, '2F': 2, '3F': 3 };

/**
 * Menor MCB (por In, luego por capacidad) que protege la corriente pedida.
 * Solo referencias AC o AC/DC — las familias DC puras (C60H-DC, C60PV-DC)
 * quedan fuera; para circuitos DC filtrar MCB_DISPONIBLES por servicio.
 * Devuelve undefined si ninguna referencia alcanza.
 */
export function sugerirMcb(corrienteA: number, opciones: OpcionesMcb = {}): Mcb | undefined {
  if (!(corrienteA > 0)) return undefined;
  const fases = opciones.fases ?? '3F';
  const curva = opciones.curva ?? 'C';
  const tensionV = opciones.tensionV ?? (fases === '1F' ? 230 : 400);
  const polos = POLOS_POR_FASES[fases];

  const candidatos = MCB.filter((m) => {
    if (m.servicio !== 'AC' && m.servicio !== 'AC/DC') return false;
    if (m.curva !== curva) return false;
    if (m.polosProtegidos !== polos) return false;
    if (opciones.conNeutro != null && m.polos.includes('+N') !== opciones.conNeutro) return false;
    if (opciones.soloChile && m.estadoChile !== 'chile') return false;
    if (opciones.familia && m.familia !== opciones.familia) return false;
    if (opciones.familias && !opciones.familias.includes(m.familia)) return false;
    if (m.inA < corrienteA) return false;
    if (opciones.iccKa != null) {
      const cap = capacidadMcbKa(m, tensionV, fases);
      if (cap == null || cap < opciones.iccKa) return false;
    }
    return true;
  });
  if (candidatos.length === 0) return undefined;

  // Menor In que alcanza; ante empate, la menor capacidad (evita sobre-
  // especificar familia) y el menor ancho.
  return candidatos.toSorted((a, b) => {
    if (a.inA !== b.inA) return a.inA - b.inA;
    const ca = capacidadMcbKa(a, tensionV, fases) ?? Infinity;
    const cb = capacidadMcbKa(b, tensionV, fases) ?? Infinity;
    if (ca !== cb) return ca - cb;
    return (a.anchoMm ?? Infinity) - (b.anchoMm ?? Infinity);
  })[0];
}
