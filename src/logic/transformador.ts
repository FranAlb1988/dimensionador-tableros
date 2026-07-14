// Cálculo del transformador MT/BT que alimenta un CDC.
//
// Convención: el secundario del transformador alimenta el CDC en BT. La
// corriente total del CDC sumada con un margen de crecimiento define la
// potencia aparente; se elige el primer kVA estándar IEC 60076 que la
// cubra. Las tensiones primarias y secundarias son las habituales en
// distribución industrial chilena.

/** Tensiones primarias (MT) habituales en distribución industrial Chile (kV). */
export const TENSIONES_PRIMARIAS_KV: readonly number[] = [
  2.3, 4.16, 6.6, 11, 12, 13.8, 15, 23, 33,
];

/** Tensiones secundarias (BT) habituales (V). */
export const TENSIONES_SECUNDARIAS_V: readonly number[] = [
  380, 400, 415, 440, 480, 525, 600, 690,
];

/**
 * Potencias nominales estándar IEC 60076-1 para transformadores MT/BT
 * de distribución (kVA).
 */
export const POTENCIAS_NOMINALES_KVA: readonly number[] = [
  50, 75, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800,
  1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000,
];

/** Máxima potencia estándar — sobre este valor se sugiere paralelo. */
export const MAX_KVA_ESTANDAR = POTENCIAS_NOMINALES_KVA[POTENCIAS_NOMINALES_KVA.length - 1]!;

/** Tipo constructivo del transformador. */
export type TipoTransformador = 'aceite' | 'seco';

export const TIPO_TRAFO_LABEL: Record<TipoTransformador, string> = {
  aceite: 'En aceite (oil-immersed)',
  seco: 'Seco (cast-resin)',
};

export interface ConfigTransformador {
  tensionPrimariaKv: number;
  tensionSecundariaV: number;
  /** Margen de crecimiento (0..1). */
  margen: number;
  tipo: TipoTransformador;
}

export const CONFIG_TRAFO_DEFAULT: ConfigTransformador = {
  tensionPrimariaKv: 13.8,
  tensionSecundariaV: 400,
  margen: 0.25,
  tipo: 'aceite',
};

export interface ParametrosTransformador extends ConfigTransformador {
  /** Corriente de carga del secundario (CDC), en A. */
  corrienteSecundarioA: number;
}

export interface UnidadTrafo {
  /** Potencia nominal estándar (kVA). */
  kvaNominal: number;
  /** Corriente nominal del primario (A). */
  inPrimarioA: number;
  /** Corriente nominal del secundario (A). */
  inSecundarioA: number;
  /** Pérdidas en vacío (W). */
  perdidasVacioW: number;
  /** Pérdidas en carga (W). */
  perdidasCargaW: number;
}

export interface ResultadoTransformador extends UnidadTrafo {
  /** Potencia aparente requerida por la carga + margen, en kVA. */
  kvaRequerido: number;
  /**
   * Corriente de cortocircuito trifásica en el secundario (kA), asumiendo
   * red primaria de potencia infinita: Icc = In_sec × 100 / Ucc%. Es el valor
   * conservador estándar para especificar el Icu del aparellaje BT del CDC.
   * Si el resultado es un banco en paralelo, es el aporte del banco completo.
   */
  iccSecundarioKa: number;
  /** Tipo constructivo elegido. */
  tipo: TipoTransformador;
  /** Grupo vectorial recomendado. */
  grupoVectorial: string;
  /** Impedancia de cortocircuito típica (Ucc) en %. */
  uccPorcentaje: number;
  /** True si la potencia requerida excede el mayor estándar disponible. */
  excede: boolean;
  /**
   * Sugerencia de N transformadores en paralelo cuando 1 unidad excede el
   * mayor estándar. Sus impedancias deben coincidir para repartir la carga.
   */
  paralelo?: {
    cantidad: number;
    cadaUno: UnidadTrafo;
  };
}

const SQRT3 = Math.sqrt(3);

/**
 * Ucc típica según tipo constructivo y potencia (IEC 60076-1, valores
 * típicos del mercado chileno):
 *  - Aceite: ≤630 kVA → 4%; ≤1250 → 5%; ≤2500 → 6%; >2500 → 7%.
 *  - Seco:   ≤2500 → 6%; >2500 → 7% (las series secas suelen tener Ucc
 *    superior porque el aislamiento es más voluminoso).
 */
function uccTipica(kva: number, tipo: TipoTransformador): number {
  if (tipo === 'seco') return kva <= 2500 ? 6 : 7;
  if (kva <= 630) return 4;
  if (kva <= 1250) return 5;
  if (kva <= 2500) return 6;
  return 7;
}

