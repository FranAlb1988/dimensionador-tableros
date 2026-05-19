import gavetasData from '../data/iec/gavetas-blokset.json';
import type {
  Arrancador,
  AsignacionCarga,
  Carga,
  DefinicionColumnaCatalogo,
  DefinicionGavetaCatalogo,
  Gaveta,
  Proteccion,
  TamanoGaveta,
} from '../types';
import { sugerirArrancador } from './arrancador';
import { sugerirProteccionNsx } from './proteccion';

const TAMANOS: readonly DefinicionGavetaCatalogo[] = (gavetasData.tamanos as DefinicionGavetaCatalogo[])
  .toSorted((a, b) => a.altoMm - b.altoMm);

export const COLUMNA_CATALOGO: DefinicionColumnaCatalogo = gavetasData.columna as DefinicionColumnaCatalogo;

const ESCALA: readonly TamanoGaveta[] = ['1/4', '1/2', '1', '1+1/2', '2'];

/** Devuelve la altura en mm para un tamaño de gaveta. */
export function altoDeGaveta(t: TamanoGaveta): number {
  const def = TAMANOS.find((x) => x.tamano === t);
  if (!def) throw new Error(`Tamaño de gaveta desconocido: ${t}`);
  return def.altoMm;
}

/** Compara dos tamaños de gaveta por su posición en la escala. */
export function maxTamano(a: TamanoGaveta, b: TamanoGaveta): TamanoGaveta {
  const ia = ESCALA.indexOf(a);
  const ib = ESCALA.indexOf(b);
  return ia >= ib ? a : b;
}

/**
 * Tamaño mínimo de gaveta para alojar un NSX, según la familia (frame).
 * El frame físico es el que manda el espacio:
 *   - NSXm / NSX100: cuerpo pequeño (~91 mm) → ¼ X
 *   - NSX160 / NSX250: cuerpo medio (~105 mm) → ½ X
 *   - NSX400 / NSX630: cuerpo grande (~140 mm) → 1 X
 */
export function tamanoPorNsx(p: Proteccion): TamanoGaveta {
  switch (p.familia) {
    case 'NSXm':
    case 'NSX100':
      return '1/4';
    case 'NSX160':
    case 'NSX250':
      return '1/2';
    case 'NSX400':
    case 'NSX630':
      return '1';
    default:
      // Familias no NSX (Masterpact, iC60) no se alojan en gavetas Blokset CCM.
      return '1/4';
  }
}

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/**
 * Para una carga de CCM produce la asignación: protección + arrancador (opcional) + gaveta.
 * Si no es posible sugerir protección, devuelve undefined.
 */
export function asignarCargaCcm(carga: Carga): AsignacionCarga | undefined {
  const proteccion = sugerirProteccionNsx(carga);
  if (!proteccion) return undefined;

  const arrancador = sugerirArrancador(carga);

  const tamano: TamanoGaveta = arrancador
    ? maxTamano(arrancador.tamanoGaveta, tamanoPorNsx(proteccion))
    : tamanoPorNsx(proteccion);

  const protecciones: Proteccion[] = [proteccion];

  const gaveta: Gaveta = {
    id: nextId('gav'),
    tamano,
    altoMm: altoDeGaveta(tamano),
    version: 'extraible',
    contenido: contenidoDescriptivo(carga, proteccion, arrancador),
    cargaId: carga.id,
    protecciones,
  };

  return arrancador
    ? { carga, proteccion, arrancador, gaveta }
    : { carga, proteccion, gaveta };
}

function contenidoDescriptivo(c: Carga, p: Proteccion, a: Arrancador | undefined): string {
  const base = `${c.descripcion || c.id} — ${p.referencia}`;
  if (!a) return base;
  const tipo = a.tipo;
  return `${base} + ${tipo} ${a.contactor}${a.releTermico ? ` / ${a.releTermico}` : ''}`;
}

/** Reinicia el contador de IDs (útil para tests deterministas). */
export function resetContadorGavetas(): void {
  counter = 0;
}
