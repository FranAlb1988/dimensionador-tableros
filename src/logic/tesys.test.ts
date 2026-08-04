import { describe, expect, it } from 'vitest';
import {
  acoplaCon,
  CONTACTORES_TESYS,
  familiasContactor,
  RELES_TESYS,
  sugerirContactor,
  sugerirParejaArrancador,
  sugerirRele,
} from './tesys';

describe('catálogo TeSys', () => {
  it('trae 79 contactores y 60 relés', () => {
    expect(CONTACTORES_TESYS.length).toBe(79);
    expect(RELES_TESYS.length).toBe(60);
  });

  it('cubre las familias del portafolio', () => {
    const f = familiasContactor();
    expect(f).toContain('TeSys K');
    expect(f).toContain('TeSys Deca');
    expect(f).toContain('TeSys Giga');
  });

  it('las referencias de contactor son patrones a completar con la bobina', () => {
    const conPatron = CONTACTORES_TESYS.filter((c) => /pp$|código de bobina/.test(c.referencia));
    expect(conPatron.length).toBeGreaterThan(20);
  });

  it('los relés declaran su rango de ajuste', () => {
    const conRango = RELES_TESYS.filter((r) => r.ajusteMinA != null && r.ajusteMaxA != null);
    expect(conRango.length).toBe(60);
    for (const r of conRango) expect(r.ajusteMaxA!).toBeGreaterThan(r.ajusteMinA!);
  });
});

describe('sugerirContactor', () => {
  it('elige el menor contactor que cubre la corriente en AC-3e', () => {
    const c = sugerirContactor(20)!;
    expect(c.ieAc3eA!).toBeGreaterThanOrEqual(20);
    expect(c.categoria).toContain('AC-3');
  });

  it('nunca devuelve un contactor de AC-1 puro', () => {
    // AC-1 es maniobra de carga no inductiva: no sirve de arrancador.
    for (const i of [5, 20, 60, 150, 400]) {
      const c = sugerirContactor(i);
      if (c) expect(c.categoria, `${i} A`).toContain('AC-3');
    }
  });

  it('escala de familia con la corriente', () => {
    expect(sugerirContactor(600)!.familia).toBe('TeSys Giga');
    expect(sugerirContactor(20)!.ieAc3eA!).toBeLessThan(60);
  });

  it('devuelve undefined sobre el catálogo', () => {
    expect(sugerirContactor(5000)).toBeUndefined();
    expect(sugerirContactor(0)).toBeUndefined();
  });
});

describe('sugerirRele y acoplaCon', () => {
  it('el relé elegido contiene la corriente en su rango de ajuste', () => {
    const r = sugerirRele(20)!;
    expect(r.ajusteMinA!).toBeLessThanOrEqual(20);
    expect(r.ajusteMaxA!).toBeGreaterThanOrEqual(20);
  });

  it('acoplaCon lee el rango declarado por el catálogo', () => {
    const lrd = RELES_TESYS.find((r) => r.montaDirectoCon === 'LC1D09…D38')!;
    const d25 = CONTACTORES_TESYS.find((c) => c.referencia.startsWith('LC1D25'))!;
    const giga = CONTACTORES_TESYS.find((c) => c.referencia.startsWith('LC1G'))!;
    expect(acoplaCon(lrd, d25)).toBe(true);
    expect(acoplaCon(lrd, giga)).toBe(false);
  });

  it('prefiere un relé que monte directo sobre el contactor', () => {
    const c = sugerirContactor(20)!;
    const r = sugerirRele(20, c)!;
    expect(acoplaCon(r, c)).toBe(true);
  });
});

describe('sugerirParejaArrancador', () => {
  it('arma parejas reales en todo el rango', () => {
    for (const i of [2, 8, 20, 40, 80, 300, 600]) {
      const p = sugerirParejaArrancador(i);
      expect(p, `${i} A`).toBeDefined();
      expect(p!.contactor.ieAc3eA!, `${i} A`).toBeGreaterThanOrEqual(i);
    }
  });

  it('el relé cubre la corriente del motor', () => {
    const p = sugerirParejaArrancador(40)!;
    expect(p.rele).toBeDefined();
    expect(p.rele!.ajusteMaxA!).toBeGreaterThanOrEqual(40);
    expect(p.rele!.ajusteMinA!).toBeLessThanOrEqual(40);
  });

  it('informa si el acople no es directo en vez de darlo por hecho', () => {
    // Hay combinaciones donde el relé que cubre la corriente pertenece a otra
    // familia; se devuelve igual pero marcado, para que se pida el kit.
    const todas = [2, 8, 20, 40, 80, 150, 300, 600].map((i) => sugerirParejaArrancador(i)!);
    expect(todas.every((p) => typeof p.acopleDirecto === 'boolean')).toBe(true);
    expect(todas.some((p) => !p.acopleDirecto)).toBe(true);
  });

  it('devuelve undefined cuando ningún contactor alcanza', () => {
    expect(sugerirParejaArrancador(5000)).toBeUndefined();
    expect(sugerirParejaArrancador(0)).toBeUndefined();
  });
});
