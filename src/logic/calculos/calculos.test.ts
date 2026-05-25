import { describe, expect, it } from 'vitest';
import { calculadoraPorId, CALCULADORAS } from './index';
import { CATALOGO_CONDUCTORES, autollenarConductor } from './conductores-catalogo';

function calc(id: string) {
  const c = calculadoraPorId(id);
  if (!c) throw new Error(`Calculadora ${id} no encontrada`);
  return c;
}

describe('registro de calculadoras', () => {
  it('expone 12 calculadoras con id único', () => {
    expect(CALCULADORAS).toHaveLength(12);
    expect(new Set(CALCULADORAS.map((c) => c.id)).size).toBe(12);
  });
});

describe('Ley de Ohm', () => {
  it('con V e I obtiene R y P', () => {
    const r = calc('ley-ohm').calcular({ V: '12', I: '2' });
    expect(r.valores.R).toBeCloseTo(6, 5);
    expect(r.valores.P).toBeCloseTo(24, 5);
  });
  it('con I y R obtiene V', () => {
    const r = calc('ley-ohm').calcular({ I: '3', R: '4' });
    expect(r.valores.V).toBeCloseTo(12, 5);
    expect(r.valores.P).toBeCloseTo(36, 5);
  });
  it('exige al menos dos valores', () => {
    expect(calc('ley-ohm').calcular({ V: '12' }).error).toBeDefined();
  });
});

describe('Triángulo de potencias', () => {
  it('P=100 kW, fp=0,8 → S=125, Q=75, φ=36,87°', () => {
    const r = calc('triangulo-potencias').calcular({ P: '100', fp: '0.8' });
    expect(r.valores.S).toBeCloseTo(125, 3);
    expect(r.valores.Q).toBeCloseTo(75, 3);
    expect(r.valores.angulo).toBeCloseTo(36.87, 1);
  });
});

describe('Corriente desde potencia', () => {
  it('10 kW, 400 V, cosφ=0,85, η=0,9, 3F ≈ 18,87 A', () => {
    const r = calc('corriente-potencia').calcular({
      P: '10', V: '400', fp: '0.85', eta: '0.9', fases: '3F',
    });
    expect(r.valores.I).toBeCloseTo(18.87, 1);
  });
});

describe('Caída de tensión — régimen permanente', () => {
  it('calcula ΔV% con la fórmula trifásica', () => {
    const r = calc('caida-permanente').calcular({
      I: '100', cosPhi: '0.85', L: '50', R: '0.5', X: '0.1', n: '1', Vs: '400', fases: '3F',
    });
    expect(r.valores.deltaVpct).toBeCloseTo(1.034, 2);
  });
});

describe('Corriente de diseño (ampacidad)', () => {
  it('aplica F1 y el apilamiento F3', () => {
    const r = calc('corriente-diseno').calcular({
      In: '100', F1: '1.25', altitud: '0', nivel: 'BT', nConductores: '5',
    });
    expect(r.valores.F2).toBeCloseTo(1, 5);
    expect(r.valores.F3).toBeCloseTo(0.8, 5);
    expect(r.valores.corregida).toBeCloseTo(125, 5);
    expect(r.valores.I).toBeCloseTo(125 / 0.8, 3);
  });
});

describe('Calibre mínimo por cortocircuito', () => {
  it('Icc=10 kA, t=0,5 s, 90→250 °C ≈ 49,8 mm²', () => {
    const r = calc('calibre-cortocircuito').calcular({
      Icc: '10000', t: '0.5', T1: '90', T2: '250',
    });
    expect(r.valores.A).toBeCloseTo(49.8, 0);
  });
});

describe('Cortocircuito por barra', () => {
  it('transformador 2 MVA, %Z=5,75, 400 V ≈ 50,2 kA en el secundario', () => {
    const r = calc('cortocircuito-barra').calcular({
      Str: '2000', pctZ: '5.75', Vll: '400', L: '0',
    });
    expect(r.valores.Zbase).toBeCloseTo(0.08, 4);
    expect(r.valores.Ztr).toBeCloseTo(0.0046, 5);
    expect(r.valores.Icc).toBeCloseTo(50.2, 0);
  });
  it('con tramo de cable la corriente baja', () => {
    const r = calc('cortocircuito-barra').calcular({
      Str: '2000', pctZ: '5.75', Vll: '400',
      L: '13', Runit: '0.041', Xunit: '0.08', nParalelos: '5',
    });
    expect(r.valores.Icc).toBeLessThan(50.2);
    expect(r.valores.Icc).toBeCloseTo(47.8, 0);
  });
});

