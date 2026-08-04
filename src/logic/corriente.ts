import type { Carga } from '../types';

/**
 * Valores típicos, alineados al estudio de cargas 5201-ES-600-12000:
 *  - motor directo: 0,85 (jaula de ardilla trifásico a 400 V).
 *  - motor con variador: 0,97 inductivo. El rectificador del VDF presenta un
 *    factor de potencia de desplazamiento cercano a la unidad, así que tomar
 *    0,85 sobreestimaba la corriente de estas salidas alrededor de un 14 %.
 *  - alimentadores y resto: 0,85 inductivo, de forma conservadora. Antes se
 *    usaba 0,9, que es menos conservador que el criterio del proyecto.
 */
export const COS_PHI_MOTOR = 0.85;
export const COS_PHI_VDF = 0.97;
export const RENDIMIENTO_MOTOR = 0.9;
export const COS_PHI_GENERAL = 0.85;

const SQRT3 = Math.sqrt(3);

/**
 * Corriente nominal en A.
 * Si la carga trae `corrienteA`, se respeta. Si no, se calcula desde potencia.
 *
 *   3F motor:    I = P·1000 / (√3 · V · cosφ · η)
 *   3F no-motor: I = P·1000 / (√3 · V · cosφ)
 *   1F motor:    I = P·1000 / (V · cosφ · η)
 *   1F no-motor: I = P·1000 / (V · cosφ)
 */
export function corrienteNominal(carga: Carga): number {
  if (typeof carga.corrienteA === 'number' && carga.corrienteA > 0) {
    return carga.corrienteA;
  }
  if (typeof carga.potenciaKw !== 'number' || carga.potenciaKw <= 0) {
    return 0;
  }
  if (carga.tensionV <= 0) return 0;

  const esMotor = carga.tipo === 'motor';
  // cosφ y η editables por carga; si no se ingresan, se usan los típicos.
  // Un motor alimentado por variador toma el cosφ del VDF, no el del motor.
  const cosPhi = carga.cosPhi && carga.cosPhi > 0 && carga.cosPhi <= 1
    ? carga.cosPhi
    : (esMotor
        ? (carga.arranque === 'variador' ? COS_PHI_VDF : COS_PHI_MOTOR)
        : COS_PHI_GENERAL);
  const eta = esMotor
    ? (carga.rendimiento && carga.rendimiento > 0 && carga.rendimiento <= 1
        ? carga.rendimiento
        : RENDIMIENTO_MOTOR)
    : 1;
  const fases = carga.fases === '3F' ? SQRT3 : 1;

  return (carga.potenciaKw * 1000) / (fases * carga.tensionV * cosPhi * eta);
}

/** Corriente de diseño = nominal × factor de servicio. */
export function corrienteDiseno(carga: Carga): number {
  const fs = carga.factorServicio > 0 ? carga.factorServicio : 1;
  return corrienteNominal(carga) * fs;
}
