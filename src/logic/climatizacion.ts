// Climatización de la sala eléctrica: carga térmica y cantidad de equipos.
//
// Implementa la metodología de la memoria DOC-0014 del proyecto Rajo Inca
// (PRECISIÓN S.A. para CODELCO), basada en ASHRAE Handbook Fundamentals.
//
// Hay tres cosas que es fácil hacer mal y que esta memoria hace bien:
//
//  1. La capacidad de placa del equipo NO es la utilizable. Se parte de la
//     capacidad SENSIBLE a la temperatura exterior de diseño — no de la total
//     nominal —, se multiplica por el factor del proveedor y recién ahí se
//     derratea por altura. En la sala de referencia eso lleva un W150A de
//     150.000 BTU/h nominales a 98.939 BTU/h utilizables: 34 % menos.
//
//  2. Se calculan las DOS estaciones y manda la peor. No es obvio cuál gana:
//     en verano el recinto pide más, pero el equipo también rinde menos, y el
//     resultado depende de cómo se cruzan las dos curvas.
//
//  3. El derrateo por altura castiga al EQUIPO, no a la ganancia del recinto.
//     Aplicarlo del lado de la carga es un error que subdimensiona.
//
// El derrateo por altura no es un detalle en Chile: a 4.000 m el equipo rinde
// 0,72 de lo que dice el catálogo.

import datos from '../data/salas/climatizacion.json';

export const FACTOR_CRECIMIENTO = datos.factorCrecimiento;
export const PERSONA_KCAL_H = datos.personaKcalH;
export const KCAL_POR_WH = datos.kcalPorWh;
export const BTU_POR_KCAL = datos.btuPorKcal;

export interface FactorAltura {
  msnm: number;
  factor: number;
}

export const FACTORES_ALTURA = datos.factoresAltura as readonly FactorAltura[];

export interface DisipacionEquipo {
  tag: string;
  descripcion: string;
  tipo: string;
  hp?: number;
  kva?: number;
  standby?: boolean;
  w: number;
}

export const DISIPACION_EQUIPOS = datos.disipacionEquipos as readonly DisipacionEquipo[];

export interface ModeloHvac {
  modelo: string;
  toneladas: number;
  nominalBtuH: number;
  pesoKg: number;
  sensibleBtuH: readonly number[];
}

export const HVAC = datos.hvac as {
  serie: string;
  etapa: string;
  retornoDbWbF: string;
  factorProveedor: number;
  tempExteriorF: readonly number[];
  modelos: readonly ModeloHvac[];
};

export const SALA_CLIMA_REFERENCIA = datos.salaReferencia;

const cToF = (c: number) => (c * 9) / 5 + 32;

/**
 * Tolerancia para considerar que una temperatura cae SOBRE una columna.
 *
 * La tabla del catálogo está en °F y las temperaturas de diseño chilenas
 * vienen en °C ya redondeadas, así que caen justo al lado de una columna por
 * el redondeo y no por el clima: la invierno de 23,9 °C son 75,02 °F, a dos
 * centésimas de la columna de 75 °F. Sin esta tolerancia el equipo saltaría a
 * la columna siguiente y perdería 1,3 % de capacidad por un artefacto de
 * conversión de unidades.
 */
const TOLERANCIA_COLUMNA_F = 0.1;

/**
 * Factor de derrateo por altura geográfica, interpolado linealmente.
 *
 * Bajo la primera entrada de la tabla (1.000 m) no hay bonificación: se
 * mantiene en 1. Sobre la última se extrapolaría a ciegas, así que se satura
 * en el último valor publicado y el llamador debería tratarlo como fuera de
 * rango — a más de 6.000 m no hay tabla que respalde nada.
 */
export function factorAltura(msnm: number): number {
  const t = FACTORES_ALTURA;
  const primero = t[0]!;
  const ultimo = t[t.length - 1]!;
  if (msnm <= primero.msnm) return primero.factor;
  if (msnm >= ultimo.msnm) return ultimo.factor;
  for (let i = 1; i < t.length; i++) {
    const b = t[i]!;
    if (msnm <= b.msnm) {
      const a = t[i - 1]!;
      const p = (msnm - a.msnm) / (b.msnm - a.msnm);
      return a.factor + p * (b.factor - a.factor);
    }
  }
  return ultimo.factor;
}

/** Modelo de equipo por nombre. */
export function modeloHvac(modelo: string): ModeloHvac | undefined {
  return HVAC.modelos.find((m) => m.modelo.toLowerCase() === modelo.toLowerCase());
}

export interface CapacidadSensible {
  btuH: number;
  /** true si la temperatura quedó fuera del rango publicado (75–125 °F). */
  fueraDeTabla: boolean;
}

