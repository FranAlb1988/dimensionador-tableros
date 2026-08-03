import { describe, expect, it } from 'vitest';
import {
  capacidadMcbKa,
  curvasMcb,
  familiasMcb,
  MCB_DISPONIBLES,
  notaMcb,
  sugerirMcb,
} from './mcb';

describe('catálogo MCB', () => {
  it('trae las 18 familias y 1115 referencias', () => {
    expect(MCB_DISPONIBLES.length).toBe(1115);
    const f = familiasMcb();
    expect(f).toContain('Acti9 iC60N');
    expect(f).toContain('Acti9 NG125H');
    expect(f).toContain('Easy9');
    expect(f.length).toBe(18);
  });

  it('la herencia familia→modelo reconstruye una referencia conocida', () => {
    // A9F75204: iC60N D 4A 2P, Icu 50 kA (240 y 415), 36 mm, Chile.
    const m = MCB_DISPONIBLES.find((x) => x.referencia === 'A9F75204')!;
    expect(m.familia).toBe('Acti9 iC60N');
    expect(m.curva).toBe('D');
    expect(m.inA).toBe(4);
    expect(m.icu415FfKa).toBe(50);
    expect(m.anchoMm).toBe(36);
    expect(m.estadoChile).toBe('chile');
    // Heredados de la familia (no override):
    expect(m.altoMm).toBe(85);
    expect(m.vidaMecanica).toBe(20000);
  });

  it('la tabla de curvas documenta B, C y D', () => {
    const curvas = curvasMcb().map((c) => c.curva);
    expect(curvas).toContain('B');
    expect(curvas).toContain('C');
    expect(curvas).toContain('D');
  });

  it('las notas resuelven a texto', () => {
    const m = MCB_DISPONIBLES.find((x) => x.fuente != null)!;
    expect(notaMcb(m.fuente)).toBeTruthy();
  });
});

describe('sugerirMcb', () => {
  it('elige el menor In que cubre la corriente', () => {
    const m = sugerirMcb(6.5, { fases: '1F' });
    expect(m).toBeDefined();
    expect(m!.inA).toBe(10);
    expect(m!.polosProtegidos).toBe(1);
    expect(m!.curva).toBe('C');
  });

  it('sin Icc no sobreespecifica capacidad (no salta a iC60L/NG125)', () => {
    const m = sugerirMcb(16, { fases: '3F', tensionV: 400 })!;
    expect(capacidadMcbKa(m, 400, '3F')!).toBeLessThanOrEqual(6);
  });

  it('el allowlist de familias restringe el resultado', () => {
    const m = sugerirMcb(16, { fases: '3F', familias: ['Acti9 iC60N'] })!;
    expect(m.familia).toBe('Acti9 iC60N');
  });

  it('con Icc alta sube de familia automáticamente', () => {
    const bajo = sugerirMcb(16, { fases: '3F', tensionV: 400, iccKa: 6 })!;
    const alto = sugerirMcb(16, { fases: '3F', tensionV: 400, iccKa: 15 })!;
    expect(capacidadMcbKa(bajo, 400, '3F')!).toBeGreaterThanOrEqual(6);
    expect(capacidadMcbKa(alto, 400, '3F')!).toBeGreaterThanOrEqual(15);
    expect(alto.familia).not.toBe('Acti9 iC60N');
  });

  it('respeta la curva pedida', () => {
    const m = sugerirMcb(10, { fases: '3F', curva: 'D' })!;
    expect(m.curva).toBe('D');
  });

  it('cubre 80-125 A con C120/NG125 (más allá del iC60)', () => {
    const m = sugerirMcb(90, { fases: '3F' })!;
    expect(m.inA).toBeGreaterThanOrEqual(100);
    expect(['Acti9 C120N', 'Acti9 C120H', 'Acti9 NG125N']).toContain(m.familia);
  });

  it('el filtro de Chile descarta referencias no publicadas', () => {
    const m = sugerirMcb(16, { fases: '3F', soloChile: true });
    expect(m?.estadoChile).toBe('chile');
  });

  it('puede exigir neutro seccionado', () => {
    const m = sugerirMcb(16, { fases: '1F', conNeutro: true });
    expect(m?.polos).toContain('+N');
  });

  it('excluye las familias DC puras en selección AC', () => {
    for (const i of [1, 5, 10, 20]) {
      const m = sugerirMcb(i, { fases: '1F' });
      expect(m?.servicio === 'AC' || m?.servicio === 'AC/DC').toBe(true);
    }
  });

  it('devuelve undefined fuera de catálogo', () => {
    expect(sugerirMcb(200, { fases: '3F' })).toBeUndefined();
    expect(sugerirMcb(16, { fases: '3F', iccKa: 200 })).toBeUndefined();
    expect(sugerirMcb(0)).toBeUndefined();
  });
});
