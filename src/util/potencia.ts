// Conversiones de potencia. Convención IEC: 1 HP mecánico ≈ 0.7457 kW.
// El motor IEC se rotula en kW de salida; el NEMA en HP. Usar este factor para conversión 1:1
// del valor de placa entre ambas convenciones.

import type { UnidadPotencia } from '../types';

export const KW_POR_HP = 0.7457;

export function kwToHp(kw: number): number {
  return kw / KW_POR_HP;
}

export function hpToKw(hp: number): number {
  return hp * KW_POR_HP;
}

/** Convierte un valor desde la unidad indicada a kW. */
export function aKw(valor: number, unidad: UnidadPotencia): number {
  return unidad === 'HP' ? hpToKw(valor) : valor;
}

/** Convierte kW a la unidad indicada. */
export function desdeKw(kw: number, unidad: UnidadPotencia): number {
  return unidad === 'HP' ? kwToHp(kw) : kw;
}
