// Barra vertical de la columna del CCM.
//
// La app dimensionaba la barra principal horizontal por el FLC del tablero,
// pero nunca verificaba la barra vertical de cada columna, que es la que
// alimenta las gavetas de esa sección: las columnas se empaquetaban solo por
// espacio (12 unidades), sin mirar la corriente que acumulaban.
//
// Dos datos del catálogo CENTERLINE 2100 (2100-SG003G-EN-P) definen el modelo:
//
//   Bus vertical    600 A efectivo  = 300 A arriba + 300 A abajo
//                   1200 A efectivo = 600 A arriba + 600 A abajo
//   Stabs unidad    225 A máximo por unidad plug-in
//
// El reparto arriba/abajo importa: una columna con 600 A repartidos 500/100 no
// cumple aunque el total quepa, porque cada mitad de la barra lleva 300 A.

import datos from '../data/nema/centerline-2100.json';

export interface BarraVerticalCatalogo {
  /** Capacidad efectiva de la columna completa, en A. */
  efectivaA: number;
  /** Capacidad de cada mitad (arriba y abajo), en A. */
  porMitadA: number;
  descripcion: string;
}

interface BarraJson {
  sistema: string;
  ratingA?: number;
  ratingTexto?: string;
  arreglo?: string;
  aplicacion?: string;
  sccr?: string;
}

const BARRAS = datos.barras as BarraJson[];

/** Extrae el par «X A arriba + X A abajo» del arreglo declarado. */
function porMitad(arreglo: string | undefined, efectivaA: number): number {
  const m = arreglo?.match(/(\d+)\s*A\s*arriba/i);
  return m ? Number(m[1]) : efectivaA / 2;
}

/** Opciones de barra vertical publicadas, de menor a mayor. */
export const BARRAS_VERTICALES: readonly BarraVerticalCatalogo[] = BARRAS
  .filter((b) => /^bus vertical$/i.test(b.sistema) && b.ratingA != null)
  .map((b) => ({
    efectivaA: b.ratingA!,
    porMitadA: porMitad(b.arreglo, b.ratingA!),
    descripcion: `${b.ratingTexto ?? `${b.ratingA} A`} — ${b.arreglo ?? ''}`.trim(),
  }))
  .sort((a, b) => a.efectivaA - b.efectivaA);

/**
 * Corriente máxima por unidad plug-in, limitada por los stabs de conexión a la
 * barra vertical. Una salida que la supere no puede ir enchufable.
 */
export const STAB_MAX_A = BARRAS.find((b) => /stabs/i.test(b.sistema))?.ratingA ?? 225;

export interface UnidadColumna {
  /** Identificador de la carga, para nombrarla en la advertencia. */
  id: string;
  descripcion: string;
  corrienteA: number;
  /** Espacios que ocupa, para repartir la columna en mitades. */
  espaciosX: number;
}

export interface VerificacionBarraVertical {
  barra: BarraVerticalCatalogo;
  corrienteTotalA: number;
  corrienteMitadSuperiorA: number;
  corrienteMitadInferiorA: number;
  /** Unidades que exceden el límite del stab. */
  sobreStab: readonly UnidadColumna[];
  excedeMitad: boolean;
  excedeTotal: boolean;
  /** Porcentaje de uso de la mitad más cargada. */
  usoMitadPct: number;
}

/**
 * Verifica una columna contra su barra vertical.
 *
 * Las unidades se reparten en mitades por orden de montaje: la mitad superior
 * toma las primeras hasta llenar medio alto útil. Es el reparto que hace la
 * app al empaquetar; el montaje real puede reordenarlas, y por eso lo que se
 * informa es la mitad más cargada y no una asignación definitiva.
 */
export function verificarBarraVertical(
  unidades: readonly UnidadColumna[],
  altoUtilXEspacios: number,
  barra: BarraVerticalCatalogo = BARRAS_VERTICALES[0]!,
): VerificacionBarraVertical {
  const mitadX = altoUtilXEspacios / 2;
  let acumX = 0;
  let superior = 0;
  let inferior = 0;
  for (const u of unidades) {
    // La unidad cuenta en la mitad donde arranca.
    if (acumX < mitadX) superior += u.corrienteA;
    else inferior += u.corrienteA;
    acumX += u.espaciosX;
  }
  const corrienteTotalA = superior + inferior;
  const mayor = Math.max(superior, inferior);
  return {
    barra,
    corrienteTotalA,
    corrienteMitadSuperiorA: superior,
    corrienteMitadInferiorA: inferior,
    sobreStab: unidades.filter((u) => u.corrienteA > STAB_MAX_A),
    excedeMitad: mayor > barra.porMitadA,
    excedeTotal: corrienteTotalA > barra.efectivaA,
    usoMitadPct: (mayor / barra.porMitadA) * 100,
  };
}

/**
 * Menor barra vertical del catálogo que cubre la columna.
 * Devuelve undefined si ni la mayor alcanza — ahí hay que dividir la columna.
 */
export function sugerirBarraVertical(
  unidades: readonly UnidadColumna[],
  altoUtilXEspacios: number,
): BarraVerticalCatalogo | undefined {
  for (const b of BARRAS_VERTICALES) {
    const v = verificarBarraVertical(unidades, altoUtilXEspacios, b);
    if (!v.excedeMitad && !v.excedeTotal) return b;
  }
  return undefined;
}
