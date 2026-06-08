import type { MedidaCcm } from '../types';

/**
 * Equipos de medida estándar de un CDC trifásico (Centro de Distribución de
 * Cargas). Igual que el CCM en cuanto a transformadores y luces piloto, pero
 * con un analizador de red (PowerLogic / ION o equivalente) en lugar de un
 * multímetro simple — propio del tablero principal de la sala eléctrica.
 */
export const MEDIDA_TDG_DEFAULT: MedidaCcm = {
  transformadoresTension: 3,
  transformadoresCorriente: 3,
  lucesPiloto: 3,
  instrumento: 'Analizador de red (PowerLogic / ION)',
};
