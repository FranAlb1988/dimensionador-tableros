import { describe, expect, it } from 'vitest';
import {
  ARREGLOS_MW2,
  BUS_DISTRIBUCION_VERTICAL_A,
  BUS_DISTRIBUCION_VERTICAL_ICW_KA,
  i2t,
  ICW_SOLICITUD_ESPECIAL,
  verificarBarraVerticalIec,
} from './barra-vertical-iec';

describe('catálogo de barra vertical BlokSeT', () => {
  it('trae los arreglos Mw2 con su Icw y separación de soportes', () => {
    expect(ARREGLOS_MW2.length).toBeGreaterThanOrEqual(2);
    for (const a of ARREGLOS_MW2) {
      expect(a.arreglo).toMatch(/60\s*[×x]\s*5\s*mm/i);
      expect(a.icwKa).toBeGreaterThan(0);
    }
  });

  it('la Icw mayor exige soportes más juntos', () => {
    const menor = ARREGLOS_MW2[0]!;
    const mayor = ARREGLOS_MW2[ARREGLOS_MW2.length - 1]!;
    expect(mayor.icwKa).toBeGreaterThan(menor.icwKa);
    if (menor.separacionSoportesMm != null && mayor.separacionSoportesMm != null) {
      expect(mayor.separacionSoportesMm).toBeLessThan(menor.separacionSoportesMm);
    }
  });

  it('publica el bus de distribución vertical', () => {
    expect(BUS_DISTRIBUCION_VERTICAL_A).toBe(3200);
    expect(BUS_DISTRIBUCION_VERTICAL_ICW_KA).toBe(100);
  });

  it('las prestaciones especiales guardan su duración, que no es siempre 1 s', () => {
    expect(ICW_SOLICITUD_ESPECIAL.length).toBeGreaterThanOrEqual(2);
    expect(ICW_SOLICITUD_ESPECIAL.some((x) => x.segundos === 3)).toBe(true);
  });

  it('65 kA durante 3 s exige más que 85 kA durante 1 s', () => {
    // En kA a secas parece menos; en energía específica es casi el doble, y es
    // por eso que no se pueden ordenar por kA sin mirar la duración.
    expect(i2t(65, 3)).toBeGreaterThan(i2t(85, 1));
  });
});

describe('verificarBarraVerticalIec', () => {
  it('elige el arreglo de menor Icw que cubre la Icc', () => {
    const v = verificarBarraVerticalIec(400, 40)!;
    expect(v.arreglo.icwKa).toBeGreaterThanOrEqual(40);
    expect(v.excedeIcw).toBe(false);
  });

  it('sube de arreglo cuando la Icc lo exige', () => {
    const baja = verificarBarraVerticalIec(400, 40)!;
    const alta = verificarBarraVerticalIec(400, 80)!;
    expect(alta.arreglo.icwKa).toBeGreaterThan(baja.arreglo.icwKa);
    expect(alta.excedeIcw).toBe(false);
  });

  it('marca cuando ni el mayor arreglo estándar alcanza', () => {
    const v = verificarBarraVerticalIec(400, 120)!;
    expect(v.excedeIcw).toBe(true);
  });

  it('marca cuando la Icc queda fuera del estándar publicado', () => {
    const v = verificarBarraVerticalIec(400, 90)!;
    expect(v.excedeIcw).toBe(true);
    expect(v.fueraDeEstandar).toBe(true);
  });

  it('sin Icc declarada no advierte: el criterio del catálogo es esa Icc', () => {
    const v = verificarBarraVerticalIec(400, 0)!;
    expect(v.excedeIcw).toBe(false);
    expect(v.fueraDeEstandar).toBe(false);
  });

  it('verifica también la corriente contra el bus de distribución', () => {
    expect(verificarBarraVerticalIec(3000, 50)!.excedeCorrienteBus).toBe(false);
    expect(verificarBarraVerticalIec(3500, 50)!.excedeCorrienteBus).toBe(true);
  });
});
