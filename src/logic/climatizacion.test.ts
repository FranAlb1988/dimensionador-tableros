import { describe, expect, it } from 'vitest';
import {
  BTU_POR_KCAL,
  capacidadEfectiva,
  capacidadSensibleBtuH,
  cargaPresurizacionKcalH,
  DISIPACION_EQUIPOS,
  dimensionarClimatizacion,
  disipacionTipicaW,
  disipacionTotalW,
  factorAltura,
  gananciaSensible,
  HVAC,
  KCAL_POR_WH,
  modeloHvac,
  SALA_CLIMA_REFERENCIA,
  type CondicionEstacion,
  type Envolvente,
} from './climatizacion';

const R = SALA_CLIMA_REFERENCIA;

const envolvente = (): Envolvente => ({
  areaMurosM2: R.areaMurosM2,
  areaTechoM2: R.areaTechoM2,
  areaPisoM2: R.areaPisoM2,
  uMuroTechoKcalHM2C: R.uMuroTechoKcalHM2C,
  uPisoKcalHM2C: R.uPisoKcalHM2C,
});

const presurizacion = () => cargaPresurizacionKcalH(
  R.caudalPresurizacionM3H, R.densidadAireKgM3, R.cpAireKcalKgC, R.presurizacionDeltaTC,
);

/** Aportes internos del caso de referencia. La radiación solar es 0 en invierno. */
const internos = (radiacionKcalH: number) => ({
  equiposW: R.disipacionEquiposW,
  cablesW: R.cablesW,
  personas: R.personas,
  iluminacionKcalH: R.iluminacionKcalH,
  radiacionKcalH,
  presurizacionKcalH: presurizacion(),
});

// La memoria calcula la envolvente contra la temperatura interior PROMEDIO, no
// contra la máxima de cada estación. En verano eso da Δt = 40 − 21,5 = 18,5 °C,
// consistente con su resumen. En invierno la tabla 7.1 usa Δt = 3,7 °C, que
// implica una interior de 20,2 y no los 21,5 declarados: se reproduce el número
// de la tabla, que es el que generó los totales publicados.
const estacionesReferencia = (): CondicionEstacion[] => [
  { nombre: 'Invierno', extC: R.extInviernoMaxC, intC: R.intInviernoEnvolventeC, internos: internos(0) },
  { nombre: 'Verano', extC: R.extVeranoC, intC: R.intPromedioC, internos: internos(R.radiacionVeranoKcalH) },
];

describe('tabla de disipación térmica', () => {
  it('reproduce exacto el total publicado de la sala de referencia', () => {
    // 56 entradas para las 57 filas de la tabla: el variador de MT y su
    // transformador comparten una celda de disipación y no se pueden separar.
    expect(DISIPACION_EQUIPOS).toHaveLength(56);
    expect(disipacionTotalW(DISIPACION_EQUIPOS)).toBe(R.disipacionEquiposW);
    expect(R.disipacionEquiposW).toBe(221079);
  });

  it('el variador de MT y su transformador son el mayor foco de calor', () => {
    // 57 kW en una celda combinada: más de un cuarto de toda la sala. La
    // extracción de texto del PDF reordena esa celda y hace parecer que el
    // variador de MT no disipa nada, que sería un error de 57 kW.
    const mt = DISIPACION_EQUIPOS.find((e) => e.tipo === 'vdfMt')!;
    expect(mt.w).toBe(57000);
    const mayor = [...DISIPACION_EQUIPOS].sort((a, b) => b.w - a.w)[0]!;
    expect(mayor.tipo).toBe('vdfMt');
  });

  it('los equipos en standby no aportan calor', () => {
    const standby = DISIPACION_EQUIPOS.filter((e) => e.standby);
    expect(standby.length).toBeGreaterThanOrEqual(5);
    for (const e of standby) expect(e.w).toBe(0);
    // Y si se contaran, la sala pediría mucho más frío del que necesita.
    const siContaran = DISIPACION_EQUIPOS.reduce((s, e) => s + e.w, 0);
    expect(siContaran).toBe(R.disipacionEquiposW);
  });

  it('los HVAC y presurizadores están en el listado pero con aporte nulo', () => {
    const hvac = DISIPACION_EQUIPOS.filter((e) => e.tipo === 'hvac');
    expect(hvac).toHaveLength(9);
    for (const e of hvac) expect(e.w).toBe(0);
  });

  it('disipacionTipicaW promedia solo los ítems que aportan', () => {
    expect(disipacionTipicaW('trafoSeco')).toBeCloseTo((2000 + 4000 + 10000) / 3, 6);
    expect(disipacionTipicaW('extincion')).toBeUndefined();
  });
});

