import { describe, expect, it } from 'vitest';
import {
  bastidoresMccb,
  capacidadMccbKa,
  familiasMccb,
  MCCB_DISPONIBLES,
  notaMccb,
  prestacionesMccb,
  sugerirMccb,
  unidadesDisparoMccb,
} from './mccb';

describe('catálogo MCCB', () => {
  it('trae las 1577 referencias y sus 7 familias', () => {
    expect(MCCB_DISPONIBLES.length).toBe(1577);
    const f = familiasMccb();
    expect(f).toContain('ComPacT NSX');
    expect(f).toContain('ComPacT NSXm');
    expect(f).toContain('ComPacT NS');
    expect(f).toContain('EasyPact EZC');
    expect(f.length).toBe(7);
  });

  it('cubre de 2,5 A a 3200 A', () => {
    const ins = MCCB_DISPONIBLES.map((m) => m.inA);
    expect(Math.min(...ins)).toBe(2.5);
    expect(Math.max(...ins)).toBe(3200);
  });

  it('la herencia grupo→modelo reconstruye una referencia conocida', () => {
    // C10F3TM016: NSX100 clase F, TM-D 16 A, 3P 3d, Icu 36 kA a 415 V.
    const m = MCCB_DISPONIBLES.find((x) => x.referencia === 'C10F3TM016')!;
    expect(m.familia).toBe('ComPacT NSX');
    expect(m.bastidor).toBe('NSX100');
    expect(m.clase).toBe('F');
    expect(m.inA).toBe(16);
    expect(m.polos).toBe(3);
    expect(m.polosProtegidos).toBe('3P 3d');
    expect(m.unidadDisparo).toBe('TM-D');
    expect(m.icu415Ka).toBe(36);
    // Heredados del grupo (bastidor+clase+polos):
    expect(m.tecnologia).toBe('Termomagnética');
    expect(m.funciones).toBe('LI');
    expect(m.ueMaxV).toBe(690);
  });

  it('las 46 filas de prestaciones y 22 unidades de disparo están presentes', () => {
    expect(prestacionesMccb().length).toBe(46);
    expect(unidadesDisparoMccb().length).toBe(22);
  });

  it('las notas resuelven a texto', () => {
    const m = MCCB_DISPONIBLES.find((x) => x.fuente != null)!;
    expect(notaMccb(m.fuente)).toBeTruthy();
  });

  it('lista los 31 bastidores', () => {
    expect(bastidoresMccb().length).toBe(31);
  });
});

describe('capacidadMccbKa', () => {
  const nsx100f = MCCB_DISPONIBLES.find((m) => m.referencia === 'C10F3TM016')!;

  it('a 415 V toma la Icu de la fila del modelo', () => {
    expect(capacidadMccbKa(nsx100f, 400)).toBe(36);
  });

  it('sobre 415 V consulta la matriz de prestaciones', () => {
    // NSX100-250 clase F: 35 kA a 440, 25 a 500, 22 a 525, 8 a 690.
    expect(capacidadMccbKa(nsx100f, 440)).toBe(35);
    expect(capacidadMccbKa(nsx100f, 500)).toBe(25);
    expect(capacidadMccbKa(nsx100f, 690)).toBe(8);
  });

  it('la capacidad cae al subir la tensión', () => {
    const v = [400, 440, 500, 690].map((t) => capacidadMccbKa(nsx100f, t)!);
    for (let i = 1; i < v.length; i++) expect(v[i]!).toBeLessThanOrEqual(v[i - 1]!);
  });

  it('distingue el rango del bastidor dentro de la misma familia y clase', () => {
    // NSX400-630 F da 10 kA a 690 V; NSX100-250 F solo 8.
    const nsx630f = MCCB_DISPONIBLES.find((m) => m.bastidor === 'NSX630' && m.clase === 'F')!;
    expect(capacidadMccbKa(nsx630f, 690)).toBe(10);
    expect(capacidadMccbKa(nsx100f, 690)).toBe(8);
  });
});

