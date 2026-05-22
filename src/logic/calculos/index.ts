// Registro de todas las calculadoras eléctricas.
import type { Calculadora, GrupoCalc } from './tipos';
import { CALCULADORAS_BASICOS } from './basicos';
import { CALCULADORAS_CONDUCTORES } from './conductores';
import { CALCULADORAS_AVANZADOS } from './avanzados';

export * from './tipos';

export const CALCULADORAS: readonly Calculadora[] = [
  ...CALCULADORAS_BASICOS,
  ...CALCULADORAS_CONDUCTORES,
  ...CALCULADORAS_AVANZADOS,
];

/** Calculadoras agrupadas, en el orden de presentación. */
export const GRUPOS_CALCULADORAS: readonly { grupo: GrupoCalc; calculadoras: readonly Calculadora[] }[] = [
  { grupo: 'basicos', calculadoras: CALCULADORAS_BASICOS },
  { grupo: 'conductores', calculadoras: CALCULADORAS_CONDUCTORES },
  { grupo: 'avanzados', calculadoras: CALCULADORAS_AVANZADOS },
];

export function calculadoraPorId(id: string): Calculadora | undefined {
  return CALCULADORAS.find((c) => c.id === id);
}