describe('derrateo por altura', () => {
  it('devuelve el valor de tabla en los puntos publicados', () => {
    expect(factorAltura(2400)).toBeCloseTo(0.86, 10);
    expect(factorAltura(1000)).toBeCloseTo(1, 10);
    expect(factorAltura(4000)).toBeCloseTo(0.72, 10);
  });

  it('interpola entre puntos y es monótono decreciente', () => {
    const f = factorAltura(2550);
    expect(f).toBeLessThan(0.86);
    expect(f).toBeGreaterThan(0.83);
    let previo = Infinity;
    for (let h = 1000; h <= 6000; h += 100) {
      const x = factorAltura(h);
      expect(x).toBeLessThanOrEqual(previo + 1e-12);
      previo = x;
    }
  });

  it('satura fuera del rango publicado en vez de extrapolar', () => {
    expect(factorAltura(0)).toBe(1);
    expect(factorAltura(9000)).toBeCloseTo(0.56, 10);
  });
});

describe('capacidad del equipo', () => {
  const w150 = modeloHvac('W150A')!;

  it('trae la capacidad sensible, no la total nominal', () => {
    expect(w150.nominalBtuH).toBe(150000);
    // A 75 °F, la mejor condición de la tabla, ya rinde menos que la placa.
    expect(w150.sensibleBtuH[0]).toBe(131600);
  });

  it('lee las columnas de tabla en sus temperaturas exactas', () => {
    // 75 °F = 23,89 °C y 105 °F = 40,56 °C, las dos condiciones de la memoria.
    expect(capacidadSensibleBtuH(w150, (75 - 32) * 5 / 9).btuH).toBeCloseTo(131600, 6);
    expect(capacidadSensibleBtuH(w150, (105 - 32) * 5 / 9).btuH).toBeCloseTo(121100, 6);
  });

  it('la cadena de derrateo reproduce los valores publicados', () => {
    // Invierno: 131.600 × 0,95 × 0,86 = 107.517 BTU/hr (tabla 8.1).
    expect(131600 * HVAC.factorProveedor * 0.86).toBeCloseTo(107517, 0);
    // Verano:   121.100 × 0,95 × 0,86 =  98.939 BTU/hr (tabla 8.2).
    expect(121100 * HVAC.factorProveedor * 0.86).toBeCloseTo(98939, 0);
  });

  it('a 40 °C y 2400 msnm queda en dos tercios de la capacidad de placa', () => {
    const c = capacidadEfectiva(w150, 40, 2400);
    expect(c.factorAltura).toBeCloseTo(0.86, 10);
    expect(c.efectivaBtuH).toBeCloseTo(98939, 0);
    expect(c.fraccionDeNominal).toBeGreaterThan(0.6);
    expect(c.fraccionDeNominal).toBeLessThan(0.7);
    expect(c.efectivaKw).toBeCloseTo(29, 0);
  });

  it('no interpola entre columnas: usa la igual o superior a la de diseño', () => {
    // 40 °C son 104 °F. Interpolar daría 121.620 BTU/hr sensibles, capacidad
    // que la tabla no publica; la columna de 105 °F da 121.100. Sobre esta
    // sala eso es la diferencia entre 8 y 9 equipos instalados.
    expect(capacidadSensibleBtuH(w150, 40).btuH).toBe(121100);
    expect(capacidadSensibleBtuH(w150, 38).btuH).toBe(121100);
    expect(capacidadSensibleBtuH(w150, 37).btuH).toBe(123700);
  });

  it('no salta de columna por el redondeo de °C a °F', () => {
    // La invierno de diseño, 23,9 °C, son 75,02 °F: dos centésimas sobre la
    // columna de 75 °F, y por puro redondeo de unidades. Sin tolerancia el
    // equipo perdería 1,3 % de capacidad ahí.
    expect(capacidadSensibleBtuH(w150, 23.9).btuH).toBe(131600);
    expect(capacidadSensibleBtuH(w150, 23.9).fueraDeTabla).toBe(false);
    // Pero una diferencia real sí cambia de columna.
    expect(capacidadSensibleBtuH(w150, 25).btuH).toBe(130300);
  });

  it('la altura sola cuesta más que un equipo entero en faena alta', () => {
    const bajo = capacidadEfectiva(w150, 40, 1000).efectivaBtuH;
    const alto = capacidadEfectiva(w150, 40, 4000).efectivaBtuH;
    expect(alto / bajo).toBeCloseTo(0.72, 2);
  });

  it('avisa cuando la temperatura sale de la tabla del catálogo', () => {
    expect(capacidadSensibleBtuH(w150, 55).fueraDeTabla).toBe(true);
    expect(capacidadSensibleBtuH(w150, 20).fueraDeTabla).toBe(true);
    expect(capacidadSensibleBtuH(w150, 40).fueraDeTabla).toBe(false);
  });
});

