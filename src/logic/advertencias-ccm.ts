// Validaciones suaves (advertencias) sobre las cargas de un CCM.
//
// Bomba contraincendio: NFPA 20 (referencia habitual en proyectos
// industriales chilenos) exige que la bomba CI se alimente por un circuito
// dedicado e independiente — tomado aguas arriba de la protección general
// del servicio normal — de modo que una falla o desconexión del CCM de
// servicios generales no deje sin alimentación al sistema contraincendio.
// El dimensionador no puede saber la topología aguas arriba, así que esto
// es una advertencia (no bloquea el cálculo).

import type { Carga } from '../types';

/**
 * Patrones que identifican una bomba del sistema contraincendio por su
 * descripción: "contraincendio(s)", "contra incendio", "fire pump",
 * "jockey" (bomba de presurización, también NFPA 20) y la sigla "PCI".
 */
const PATRON_BOMBA_CI = /contra\s*-?\s*incendios?|fire\s*pump|jockey|\bp\.?c\.?i\.?\b/i;

/** Cargas del CCM que parecen pertenecer al sistema contraincendio. */
export function cargasContraincendio(cargas: readonly Carga[]): Carga[] {
  return cargas.filter((c) => PATRON_BOMBA_CI.test(c.descripcion ?? ''));
}
