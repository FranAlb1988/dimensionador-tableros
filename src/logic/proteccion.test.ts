import { describe, expect, it } from 'vitest';
import { MARCAS_FEEDER, sugerirProteccionFeeder, sugerirProteccionIc60, sugerirProteccionNsx } from './proteccion';
import type { Carga } from '../types';

const motor11kW: Carga = {
  id: 'm', descripcion: 'motor 11 kW', tipo: 'motor',
  potenciaKw: 11, tensionV: 400, fases: '3F', factorServicio: 1, arranque: 'DOL',
};

describe('sugerirProteccionNsx', () => {
  it('para motor 11 kW (≈21 A × 1.25 = 26 A) elige ≥ 25 A o más', () => {
    const p = sugerirProteccionNsx(motor11kW);
    expect(p).toBeDefined();
    expect(p!.inA).toBeGreaterThanOrEqual(26);
  });

  it('elige siempre el menor In que cumpla', () => {
    const p = sugerirProteccionNsx({ ...motor11kW, potenciaKw: 1 });
    expect(p).toBeDefined();
    // Para 1 kW (~1.9 A) cualquier NSX cumple, debe ser el más chico (16 A).
    expect(p!.inA).toBe(16);
  });

  it('devuelve undefined si no hay corriente calculable', () => {
    const c: Carga = { ...motor11kW, potenciaKw: undefined, corrienteA: undefined };
    expect(sugerirProteccionNsx(c)).toBeUndefined();
  });

  it('corrienteProteccionA fuerza el frame mínimo aunque la carga no lo necesite', () => {
    const carga: Carga = { ...motor11kW, potenciaKw: 1, corrienteProteccionA: 200 };
    const p = sugerirProteccionNsx(carga);
    expect(p).toBeDefined();
    expect(p!.inA).toBeGreaterThanOrEqual(200);
    expect(p!.familia).toBe('NSX250');
  });

  it('si la carga ya pide más que corrienteProteccionA, manda la carga', () => {
    // motor 75 kW ≈ 142 A × 1.25 = 178 A, frame forzado solo a 50 A → manda 178 A
    const carga: Carga = { ...motor11kW, potenciaKw: 75, corrienteProteccionA: 50 };
    const p = sugerirProteccionNsx(carga);
    expect(p!.inA).toBeGreaterThanOrEqual(178);
  });

  it('sin potencia pero con corrienteProteccionA, sugiere NSX por el frame', () => {
    const carga: Carga = {
      id: 'x', descripcion: 'spare', tipo: 'otro',
      tensionV: 400, fases: '3F', factorServicio: 1, corrienteProteccionA: 250,
    };
    const p = sugerirProteccionNsx(carga);
    expect(p).toBeDefined();
    expect(p!.familia).toBe('NSX250');
  });
});

describe('sugerirProteccionNsx — margen de cargas continuas', () => {
  it('carga no-motor lleva margen 1.25 (In ≥ 1.25 × I diseño)', () => {
    // 90 kW × FS 1.1 @ 400 V 3F ≈ 158.7 A → ×1.25 = 198.4 → In ≥ 200 (TM200),
    // no TM160 (que quedaría cargado al 99% en régimen continuo).
    const c: Carga = {
      id: 's', descripcion: 'alimentador CCM', tipo: 'otro',
      potenciaKw: 90, tensionV: 400, fases: '3F', factorServicio: 1.1,
    };
    const p = sugerirProteccionNsx(c);
    expect(p).toBeDefined();
    expect(p!.inA).toBeGreaterThanOrEqual(199);
  });
});

