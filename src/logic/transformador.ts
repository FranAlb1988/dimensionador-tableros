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

export interface ParametrosTransformador {
  /** Corriente de carga del secundario (CDC), en A. */
  corrienteSecundarioA: number;
  /** Tensión del secundario (BT) en V. */
  tensionSecundariaV: number;
  /** Tensión del primario (MT) en kV. */
  tensionPrimariaKv: number;
  /** Margen de crecimiento sobre la carga (0..1). Default 0.25. */
  margen: number;
}

export interface ResultadoTransformador {
  /** Potencia aparente requerida por la carga + margen, en kVA. */
  kvaRequerido: number;
  /** Potencia nominal estándar seleccionada, en kVA. */
  kvaNominal: number;
  /** Corriente nominal del primario (A). */
  inPrimarioA: number;
  /** Corriente nominal del secundario (A). */
  inSecundarioA: number;
  /** Grupo vectorial recomendado. */
  grupoVectorial: string;
  /** Impedancia de cortocircuito típica (Ucc) en %. */
  uccPorcentaje: number;
  /** True si la potencia requerida excede el mayor estándar disponible. */
  excede: boolean;
}

const SQRT3 = Math.sqrt(3);

/**
 * Ucc típica para transformadores secos / aceite IEC 60076 según potencia:
 *  - ≤ 630 kVA  → 4 %
 *  - 800-1250  → 5 %
 *  - 1600-2500 → 6 %
 *  - > 2500    → 7 %
 */
function uccTipica(kva: number): number {
  if (kva <= 630) return 4;
  if (kva <= 1250) return 5;
  if (kva <= 2500) return 6;
  return 7;
}

/** Calcula el transformador para alimentar un CDC. */
export function calcularTransformador(p: ParametrosTransformador): ResultadoTransformador {
  const v2 = p.tensionSecundariaV;
  const v1Kv = p.tensionPrimariaKv;
  const margen = Math.max(0, p.margen);
  const sCargaKva = (SQRT3 * v2 * Math.max(0, p.corrienteSecundarioA)) / 1000;
  const sRequeridaKva = sCargaKva * (1 + margen);
  const max = POTENCIAS_NOMINALES_KVA[POTENCIAS_NOMINALES_KVA.length - 1]!;
  const kvaNominal = POTENCIAS_NOMINALES_KVA.find((k) => k >= sRequeridaKva) ?? max;
  const excede = sRequeridaKva > max;
  const inSec = v2 > 0 ? (kvaNominal * 1000) / (SQRT3 * v2) : 0;
  const inPri = v1Kv > 0 ? (kvaNominal * 1000) / (SQRT3 * v1Kv * 1000) : 0;
  return {
    kvaRequerido: sRequeridaKva,
    kvaNominal,
    inPrimarioA: inPri,
    inSecundarioA: inSec,
    grupoVectorial: 'Dyn11',
    uccPorcentaje: uccTipica(kvaNominal),
    excede,
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
