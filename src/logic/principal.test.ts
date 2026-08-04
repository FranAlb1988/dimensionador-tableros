import { describe, expect, it } from 'vitest';
import { MARCAS_PRINCIPAL, sugerirInterruptorPrincipal } from './principal';

describe('sugerirInterruptorPrincipal', () => {
  it('para 100 A elige NSX (familia NSX*)', () => {
    const p = sugerirInterruptorPrincipal(100);
    expect(p).toBeDefined();
    expect(p!.familia.startsWith('NSX')).toBe(true);
    expect(p!.inA).toBeGreaterThanOrEqual(100);
  });

  it('para 600 A elige NSX (≤ 630)', () => {
    const p = sugerirInterruptorPrincipal(600);
    expect(p).toBeDefined();
    expect(p!.familia).toBe('NSX630');
    expect(p!.inA).toBe(630);
  });

  it('para 700 A salta a Masterpact NT', () => {
    const p = sugerirInterruptorPrincipal(700);
    expect(p).toBeDefined();
    expect(p!.familia).toBe('MasterpactNT');
    expect(p!.inA).toBeGreaterThanOrEqual(700);
  });

  it('para 1800 A elige Masterpact NW', () => {
    const p = sugerirInterruptorPrincipal(1800);
    expect(p).toBeDefined();
    expect(p!.familia).toBe('MasterpactNW');
    expect(p!.inA).toBeGreaterThanOrEqual(1800);
  });

  it('siempre elige el menor In que cumpla', () => {
    const p = sugerirInterruptorPrincipal(801);
    expect(p!.inA).toBe(1000); // NSX llega a 630 (no aplica), Masterpact NT08 = 800 < 801, siguiente NT10 = 1000
  });

  it('devuelve undefined para corriente cero o negativa', () => {
    expect(sugerirInterruptorPrincipal(0)).toBeUndefined();
    expect(sugerirInterruptorPrincipal(-10)).toBeUndefined();
  });

  it('ABB: para 100 A elige un Tmax (MCCB)', () => {
    const p = sugerirInterruptorPrincipal(100, 'ABB');
    expect(p).toBeDefined();
    expect(p!.marca).toBe('ABB');
    expect(p!.familia.startsWith('Tmax')).toBe(true);
    expect(p!.inA).toBeGreaterThanOrEqual(100);
  });

  it('ABB: para 1800 A elige un Emax 2 (ACB)', () => {
    const p = sugerirInterruptorPrincipal(1800, 'ABB');
    expect(p).toBeDefined();
    expect(p!.marca).toBe('ABB');
    expect(p!.familia.startsWith('Emax')).toBe(true);
    expect(p!.inA).toBeGreaterThanOrEqual(1800);
  });

  it('Chint: para 1500 A elige NA1 (ACB)', () => {
    const p = sugerirInterruptorPrincipal(1500, 'Chint');
    expect(p).toBeDefined();
    expect(p!.marca).toBe('Chint');
    expect(p!.familia.startsWith('NA1')).toBe(true);
    expect(p!.inA).toBeGreaterThanOrEqual(1500);
  });

  it('Chint: por debajo de 1000 A se sobredimensiona al menor NA1 (1000 A)', () => {
    const p = sugerirInterruptorPrincipal(400, 'Chint');
    expect(p).toBeDefined();
    expect(p!.marca).toBe('Chint');
    expect(p!.inA).toBe(1000);
  });

  it('Chint: por encima de 6300 A excede el catálogo', () => {
    expect(sugerirInterruptorPrincipal(7000, 'Chint')).toBeUndefined();
  });

  it('Schneider cubre 4000–6300 A con los frames b (NW50b / NW63)', () => {
    const p45 = sugerirInterruptorPrincipal(4500);
    expect(p45).toBeDefined();
    expect(p45!.referencia).toContain('NW50b');
    expect(p45!.inA).toBe(5000);
    const p55 = sugerirInterruptorPrincipal(5500);
    expect(p55!.referencia).toContain('NW63');
    expect(p55!.inA).toBe(6300);
    expect(sugerirInterruptorPrincipal(7000)).toBeUndefined();
  });

  it('los frames b aportan Icu 100 kA cuando el filtro lo exige', () => {
    // 3800 A con Icu >= 80: NW40 (65 kA) no alcanza → NW40b (100 kA).
    const p = sugerirInterruptorPrincipal(3800, 'Schneider', 80);
    expect(p).toBeDefined();
    expect(p!.referencia).toContain('NW40b');
    expect(p!.icuKA).toBe(100);
  });

  it('expone las tres marcas disponibles', () => {
    expect(MARCAS_PRINCIPAL).toEqual(['Schneider', 'ABB', 'Chint']);
  });

  it('minIcuKA filtra por poder de corte: 700 A con Icu ≥ 50 kA salta de NT (42) a NW (65)', () => {
    const sinIcu = sugerirInterruptorPrincipal(700, 'Schneider');
    expect(sinIcu!.familia).toBe('MasterpactNT');
    const conIcu = sugerirInterruptorPrincipal(700, 'Schneider', 50);
    expect(conIcu).toBeDefined();
    expect(conIcu!.familia).toBe('MasterpactNW');
    expect(conIcu!.icuKA).toBeGreaterThanOrEqual(50);
  });

  it('minIcuKA imposible de cumplir devuelve undefined', () => {
    expect(sugerirInterruptorPrincipal(700, 'Schneider', 200)).toBeUndefined();
  });

  it('no trepa la escalera de calibres para alcanzar el Icu', () => {
    // Un CCM de 170 A con Icc 85 kA recibía un ACB de 4000 A (23× la carga)
    // porque en el catálogo el poder de corte solo sube con el bastidor.
    // Ahora se admite un escalón sobre el mínimo por corriente, no cuatro.
    const base = sugerirInterruptorPrincipal(170, 'Schneider')!;
    const conIcc = sugerirInterruptorPrincipal(170, 'Schneider', 85);
    if (conIcc) {
      expect(conIcc.inA).toBeLessThan(base.inA * 4);
      expect(conIcc.icuKA).toBeGreaterThanOrEqual(85);
    }
    // Si no existe equipo del calibre correcto con esa capacidad, la respuesta
    // honesta es undefined: ni el TDG ni el CDC revisan el Icu del principal
    // después de elegirlo, así que un "mejor esfuerzo" pasaría en silencio.
    expect(conIcc?.inA ?? 0).toBeLessThan(1000);
  });

  it('el principal nunca queda bajo el Icu pedido', () => {
    for (const I of [50, 170, 400, 800, 1500, 3000]) {
      for (const icc of [0, 25, 36, 50, 65, 85, 100]) {
        const p = sugerirInterruptorPrincipal(I, 'Schneider', icc);
        if (p) {
          expect(p.icuKA, `${I} A / ${icc} kA`).toBeGreaterThanOrEqual(icc);
          expect(p.inA, `${I} A / ${icc} kA`).toBeGreaterThanOrEqual(I);
        }
      }
    }
  });
});