/**
 * Capacidad sensible de tabla a una temperatura exterior dada.
 *
 * Se toma la columna IGUAL O SUPERIOR a la temperatura de diseño, no se
 * interpola. No es un atajo: interpolar acredita al equipo una capacidad que
 * la tabla no publica, y en el caso de referencia la diferencia decide si la
 * sala lleva 8 o 9 equipos. A 40 °C (104 °F) interpolar da 7,99 unidades y la
 * columna de 105 °F da 8,03 — la memoria instala 9. Entre creerle al punto
 * intermedio y creerle al catálogo, se le cree al catálogo.
 *
 * Fuera del rango publicado se satura en el extremo y se avisa: por encima de
 * 125 °F el catálogo simplemente no dice qué pasa.
 */
export function capacidadSensibleBtuH(
  modelo: ModeloHvac,
  tempExteriorC: number,
): CapacidadSensible {
  const f = cToF(tempExteriorC);
  const temps = HVAC.tempExteriorF;
  const caps = modelo.sensibleBtuH;
  const ultimo = temps[temps.length - 1]!;
  if (f > ultimo + TOLERANCIA_COLUMNA_F) {
    return { btuH: caps[caps.length - 1]!, fueraDeTabla: true };
  }
  const i = temps.findIndex((t) => f <= t + TOLERANCIA_COLUMNA_F);
  return { btuH: caps[i]!, fueraDeTabla: f < temps[0]! - TOLERANCIA_COLUMNA_F };
}

export interface CapacidadEfectiva extends CapacidadSensible {
  /** Capacidad sensible de tabla, antes de castigos. */
  sensibleTablaBtuH: number;
  /** Después del factor del proveedor. */
  realBtuH: number;
  /** Después del derrateo por altura: la que se usa para dimensionar. */
  efectivaBtuH: number;
  efectivaKw: number;
  factorAltura: number;
  /** Fracción de la capacidad nominal de placa que queda disponible. */
  fraccionDeNominal: number;
}

/**
 * Capacidad realmente disponible de un equipo, con la cadena completa:
 * sensible de tabla → × factor de proveedor → × factor de altura.
 */
export function capacidadEfectiva(
  modelo: ModeloHvac,
  tempExteriorC: number,
  altitudMsnm: number,
): CapacidadEfectiva {
  const s = capacidadSensibleBtuH(modelo, tempExteriorC);
  const realBtuH = s.btuH * HVAC.factorProveedor;
  const fa = factorAltura(altitudMsnm);
  const efectivaBtuH = realBtuH * fa;
  return {
    ...s,
    sensibleTablaBtuH: s.btuH,
    realBtuH,
    efectivaBtuH,
    efectivaKw: (efectivaBtuH / BTU_POR_KCAL) * (1 / KCAL_POR_WH) / 1000,
    factorAltura: fa,
    fraccionDeNominal: efectivaBtuH / modelo.nominalBtuH,
  };
}

/** Un aporte de calor con su origen, para poder mostrar el desglose. */
export interface AporteCalor {
  concepto: string;
  kcalH: number;
}

export interface Envolvente {
  areaMurosM2: number;
  areaTechoM2: number;
  areaPisoM2: number;
  /** U de muro y techo, kcal/h·m²·°C. */
  uMuroTechoKcalHM2C: number;
  /** U de piso, kcal/h·m²·°C. */
  uPisoKcalHM2C: number;
}

export interface AportesInternos {
  /** Disipación de los equipos eléctricos del recinto, W. */
  equiposW: number;
  /** Disipación estimada del cableado, W. */
  cablesW?: number;
  personas?: number;
  iluminacionKcalH?: number;
  radiacionKcalH?: number;
  /** Carga que introduce el aire de presurización, kcal/h. */
  presurizacionKcalH?: number;
}

/**
 * Carga que introduce el aire de presurización.
 * Q = caudal · densidad · cp · Δt, con la densidad ya derrateada por altura.
 */
export function cargaPresurizacionKcalH(
  caudalM3H: number,
  densidadKgM3: number,
  cpKcalKgC: number,
  deltaTC: number,
): number {
  if (!(caudalM3H > 0) || !(densidadKgM3 > 0) || deltaTC <= 0) return 0;
  return caudalM3H * densidadKgM3 * cpKcalKgC * deltaTC;
}

export interface GananciaSensible {
  aportes: readonly AporteCalor[];
  totalKcalH: number;
  totalBtuH: number;
  totalKw: number;
}

/**
 * Ganancia sensible del recinto para una condición (una estación).
 *
 * `deltaTC` es la diferencia entre la exterior máxima de la estación y la
 * interior promedio. Puede ser negativa en invierno, y entonces la envolvente
 * ayuda en vez de cargar; se conserva el signo porque así lo hace la memoria.
 */
