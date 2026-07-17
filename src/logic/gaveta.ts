import gavetasData from '../data/iec/gavetas-blokset.json';
import type {
  Arrancador,
  AsignacionCarga,
  Carga,
  DefinicionColumnaCatalogo,
  DefinicionGavetaCatalogo,
  Gaveta,
  MarcaProteccion,
  Proteccion,
  TamanoGaveta,
} from '../types';
import { sugerirArrancador } from './arrancador';
import { sugerirProteccionFeeder } from './proteccion';

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
 * Tamaño mínimo de gaveta para alojar un interruptor de alimentador (MCCB),
 * según la corriente del frame. El cuerpo físico crece con el frame:
 *   - ≤100 A (NSXm/NSX100, Tmax XT2 bajo): cuerpo pequeño → ¼ X
 *   - ≤250 A (NSX160/250, Tmax XT4): cuerpo medio → ½ X
 *   - >250 A (NSX400/630, Tmax T4/T5): cuerpo grande → 1 X
 * Los ACB (Masterpact, Emax 2, NA1) no se alojan en gavetas Blokset CCM.
 */
export function tamanoPorProteccion(p: Proteccion): TamanoGaveta {
  const esAcb = p.familia.startsWith('Masterpact')
    || p.familia.startsWith('Emax')
    || p.familia.startsWith('NA1')
    || p.familia.startsWith('iC60');
  if (esAcb) return '1/4';
  if (p.inA <= 100) return '1/4';
  if (p.inA <= 250) return '1/2';
  return '1';
}

/** Compatibilidad: tamaño de gaveta para un NSX (delega en tamanoPorProteccion). */
export function tamanoPorNsx(p: Proteccion): TamanoGaveta {
  return tamanoPorProteccion(p);
}

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/**
 * Protección de una salida de CCM: si el motor lleva arrancador en la gaveta
 * (contactor + relé térmico), el interruptor es SOLO MAGNÉTICO (MA /
 * Micrologic 1.3 M — coordinación tipo 2 IEC 60947-4-1); en cualquier otro
 * caso, TM-D. `factorDerrateo` es el F por altura/temperatura: el interruptor
 * se selecciona contra I / F. Usado también por la tabla de cargas para
 * mostrar el frame.
 */
export function sugerirProteccionCcm(
  carga: Carga,
  marca: MarcaProteccion = 'Schneider',
  factorDerrateo = 1,
): Proteccion | undefined {
  const conArrancador = carga.tipo === 'motor' && sugerirArrancador(carga) != null;
  return sugerirProteccionFeeder(carga, marca, factorDerrateo, conArrancador);
}

/**
 * Para una carga de CCM produce la asignación: protección + arrancador (opcional) + gaveta.
 * Si no es posible sugerir protección, devuelve undefined.
 */
export function asignarCargaCcm(
  carga: Carga,
  marca: MarcaProteccion = 'Schneider',
  factorDerrateo = 1,
): AsignacionCarga | undefined {
  const arrancador = sugerirArrancador(carga);
  // Motor con arrancador → unidad solo magnética; el LRD cubre la sobrecarga.
  // El interruptor pierde capacidad con la altura/temperatura → I / F.
  const proteccion = sugerirProteccionFeeder(carga, marca, factorDerrateo, arrancador != null);
  if (!proteccion) return undefined;

  const tamano: TamanoGaveta = arrancador
    ? maxTamano(arrancador.tamanoGaveta, tamanoPorProteccion(proteccion))
    : tamanoPorProteccion(proteccion);

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