describe('ganancia sensible del recinto', () => {
  it('reproduce exacto el total de verano de la memoria', () => {
    // Factor de crecimiento 1: la planilla de la memoria no aplicó el 5 %.
    const g = gananciaSensible(
      envolvente(), internos(R.radiacionVeranoKcalH), R.extVeranoC - R.intPromedioC, 1,
    );
    expect(g.totalKcalH).toBeCloseTo(R.totalSensibleVeranoKcalH, 0);
    expect(g.totalKcalH).toBeCloseTo(200098, 0);
  });

  it('reproduce exacto el total de invierno de la memoria', () => {
    const g = gananciaSensible(
      envolvente(), internos(0), R.extInviernoMaxC - R.intInviernoEnvolventeC, 1,
    );
    expect(g.totalKcalH).toBeCloseTo(R.totalSensibleInviernoKcalH, 0);
    expect(g.totalKcalH).toBeCloseTo(195742, 0);
  });

  it('reproduce cada término de la envolvente por separado', () => {
    const g = gananciaSensible(
      envolvente(), internos(R.radiacionVeranoKcalH), R.extVeranoC - R.intPromedioC, 1,
    );
    const de = (c: string) => g.aportes.find((a) => a.concepto === c)!.kcalH;
    expect(de('Muros')).toBeCloseTo(2122.96, 1);
    expect(de('Techo')).toBeCloseTo(1229.59, 1);
    expect(de('Piso')).toBeCloseTo(1213.33, 1);
    expect(de('Equipamiento')).toBeCloseTo(190083.7, 0);
    expect(de('Cables')).toBeCloseTo(1719.6, 1);
    expect(de('Personas')).toBe(180);
    expect(de('Presurización')).toBeCloseTo(1896, 6);
  });

  it('el equipamiento es el 95 % de la carga: la envolvente casi no pesa', () => {
    const g = gananciaSensible(
      envolvente(), internos(R.radiacionVeranoKcalH), R.extVeranoC - R.intPromedioC, 1,
    );
    const equipos = g.aportes.find((a) => a.concepto === 'Equipamiento')!.kcalH;
    expect(equipos / g.totalKcalH).toBeGreaterThan(0.94);
  });

  it('el factor de crecimiento solo escala el equipamiento', () => {
    const sin = gananciaSensible(envolvente(), internos(0), 18.5, 1);
    const con = gananciaSensible(envolvente(), internos(0), 18.5, 1.05);
    const eq = (g: typeof sin) => g.aportes.find((a) => a.concepto === 'Equipamiento')!.kcalH;
    expect(eq(con) / eq(sin)).toBeCloseTo(1.05, 10);
    const muros = (g: typeof sin) => g.aportes.find((a) => a.concepto === 'Muros')!.kcalH;
    expect(muros(con)).toBeCloseTo(muros(sin), 10);
  });

  it('convierte a BTU/hr y kW de forma consistente', () => {
    const g = gananciaSensible(envolvente(), { equiposW: 1000 }, 0, 1);
    expect(g.totalKcalH).toBeCloseTo(859.8, 6);
    expect(g.totalBtuH).toBeCloseTo(859.8 * BTU_POR_KCAL, 6);
    expect(g.totalKw).toBeCloseTo(1, 6);
    expect(KCAL_POR_WH).toBe(0.8598);
  });

  it('con delta negativo la envolvente descarga en vez de cargar', () => {
    const g = gananciaSensible(envolvente(), { equiposW: 0 }, -10, 1);
    expect(g.totalKcalH).toBeLessThan(0);
  });
});

