// Catálogo de protecciones de motor tipo MCP (Motor Circuit Protector).
//
// Un MCP protege SOLO contra cortocircuito: no lleva sobrecarga integrada y
// exige un relé térmico externo. Es la arquitectura de tres componentes
// (MCP + contactor + relé) que la app ya usaba con unidades NSX MA, pero el
// catálogo agrega las gamas compactas TeSys GV/BV, mucho más chicas para el
// mismo servicio, y el rango de ajuste del disparo magnético — el parámetro
// que gobierna la coordinación tipo 2 (IEC 60947-4-1).

import mcpData from '../data/schneider/mcp.json';

export type EstadoChileMcp = 'chile' | 'noVerificado' | 'norteamerica';
export type AlcanceMcp = 'IEC' | 'UL';

export interface Mcp {
  familia: string;
  /** Bastidor o tamaño: Frame 2, Frame 4, NSX100, H-Frame… */
  bastidor: string;
  referencia: string;
  /** Calibre nominal del MCP en A. */
  inA: number;
  /** Ventana de corriente de motor que cubre la referencia. */
  iSeleccionMinA?: number;
  iSeleccionMaxA?: number;
  /** Rango de ajuste del disparo magnético, en A. */
  ajusteScMinA?: number;
  ajusteScMaxA?: number;
  /** Umbral instantáneo fijo, cuando la unidad no es ajustable. */
  instantaneoFijoA?: number;
  /** IEC (declara Icu) o UL (declara SCCR). */
  alcance: AlcanceMcp;
  variante: string;
  polos: number;
  potenciaMin415Kw?: number;
  potenciaMax415Kw?: number;
  potenciaMinHp?: number;
  potenciaMaxHp?: number;
  cap240Ka?: number;
  icu415Ka?: number;
  sccr480Ka?: number;
  cap500Ka?: number;
  cap600Ka?: number;
  cap690Ka?: number;
  icsPct?: number;
  ueMaxV?: number;
  uiV?: number;
  uimpKv?: number;
  /** Magnética o Electrónica. */
  tecnologia: string;
  /** MA, Magnética ajustable, Magnética instantánea, MicroLogic 1.3 M… */
  unidadDisparo: string;
  operacion: string;
  conexion: string;
  montaje: string;
  anchoMm?: number;
  altoMm?: number;
  profundidadMm?: number;
  pesoKg?: number;
  estadoChile: EstadoChileMcp;
  /** Índices dentro de `notas`. */
  relacion?: number;
  criterioCapacidad?: number;
  releRecomendado?: number;
  normas?: number;
  coordinacion?: number;
  detalleChile?: number;
  fuente?: number;
  url?: number;
  observacion?: number;
}

export interface ArquitecturaMcp {
  arquitectura: string;
  cadena?: string;
  reparto?: string;
  equipos?: string;
  cuando?: string;
}

interface GrupoJson {
  familia: string;
  bastidor: string;
  [k: string]: unknown;
}

const GRUPOS = mcpData.grupos as GrupoJson[];
const POR_GRUPO = new Map(GRUPOS.map((g) => [`${g.familia}|${g.bastidor}`, g]));

const MCP: readonly Mcp[] = (mcpData.modelos as Record<string, unknown>[]).map((m) => {
  const clave = `${m.familia as string}|${m.bastidor as string}`;
  const fusion: Record<string, unknown> = { ...POR_GRUPO.get(clave), ...m };
  for (const k of Object.keys(fusion)) {
    if (fusion[k] == null) delete fusion[k];
  }
  return fusion as unknown as Mcp;
});

const NOTAS = mcpData.notas as string[];
const ARQUITECTURAS = mcpData.arquitecturas as ArquitecturaMcp[];

export function notaMcp(i: number | undefined): string | undefined {
  return i == null ? undefined : NOTAS[i];
}

export function familiasMcp(): string[] {
  return [...new Set(MCP.map((m) => m.familia))].sort();
}

export function arquitecturasMcp(): readonly ArquitecturaMcp[] {
  return ARQUITECTURAS;
}

export const MCP_DISPONIBLES = MCP;

/** Capacidad de ruptura aplicable a la tensión de servicio, en kA. */
export function capacidadMcpKa(m: Mcp, tensionV: number): number | undefined {
  if (m.alcance === 'UL') return m.sccr480Ka;
  if (tensionV <= 250) return m.cap240Ka ?? m.icu415Ka;
  if (tensionV <= 415) return m.icu415Ka;
  if (tensionV <= 500) return m.cap500Ka;
  if (tensionV <= 600) return m.cap600Ka;
  if (tensionV <= 690) return m.cap690Ka;
  return undefined;
}

