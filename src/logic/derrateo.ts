// Factor de corrección por altura geográfica (derrateo F2).
// Tabla V de la memoria de cálculo del proyecto, basada en IEEE Std 37.20.1-1993
// (baja tensión) e IEEE Std 37.20.2-1999 (media tensión).
//
// No hay derrateo hasta 2.000 m.s.n.m. en BT ni 1.000 m.s.n.m. en MT; por encima
// la corriente admisible del equipo se corrige por el factor de la tabla. Las
// alturas intermedias se obtienen por interpolación lineal.

export type NivelTension = 'BT' | 'MT';

export interface PuntoDerrateoAltura {
  altitudM: number;
  factorBT: number;
  factorMT: number;
}

/** Tabla V — Factor de corrección por altura. */
export const TABLA_DERRATEO_ALTURA: readonly PuntoDerrateoAltura[] = [
  { altitudM: 1000, factorBT: 1.0, factorMT: 1.0 },
  { altitudM: 1500, factorBT: 1.0, factorMT: 0.991 },
  { altitudM: 2000, factorBT: 1.0, factorMT: 0.985 },
  { altitudM: 2300, factorBT: 0.994, factorMT: 0.974 },
  { altitudM: 3000, factorBT: 0.978, factorMT: 0.96 },
  { altitudM: 3900, factorBT: 0.96, factorMT: 0.943 },
];

/**
 * Factor de derrateo F2 por altura de operación.
 * Interpola linealmente entre los puntos de la Tabla V y hace clamp fuera de rango.
 * Devuelve 1 (sin derrateo) por debajo del primer punto de la tabla.
 */
export function factorDerrateoAltura(altitudM: number, nivel: NivelTension = 'BT'): number {
  if (!Number.isFinite(altitudM)) return 1;
  const clave = nivel === 'MT' ? 'factorMT' : 'factorBT';
  const tabla = TABLA_DERRATEO_ALTURA;
  const primero = tabla[0]!;
  const ultimo = tabla[tabla.length - 1]!;
  if (altitudM <= primero.altitudM) return primero[clave];
  if (altitudM >= ultimo.altitudM) return ultimo[clave];
  for (let i = 0; i < tabla.length - 1; i += 1) {
    const a = tabla[i]!;
    const b = tabla[i + 1]!;
    if (altitudM >= a.altitudM && altitudM <= b.altitudM) {
      const t = (altitudM - a.altitudM) / (b.altitudM - a.altitudM);
      return a[clave] + t * (b[clave] - a[clave]);
    }
  }
  return 1;
}
