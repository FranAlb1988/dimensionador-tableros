import type { Carga } from '../types';

/**
 * Valores típicos para motores trifásicos jaula de ardilla a 400 V.
 * En una versión futura cosφ y rendimiento podrán ser por carga.
 */
export const COS_PHI_MOTOR = 0.85;
export const RENDIMIENTO_MOTOR = 0.9;
export const COS_PHI_GENERAL = 0.9;

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
  const cosPhi = esMotor ? COS_PHI_MOTOR : COS_PHI_GENERAL;
  const eta = esMotor ? RENDIMIENTO_MOTOR : 1;
  const fases = carga.fases === '3F' ? SQRT3 : 1;

  return (carga.potenciaKw * 1000) / (fases * carga.tensionV * cosPhi * eta);
}

/** Corriente de diseño = nominal × factor de servicio. */
export function corrienteDiseno(carga: Carga): number {
  const fs = carga.factorServicio > 0 ? carga.factorServicio : 1;
  return corrienteNominal(carga) * fs;
}
