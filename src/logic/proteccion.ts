import nsxData from '../data/iec/nsx.json';
import ic60Data from '../data/iec/ic60.json';
import type { Carga, Proteccion } from '../types';
import { corrienteDiseno } from './corriente';

const NSX: readonly Proteccion[] = (nsxData.interruptores as Proteccion[]);
const IC60: readonly Proteccion[] = (ic60Data.interruptores as Proteccion[]);

/** Margen para el In del interruptor sobre la corriente de diseño. */
const MARGEN_NSX_NO_MOTOR = 1.0;
const MARGEN_NSX_MOTOR = 1.25;
const MARGEN_IC60 = 1.0;

/**
 * Sugiere un interruptor NSX para una carga de CCM.
 * Para motores se usa margen 1.25 sobre I_diseño; para otras cargas 1.0.
 * Si la carga trae `corrienteProteccionA` (Frame mínimo forzado), el In del NSX
 * elegido será ≥ ese valor — usado para forzar un frame mayor del necesario
 * por la corriente, lo que define el tamaño de gaveta.
 * El relé térmico (LRD) hace la protección de sobrecarga; el NSX corta cortocircuito.
 */
export function sugerirProteccionNsx(carga: Carga): Proteccion | undefined {
  const I = corrienteDiseno(carga);
  const frameForzado = carga.corrienteProteccionA && carga.corrienteProteccionA > 0
    ? carga.corrienteProteccionA
    : 0;
  if (I <= 0 && frameForzado <= 0) return undefined;
  const margen = carga.tipo === 'motor' ? MARGEN_NSX_MOTOR : MARGEN_NSX_NO_MOTOR;
  const Imin = Math.max(I * margen, frameForzado);
  return NSX
    .toSorted((a, b) => a.inA - b.inA)
    .find((p) => p.inA >= Imin);
}

/**
 * Sugiere un iC60 para una carga de CDC.
 * Curva preferida: C para iluminación/tomas, D para cargas inductivas pequeñas (motor < 4 kW).
 */
export function sugerirProteccionIc60(carga: Carga): Proteccion | undefined {
  const I = corrienteDiseno(carga);
  if (I <= 0) return undefined;
  const Imin = I * MARGEN_IC60;
  const polosNecesarios = carga.fases === '3F' ? 3 : 1;
  return IC60
    .filter((p) => p.polos === polosNecesarios)
    .toSorted((a, b) => a.inA - b.inA)
    .find((p) => p.inA >= Imin);
}

export const NSX_DISPONIBLES = NSX;
export const IC60_DISPONIBLES = IC60;