describe('sugerirProteccionFeeder — motor con arrancador (unidad solo magnética)', () => {
  it('motor con arrancador recibe unidad MA con In ≥ I diseño (margen 1.0)', () => {
    // 11 kW ≈ 21.1 A → MA25 (con TM-D sería 21.1 × 1.25 = 26.3 → TM40).
    const p = sugerirProteccionFeeder(motor11kW, 'Schneider', 1, true);
    expect(p).toBeDefined();
    expect(p!.curva).toBe('MA');
    expect(p!.inA).toBe(25);
  });

  it('sin el contexto de arrancador, el motor mantiene TM-D con margen 1.25', () => {
    const p = sugerirProteccionFeeder(motor11kW, 'Schneider');
    expect(p!.curva).toBe('TM-D');
    expect(p!.inA).toBeGreaterThanOrEqual(26);
  });

  it('el frame forzado también aplica al pool MA', () => {
    const carga: Carga = { ...motor11kW, corrienteProteccionA: 100 };
    const p = sugerirProteccionFeeder(carga, 'Schneider', 1, true);
    expect(p!.curva).toBe('MA');
    expect(p!.inA).toBeGreaterThanOrEqual(100);
  });

  it('una carga no-motor ignora el contexto de arrancador (sigue TM-D)', () => {
    const c: Carga = {
      id: 'l', descripcion: 'ilum', tipo: 'iluminacion',
      potenciaKw: 18, tensionV: 400, fases: '3F', factorServicio: 1,
    };
    const p = sugerirProteccionFeeder(c, 'Schneider', 1, true);
    expect(p!.curva).toBe('TM-D');
  });

  it('ABB: motor con arrancador recibe Tmax solo magnético', () => {
    const p = sugerirProteccionFeeder(motor11kW, 'ABB', 1, true);
    expect(p).toBeDefined();
    expect(p!.marca).toBe('ABB');
    expect(p!.familia.startsWith('Tmax')).toBe(true);
    expect(p!.curva).toBe('MA');
  });
});

describe('variante bipolar para cargas 1F', () => {
  const ilum1F: Carga = {
    id: 'l', descripcion: 'alumbrado 1F', tipo: 'iluminacion',
    potenciaKw: 1.5, tensionV: 230, fases: '1F', factorServicio: 1,
  };

  it('carga 1F recibe la variante 2P (F+N) con nota de verificación', () => {
    const p = sugerirProteccionFeeder(ilum1F, 'Schneider');
    expect(p).toBeDefined();
    expect(p!.polos).toBe(2);
    expect(p!.referencia).toContain('2P 2D');
    expect(p!.referencia).not.toContain('3P');
    expect(p!.notas).toContain('1F');
  });

  it('carga 3F mantiene 3 polos', () => {
    const p = sugerirProteccionFeeder(motor11kW, 'Schneider');
    expect(p!.polos).toBe(3);
  });

  it('ABB 1F también deriva a 2P', () => {
    const p = sugerirProteccionFeeder(ilum1F, 'ABB');
    expect(p!.polos).toBe(2);
    expect(p!.referencia).toContain('2P');
  });

  it('la variante 2P compone con la elevación de prestación por Icc', () => {
    const p = sugerirProteccionFeeder(ilum1F, 'Schneider', 1, false, 45);
    expect(p!.polos).toBe(2);
    expect(p!.icuKA).toBe(50);
    expect(p!.referencia).toContain('NSX100N');
    expect(p!.referencia).toContain('2P 2D');
  });
});

