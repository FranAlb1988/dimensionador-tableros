/**
 * Interpreta lo que se teclea en un campo numérico.
 *
 * Devuelve `undefined` cuando todavía no hay un número: campo vacío o a medio
 * escribir. Esa distinción importa — `Number('')` es 0, así que interpretar el
 * campo vacío como un número hace que borrarlo para reescribirlo rehaga el
 * cálculo con cero.
 *
 * La coma se acepta como separador decimal: la app muestra los números en
 * formato es-CL y sería raro no admitirlos de vuelta.
 */
export function parsearNumero(bruto: string): number | undefined {
  const limpio = bruto.replace(',', '.').trim();
  if (limpio === '') return undefined;
  const n = Number(limpio);
  // Number.isFinite descarta de una NaN e Infinity: ninguno de los dos sirve
  // como dato de entrada de un cálculo.
  return Number.isFinite(n) ? n : undefined;
}
