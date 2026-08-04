import { describe, expect, it } from 'vitest';
import { calculadoraPorId, CALCULADORAS } from './index';
import { CATALOGO_CONDUCTORES, autollenarConductor } from './conductores-catalogo';

function calc(id: string) {
  const c = calculadoraPorId(id);
  if (!c) throw new Error(`Calculadora ${id} no encontrada`);
  return c;
}

describe('registro de calculadoras', () => {
  it('expone 13 calculadoras con id único', () => {
    expect(CALCULADORAS).toHaveLength(13);
    expect(new Set(CALCULADORAS.map((c) => c.id)).size).toBe(13);
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
  it('3 conductores → relleno RIC 33% por defecto', () => {
    // 3 × 4/0 AWG (208,8 mm²) → área total 626,4 mm².
    const r = calc('tamano-ducto').calcular({
      tipo: 'metalico',
      'grupos.count': '1',
      'grupos.0.area': '208.8', 'grupos.0.cantidad': '3',
    });
    expect(r.valores.totalConductores).toBe(3);
    expect(r.valores.areaTotal).toBeCloseTo(626.4, 1);
    expect(r.valores.relleno).toBe(33);
    expect(r.valores.rellenoReal).toBeLessThanOrEqual(33);
  });
  it('con 3 o más conductores el NEC admite 40% donde el RIC solo 33%', () => {
    // La diferencia que importa: aplicar el NEC en Chile subdimensiona.
    const entradas = {
      tipo: 'metalico',
      'grupos.count': '1',
      'grupos.0.area': '208.8', 'grupos.0.cantidad': '3',
    };
    const ric = calc('tamano-ducto').calcular({ ...entradas, normaRelleno: 'RIC' });
    const nec = calc('tamano-ducto').calcular({ ...entradas, normaRelleno: 'NEC' });
    expect(ric.valores.relleno).toBe(33);
    expect(nec.valores.relleno).toBe(40);
    // Menos relleno admisible ⇒ se exige más área interna ⇒ ducto igual o mayor.
    expect(ric.valores.areaRequerida).toBeGreaterThan(nec.valores.areaRequerida!);
  });
  it('un solo conductor: 50% en RIC, 53% en NEC', () => {
    const entradas = {
      tipo: 'pvc',
      'grupos.count': '1',
      'grupos.0.area': '100', 'grupos.0.cantidad': '1',
    };
    expect(calc('tamano-ducto').calcular(entradas).valores.relleno).toBe(50);
    expect(calc('tamano-ducto').calcular({ ...entradas, normaRelleno: 'NEC' }).valores.relleno).toBe(53);
    expect(calc('tamano-ducto').calcular(entradas).textos?.ducto).toMatch(/PVC/);
  });
  it('múltiples calibres: suma áreas y cuenta total de conductores', () => {
    // 3 × 4/0 AWG (208,8) + 1 × #4 AWG (53,16) = 626,4 + 53,16 = 679,56 mm²
    // total 4 conductores → relleno RIC 33%.
    const r = calc('tamano-ducto').calcular({
      tipo: 'metalico',
      'grupos.count': '2',
      'grupos.0.area': '208.8', 'grupos.0.cantidad': '3',
      'grupos.1.area': '53.16', 'grupos.1.cantidad': '1',
    });
    expect(r.valores.totalConductores).toBe(4);
    expect(r.valores.areaTotal).toBeCloseTo(679.56, 1);
    expect(r.valores.relleno).toBe(33);
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
  it('el tope normativo de 2 capas limita aunque el alto admita más', () => {
    // ⌀23,44 → geométricamente caben floor(100/23,44) = 4 capas, pero el tope
    // normativo (NEC 392.80 / RIC N°4) es 2 capas por derrateo de ampacidad.
    const r = calc('ancho-escalerilla').calcular({
      capas: '10',
      'grupos.count': '1',
      'grupos.0.diametro': '23.44', 'grupos.0.cantidad': '6',
    });
    expect(r.valores.capasUsadas).toBe(2);
    expect(r.valores.anchoRequerido).toBeCloseTo(70.32, 1); // 3 cond × 23,44 por capa
    expect(r.valores.alturaUsada).toBeCloseTo(46.88, 1);    // 2 × 23,44
    expect(r.valores.ocupacionAltura).toBeCloseTo(46.88, 1);
    expect(r.nota).toMatch(/tope normativo es 2 capas/);
  });
  it('capas no puede ser mayor que el total de conductores (con tope normativo)', () => {
    const r = calc('ancho-escalerilla').calcular({
      capas: '10',
      'grupos.count': '1',
      'grupos.0.diametro': '23.44', 'grupos.0.cantidad': '3',
    });
    // min(10 pedidas, 2 normativo, 3 conductores) = 2
    expect(r.valores.capasUsadas).toBe(2);
    expect(r.valores.anchoRequerido).toBeCloseTo(46.88, 1); // 2 cond por capa máxima
  });
  it('si el conductor es muy grande, el alto manda sobre el tope normativo', () => {
    // ⌀60 mm → solo cabe 1 capa por geometría (floor(100/60)=1) < 2 normativo.
    const r = calc('ancho-escalerilla').calcular({
      capas: '2',
      'grupos.count': '1',
      'grupos.0.diametro': '60', 'grupos.0.cantidad': '4',
    });
    expect(r.valores.capasUsadas).toBe(1);
    expect(r.nota).toMatch(/solo caben 1/);
  });
  it('rechaza un conductor cuyo diámetro supera el alto de la bandeja', () => {
    const r = calc('ancho-escalerilla').calcular({
      'grupos.count': '1',
      'grupos.0.diametro': '150', 'grupos.0.cantidad': '1',
    });
    expect(r.valores.anchoSugerido).toBeUndefined();
    expect(r.nota).toMatch(/supera el alto/);
  });
  it('reporta el área de conductores y la ocupación NEC 392', () => {
    // 6 × ⌀23,44: área cada uno = π·23,44²/4 ≈ 431,5; total ≈ 2589 mm².
    // 1 capa → ancho req 140,64 → escalerilla 150 (área admisible 4200) → 61,6%.
    const r = calc('ancho-escalerilla').calcular({
      'grupos.count': '1',
      'grupos.0.diametro': '23.44', 'grupos.0.cantidad': '6',
    });
    expect(r.valores.areaConductores).toBeCloseTo(2589, -1);
    expect(r.valores.areaPermitida).toBe(4200);
    expect(r.valores.ocupacionNec).toBeCloseTo(61.6, 0);
  });
  it('el criterio de área obliga a una escalerilla mayor cuando aplica', () => {
    // 10 × ⌀28,88 (área ≈ 655 cada uno). Capas pedidas 4 → topadas a 2 por
    // norma. Ancho geométrico req ≈ 5·28,88 = 144 mm (cabría en 150 mm), pero
    // el área total ≈ 6551 mm² > 5600 (200) → fuerza al ancho 300 (área 8400).
    const r = calc('ancho-escalerilla').calcular({
      capas: '4',
      'grupos.count': '1',
      'grupos.0.diametro': '28.88', 'grupos.0.cantidad': '10',
    });
    expect(r.valores.areaConductores).toBeCloseTo(6551, -1);
    expect(r.valores.anchoSugerido).toBe(300);
    expect(r.valores.areaPermitida).toBe(8400);
    expect(r.valores.ocupacionNec).toBeCloseTo(78, 0);
  });
});
