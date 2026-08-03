// Catálogo de interruptores de caja moldeada (MCCB) Schneider BT — IEC.
//
// Reemplaza a los placeholders nsx.json / nsx-ma.json: referencias comerciales
// reales (C10F3TM016…) con Icu por clase de tensión, unidades de disparo
// TM-D / MicroLogic / MA, y las variantes 1P-4P que antes se fabricaban por
// sustitución de texto. El JSON está normalizado: el grupo
// (bastidor + clase + polos) lleva el valor modal y el modelo solo el override.

import mccbData from '../data/schneider/mccb.json';

export type EstadoChileMccb = 'chile' | 'noVerificado';

/**
 * Clase de poder de corte, de menor a mayor Icu. Es la letra que distingue
 * dos referencias del mismo bastidor y calibre: C10**F**3TM016 vs C10**H**3TM016.
 */
export const CLASES_CORTE = ['E', 'B', 'F', 'M', 'N', 'H', 'S', 'L', 'R'] as const;
export type ClaseCorte = (typeof CLASES_CORTE)[number];

export interface Mccb {
  familia: string;
  /** Bastidor: NSX100, NSXm160, NS630, CVS250, EZC100… */
  bastidor: string;
  clase: ClaseCorte;
  referencia: string;
  inA: number;
  polos: 1 | 2 | 3 | 4;
  /** Polos protegidos tal como los declara el catálogo: "3P 3d", "4P 3d"… */
  polosProtegidos: string;
  /** Unidad de disparo: TM-D, MA, MicroLogic 2.2, ETS 2.0… */
  unidadDisparo: string;
  /** Termomagnética, Electrónica, Magnética o Electrónica configurable. */
  tecnologia: string;
  /** Funciones de protección: L (largo), S (corto), I (instantáneo), IΔn. */
  funciones: string;
  icu415Ka?: number;
  ics415Ka?: number;
  icuRefKa?: number;
  tensionIcuRef?: string;
  ueMaxV?: number;
  uiV?: number;
  uimpKv?: number;
  /** Bloque diferencial integrado (Vigi). */
  diferencial?: boolean;
  /** Medición de energía integrada. */
  medicion?: boolean;
  anchoMm?: number;
  altoMm?: number;
  profundidadMm?: number;
  pesoKg?: number;
  /** false = requiere unidad MicroLogic pedida por separado. */
  completo?: boolean;
  estadoChile: EstadoChileMccb;
  /** Índices dentro de `notas`. */
  aplicacion?: number;
  ajustes?: number;
  comunicacion?: number;
  conexion?: number;
  fuente?: number;
  url?: number;
  observacion?: number;
}

/** Icu por clase de tensión, para las tensiones que la fila del modelo no trae. */
export interface PrestacionMccb {
  familia: string;
  rango: string;
  clase: string;
  icu240Ka?: number;
  icu415Ka?: number;
  icu440Ka?: number;
  icu500Ka?: number;
  icu525Ka?: number;
  icu690Ka?: number;
  ics415Ka?: number;
  uiV?: number;
  uimpKv?: number;
  nota?: number;
}

export interface UnidadDisparoMccb {
  familia: string;
  unidad: string;
  funciones?: string;
  ajustes?: number;
  aplicacion?: number;
  criterio?: number;
}

interface GrupoJson {
  bastidor: string;
  clase: string;
  polos: number;
  [k: string]: unknown;
}

const GRUPOS = mccbData.grupos as GrupoJson[];
const POR_GRUPO = new Map(GRUPOS.map((g) => [`${g.bastidor}|${g.clase}|${g.polos}`, g]));

const MCCB: readonly Mccb[] = (mccbData.modelos as Record<string, unknown>[]).map((m) => {
  const clave = `${m.bastidor as string}|${m.clase as string}|${m.polos as number}`;
  const fusion: Record<string, unknown> = { ...POR_GRUPO.get(clave), ...m };
  for (const k of Object.keys(fusion)) {
    if (fusion[k] == null) delete fusion[k];
  }
  return fusion as unknown as Mccb;
});

const NOTAS = mccbData.notas as string[];
const PRESTACIONES = mccbData.prestaciones as PrestacionMccb[];
const UNIDADES = mccbData.unidades as UnidadDisparoMccb[];

export function notaMccb(i: number | undefined): string | undefined {
  return i == null ? undefined : NOTAS[i];
}

