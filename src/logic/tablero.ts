import type { AsignacionCarga, Carga, Gaveta, MarcaProteccion, Tablero, TipoTablero } from '../types';
import {
  distribuirEnColumnas, necesitaColumnaIncoming, nuevaColumnaIncoming, resetContadorColumnas,
} from './columna';
import { altoDeGaveta, asignarCargaCcm, COLUMNA_CATALOGO, resetContadorGavetas } from './gaveta';
import { MEDIDA_CCM_DEFAULT } from './medida-ccm';
import { corrienteDiseno } from './corriente';
import { sugerirBarra } from './barra';
import { calcularReservas } from './reserva';
import { tamanoEnX } from '../util/x-blokset';

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
  reservaPorcentaje = 0,
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

  // Gavetas de reserva (vacancia): 1 de cada tamaño usado + adicionales hasta
  // alcanzar el porcentaje pedido sobre el X usado por las salidas reales.
  const gavetasReales = asignaciones.map((a) => a.gaveta);
  const { reservas } = calcularReservas<Gaveta>(
    gavetasReales,
    (g) => g.tamano,
    (g) => tamanoEnX(g.tamano),
    (modelo, i) => ({
      id: `reserva-${i + 1}`,
      tamano: modelo.tamano,
      altoMm: altoDeGaveta(modelo.tamano),
      version: 'extraible',
      contenido: `Reserva · ${modelo.tamano}X`,
      protecciones: [],
      esReserva: true,
    }),
    reservaPorcentaje,
  );

  const gavetas = [...gavetasReales, ...reservas];
  const columnasFeeders = distribuirEnColumnas(gavetas);

  // Barra principal por la FLC total. El derrateo por altura reduce la
  // capacidad útil: la barra se selecciona contra FLC / F2.
  const f = factorDerrateo > 0 ? factorDerrateo : 1;
  const corrienteTotalA = asignaciones.reduce((s, a) => s + corrienteDiseno(a.carga), 0);
  const corrienteSeleccionBarraA = corrienteTotalA / f;
  const barra = sugerirBarra(corrienteSeleccionBarraA);

  // Incoming/acometida dedicada cuando hay ≥4 gavetas o I ≥ 250 A.
  const columnas = necesitaColumnaIncoming(asignaciones.length, corrienteTotalA)
    ? [nuevaColumnaIncoming(), ...columnasFeeders]
    : columnasFeeders;

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
