import { describe, expect, it } from 'vitest';
import {
  AGRUPAMIENTO,
  AMPACIDAD,
  ampacidadCorregida,
  ampacidadTabla,
  areaBandejaMm2,
  AREA_BANDEJA_POR_MM,
  BANDEJAS,
  calibrePorCorriente,
  CALIBRES,
  factorAgrupamiento,
  factorTemperatura,
} from './nec';

describe('Tabla 310.16 — ampacidad', () => {
  it('trae los 28 calibres, del 14 AWG al 2000 kcmil', () => {
    expect(AMPACIDAD).toHaveLength(28);
    expect(CALIBRES[0]).toBe('14');
    expect(CALIBRES[CALIBRES.length - 1]).toBe('2000');
  });

  it('reproduce valores conocidos de la tabla', () => {
    expect(ampacidadTabla('14', 'cobre', 60)).toBe(15);
    expect(ampacidadTabla('12', 'cobre', 75)).toBe(25);
    expect(ampacidadTabla('4/0', 'cobre', 75)).toBe(230);
    expect(ampacidadTabla('500', 'cobre', 75)).toBe(380);
    expect(ampacidadTabla('4/0', 'aluminio', 90)).toBe(205);
    expect(ampacidadTabla('2000', 'cobre', 90)).toBe(750);
  });

  it('el aluminio no baja del 12 AWG', () => {
    // El 14 AWG no se fabrica en aluminio: la tabla lo deja vacío y no
    // corresponde inventarle un valor.
    expect(ampacidadTabla('14', 'aluminio', 60)).toBeUndefined();
    expect(ampacidadTabla('12', 'aluminio', 60)).toBe(15);
  });

  it('la ampacidad crece con el calibre y con la temperatura de aislación', () => {
    for (const f of AMPACIDAD) {
      if (f.cu60 != null && f.cu75 != null) expect(f.cu75).toBeGreaterThanOrEqual(f.cu60);
      if (f.cu75 != null && f.cu90 != null) expect(f.cu90).toBeGreaterThanOrEqual(f.cu75);
      // El aluminio nunca conduce más que el cobre del mismo calibre.
      if (f.cu75 != null && f.al75 != null) expect(f.al75).toBeLessThan(f.cu75);
    }
  });

  it('un calibre inexistente no devuelve nada', () => {
    expect(ampacidadTabla('16', 'cobre', 75)).toBeUndefined();
  });
});

describe('Tabla 310.15(B)(1)(1) — corrección por temperatura', () => {
  it('es 1 en la base de 30 °C', () => {
    expect(factorTemperatura(30, 60)).toBe(1);
    expect(factorTemperatura(30, 75)).toBe(1);
    expect(factorTemperatura(30, 90)).toBe(1);
  });

  it('bonifica por debajo de 30 °C y castiga por encima', () => {
    expect(factorTemperatura(10, 75)).toBeGreaterThan(1);
    expect(factorTemperatura(45, 75)!).toBeLessThan(1);
    expect(factorTemperatura(45, 75)).toBe(0.82);
  });

  it('resuelve los tramos por sus bordes', () => {
    expect(factorTemperatura(41, 90)).toBe(0.87);
    expect(factorTemperatura(45, 90)).toBe(0.87);
    expect(factorTemperatura(46, 90)).toBe(0.82);
  });

  it('no inventa factor donde la tabla no publica', () => {
    // Sobre 55 °C un aislamiento de 60 °C ya no sirve y la tabla queda vacía.
    expect(factorTemperatura(60, 60)).toBeUndefined();
    expect(factorTemperatura(60, 75)).toBe(0.58);
    expect(factorTemperatura(200, 90)).toBeUndefined();
  });

  it('el aislamiento más caliente castiga menos', () => {
    expect(factorTemperatura(50, 90)!).toBeGreaterThan(factorTemperatura(50, 75)!);
    expect(factorTemperatura(50, 75)!).toBeGreaterThan(factorTemperatura(50, 60)!);
  });
});

describe('Tabla 310.15(C)(1) — agrupamiento', () => {
  it('hasta tres conductores no se ajusta', () => {
    expect(factorAgrupamiento(1)).toBe(1);
    expect(factorAgrupamiento(3)).toBe(1);
  });

  it('reproduce los tramos publicados', () => {
    expect(factorAgrupamiento(4)).toBe(0.8);
    expect(factorAgrupamiento(6)).toBe(0.8);
    expect(factorAgrupamiento(7)).toBe(0.7);
    expect(factorAgrupamiento(10)).toBe(0.5);
    expect(factorAgrupamiento(21)).toBe(0.45);
    expect(factorAgrupamiento(31)).toBe(0.4);
    expect(factorAgrupamiento(41)).toBe(0.35);
    expect(factorAgrupamiento(200)).toBe(0.35);
  });

  it('los tramos cubren sin huecos y el factor solo baja', () => {
    let previo = 1;
    for (let n = 4; n <= 60; n++) {
      const f = factorAgrupamiento(n);
      expect(f).toBeGreaterThan(0);
      expect(f).toBeLessThanOrEqual(previo);
      previo = f;
    }
    expect(AGRUPAMIENTO[AGRUPAMIENTO.length - 1]!.hasta).toBeNull();
  });
});