export function gananciaSensible(
  envolvente: Envolvente,
  internos: AportesInternos,
  deltaTC: number,
  factorCrecimiento = FACTOR_CRECIMIENTO,
): GananciaSensible {
  const { uMuroTechoKcalHM2C: u, uPisoKcalHM2C: up } = envolvente;
  const aportes: AporteCalor[] = [
    { concepto: 'Muros', kcalH: envolvente.areaMurosM2 * u * deltaTC },
    { concepto: 'Techo', kcalH: envolvente.areaTechoM2 * u * deltaTC },
    { concepto: 'Piso', kcalH: envolvente.areaPisoM2 * up * deltaTC },
    { concepto: 'Equipamiento', kcalH: internos.equiposW * KCAL_POR_WH * factorCrecimiento },
    { concepto: 'Cables', kcalH: (internos.cablesW ?? 0) * KCAL_POR_WH },
    { concepto: 'Personas', kcalH: (internos.personas ?? 0) * PERSONA_KCAL_H },
    { concepto: 'Iluminación', kcalH: internos.iluminacionKcalH ?? 0 },
    { concepto: 'Radiación solar', kcalH: internos.radiacionKcalH ?? 0 },
    { concepto: 'Presurización', kcalH: internos.presurizacionKcalH ?? 0 },
  ].filter((a) => a.kcalH !== 0);

  const totalKcalH = aportes.reduce((s, a) => s + a.kcalH, 0);
  return {
    aportes,
    totalKcalH,
    totalBtuH: totalKcalH * BTU_POR_KCAL,
    totalKw: (totalKcalH / KCAL_POR_WH) / 1000,
  };
}

export interface CondicionEstacion {
  nombre: string;
  /** Temperatura exterior máxima de la estación, °C. */
  extC: number;
  /** Temperatura interior de referencia para la envolvente, °C. */
  intC: number;
  internos: AportesInternos;
}

export interface ResultadoEstacion {
  nombre: string;
  extC: number;
  ganancia: GananciaSensible;
  capacidad: CapacidadEfectiva;
  /** Unidades necesarias, con decimales. */
  unidadesExactas: number;
  /** Unidades a instalar: el entero superior. */
  unidades: number;
}

export interface DimensionamientoClima {
  modelo: ModeloHvac;
  altitudMsnm: number;
  estaciones: readonly ResultadoEstacion[];
  /** La estación que manda, que es la que pide más unidades. */
  critica: ResultadoEstacion;
  /** Unidades a instalar. */
  unidades: number;
  /** true si alguna estación quedó fuera de la tabla del catálogo. */
  fueraDeTabla: boolean;
}

/**
 * Dimensiona la climatización evaluando cada estación y quedándose con la peor.
 *
 * No se resuelve por la estación más calurosa sin mirar: el recinto pide más
 * en verano pero el equipo también rinde menos, y cuál de los dos efectos pesa
 * depende del caso. En la sala de referencia invierno pide 7,20 unidades y
 * verano 8,03, y se instalan 9.
 */
export function dimensionarClimatizacion(
  modelo: ModeloHvac,
  envolvente: Envolvente,
  estaciones: readonly CondicionEstacion[],
  altitudMsnm: number,
  factorCrecimiento = FACTOR_CRECIMIENTO,
): DimensionamientoClima | undefined {
  if (estaciones.length === 0) return undefined;

  const resultados = estaciones.map((e): ResultadoEstacion => {
    const ganancia = gananciaSensible(envolvente, e.internos, e.extC - e.intC, factorCrecimiento);
    const capacidad = capacidadEfectiva(modelo, e.extC, altitudMsnm);
    const unidadesExactas = capacidad.efectivaBtuH > 0
      ? ganancia.totalBtuH / capacidad.efectivaBtuH
      : Infinity;
    return {
      nombre: e.nombre,
      extC: e.extC,
      ganancia,
      capacidad,
      unidadesExactas,
      unidades: Number.isFinite(unidadesExactas) ? Math.ceil(unidadesExactas) : 0,
    };
  });

  const critica = resultados.reduce((a, b) => (b.unidadesExactas > a.unidadesExactas ? b : a));
  return {
    modelo,
    altitudMsnm,
    estaciones: resultados,
    critica,
    unidades: critica.unidades,
    fueraDeTabla: resultados.some((r) => r.capacidad.fueraDeTabla),
  };
}

/**
 * Disipación total de una lista de equipos, en W.
 * Los equipos en standby aportan 0: la redundancia eléctrica ocupa espacio y
 * peso, pero no es carga térmica.
 */
export function disipacionTotalW(equipos: readonly { w: number; standby?: boolean }[]): number {
  return equipos.reduce((s, e) => s + (e.standby ? 0 : e.w), 0);
}

/**
 * Disipación publicada para un tipo de equipo, en W por unidad de referencia.
 *
 * Es un promedio de los ítems del tipo en la memoria de referencia, y sirve
 * como estimación cuando el proyecto todavía no tiene el dato del fabricante.
 * Ojo con los variadores: la memoria publica 4,9 % de la potencia nominal para
 * el de 350 HP y 9,0 % para el de 400 HP, una dispersión que no se explica en
 * el documento. Por eso esto es una estimación y no un factor de diseño.
 */
export function disipacionTipicaW(tipo: string): number | undefined {
  const items = DISIPACION_EQUIPOS.filter((e) => e.tipo === tipo && !e.standby && e.w > 0);
  if (items.length === 0) return undefined;
  return items.reduce((s, e) => s + e.w, 0) / items.length;
}