describe('Armónicos (IEEE 519)', () => {
  it('I1=100 A, THD=35%, IL=120 A', () => {
    const r = calc('armonicos-519').calcular({ I1: '100', THD: '35', IL: '120' });
    expect(r.valores.Irms).toBeCloseTo(105.95, 1);
    expect(r.valores.Iarm).toBeCloseTo(35, 3);
    expect(r.valores.TDD).toBeCloseTo(29.17, 1);
  });
});

describe('Malla de puesta a tierra (IEEE 80)', () => {
  it('produce resistencia y tensiones finitas y positivas', () => {
    const r = calc('malla-tierra').calcular({
      rhoE: '100', rhoS: '3000', hs: '0.2',
      largo: '30', ancho: '9', D: '3', h: '0.6', d: '0.0127', LR: '0',
      I1cc: '755.5', E: '23000', ts: '0.5', peso: '50',
    });
    expect(r.error).toBeUndefined();
    expect(r.valores.A).toBeCloseTo(270, 5);
    for (const v of Object.values(r.valores)) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(r.valores.Rg).toBeGreaterThan(0);
    expect(r.valores.Em).toBeGreaterThan(0);
    expect(r.valores.Es).toBeGreaterThan(0);
    expect(r.nota).toBeDefined();
  });
});

describe('Catálogo de conductores', () => {
  it('tiene entradas con R y X positivos', () => {
    expect(CATALOGO_CONDUCTORES.length).toBeGreaterThan(0);
    for (const c of CATALOGO_CONDUCTORES) {
      expect(c.R).toBeGreaterThan(0);
      expect(c.X).toBeGreaterThan(0);
    }
  });
  it('autollenar devuelve R y X en las claves indicadas', () => {
    const fn = autollenarConductor('R', 'X');
    expect(fn('mcm-500')).toEqual({ R: '0.0886', X: '0.107' });
    const fn2 = autollenarConductor('Runit', 'Xunit');
    expect(Object.keys(fn2('mm2-120'))).toEqual(['Runit', 'Xunit']);
  });
  it('autollenar devuelve vacío para id desconocido o manual', () => {
    const fn = autollenarConductor('R', 'X');
    expect(fn('')).toEqual({});
    expect(fn('no-existe')).toEqual({});
  });
});

describe('Tamaño de ducto (conduit)', () => {
  it('3 conductores → relleno 40% y elige el ducto EMT que cubre', () => {
    // 3 × 4/0 AWG (208,8 mm²) → área total 626,4 → área req 1566 mm² → 2″ EMT.
    const r = calc('tamano-ducto').calcular({
      tipo: 'metalico',
      'grupos.count': '1',
      'grupos.0.area': '208.8', 'grupos.0.cantidad': '3',
    });
    expect(r.valores.totalConductores).toBe(3);
    expect(r.valores.areaTotal).toBeCloseTo(626.4, 1);
    expect(r.valores.relleno).toBe(40);
    expect(r.textos?.ducto).toBe('2″ EMT');
    expect(r.valores.rellenoReal).toBeLessThanOrEqual(40);
  });
  it('un solo conductor usa el 53%', () => {
    const r = calc('tamano-ducto').calcular({
      tipo: 'pvc',
      'grupos.count': '1',
      'grupos.0.area': '100', 'grupos.0.cantidad': '1',
    });
    expect(r.valores.relleno).toBe(53);
    expect(r.textos?.ducto).toMatch(/PVC/);
  });
  it('múltiples calibres: suma áreas y cuenta total de conductores', () => {
    // 3 × 4/0 AWG (208,8) + 1 × #4 AWG (53,16) = 626,4 + 53,16 = 679,56 mm²
    // total 4 conductores → relleno 40%; área req 1698,9 → 2″ EMT (2165 mm²).
    const r = calc('tamano-ducto').calcular({
      tipo: 'metalico',
      'grupos.count': '2',
      'grupos.0.area': '208.8', 'grupos.0.cantidad': '3',
      'grupos.1.area': '53.16', 'grupos.1.cantidad': '1',
    });
    expect(r.valores.totalConductores).toBe(4);
    expect(r.valores.areaTotal).toBeCloseTo(679.56, 1);
    expect(r.valores.relleno).toBe(40);
    expect(r.textos?.ducto).toBe('2″ EMT');
  });
  it('marca cuando supera el ducto más grande', () => {
    const r = calc('tamano-ducto').calcular({
      tipo: 'metalico',
      'grupos.count': '1',
      'grupos.0.area': '5000', 'grupos.0.cantidad': '10',
    });
    expect(r.textos?.ducto).toMatch(/Supera/);
    expect(r.nota).toMatch(/varios ductos/);
  });
  it('sin grupos válidos devuelve error', () => {
    const r = calc('tamano-ducto').calcular({ tipo: 'metalico', 'grupos.count': '0' });
    expect(r.error).toMatch(/al menos un grupo/);
  });
});