describe('elevación de prestación por Icc de barra (F→N→H / N→S→H)', () => {
  it('Icc dentro de la prestación base no cambia nada', () => {
    const p = sugerirProteccionFeeder(motor11kW, 'Schneider', 1, false, 30);
    expect(p!.icuKA).toBe(36);
    expect(p!.referencia).toContain('NSX100F');
  });

  it('Icc 45 kA eleva el NSX de F (36) a N (50) manteniendo In y familia', () => {
    const base = sugerirProteccionFeeder(motor11kW, 'Schneider');
    const p = sugerirProteccionFeeder(motor11kW, 'Schneider', 1, false, 45);
    expect(p!.icuKA).toBe(50);
    expect(p!.inA).toBe(base!.inA);
    expect(p!.familia).toBe(base!.familia);
    expect(p!.referencia).toContain('NSX100N');
    expect(p!.notas).toContain('Prestación elevada');
  });

  it('Icc 60 kA salta directo a H (70)', () => {
    const p = sugerirProteccionFeeder(motor11kW, 'Schneider', 1, false, 60);
    expect(p!.icuKA).toBe(70);
    expect(p!.referencia).toContain('NSX100H');
  });

  it('Icc sobre la prestación mayor devuelve H y el caller debe advertir', () => {
    const p = sugerirProteccionFeeder(motor11kW, 'Schneider', 1, false, 85);
    expect(p).toBeDefined();
    expect(p!.icuKA).toBe(70); // < 85 → advertencia aguas arriba
  });

  it('ABB eleva por la escala Tmax (N→S→H)', () => {
    const p = sugerirProteccionFeeder(motor11kW, 'ABB', 1, false, 45);
    expect(p!.icuKA).toBe(50);
    expect(p!.referencia).toMatch(/XT2S/);
  });

  it('también aplica a las unidades MA (motor con arrancador)', () => {
    const p = sugerirProteccionFeeder(motor11kW, 'Schneider', 1, true, 45);
    expect(p!.curva).toBe('MA');
    expect(p!.icuKA).toBe(50);
    expect(p!.referencia).toContain('NSX100N MA');
  });
});

describe('sugerirProteccionFeeder (por marca)', () => {
  it('Schneider devuelve NSX', () => {
    const p = sugerirProteccionFeeder(motor11kW, 'Schneider');
    expect(p?.familia.startsWith('NSX')).toBe(true);
  });

  it('ABB devuelve Tmax con marca ABB', () => {
    const p = sugerirProteccionFeeder(motor11kW, 'ABB');
    expect(p).toBeDefined();
    expect(p!.marca).toBe('ABB');
    expect(p!.familia.startsWith('Tmax')).toBe(true);
    expect(p!.inA).toBeGreaterThanOrEqual(26);
  });

  it('Chint (sin MCCB) usa NSX como complemento de alimentadores', () => {
    const p = sugerirProteccionFeeder(motor11kW, 'Chint');
    expect(p?.familia.startsWith('NSX')).toBe(true);
  });

  it('solo Schneider y ABB tienen alimentadores propios', () => {
    expect(MARCAS_FEEDER).toEqual(['Schneider', 'ABB']);
  });
});

describe('sugerirProteccionIc60', () => {
  it('para iluminación 1F de 1.5 kW @ 230 V (~6.5 A) elige iC60 1P de 10 A', () => {
    const c: Carga = {
      id: 'l', descripcion: 'lum', tipo: 'iluminacion',
      potenciaKw: 1.5, tensionV: 230, fases: '1F', factorServicio: 1,
    };
    const p = sugerirProteccionIc60(c);
    expect(p).toBeDefined();
    expect(p!.polos).toBe(1);
    expect(p!.inA).toBeGreaterThanOrEqual(7);
  });

  it('respeta los polos según fases', () => {
    const c: Carga = {
      id: 't', descripcion: 'tomas 3F', tipo: 'tomas',
      potenciaKw: 5, tensionV: 400, fases: '3F', factorServicio: 1,
    };
    const p = sugerirProteccionIc60(c);
    expect(p?.polos).toBe(3);
  });

  it('el factor de derrateo selecciona contra I/F2 (interruptor mayor)', () => {
    const c: Carga = {
      id: 'l', descripcion: 'lum', tipo: 'iluminacion',
      potenciaKw: 1.5, tensionV: 230, fases: '1F', factorServicio: 1,
    };
    const sinDerrateo = sugerirProteccionIc60(c);
    const conDerrateo = sugerirProteccionIc60(c, 0.5);
    expect(sinDerrateo).toBeDefined();
    expect(conDerrateo).toBeDefined();
    expect(conDerrateo!.inA).toBeGreaterThan(sinDerrateo!.inA);
  });
});