describe('ampacidadCorregida', () => {
  it('encadena tabla × temperatura × agrupamiento', () => {
    // 4/0 Cu 75 °C = 230 A; a 45 °C el factor es 0,82; con 6 conductores 0,80.
    const r = ampacidadCorregida('4/0', 'cobre', 75, 45, 6)!;
    expect(r.base).toBe(230);
    expect(r.factorTemperatura).toBe(0.82);
    expect(r.factorAgrupamiento).toBe(0.8);
    expect(r.corregida).toBeCloseTo(230 * 0.82 * 0.8, 6);
    expect(r.corregida).toBeCloseTo(150.88, 2);
  });

  it('sin correcciones devuelve la ampacidad de tabla', () => {
    const r = ampacidadCorregida('500', 'cobre', 75, 30, 3)!;
    expect(r.corregida).toBe(380);
  });

  it('las correcciones no son un detalle: aquí se pierde el 34 %', () => {
    const sin = ampacidadTabla('4/0', 'cobre', 75)!;
    const con = ampacidadCorregida('4/0', 'cobre', 75, 45, 6)!.corregida;
    expect(con / sin).toBeCloseTo(0.656, 2);
  });

  it('no devuelve nada si la temperatura deja al aislamiento fuera de tabla', () => {
    expect(ampacidadCorregida('4/0', 'cobre', 60, 60, 3)).toBeUndefined();
  });
});

describe('calibrePorCorriente', () => {
  it('elige el más chico que cubre, sin correcciones', () => {
    // 200 A a 75 °C: el 3/0 da exactamente 200.
    expect(calibrePorCorriente(200, 'cobre', 75, 30, 3)!.calibre).toBe('3/0');
    expect(calibrePorCorriente(201, 'cobre', 75, 30, 3)!.calibre).toBe('4/0');
  });

  it('sube de calibre cuando hay que corregir', () => {
    const facil = calibrePorCorriente(150, 'cobre', 75, 30, 3)!;
    const dificil = calibrePorCorriente(150, 'cobre', 75, 45, 6)!;
    expect(CALIBRES.indexOf(dificil.calibre)).toBeGreaterThan(CALIBRES.indexOf(facil.calibre));
    expect(dificil.corregida).toBeGreaterThanOrEqual(150);
  });

  it('el aluminio pide más calibre que el cobre para la misma corriente', () => {
    const cu = calibrePorCorriente(200, 'cobre', 75, 30, 3)!;
    const al = calibrePorCorriente(200, 'aluminio', 75, 30, 3)!;
    expect(CALIBRES.indexOf(al.calibre)).toBeGreaterThan(CALIBRES.indexOf(cu.calibre));
  });

  it('devuelve undefined cuando ni el mayor calibre alcanza', () => {
    // Poner conductores en paralelo es decisión del proyectista, no del cálculo.
    expect(calibrePorCorriente(5000, 'cobre', 75, 30, 3)).toBeUndefined();
  });

  it('rechaza corrientes no positivas', () => {
    expect(calibrePorCorriente(0, 'cobre', 75, 30, 3)).toBeUndefined();
    expect(calibrePorCorriente(-5, 'cobre', 75, 30, 3)).toBeUndefined();
  });
});

describe('Tabla 392.22(A)(1) — llenado de bandeja', () => {
  it('la columna métrica da 30 mm² por mm de ancho, salvo en 225 mm', () => {
    // El NEC publica 6.800 mm² para 225 mm donde la razón daría 6.750. Es el
    // único ancho que no cierra exacto, y es la razón de devolver el valor de
    // tabla en vez de multiplicar siempre.
    expect(AREA_BANDEJA_POR_MM).toBe(30);
    const excepciones = BANDEJAS.filter((b) => Math.abs(b.escaleraMm2 / b.anchoMm - 30) > 1e-6);
    expect(excepciones.map((b) => b.anchoMm)).toEqual([225]);
    expect(areaBandejaMm2(225)).toBe(6800);
    expect(225 * AREA_BANDEJA_POR_MM).toBe(6750);
  });

  it('la columna en pulgadas redondea distinto y no coincide exacto', () => {
    // 28,0 in² / 24 in convertido da 29,63 mm²/mm, no 30. No es un error de
    // ninguna de las dos columnas: son dos redondeos del mismo criterio.
    const b = BANDEJAS.find((x) => x.anchoMm === 600)!;
    const desdePulgadas = (b.escaleraPulg2 * 645.16) / (b.anchoPulg * 25.4);
    expect(desdePulgadas).toBeCloseTo(29.63, 2);
    expect(desdePulgadas).not.toBeCloseTo(30, 2);
  });

  it('devuelve el valor publicado para los anchos de tabla', () => {
    expect(areaBandejaMm2(600)).toBe(18000);
    expect(areaBandejaMm2(300)).toBe(9000);
  });

  it('interpola con la misma razón para anchos fuera de tabla', () => {
    expect(areaBandejaMm2(350)).toBe(10500);
  });

  it('el fondo sólido admite menos que la escalera', () => {
    for (const b of BANDEJAS) {
      expect(b.fondoSolidoMm2).toBeLessThan(b.escaleraMm2);
    }
  });
});
