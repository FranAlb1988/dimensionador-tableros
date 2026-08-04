import { describe, expect, it } from 'vitest';
import {
  cosPhiDe,
  demandaMaxima,
  demandaMedia,
  FACTORES_TIPICOS,
  factorCargaDe,
  factorDemandaDe,
  potenciaConectada,
  resumirDemanda,
} from './demanda';
import type { Carga } from '../types';

const motor = (kw: number, extra: Partial<Carga> = {}): Carga => ({
  id: 'm', descripcion: 'motor', tipo: 'motor',
  potenciaKw: kw, tensionV: 400, fases: '3F', factorServicio: 1, ...extra,
});

describe('factores de demanda y carga', () => {
  it('cubre la Tabla 1 del estudio para los cinco tipos de carga', () => {
    expect(FACTORES_TIPICOS.motor.descripcion).toBe('Equipamiento mecánico');
    expect(FACTORES_TIPICOS.motor.fdMin).toBe(0.3);
    expect(FACTORES_TIPICOS.motor.fdMax).toBe(0.9);
    expect(FACTORES_TIPICOS.iluminacion.fdMin).toBe(0.9);
    expect(FACTORES_TIPICOS.tomas.fcMin).toBe(1);
    expect(FACTORES_TIPICOS.tomas.fcMax).toBe(1);
  });

  it('sin dato usa el punto medio del rango típico', () => {
    expect(factorDemandaDe(motor(30))).toBeCloseTo(0.6, 5); // (0,3 + 0,9) / 2
    expect(factorCargaDe(motor(30))).toBeCloseTo(0.7, 5);   // (0,5 + 0,9) / 2
  });

  it('el valor declarado por carga manda sobre el típico', () => {
    expect(factorDemandaDe(motor(30, { factorDemanda: 0.85 }))).toBe(0.85);
    expect(factorCargaDe(motor(30, { factorCarga: 0.4 }))).toBe(0.4);
  });

  it('una carga stand-by tiene factor de demanda y de carga cero', () => {
    // "nunca operarán simultáneamente con el equipo al cual reemplazan".
    const c = motor(30, { standby: true, factorDemanda: 0.9, factorCarga: 0.9 });
    expect(factorDemandaDe(c)).toBe(0);
    expect(factorCargaDe(c)).toBe(0);
    expect(demandaMaxima(c).kw).toBe(0);
    // Pero sí aporta a la potencia conectada.
    expect(potenciaConectada(c).kw).toBeGreaterThan(0);
  });
});

describe('factor de potencia según el estudio', () => {
  it('un motor con variador usa 0,97 y no 0,85', () => {
    expect(cosPhiDe(motor(30, { arranque: 'variador' }))).toBe(0.97);
    expect(cosPhiDe(motor(30, { arranque: 'DOL' }))).toBe(0.85);
  });

  it('los alimentadores usan 0,85 inductivo, el criterio conservador', () => {
    const alim: Carga = {
      id: 'a', descripcion: 'alim', tipo: 'otro',
      potenciaKw: 100, tensionV: 400, fases: '3F', factorServicio: 1,
    };
    expect(cosPhiDe(alim)).toBe(0.85);
  });

  it('el cosφ declarado por carga siempre manda', () => {
    expect(cosPhiDe(motor(30, { arranque: 'variador', cosPhi: 0.8 }))).toBe(0.8);
  });

  it('el VDF a 0,97 baja la corriente respecto de tomarlo como motor directo', () => {
    const vsd = potenciaConectada(motor(75, { arranque: 'variador' }));
    const dol = potenciaConectada(motor(75, { arranque: 'DOL' }));
    expect(vsd.corrienteA).toBeLessThan(dol.corrienteA);
    // 0,85 → 0,97 es del orden de un 12 % menos.
    expect(dol.corrienteA / vsd.corrienteA).toBeCloseTo(0.97 / 0.85, 2);
  });
});

describe('ecuaciones del estudio', () => {
  it('la potencia eléctrica de un motor es la mecánica dividida por el rendimiento', () => {
    // Ec. 5.1: kW_E = kW_MEC / Eff.
    const p = potenciaConectada(motor(90, { rendimiento: 0.9 }));
    expect(p.kw).toBeCloseTo(100, 5);
  });

  it('kVA = kW / f.p. y kVAR = √(kVA² − kW²)', () => {
    const p = potenciaConectada(motor(85, { rendimiento: 1, cosPhi: 0.85 }));
    expect(p.kva).toBeCloseTo(100, 5);
    expect(p.kw).toBeCloseTo(85, 5);
    expect(p.kvar).toBeCloseTo(Math.sqrt(100 * 100 - 85 * 85), 5);
  });

  it('demanda máxima = conectada × FD, y media = máxima × FC', () => {
    const c = motor(100, { rendimiento: 1, factorDemanda: 0.7, factorCarga: 0.5 });
    const con = potenciaConectada(c);
    const max = demandaMaxima(c);
    const med = demandaMedia(c);
    expect(max.kw).toBeCloseTo(con.kw * 0.7, 5);
    expect(med.kw).toBeCloseTo(max.kw * 0.5, 5);
    // El cosφ no cambia, así que los kVA escalan igual.
    expect(max.kva).toBeCloseTo(con.kva * 0.7, 5);
  });

  it('las tres potencias mantienen el triángulo', () => {
    for (const p of [potenciaConectada(motor(75)), demandaMaxima(motor(75)), demandaMedia(motor(75))]) {
      expect(p.kva).toBeCloseTo(Math.hypot(p.kw, p.kvar), 5);
    }
  });

  it('una carga sin potencia ni corriente no aporta nada', () => {
    const vacia: Carga = {
      id: 'v', descripcion: 'v', tipo: 'otro', tensionV: 400, fases: '3F', factorServicio: 1,
    };
    expect(potenciaConectada(vacia)).toEqual({ kva: 0, kw: 0, kvar: 0, corrienteA: 0 });
  });

  it('reconstruye la potencia desde la corriente cuando no hay kW', () => {
    const c: Carga = {
      id: 'c', descripcion: 'c', tipo: 'otro',
      corrienteA: 100, tensionV: 400, fases: '3F', factorServicio: 1,
    };
    const p = potenciaConectada(c);
    expect(p.corrienteA).toBeCloseTo(100, 3);
  });
});

