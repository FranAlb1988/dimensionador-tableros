import { describe, expect, it } from 'vitest';
import {
  clasesTensionMt,
  familiasMt,
  gamasBt,
  notaBt,
  servicioSugerido,
  sugerirVariadorBt,
  sugerirVariadorMt,
} from './variadores';

describe('catálogo BT', () => {
  it('trae las gamas publicadas', () => {
    const g = gamasBt();
    expect(g).toContain('ATV320');
    expect(g).toContain('ATV630');
    expect(g.length).toBeGreaterThanOrEqual(5);
  });

  it('elige el menor variador que cubre la potencia', () => {
    const m = sugerirVariadorBt(75, 400);
    expect(m).toBeDefined();
    const p = m!.ndKwVMin ?? m!.ndKwVMax!;
    expect(p).toBeGreaterThanOrEqual(75);
    // No debe sobredimensionar: el siguiente escalón no puede ser mucho mayor.
    expect(p).toBeLessThan(75 * 2);
  });

  it('respeta el rango de alimentación', () => {
    const m = sugerirVariadorBt(2.2, 400);
    expect(m).toBeDefined();
    expect(m!.vMin).toBeLessThanOrEqual(400 * 1.05);
    expect(m!.vMax).toBeGreaterThanOrEqual(400 * 0.95);
  });

  it('el servicio pesado exige un equipo igual o mayor', () => {
    const nd = sugerirVariadorBt(45, 400, { servicio: 'ND' });
    const hd = sugerirVariadorBt(45, 400, { servicio: 'HD' });
    expect(nd).toBeDefined();
    expect(hd).toBeDefined();
    const pNd = nd!.ndKwVMin ?? 0;
    const pHd = hd!.ndKwVMin ?? 0;
    expect(pHd).toBeGreaterThanOrEqual(pNd);
  });

  it('puede restringirse a una gama', () => {
    const m = sugerirVariadorBt(11, 400, { gama: 'ATV630' });
    expect(m?.gama).toBe('ATV630');
  });

  it('el filtro de Chile descarta las referencias fuera del rango local', () => {
    const m = sugerirVariadorBt(11, 400, { soloChile: true });
    expect(m).toBeDefined();
    expect(notaBt(m!.alcanceChile) ?? '').toMatch(/^Chile/);
  });

  it('devuelve undefined si ninguna referencia alcanza', () => {
    expect(sugerirVariadorBt(5000, 400)).toBeUndefined();
    expect(sugerirVariadorBt(75, 6600)).toBeUndefined();
    expect(sugerirVariadorBt(0, 400)).toBeUndefined();
  });
});

describe('catálogo MT', () => {
  it('trae las dos familias y las clases de tensión', () => {
    expect(familiasMt()).toEqual(['ATV6000', 'ATV6100']);
    const kv = clasesTensionMt();
    expect(kv).toContain(4.16);
    expect(kv).toContain(6.6);
    expect(kv[0]).toBe(2.4);
  });

  it('elige el menor variador MT que cubre la potencia', () => {
    const m = sugerirVariadorMt(1000, 4.16);
    expect(m).toBeDefined();
    expect(m!.ndKw!).toBeGreaterThanOrEqual(1000);
    expect(m!.tensionKv).toBe(4.16);
  });

  it('no mezcla clases de tensión', () => {
    const m = sugerirVariadorMt(500, 2.4);
    expect(m!.tensionKv).toBe(2.4);
  });

  it('el servicio pesado exige un equipo igual o mayor', () => {
    const nd = sugerirVariadorMt(800, 6.6, { servicio: 'ND' })!;
    const hd = sugerirVariadorMt(800, 6.6, { servicio: 'HD' })!;
    expect(hd.ndKw!).toBeGreaterThanOrEqual(nd.ndKw!);
  });

  it('devuelve undefined fuera de catálogo', () => {
    expect(sugerirVariadorMt(50000, 6.6)).toBeUndefined();
    expect(sugerirVariadorMt(1000, 33)).toBeUndefined();
  });
});

describe('servicio sugerido por tipo de equipo', () => {
  it('bombas y ventiladores son servicio normal', () => {
    expect(servicioSugerido('MOTOR ELÉCTRICO BOMBA TRASPASO SOLUCIÓN')).toBe('ND');
    expect(servicioSugerido('VENTILADOR EXTRACTOR SALA')).toBe('ND');
    expect(servicioSugerido('Soplador de aireación')).toBe('ND');
  });

  it('chancado, correas y molinos son servicio pesado', () => {
    expect(servicioSugerido('CHANCADOR PRIMARIO')).toBe('HD');
    expect(servicioSugerido('CORREA TRANSPORTADORA CT-01')).toBe('HD');
    expect(servicioSugerido('MOLINO DE BOLAS')).toBe('HD');
    expect(servicioSugerido('HARNERO VIBRATORIO')).toBe('HD');
  });

  it('no depende de tildes ni mayúsculas', () => {
    expect(servicioSugerido('chancado')).toBe('HD');
    expect(servicioSugerido('CHANCADÓR')).toBe('HD');
    expect(servicioSugerido('Bomba')).toBe('ND');
  });

  it('sin pistas cae en servicio normal', () => {
    expect(servicioSugerido('EQUIPO 12')).toBe('ND');
    expect(servicioSugerido('')).toBe('ND');
  });
});