/**
 * ¿La referencia cubre esta corriente de motor?
 * El catálogo publica una ventana de selección (`iSeleccionMin/MaxA`) que es
 * más estricta que el calibre: un GV2L de 32 A no sirve para un motor de 30 A
 * si su ventana termina en 25 A. Sin ventana declarada se usa el calibre.
 */
export function cubreCorriente(m: Mcp, corrienteA: number): boolean {
  const max = m.iSeleccionMaxA ?? m.inA;
  const min = m.iSeleccionMinA ?? 0;
  return corrienteA > min - 1e-9 && corrienteA <= max + 1e-9;
}

export interface OpcionesMcp {
  /** Cortocircuito en la barra: exige capacidad ≥ este valor. */
  iccKa?: number;
  /** Tensión de servicio (400 V por defecto). */
  tensionV?: number;
  /** IEC (por defecto) o UL. */
  alcance?: AlcanceMcp;
  /** Excluir referencias no publicadas en Chile. */
  soloChile?: boolean;
  /** Limitar a un conjunto de familias (allowlist). */
  familias?: readonly string[];
  /** Excluir las variantes con terminales para barras (sufijo 6). */
  soloReferenciaCompleta?: boolean;
}

/**
 * Menor MCP que cubre la corriente del motor.
 * Ordena por ancho antes que por calibre: entre dos referencias que sirven,
 * la que ocupa menos frente de gaveta es la correcta — que es justamente la
 * ventaja de las gamas TeSys GV sobre un NSX del mismo calibre.
 */
export function sugerirMcp(corrienteA: number, opciones: OpcionesMcp = {}): Mcp | undefined {
  if (!(corrienteA > 0)) return undefined;
  const tensionV = opciones.tensionV ?? 400;
  const alcance = opciones.alcance ?? 'IEC';

  const candidatos = MCP.filter((m) => {
    if (m.alcance !== alcance) return false;
    if (!cubreCorriente(m, corrienteA)) return false;
    if (opciones.soloChile && m.estadoChile !== 'chile') return false;
    if (opciones.familias && !opciones.familias.includes(m.familia)) return false;
    if (opciones.soloReferenciaCompleta && m.variante !== 'Referencia completa') return false;
    if (m.ueMaxV != null && m.ueMaxV < tensionV) return false;
    if (opciones.iccKa != null) {
      const cap = capacidadMcpKa(m, tensionV);
      if (cap == null || cap < opciones.iccKa) return false;
    }
    return true;
  });
  if (candidatos.length === 0) return undefined;

  return candidatos.toSorted((a, b) => {
    const anchoA = a.anchoMm ?? Infinity;
    const anchoB = b.anchoMm ?? Infinity;
    if (anchoA !== anchoB) return anchoA - anchoB;
    if (a.inA !== b.inA) return a.inA - b.inA;
    const ca = capacidadMcpKa(a, tensionV) ?? Infinity;
    const cb = capacidadMcpKa(b, tensionV) ?? Infinity;
    return ca - cb;
  })[0];
}

/**
 * Ajuste magnético sugerido para el motor, en A.
 *
 * Criterio: el umbral debe quedar sobre la punta de arranque para no disparar
 * al partir, y bajo la capacidad del relé y el cable. Con arranque directo la
 * punta típica es 6-8 × In del motor; se apunta a 8 × y se recorta al rango
 * que la referencia admite. Devuelve undefined si la unidad no es ajustable.
 */
export function ajusteMagneticoSugerido(m: Mcp, corrienteMotorA: number): number | undefined {
  if (m.ajusteScMinA == null || m.ajusteScMaxA == null) return undefined;
  if (m.ajusteScMinA === m.ajusteScMaxA) return m.ajusteScMinA;
  const objetivo = corrienteMotorA * 8;
  return Math.min(Math.max(objetivo, m.ajusteScMinA), m.ajusteScMaxA);
}

/** ¿El umbral magnético es ajustable, o viene fijo por calibre? */
export function esAjustable(m: Mcp): boolean {
  return m.ajusteScMinA != null && m.ajusteScMaxA != null && m.ajusteScMinA !== m.ajusteScMaxA;
}

/**
 * Tolerancia declarada del umbral magnético, tal como la publica el catálogo
 * (p. ej. "±20 %"). Los umbrales fijos la traen y no es un detalle menor: la
 * banda real de disparo es la que entra al estudio de coordinación.
 */
export function toleranciaMagnetica(m: Mcp): string | undefined {
  const texto = notaMcp(m.relacion);
  return texto?.match(/tolerancia\s*(±\s*\d+\s*%)/i)?.[1]?.replace(/\s+/g, ' ');
}