describe('sugerirMccb', () => {
  it('elige el menor In que cubre la corriente', () => {
    const m = sugerirMccb(26, { polos: 3, protegeSobrecarga: true })!;
    // 30 A del EasyPact EZC es el escalón más bajo que cubre 26 A.
    expect(m.inA).toBe(30);
    expect(m.polos).toBe(3);
  });

  it('el allowlist de familias cambia el escalón disponible', () => {
    const m = sugerirMccb(26, {
      polos: 3, protegeSobrecarga: true, familias: ['ComPacT NSX', 'ComPacT NSXm'],
    })!;
    expect(m.inA).toBe(32);
    expect(m.familia).toMatch(/^ComPacT/);
  });

  it('protegeSobrecarga deja fuera las unidades solo magnéticas', () => {
    const conL = sugerirMccb(3, { polos: 3, protegeSobrecarga: true })!;
    const sinL = sugerirMccb(3, { polos: 3, protegeSobrecarga: false })!;
    expect(conL.funciones).toContain('L');
    expect(sinL.funciones).not.toContain('L');
    expect(sinL.unidadDisparo).toBe('MA');
    // La MA existe en calibres mucho menores: por eso ganaría sin el filtro.
    expect(sinL.inA).toBeLessThan(conL.inA);
  });

  it('la Icc pedida determina la clase de corte', () => {
    const opts = { polos: 3, tensionV: 400, protegeSobrecarga: true } as const;
    const f = sugerirMccb(26, { ...opts, iccKa: 36 })!;
    const n = sugerirMccb(26, { ...opts, iccKa: 45 })!;
    const h = sugerirMccb(26, { ...opts, iccKa: 60 })!;
    expect(capacidadMccbKa(f, 400)!).toBeGreaterThanOrEqual(36);
    expect(capacidadMccbKa(n, 400)!).toBeGreaterThanOrEqual(45);
    expect(capacidadMccbKa(h, 400)!).toBeGreaterThanOrEqual(60);
  });

  it('la Icc se evalúa a la tensión de servicio', () => {
    // 30 kA a 400 V es fácil; a 690 V exige una clase mucho mayor.
    const a = sugerirMccb(80, { polos: 3, tensionV: 400, iccKa: 30, protegeSobrecarga: true })!;
    const b = sugerirMccb(80, { polos: 3, tensionV: 690, iccKa: 30, protegeSobrecarga: true })!;
    expect(capacidadMccbKa(a, 400)!).toBeGreaterThanOrEqual(30);
    expect(capacidadMccbKa(b, 690)!).toBeGreaterThanOrEqual(30);
    expect(b.clase).not.toBe(a.clase);
  });

  it('devuelve referencias 1P, 2P y 4P reales de catálogo', () => {
    for (const polos of [1, 2, 3, 4] as const) {
      const m = sugerirMccb(40, { polos });
      expect(m?.polos, `polos ${polos}`).toBe(polos);
    }
  });

  it('puede exigir diferencial integrado (Vigi)', () => {
    const m = sugerirMccb(40, { polos: 4, diferencial: true })!;
    expect(m.diferencial).toBe(true);
    expect(m.funciones).toContain('IΔn');
  });

  it('soloCompletos descarta las que piden la unidad MicroLogic aparte', () => {
    const m = sugerirMccb(2000, { polos: 3, soloCompletos: true });
    expect(m?.completo).not.toBe(false);
  });

  it('preferirMayorIcu invierte el desempate a igual In', () => {
    const opts = { polos: 3, tensionV: 400, protegeSobrecarga: true } as const;
    const barato = sugerirMccb(26, opts)!;
    const fuerte = sugerirMccb(26, { ...opts, preferirMayorIcu: true })!;
    expect(fuerte.inA).toBe(barato.inA);
    expect(capacidadMccbKa(fuerte, 400)!).toBeGreaterThan(capacidadMccbKa(barato, 400)!);
  });

  it('descarta referencias cuya Ue máxima no llega a la tensión pedida', () => {
    const m = sugerirMccb(40, { polos: 3, tensionV: 690 });
    expect(m?.ueMaxV).toBeGreaterThanOrEqual(690);
  });

  it('devuelve undefined fuera de catálogo', () => {
    expect(sugerirMccb(5000, { polos: 3 })).toBeUndefined();
    expect(sugerirMccb(40, { polos: 3, iccKa: 500 })).toBeUndefined();
    expect(sugerirMccb(0)).toBeUndefined();
  });
});
