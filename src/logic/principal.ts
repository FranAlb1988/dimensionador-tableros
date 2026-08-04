import abbTmaxData from '../data/iec/abb-tmax.json';
import abbEmax2Data from '../data/iec/abb-emax2.json';
import chintNa1Data from '../data/iec/chint-na1.json';
import type { MarcaProteccion, Proteccion } from '../types';
import { capacidadMasterpactKa, sugerirMasterpact, type Masterpact } from './masterpact';
import { capacidadMccbKa, sugerirMccb, type Mccb } from './mccb';

const ABB_TMAX: readonly Proteccion[] = (abbTmaxData.interruptores as Proteccion[]);
const ABB_EMAX2: readonly Proteccion[] = (abbEmax2Data.interruptores as Proteccion[]);
const CHINT_NA1: readonly Proteccion[] = (chintNa1Data.interruptores as Proteccion[]);

/**
 * Conjunto de interruptores disponibles por marca para el principal del CDC/TDG.
 *  - Schneider: catálogos reales — ComPacT (MCCB, hasta 3200 A) y MasterPact
 *    MTZ (ACB, 630-6300 A), que traen el nivel de corte como dimensión aparte
 *    del calibre.
 *  - ABB: Tmax (MCCB ≤630 A) + Emax 2 (ACB 800-6300 A). Tabla incorporada.
 *  - Chint: NA1 (ACB 1000-6300 A). No cubre el rango MCCB (<1000 A).
 */
const POOL_POR_MARCA: Record<MarcaProteccion, readonly Proteccion[] | 'catalogo'> = {
  Schneider: 'catalogo',
  ABB: [...ABB_TMAX, ...ABB_EMAX2],
  Chint: [...CHINT_NA1],
};

/** Marcas disponibles para el interruptor principal. */
export const MARCAS_PRINCIPAL: readonly MarcaProteccion[] = ['Schneider', 'ABB', 'Chint'];

/** Margen del In del interruptor principal sobre la corriente total. */
const MARGEN_PRINCIPAL = 1.0;

/** Menor calibre del catálogo MasterPact, en A. Bajo esto solo hay MCCB. */
const MENOR_IN_MASTERPACT = 630;

/**
 * Icu mínima del principal cuando el proyecto no declaró la Icc de barra, kA.
 * Mismo criterio que en los alimentadores: los catálogos reales ofrecen clases
 * desde 16-25 kA y, sin piso, la selección por "menor capacidad" las elegiría.
 * Un principal de 25 kA en un tablero industrial es una apuesta.
 */
const ICU_MINIMA_PRINCIPAL = 36;

/**
 * Sugiere el interruptor principal del CDC/TDG para una marca dada.
 * Elige, dentro del catálogo de la marca, el menor In que cubra la corriente total
 * (MCCB para corrientes bajas, ACB para corrientes altas — el catálogo ya los mezcla
 * ordenados por In).
 *
 * `minIcuKA` (opcional): poder de corte mínimo exigido — usado para validar el
 * principal contra la Icc de barra que aporta el trafo alimentador (IEC 61439-2 /
 * RIC N°02: el aparellaje debe soportar el cortocircuito del punto de instalación).
 *
 * Devuelve `undefined` si la corriente total no es asignable con esa marca
 * (p. ej. Chint por debajo de 1000 A) o si ningún equipo alcanza el Icu pedido.
 */
export function sugerirInterruptorPrincipal(
  corrienteTotalA: number,
  marca: MarcaProteccion = 'Schneider',
  minIcuKA = 0,
): Proteccion | undefined {
  if (!Number.isFinite(corrienteTotalA) || corrienteTotalA <= 0) return undefined;
  const Imin = corrienteTotalA * MARGEN_PRINCIPAL;

  const pool = POOL_POR_MARCA[marca];
  if (pool === 'catalogo') return principalSchneider(Imin, minIcuKA);

  const porCorriente = pool
    .toSorted((a, b) => a.inA - b.inA)
    .filter((p) => p.inA >= Imin);
  if (porCorriente.length === 0) return undefined;

  // Buscar el Icu trepando la escalera de calibres entrega un interruptor
  // absurdamente grande: un CCM de 170 A con Icc 85 kA recibía un ACB de
  // 4000 A (23× la carga), porque en el catálogo el poder de corte solo sube
  // al cambiar de bastidor. Se admite un escalón sobre el mínimo por corriente
  // —cambiar de marco para ganar Icu es legítimo—, no cuatro.
  const tope = siguienteEscalon(porCorriente);
  return porCorriente.find((p) => p.inA <= tope && p.icuKA >= minIcuKA);
  // Si nada dentro de ese tope alcanza la Icc se devuelve undefined a
  // propósito: el caller informa "sin interruptor principal en catálogo para
  // X A con Icu ≥ Y kA", que es la respuesta honesta. Devolver el mejor
  // esfuerzo sería peor — ni el TDG ni el CDC revisan el Icu del principal
  // después de elegirlo, así que un equipo insuficiente pasaría en silencio.
}