describe('dimensionarClimatizacion', () => {
  const w150 = modeloHvac('W150A')!;

  it('reproduce el caso de referencia: manda verano y son 9 equipos', () => {
    const d = dimensionarClimatizacion(w150, envolvente(), estacionesReferencia(), R.altitudMsnm, 1)!;
    const inv = d.estaciones.find((e) => e.nombre === 'Invierno')!;
    const ver = d.estaciones.find((e) => e.nombre === 'Verano')!;

    expect(inv.unidadesExactas).toBeCloseTo(7.2, 1);
    expect(inv.unidades).toBe(R.unidadesInvierno);
    expect(ver.unidadesExactas).toBeCloseTo(8.03, 1);
    expect(ver.unidades).toBe(R.unidadesVerano);

    expect(d.critica.nombre).toBe('Verano');
    expect(d.unidades).toBe(9);
    expect(d.fueraDeTabla).toBe(false);
  });

  it('el invierno no es descartable: pide 8 de los 9 equipos', () => {
    // Es el punto de calcular las dos estaciones. El recinto carga más en
    // verano, pero el equipo también rinde menos, y las dos curvas quedan
    // cerca: mirar solo el verano funciona acá y no tiene por qué funcionar
    // siempre.
    const d = dimensionarClimatizacion(w150, envolvente(), estacionesReferencia(), R.altitudMsnm, 1)!;
    const inv = d.estaciones.find((e) => e.nombre === 'Invierno')!;
    expect(inv.ganancia.totalKcalH).toBeLessThan(d.critica.ganancia.totalKcalH);
    expect(inv.capacidad.efectivaBtuH).toBeGreaterThan(d.critica.capacidad.efectivaBtuH);
    expect(inv.unidades / d.unidades).toBeGreaterThan(0.8);
  });

  it('la misma sala a 4000 msnm necesita más equipos', () => {
    const bajo = dimensionarClimatizacion(w150, envolvente(), estacionesReferencia(), 1000, 1)!;
    const alto = dimensionarClimatizacion(w150, envolvente(), estacionesReferencia(), 4000, 1)!;
    expect(alto.unidades).toBeGreaterThan(bajo.unidades);
  });

  it('un modelo más chico necesita más unidades', () => {
    const w090 = modeloHvac('W090A')!;
    const grande = dimensionarClimatizacion(w150, envolvente(), estacionesReferencia(), 2400, 1)!;
    const chico = dimensionarClimatizacion(w090, envolvente(), estacionesReferencia(), 2400, 1)!;
    expect(chico.unidades).toBeGreaterThan(grande.unidades);
  });

  it('propaga el aviso de fuera de tabla', () => {
    const caliente: CondicionEstacion[] = [
      { nombre: 'Extremo', extC: 60, intC: 25, internos: { equiposW: 50000 } },
    ];
    const d = dimensionarClimatizacion(w150, envolvente(), caliente, 2400, 1)!;
    expect(d.fueraDeTabla).toBe(true);
  });

  it('sin estaciones no dimensiona', () => {
    expect(dimensionarClimatizacion(w150, envolvente(), [], 2400)).toBeUndefined();
  });

  it('modeloHvac no inventa modelos', () => {
    expect(modeloHvac('W999Z')).toBeUndefined();
    expect(modeloHvac('w150a')!.toneladas).toBe(12.5);
  });
});

describe('carga de presurización', () => {
  it('reproduce el valor de la memoria', () => {
    expect(presurizacion()).toBeCloseTo(1896, 6);
  });

  it('sin caudal o sin salto de temperatura no hay carga', () => {
    expect(cargaPresurizacionKcalH(0, 0.79, 0.24, 2)).toBe(0);
    expect(cargaPresurizacionKcalH(5000, 0.79, 0.24, 0)).toBe(0);
  });
});
