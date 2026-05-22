import { describe, expect, it } from 'vitest';
import { calculadoraPorId, CALCULADORAS } from './index';
import { CATALOGO_CONDUCTORES, autollenarConductor } from './conductores-catalogo';

function calc(id: string) {
  const c = calculadoraPorId(id);
  if (!c) throw new Error(`Calculadora ${id} no encontrada`);
  return c;
}

describe('registro de calculadoras', () => {
  it('expone 10 calculadoras con id único', () => {
    expect(CALCULADORAS).toHaveLength(10);
    expect(new Set(CALCULADORAS.map((c) => c.id)).size).toBe(10);
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
