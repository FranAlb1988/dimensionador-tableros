import type { AsignacionCarga, Carga, Tablero, TipoTablero } from '../types';
import { distribuirEnColumnas, resetContadorColumnas } from './columna';
import { asignarCargaCcm, COLUMNA_CATALOGO, resetContadorGavetas } from './gaveta';

export interface ResultadoCcm {
  asignaciones: AsignacionCarga[];
  cargasSinAsignar: Carga[];
  tablero: Tablero;
}

/**
 * Punto de entrada para CCM Blokset:
 * 1. Asigna protección + arrancador + gaveta a cada carga
 * 2. Distribuye gavetas en columnas (FFD)
 * 3. Calcula dimensiones totales del tablero
 *
 * Resetea contadores internos para resultados deterministas.
 */
export function dimensionarCcm(cargas: readonly Carga[]): ResultadoCcm {
  resetContadorGavetas();
  resetContadorColumnas();

  const asignaciones: AsignacionCarga[] = [];
  const cargasSinAsignar: Carga[] = [];

  for (const c of cargas) {
    const a = asignarCargaCcm(c);
    if (a) asignaciones.push(a);
    else cargasSinAsignar.push(c);
  }

  const gavetas = asignaciones.map((a) => a.gaveta);
  const columnas = distribuirEnColumnas(gavetas);

  const tablero: Tablero = {
    tipo: 'CCM' satisfies TipoTablero,
    columnas,
    reservaCabezalMm: COLUMNA_CATALOGO.reservaCabezalMm,
    reservaZocaloMm: COLUMNA_CATALOGO.reservaZocaloMm,
    altoTotalMm: COLUMNA_CATALOGO.altoTotalMm,
    anchoTotalMm: columnas.length * COLUMNA_CATALOGO.anchoMm,
    profundidadTotalMm: COLUMNA_CATALOGO.profundidadMm,
  };

  return { asignaciones, cargasSinAsignar, tablero };
}