describe('Ancho de escalerilla portaconductores', () => {
  it('un solo calibre: ancho requerido = n · diámetro', () => {
    // 6 × 500 MCM (23,44 mm) → 140,6 mm → escalerilla 150 mm.
    const r = calc('ancho-escalerilla').calcular({
      'grupos.count': '1',
      'grupos.0.diametro': '23.44', 'grupos.0.cantidad': '6',
    });
    expect(r.valores.totalConductores).toBe(6);
    expect(r.valores.anchoRequerido).toBeCloseTo(140.64, 1);
    expect(r.valores.anchoSugerido).toBe(150);
  });
  it('múltiples calibres: suma diámetros de todos los grupos', () => {
    // 3 × 500 MCM (23,44) + 1 × 4/0 AWG (16,31) + 1 × #4 AWG (8,23)
    // = 70,32 + 16,31 + 8,23 = 94,86 mm → escalerilla 100 mm.
    const r = calc('ancho-escalerilla').calcular({
      'grupos.count': '3',
      'grupos.0.diametro': '23.44', 'grupos.0.cantidad': '3',
      'grupos.1.diametro': '16.31', 'grupos.1.cantidad': '1',
      'grupos.2.diametro': '8.23',  'grupos.2.cantidad': '1',
    });
    expect(r.valores.totalConductores).toBe(5);
    expect(r.valores.capasUsadas).toBe(1);
    expect(r.valores.anchoRequerido).toBeCloseTo(94.86, 1);
    expect(r.valores.anchoSugerido).toBe(100);
  });
  it('2 capas reducen el ancho requerido a la mitad para conductores iguales', () => {
    // 6 × 500 MCM en 2 capas → 3 por capa → ancho = 3·23,44 = 70,32 → escalerilla 100 mm.
    const r = calc('ancho-escalerilla').calcular({
      capas: '2',
      'grupos.count': '1',
      'grupos.0.diametro': '23.44', 'grupos.0.cantidad': '6',
    });
    expect(r.valores.totalConductores).toBe(6);
    expect(r.valores.capasUsadas).toBe(2);
    expect(r.valores.anchoRequerido).toBeCloseTo(70.32, 1);
    expect(r.valores.anchoSugerido).toBe(100);
  });
  it('bin-packing balancea calibres distintos entre capas', () => {
    // 3 × 23,44 (grandes) + 2 × 8,23 (pequeños) en 2 capas.
    // best-fit decreasing: capa0=[23.44,23.44]=46,88; capa1=[23.44,8.23,8.23]=39,90.
    // máx = 46,88 → escalerilla 100 mm.
    const r = calc('ancho-escalerilla').calcular({
      capas: '2',
      'grupos.count': '2',
      'grupos.0.diametro': '23.44', 'grupos.0.cantidad': '3',
      'grupos.1.diametro': '8.23',  'grupos.1.cantidad': '2',
    });
    expect(r.valores.capasUsadas).toBe(2);
    expect(r.valores.anchoRequerido).toBeCloseTo(46.88, 1);
    expect(r.valores.anchoSugerido).toBe(100);
  });
  it('capas no puede ser mayor que el total de conductores', () => {
    const r = calc('ancho-escalerilla').calcular({
      capas: '10',
      'grupos.count': '1',
      'grupos.0.diametro': '23.44', 'grupos.0.cantidad': '3',
    });
    expect(r.valores.capasUsadas).toBe(3);
    expect(r.valores.anchoRequerido).toBeCloseTo(23.44, 2);
  });
});