export function familiasMccb(): string[] {
  return [...new Set(MCCB.map((m) => m.familia))].sort();
}

export function bastidoresMccb(): string[] {
  return [...new Set(MCCB.map((m) => m.bastidor))].sort();
}

export function prestacionesMccb(): readonly PrestacionMccb[] {
  return PRESTACIONES;
}

export function unidadesDisparoMccb(): readonly UnidadDisparoMccb[] {
  return UNIDADES;
}

export const MCCB_DISPONIBLES = MCCB;

const ORDEN_CLASE = new Map(CLASES_CORTE.map((c, i) => [c as string, i]));

/**
 * Icu aplicable a la tensión de servicio, en kA.
 * La fila del modelo solo trae 415 V (y 240 V para las referencias 1P/2P);
 * para 440-690 V se consulta la matriz de prestaciones por familia y clase.
 */
export function capacidadMccbKa(m: Mccb, tensionV: number): number | undefined {
  if (tensionV <= 250) {
    const p = prestacionDe(m);
    return p?.icu240Ka ?? (m.tensionIcuRef?.startsWith('220') ? m.icuRefKa : undefined);
  }
  if (tensionV <= 415) return m.icu415Ka ?? prestacionDe(m)?.icu415Ka;
  const p = prestacionDe(m);
  if (!p) return undefined;
  if (tensionV <= 440) return p.icu440Ka;
  if (tensionV <= 500) return p.icu500Ka;
  if (tensionV <= 525) return p.icu525Ka;
  if (tensionV <= 690) return p.icu690Ka;
  return undefined;
}

/**
 * Fila de la matriz de prestaciones que cubre a este modelo. El `rango` del
 * catálogo agrupa bastidores ("NSX100-250", "NS630b-1600", "16-160 A"), así
 * que se compara por familia + clase y se desempata por el número del bastidor.
 *
 * La familia se compara exacta: "ComPacT NSXm" NO puede resolver a las filas
 * de "ComPacT NSX" ni al revés (un startsWith daría al NSX100 las prestaciones
 * del NSXm, que son menores). La única fila que cubre dos familias es
 * "EasyPact EZC/EZCV", que se separa por la barra.
 */
function familiaCoincide(prestacion: string, modelo: string): boolean {
  if (prestacion === modelo) return true;
  if (!prestacion.includes('/')) return false;
  // "EasyPact EZC/EZCV" → ["EasyPact EZC", "EasyPact EZCV"]
  const corte = prestacion.lastIndexOf(' ');
  const prefijo = prestacion.slice(0, corte + 1);
  return prestacion.slice(corte + 1).split('/').some((s) => prefijo + s === modelo);
}

function prestacionDe(m: Mccb): PrestacionMccb | undefined {
  const candidatos = PRESTACIONES.filter(
    (p) => p.clase === m.clase && familiaCoincide(p.familia, m.familia),
  );
  if (candidatos.length <= 1) return candidatos[0];
  // "NS1600b-3200" nombra su bastidor de arranque: gana sobre el rango
  // numérico, que también contiene el 1600 de "NS630b-1600".
  const exacto = candidatos.find((p) => p.rango.startsWith(`${m.bastidor}-`));
  if (exacto) return exacto;
  const calibre = Number(m.bastidor.replace(/\D+/g, '')) || m.inA;
  return candidatos.find((p) => {
    const nums = p.rango.match(/\d+/g)?.map(Number) ?? [];
    if (nums.length < 2) return false;
    return calibre >= nums[0]! && calibre <= nums[nums.length - 1]!;
  }) ?? candidatos[0];
}

