// Catálogo TeSys — contactores y relés de sobrecarga.
//
// Reemplaza al placeholder tesys.json, que traía 14 parejas contactor+relé
// inventadas. Aquí la pareja se arma con los datos del catálogo: el contactor
// se elige por su corriente en categoría AC-3e (la de motor), y el relé por su
// rango de ajuste y por la familia de contactores con la que el propio
// catálogo declara que se acopla directamente.

import tesysData from '../data/schneider/tesys.json';

export interface ContactorTeSys {
  familia: string;
  ejecucion: string;
  /**
   * Referencia base. Es un PATRÓN: el sufijo "pp" lo completa el código de
   * bobina según la tensión de mando del proyecto.
   */
  referencia: string;
  polos: string;
  /** Categoría de empleo declarada (AC-3e, AC-1, AC-4…). */
  categoria: string;
  /** Corriente de empleo en AC-3e, en A. Es la que rige para un motor. */
  ieAc3eA?: number;
  kw400V?: number;
  hp480V?: number;
  /** Corriente térmica convencional / AC-1. */
  ithAc1A?: number;
  anchoMm?: number;
  altoMm?: number;
  profundidadMm?: number;
  pesoKg?: number;
  /** Índices dentro de `notas`. */
  bobina?: number;
  montaje?: number;
  fuente?: number;
}

export interface ReleTeSys {
  familia: string;
  /** Térmico, Térmico EverLink, Electrónico… */
  tipo: string;
  referencia: string;
  /** Clase de disparo: 10A, 5E-30E, etc. */
  clase: string;
  ajusteMinA?: number;
  ajusteMaxA?: number;
  /** Contactores con los que el catálogo declara acople directo. */
  montaDirectoCon?: string;
  anchoMm?: number;
  altoMm?: number;
  profundidadMm?: number;
  pesoKg?: number;
  observaciones?: number;
}

const CONTACTORES: readonly ContactorTeSys[] = tesysData.contactores as ContactorTeSys[];
const RELES: readonly ReleTeSys[] = tesysData.reles as ReleTeSys[];
const NOTAS = tesysData.notas as string[];

export function notaTeSys(i: number | undefined): string | undefined {
  return i == null ? undefined : NOTAS[i];
}

export const CONTACTORES_TESYS = CONTACTORES;
export const RELES_TESYS = RELES;

export function familiasContactor(): string[] {
  return [...new Set(CONTACTORES.map((c) => c.familia))].sort();
}

/**
 * Menor contactor que cubre la corriente del motor en categoría AC-3e.
 * Solo se consideran las ejecuciones con AC-3e declarada: las de AC-1 puro son
 * para maniobra de cargas no inductivas y no sirven de arrancador.
 */
export function sugerirContactor(
  corrienteMotorA: number,
  opciones: { polos?: string; familia?: string } = {},
): ContactorTeSys | undefined {
  if (!(corrienteMotorA > 0)) return undefined;
  const candidatos = CONTACTORES.filter((c) => {
    if (c.ieAc3eA == null || c.ieAc3eA < corrienteMotorA) return false;
    if (!c.categoria.includes('AC-3')) return false;
    if (opciones.polos && !c.polos.includes(opciones.polos)) return false;
    if (opciones.familia && c.familia !== opciones.familia) return false;
    return true;
  });
  return candidatos.toSorted((a, b) => (a.ieAc3eA! - b.ieAc3eA!)
    || (a.anchoMm ?? Infinity) - (b.anchoMm ?? Infinity))[0];
}

/**
 * ¿El relé se acopla directamente a este contactor?
 *
 * El catálogo declara el acople como rango de referencias ("LC1D09…D38",
 * "LC1K/LP1K", "LC1D40A…D80A"). Se compara por el prefijo de familia del
 * contactor, que es lo que el rango identifica.
 */
export function acoplaCon(rele: ReleTeSys, contactor: ContactorTeSys): boolean {
  const decl = rele.montaDirectoCon;
  if (!decl) return false;
  // "LC1D09…D38" → prefijo LC1D; "LC1K/LP1K" → LC1K y LP1K.
  const prefijos = decl.split('/').map((p) => {
    const m = p.trim().match(/^[A-Z]{2}\d[A-Z]+/);
    return m?.[0] ?? p.trim();
  });
  return prefijos.some((p) => contactor.referencia.startsWith(p));
}

/**
 * Relé de sobrecarga cuyo rango de ajuste contiene la corriente del motor.
 * Prefiere los que se acoplan directamente al contactor elegido; si ninguno
 * lo hace, devuelve el que cubre la corriente y el caller decide.
 */
export function sugerirRele(
  corrienteMotorA: number,
  contactor?: ContactorTeSys,
): ReleTeSys | undefined {
  if (!(corrienteMotorA > 0)) return undefined;
  const cubren = RELES.filter((r) =>
    r.ajusteMinA != null && r.ajusteMaxA != null
    && corrienteMotorA >= r.ajusteMinA && corrienteMotorA <= r.ajusteMaxA);
  if (cubren.length === 0) return undefined;
  const porRango = (a: ReleTeSys, b: ReleTeSys) => (a.ajusteMaxA! - b.ajusteMaxA!);
  if (contactor) {
    const acoplados = cubren.filter((r) => acoplaCon(r, contactor));
    if (acoplados.length > 0) return acoplados.toSorted(porRango)[0];
  }
  return cubren.toSorted(porRango)[0];
}

export interface ParejaArrancador {
  contactor: ContactorTeSys;
  rele?: ReleTeSys;
  /** true si el relé elegido se acopla directamente al contactor. */
  acopleDirecto: boolean;
  /** Ancho del conjunto, mm — el del contactor, que es el que manda en gaveta. */
  anchoMm?: number;
}

/**
 * Pareja contactor + relé para un motor de la corriente dada.
 * Devuelve undefined si ningún contactor AC-3e alcanza la corriente.
 */
export function sugerirParejaArrancador(corrienteMotorA: number): ParejaArrancador | undefined {
  const contactor = sugerirContactor(corrienteMotorA, { polos: '3' });
  if (!contactor) return undefined;
  const rele = sugerirRele(corrienteMotorA, contactor);
  return {
    contactor,
    ...(rele ? { rele } : {}),
    acopleDirecto: rele ? acoplaCon(rele, contactor) : false,
    ...(contactor.anchoMm != null ? { anchoMm: contactor.anchoMm } : {}),
  };
}
