/**
 * Rótulos accesibles para los controles que viven dentro de una tabla.
 *
 * En las tablas de cargas y salidas cada celda es un input o un select cuyo
 * único contexto era el encabezado de columna. Un lector de pantalla anunciaba
 * el control sin decir qué campo era ni de qué fila, y el control por voz no
 * tenía cómo referirse a él. El encabezado aporta la columna; estos rótulos
 * aportan la fila.
 */

/**
 * Nombre con el que se identifica una fila.
 * Mientras no tenga descripción, el número de fila es lo único que distingue
 * una de otra.
 */
export function nombreDeFila(descripcion: string | undefined, indice: number, singular = 'carga'): string {
  const limpia = (descripcion ?? '').trim();
  return limpia || `${singular} ${indice + 1} sin descripción`;
}

/** Rótulo de un campo concreto de una fila: "Tensión de Bomba agua potable". */
export function rotuloDeCampo(campo: string, nombreFila: string): string {
  return `${campo} de ${nombreFila}`;
}
