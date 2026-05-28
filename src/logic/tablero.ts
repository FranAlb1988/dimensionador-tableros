import type { AsignacionCarga, Carga, MarcaProteccion, Tablero, TipoTablero } from '../types';
import { distribuirEnColumnas, resetContadorColumnas } from './columna';
import { asignarCargaCcm, COLUMNA_CATALOGO, resetContadorGavetas } from './gaveta';
import { MEDIDA_CCM_DEFAULT } from './medida-ccm';
import { corrienteDiseno } from './corriente';
import { sugerirBarra } from './barra';

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
export function dimensionarCcm(
  cargas: readonly Carga[],
  factorDerrateo = 1,
  marca: MarcaProteccion = 'Schneider',
): ResultadoCcm {
  resetContadorGavetas();
  resetContadorColumnas();

  const asignaciones: AsignacionCarga[] = [];
  const cargasSinAsignar: Carga[] = [];

  for (const c of cargas) {
    const a = asignarCargaCcm(c, marca);
    if (a) asignaciones.push(a);
    else cargasSinAsignar.push(c);
  }

  const gavetas = asignaciones.map((a) => a.gaveta);
  const columnas = distribuirEnColumnas(gavetas);

  // Barra principal por la FLC total. El derrateo por altura reduce la
  // capacidad útil: la barra se selecciona contra FLC / F2.
  const f = factorDerrateo > 0 ? factorDerrateo : 1;
  const corrienteTotalA = asignaciones.reduce((s, a) => s + corrienteDiseno(a.carga), 0);
  const corrienteSeleccionBarraA = corrienteTotalA / f;
  const barra = sugerirBarra(corrienteSeleccionBarraA);

  const tablero: Tablero = {
    tipo: 'CCM' satisfies TipoTablero,
    columnas,
    reservaCabezalMm: COLUMNA_CATALOGO.reservaCabezalMm,
    reservaZocaloMm: COLUMNA_CATALOGO.reservaZocaloMm,
    medida: MEDIDA_CCM_DEFAULT,
    corrienteTotalA,
    factorDerrateoAltura: f,
    corrienteSeleccionBarraA,
    barra,
    altoTotalMm: COLUMNA_CATALOGO.altoTotalMm,
    anchoTotalMm: columnas.length * COLUMNA_CATALOGO.anchoMm,
    profundidadTotalMm: COLUMNA_CATALOGO.profundidadMm,
  };

  return { asignaciones, cargasSinAsignar, tablero };
}