/**
 * Pérdidas típicas (placeholder — IEC 60076-12 / EU Reg. 548/2014 Tier 2,
 * aproximación lineal con la potencia):
 *  - Seco: P0 ≈ 2.0 W/kVA  · Pk ≈ 9.0 W/kVA.
 *  - Aceite: P0 ≈ 0.77 W/kVA · Pk ≈ 9.0 W/kVA (vacío bastante menor).
 * Para usar valores exactos del fabricante, reemplazar con el catálogo
 * Schneider Minera/Trihal, ABB ResiBloc/EcoDry, etc.
 */
function perdidasTipicas(kva: number, tipo: TipoTransformador): { vacioW: number; cargaW: number } {
  const kVacio = tipo === 'seco' ? 2.0 : 0.77;
  const kCarga = 9.0;
  return {
    vacioW: Math.round(kva * kVacio),
    cargaW: Math.round(kva * kCarga),
  };
}

function fabricarUnidad(kvaNominal: number, v2: number, v1Kv: number, tipo: TipoTransformador): UnidadTrafo {
  const inSec = v2 > 0 ? (kvaNominal * 1000) / (SQRT3 * v2) : 0;
  const inPri = v1Kv > 0 ? (kvaNominal * 1000) / (SQRT3 * v1Kv * 1000) : 0;
  const p = perdidasTipicas(kvaNominal, tipo);
  return {
    kvaNominal,
    inPrimarioA: inPri,
    inSecundarioA: inSec,
    perdidasVacioW: p.vacioW,
    perdidasCargaW: p.cargaW,
  };
}

/**
 * Sugiere N transformadores en paralelo cuando la potencia requerida supera
 * el mayor estándar (5000 kVA). Empieza por N=2; sube de a 1 si N=2 sigue
 * sin alcanzar (poco común — solo para CDCs muy grandes).
 */
function sugerirParalelo(
  sRequerida: number, v2: number, v1Kv: number, tipo: TipoTransformador,
): ResultadoTransformador['paralelo'] | undefined {
  if (sRequerida <= MAX_KVA_ESTANDAR) return undefined;
  let n = 2;
  while (n <= 6) {
    const cadaUnoKva = sRequerida / n;
    const kvaCadaUno = POTENCIAS_NOMINALES_KVA.find((k) => k >= cadaUnoKva);
    if (kvaCadaUno != null) {
      return { cantidad: n, cadaUno: fabricarUnidad(kvaCadaUno, v2, v1Kv, tipo) };
    }
    n += 1;
  }
  return undefined;
}

/** Icc trifásica en el secundario de una unidad (kA): In_sec × 100 / Ucc%. */
function iccUnidadKa(unidad: UnidadTrafo, tipo: TipoTransformador): number {
  const ucc = uccTipica(unidad.kvaNominal, tipo);
  return (unidad.inSecundarioA * 100) / ucc / 1000;
}

/** Calcula el transformador para alimentar un CDC. */
export function calcularTransformador(p: ParametrosTransformador): ResultadoTransformador {
  const v2 = p.tensionSecundariaV;
  const v1Kv = p.tensionPrimariaKv;
  const tipo = p.tipo;
  const margen = Math.max(0, p.margen);
  const sCargaKva = (SQRT3 * v2 * Math.max(0, p.corrienteSecundarioA)) / 1000;
  const sRequeridaKva = sCargaKva * (1 + margen);
  const kvaNominal = POTENCIAS_NOMINALES_KVA.find((k) => k >= sRequeridaKva) ?? MAX_KVA_ESTANDAR;
  const excede = sRequeridaKva > MAX_KVA_ESTANDAR;
  const unidad = fabricarUnidad(kvaNominal, v2, v1Kv, tipo);
  const paralelo = excede ? sugerirParalelo(sRequeridaKva, v2, v1Kv, tipo) : undefined;
  // Icc de la barra: la unidad sola, o la suma de los aportes del banco en
  // paralelo (impedancias iguales → aportes iguales).
  const iccSecundarioKa = paralelo
    ? paralelo.cantidad * iccUnidadKa(paralelo.cadaUno, tipo)
    : iccUnidadKa(unidad, tipo);
  return {
    ...unidad,
    kvaRequerido: sRequeridaKva,
    tipo,
    grupoVectorial: 'Dyn11',
    uccPorcentaje: uccTipica(kvaNominal, tipo),
    iccSecundarioKa,
    excede,
    ...(paralelo ? { paralelo } : {}),
  };
}

/**
 * Tensión secundaria (BT) que predomina en las salidas del CDC. Si hay
 * varias tensiones distintas, devuelve la más frecuente. Default 400 V.
 */
export function tensionPredominanteV(tensiones: readonly number[]): number {
  if (tensiones.length === 0) return 400;
  const conteo = new Map<number, number>();
  for (const v of tensiones) {
    if (v > 0 && v <= 1000) {
      conteo.set(v, (conteo.get(v) ?? 0) + 1);
    }
  }
  if (conteo.size === 0) return 400;
  let mejorV = 400;
  let mejorN = -1;
  for (const [v, n] of conteo) {
    if (n > mejorN) {
      mejorV = v;
      mejorN = n;
    }
  }
  return mejorV;
}
