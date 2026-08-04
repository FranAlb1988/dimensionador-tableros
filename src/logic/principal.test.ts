import { describe, expect, it } from 'vitest';
import { MARCAS_PRINCIPAL, sugerirInterruptorPrincipal } from './principal';

describe('sugerirInterruptorPrincipal', () => {
  it('sin Icc declarada aplica el piso de 36 kA', () => {
    const p = sugerirInterruptorPrincipal(170, 'Schneider')!;
    expect(p.icuKA).toBeGreaterThanOrEqual(36);
  });

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

  it('desde 630 A usa un ACB MasterPact, por la Icw que pide la selectividad', () => {
    const p = sugerirInterruptorPrincipal(700);
    expect(p).toBeDefined();
    expect(p!.familia).toMatch(/^MasterPact MTZ/);
    expect(p!.inA).toBeGreaterThanOrEqual(700);
  });

  it('para 1800 A elige un MTZ2', () => {
    const p = sugerirInterruptorPrincipal(1800);
    expect(p).toBeDefined();
    expect(p!.familia).toBe('MasterPact MTZ2');
    expect(p!.inA).toBeGreaterThanOrEqual(1800);
  });

  it('el nivel sube con la Icc sin cambiar el calibre', () => {
    // Es la razón de ser del nivel en el catálogo, y lo que evita que subir el
    // poder de corte obligue a subir de bastidor.
    const base = sugerirInterruptorPrincipal(700, 'Schneider')!;
    const fuerte = sugerirInterruptorPrincipal(700, 'Schneider', 50)!;
    expect(fuerte.inA).toBe(base.inA);
    expect(fuerte.icuKA).toBeGreaterThanOrEqual(50);
    expect(fuerte.referencia).not.toBe(base.referencia);
  });

  it('siempre elige el menor In que cumpla', () => {
    const p = sugerirInterruptorPrincipal(801);
    expect(p!.inA).toBe(1000); // MTZ 800 < 801 → siguiente calibre 1000
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

  it('Schneider cubre 4000–6300 A con los bastidores MTZ3', () => {
    const p45 = sugerirInterruptorPrincipal(4500);
    expect(p45!.familia).toBe('MasterPact MTZ3');
    expect(p45!.inA).toBe(5000);
    const p55 = sugerirInterruptorPrincipal(5500);
    expect(p55!.inA).toBe(6300);
    expect(sugerirInterruptorPrincipal(7000)).toBeUndefined();
  });

  it('los niveles altos aportan Icu 100 kA cuando el filtro lo exige', () => {
    const p = sugerirInterruptorPrincipal(3800, 'Schneider', 80);
    expect(p).toBeDefined();
    expect(p!.icuKA).toBeGreaterThanOrEqual(80);
    expect(p!.inA).toBe(4000);
  });

  it('expone las tres marcas disponibles', () => {
    expect(MARCAS_PRINCIPAL).toEqual(['Schneider', 'ABB', 'Chint']);
  });

  it('minIcuKA filtra por poder de corte sin cambiar de bastidor', () => {
    const sinIcu = sugerirInterruptorPrincipal(700, 'Schneider')!;
    const conIcu = sugerirInterruptorPrincipal(700, 'Schneider', 50)!;
    expect(conIcu.familia).toBe(sinIcu.familia);
    expect(conIcu.inA).toBe(sinIcu.inA);
    expect(conIcu.icuKA).toBeGreaterThanOrEqual(50);
  });

  it('minIcuKA imposible de cumplir devuelve undefined', () => {
    expect(sugerirInterruptorPrincipal(700, 'Schneider', 250)).toBeUndefined();
  });

  it('no trepa la escalera de calibres para alcanzar el Icu', () => {
    // Con el catálogo placeholder, un CCM de 170 A con Icc 85 kA recibía un ACB
    // de 4000 A: 23 veces la carga. El catálogo real trae la clase (ComPacT) y
    // el nivel (MasterPact) como dimensión propia, así que el poder de corte
    // sube sin tocar el calibre.
    const base = sugerirInterruptorPrincipal(170, 'Schneider')!;
    const conIcc = sugerirInterruptorPrincipal(170, 'Schneider', 85)!;
    expect(conIcc.inA).toBe(base.inA);
    expect(conIcc.icuKA).toBeGreaterThanOrEqual(85);
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
