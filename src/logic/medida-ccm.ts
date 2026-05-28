import type { MedidaCcm } from '../types';

/**
 * Equipos de medida estándar de un CCM trifásico: 3 transformadores de tensión
 * (PT), 3 de corriente (CT), 3 luces piloto (presencia de fase R/S/T) y un
 * multímetro de red.
 */
export const MEDIDA_CCM_DEFAULT: MedidaCcm = {
  transformadoresTension: 3,
  transformadoresCorriente: 3,
  lucesPiloto: 3,
  instrumento: 'Multímetro digital de red',
};