export interface OpcionesMccb {
  /** Polos requeridos (3 por defecto). */
  polos?: 1 | 2 | 3 | 4;
  /** Cortocircuito en la barra: exige Icu ≥ este valor a `tensionV`. */
  iccKa?: number;
  /** Tensión de servicio, para elegir la columna de Icu (400 V por defecto). */
  tensionV?: number;
  /**
   * Tecnología de la unidad de disparo:
   *  - 'termomagnetica' → TM-D, protección L+I (alimentadores y cables)
   *  - 'magnetica'      → MA, solo cortocircuito (motor con arrancador,
   *                       coordinación tipo 2 IEC 60947-4-1)
   *  - 'electronica'    → MicroLogic / ETS, protección LSI ajustable
   */
  tecnologia?: 'termomagnetica' | 'magnetica' | 'electronica';
  /**
   * Exigir (o excluir) protección de sobrecarga — la función L del catálogo.
   * true: solo unidades LI/LSI, las que protegen el cable contra sobrecarga.
   * false: solo unidades sin L (MA, funciones "I"), para motor con arrancador.
   *
   * Es el filtro correcto para un alimentador: sin él, una unidad MA de 3 A
   * gana la selección por tener el In más bajo y deja la carga sin protección
   * térmica.
   */
  protegeSobrecarga?: boolean;
  /** Exigir bloque diferencial integrado (Vigi). */
  diferencial?: boolean;
  /** Excluir referencias no publicadas en Chile. */
  soloChile?: boolean;
  /** Limitar a una clase de corte concreta. */
  clase?: ClaseCorte;
  /** Limitar a una familia (p.ej. "ComPacT NSX"). */
  familia?: string;
  /** Limitar a un conjunto de familias (allowlist). */
  familias?: readonly string[];
  /** Excluir referencias que requieren pedir la unidad de disparo aparte. */
  soloCompletos?: boolean;
  /**
   * Invierte el desempate a igual In: la mayor Icu en vez de la menor.
   * Para cuando ninguna clase alcanza la Icc y se quiere el mejor esfuerzo.
   */
  preferirMayorIcu?: boolean;
}

const TECNOLOGIA_CATALOGO: Record<NonNullable<OpcionesMccb['tecnologia']>, readonly string[]> = {
  termomagnetica: ['Termomagnética'],
  magnetica: ['Magnética'],
  electronica: ['Electrónica', 'Electrónica configurable'],
};

/**
 * Menor MCCB que cubre la corriente pedida, por In y luego por Icu.
 * Devuelve undefined si ninguna referencia alcanza (corriente fuera de
 * catálogo o Icc mayor que la clase más alta del bastidor que la soporta).
 */
export function sugerirMccb(corrienteA: number, opciones: OpcionesMccb = {}): Mccb | undefined {
  if (!(corrienteA > 0)) return undefined;
  const polos = opciones.polos ?? 3;
  const tensionV = opciones.tensionV ?? 400;
  const tecnologias = opciones.tecnologia ? TECNOLOGIA_CATALOGO[opciones.tecnologia] : null;

  const candidatos = MCCB.filter((m) => {
    if (m.polos !== polos) return false;
    if (m.inA < corrienteA) return false;
    if (tecnologias && !tecnologias.includes(m.tecnologia)) return false;
    if (opciones.protegeSobrecarga != null
      && m.funciones.includes('L') !== opciones.protegeSobrecarga) return false;
    if (opciones.diferencial != null && (m.diferencial ?? false) !== opciones.diferencial) return false;
    if (opciones.soloChile && m.estadoChile !== 'chile') return false;
    if (opciones.clase && m.clase !== opciones.clase) return false;
    if (opciones.familia && m.familia !== opciones.familia) return false;
    if (opciones.familias && !opciones.familias.includes(m.familia)) return false;
    if (opciones.soloCompletos && m.completo === false) return false;
    if (m.ueMaxV != null && m.ueMaxV < tensionV) return false;
    if (opciones.iccKa != null) {
      const cap = capacidadMccbKa(m, tensionV);
      if (cap == null || cap < opciones.iccKa) return false;
    }
    return true;
  });
  if (candidatos.length === 0) return undefined;

  // Menor In que alcanza; ante empate, la menor capacidad (no sobreespecificar
  // la clase), luego la clase más baja y el menor ancho. Con `preferirMayorIcu`
  // el desempate por capacidad se invierte.
  const signo = opciones.preferirMayorIcu ? -1 : 1;
  return candidatos.toSorted((a, b) => {
    if (a.inA !== b.inA) return a.inA - b.inA;
    const ca = capacidadMccbKa(a, tensionV) ?? (opciones.preferirMayorIcu ? -Infinity : Infinity);
    const cb = capacidadMccbKa(b, tensionV) ?? (opciones.preferirMayorIcu ? -Infinity : Infinity);
    if (ca !== cb) return signo * (ca - cb);
    const oa = ORDEN_CLASE.get(a.clase) ?? Infinity;
    const ob = ORDEN_CLASE.get(b.clase) ?? Infinity;
    if (oa !== ob) return signo * (oa - ob);
    return (a.anchoMm ?? Infinity) - (b.anchoMm ?? Infinity);
  })[0];
}