/**
 * In del escalón inmediatamente superior al menor del pool ya filtrado por
 * corriente. Es el tope de calibre que se acepta para ganar poder de corte.
 */
function siguienteEscalon(pool: readonly Proteccion[]): number {
  const menor = pool[0]!.inA;
  return pool.find((p) => p.inA > menor)?.inA ?? menor;
}

/** Adapta un MasterPact al tipo Proteccion del tablero. */
function masterpactAProteccion(m: Masterpact, tensionV: number): Proteccion {
  const ref = m.referencia ? ` — ${m.referencia}` : '';
  return {
    id: (m.referencia ?? `${m.bastidor}${m.nivel}${m.inA}`).toLowerCase(),
    familia: `MasterPact ${m.bastidor}`,
    marca: 'Schneider',
    referencia: `MasterPact ${m.bastidor}${m.nivel} ${m.inA}A ${m.polos} ${m.ejecucion}${ref}`,
    inA: m.inA,
    icuKA: capacidadMasterpactKa(m, tensionV) ?? 0,
    polos: m.polos === '4P' ? 4 : 3,
    notas: 'Interruptor base: requiere unidad de control MicroLogic y conexiones.',
  };
}

/** Adapta un MCCB del catálogo al tipo Proteccion, para el rango bajo. */
function mccbAPrincipal(m: Mccb, tensionV: number): Proteccion {
  return {
    id: m.referencia.toLowerCase(),
    familia: m.bastidor,
    marca: 'Schneider',
    referencia: `${m.bastidor}${m.clase} ${m.unidadDisparo} ${m.inA}A ${m.polosProtegidos} — ${m.referencia}`,
    inA: m.inA,
    icuKA: capacidadMccbKa(m, tensionV) ?? m.icu415Ka ?? 0,
    polos: m.polos,
  };
}

/**
 * Principal Schneider desde los catálogos reales.
 *
 * Se prueba primero el MCCB, que es lo correcto y más económico hasta donde
 * llega (ComPacT NS alcanza 3200 A), y solo si no alcanza —por corriente o por
 * Icc— se pasa al ACB. En ambos catálogos el poder de corte es una dimensión
 * propia (clase en ComPacT, nivel en MasterPact), así que subir el Icu ya no
 * obliga a subir de calibre: ese era el origen del ACB de 4000 A para un
 * tablero de 170 A.
 */
function principalSchneider(Imin: number, minIcuKA: number): Proteccion | undefined {
  const tensionV = 400;
  const icc = { iccKa: minIcuKA > 0 ? minIcuKA : ICU_MINIMA_PRINCIPAL };

  // Desde donde hay ACB se usa ACB, aunque exista un MCCB del mismo calibre.
  // No es por tamaño sino por selectividad: el principal tiene que aguantar la
  // falla el tiempo que necesita la salida para despejarla, y eso lo da la Icw
  // de un equipo categoría B (MasterPact declara 42-100 kA durante 1 s). Un
  // MCCB corta antes y deja todo el tablero sin tensión.
  if (Imin >= MENOR_IN_MASTERPACT) {
    const acb = sugerirMasterpact(Imin, {
      tensionV, polos: '3P', soloConReferencia: true, ...icc,
    });
    if (acb) return masterpactAProteccion(acb, tensionV);
  }

  const mccb = sugerirMccb(Imin, {
    polos: 3, tensionV, soloCompletos: true,
    familias: ['ComPacT NSXm', 'ComPacT NSX', 'ComPacT NS'],
    protegeSobrecarga: true, ...icc,
  });
  if (mccb) return mccbAPrincipal(mccb, tensionV);

  // Bajo el rango del ACB pero sin MCCB que cumpla la Icc: último intento con
  // ACB, que llega a Icu mayores.
  const acb = sugerirMasterpact(Imin, {
    tensionV, polos: '3P', soloConReferencia: true, ...icc,
  });
  return acb ? masterpactAProteccion(acb, tensionV) : undefined;
}

export const PRINCIPAL_DISPONIBLES: readonly Proteccion[] = [
  ...ABB_TMAX, ...ABB_EMAX2, ...CHINT_NA1,
];