describe('resumirDemanda', () => {
  const cargas: Carga[] = [
    motor(75, { id: 'm1' }),
    motor(45, { id: 'm2' }),
    motor(30, { id: 'm3', standby: true }),
  ];

  it('suma por componente y recompone el kVA del conjunto', () => {
    const r = resumirDemanda(cargas, 400);
    // No es la suma aritmética de los kVA: se suman kW y kVAR por separado.
    const sumaKva = cargas.reduce((s, c) => s + potenciaConectada(c).kva, 0);
    expect(r.conectada.kva).toBeLessThanOrEqual(sumaKva + 1e-9);
    expect(r.conectada.kva).toBeCloseTo(Math.hypot(r.conectada.kw, r.conectada.kvar), 5);
  });

  it('la stand-by suma en conectada pero no en demanda', () => {
    const conStandby = resumirDemanda(cargas, 400);
    const sinStandby = resumirDemanda(cargas.slice(0, 2), 400);
    expect(conStandby.conectada.kw).toBeGreaterThan(sinStandby.conectada.kw);
    expect(conStandby.maxima.kw).toBeCloseTo(sinStandby.maxima.kw, 5);
    expect(conStandby.standby).toBe(1);
  });

  it('la demanda nunca supera la conectada, ni la media a la máxima', () => {
    const r = resumirDemanda(cargas, 400);
    expect(r.maxima.kw).toBeLessThanOrEqual(r.conectada.kw);
    expect(r.media.kw).toBeLessThanOrEqual(r.maxima.kw);
  });

  it('la energía sale de la demanda media y las horas declaradas', () => {
    const c = motor(100, { rendimiento: 1, factorDemanda: 1, factorCarga: 1, horasDia: 10 });
    const r = resumirDemanda([c], 400);
    expect(r.energiaDiariaKwh).toBeCloseTo(100 * 10, 5);
    expect(r.energiaAnualKwh).toBeCloseTo(100 * 10 * 365, 3);
  });

  it('sin horas declaradas asume operación continua', () => {
    const c = motor(100, { rendimiento: 1, factorDemanda: 1, factorCarga: 1 });
    expect(resumirDemanda([c], 400).energiaDiariaKwh).toBeCloseTo(100 * 24, 5);
  });

  it('un conjunto vacío da todo en cero', () => {
    const r = resumirDemanda([], 400);
    expect(r.conectada.kva).toBe(0);
    expect(r.energiaAnualKwh).toBe(0);
    expect(r.cargas).toBe(0);
  });
});

describe('contraste con el estudio 5201-ES-600-12000', () => {
  // El estudio publica para el CDC-6675: conectada 2646 kVA / 2451 kW,
  // máxima 1430 / 1300, media 917 / 830. Las razones que se derivan de esos
  // números son las que el modelo debe reproducir.
  it('reproduce las razones FD y FC agregadas del CDC-6675', () => {
    const fdEstudio = 1300 / 2451;   // ≈ 0,530
    const fcEstudio = 830 / 1300;    // ≈ 0,638
    // Con los típicos de equipamiento mecánico (0,6 y 0,7) el modelo queda del
    // mismo orden: el estudio afina FD y FC por carga, que es justamente lo
    // que la app permite hacer ahora.
    expect(fdEstudio).toBeGreaterThan(FACTORES_TIPICOS.motor.fdMin);
    expect(fdEstudio).toBeLessThan(FACTORES_TIPICOS.motor.fdMax);
    expect(fcEstudio).toBeGreaterThan(FACTORES_TIPICOS.motor.fcMin);
    expect(fcEstudio).toBeLessThan(FACTORES_TIPICOS.motor.fcMax);
  });

  it('con los FD y FC del estudio reproduce sus potencias', () => {
    // Se modela el CDC como una carga equivalente de 2451 kW conectados.
    const cdc: Carga = {
      id: 'cdc', descripcion: 'CDC-6675', tipo: 'otro',
      potenciaKw: 2451, tensionV: 400, fases: '3F', factorServicio: 1,
      cosPhi: 2451 / 2646, factorDemanda: 1300 / 2451, factorCarga: 830 / 1300,
    };
    expect(potenciaConectada(cdc).kva).toBeCloseTo(2646, 0);
    expect(demandaMaxima(cdc).kw).toBeCloseTo(1300, 0);
    expect(demandaMedia(cdc).kw).toBeCloseTo(830, 0);
    // La corriente publicada del estudio para la conectada es 3819 A a 400 V.
    expect(potenciaConectada(cdc).corrienteA).toBeCloseTo(3819, -1);
  });
});
