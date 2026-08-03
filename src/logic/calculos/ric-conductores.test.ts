import { describe, expect, it } from 'vitest';
import {
  ampacidadRic,
  datosSeccion,
  datosTipo,
  factorAgrupamientoRic,
  factorTemperaturaRic,
  itmNormalizadoRic,
  metodosDe,
  metodosInstalacionRic,
  seccionesDe,
  seccionPorAmpacidad,
  tiposConductorRic,
} from './ric-conductores';
import { factorApilamiento } from './conductores';

describe('catálogo de conductores RIC', () => {
  it('trae los 7 tipos y los 8 métodos de instalación', () => {
    expect(tiposConductorRic().map((t) => t.tipo)).toEqual(
      expect.arrayContaining(['H07V-K', 'H07Z1-K', 'RV-K', 'RZ1-K', 'THHN', 'THWN']),
    );
    expect(tiposConductorRic().length).toBe(7);
    expect(metodosInstalacionRic().length).toBe(8);
  });

  it('la ampacidad depende del método de instalación', () => {
    // RZ1-K 16 mm²: A1 73 A, B1 88 A, E 100 A, D2 126 A.
    expect(ampacidadRic('RZ1-K', 16, 'A1')).toBe(73);
    expect(ampacidadRic('RZ1-K', 16, 'B1')).toBe(88);
    expect(ampacidadRic('RZ1-K', 16, 'E')).toBe(100);
    expect(ampacidadRic('RZ1-K', 16, 'D2')).toBe(126);
  });

  it('R20 y diámetro no dependen del método', () => {
    const s = datosSeccion('RZ1-K', 16)!;
    expect(s.r20OhmKm).toBe(1.21);
    expect(s.diametroMm).toBe(9.3);
  });

  it('marca qué tipos sirven para locales de reunión de personas', () => {
    expect(datosTipo('H07Z1-K')!.aptoReunion).toBe(true);
    expect(datosTipo('RZ1-K')!.aptoReunion).toBe(true);
    expect(datosTipo('H07V-K')!.aptoReunion).toBeUndefined();
    expect(datosTipo('RV-K')!.aptoReunion).toBeUndefined();
  });

  it('las secciones vienen ordenadas de menor a mayor', () => {
    const s = seccionesDe('RZ1-K', 'B1');
    expect(s.length).toBeGreaterThan(5);
    expect([...s].sort((a, b) => a - b)).toEqual(s);
  });

  it('no todos los tipos tienen todos los métodos', () => {
    expect(metodosDe('H07V-K')).not.toContain('D1');
    expect(metodosDe('RZ1-K')).toContain('D1');
  });
});

describe('factorTemperaturaRic', () => {
  it('a la temperatura de referencia el factor es 1', () => {
    expect(factorTemperaturaRic(30, 70, 'B1')).toBe(1);
    expect(factorTemperaturaRic(30, 90, 'B1')).toBe(1);
  });

  it('sobre la referencia derratea y bajo ella permite más corriente', () => {
    expect(factorTemperaturaRic(40, 70, 'B1')).toBeLessThan(1);
    expect(factorTemperaturaRic(10, 70, 'B1')).toBeGreaterThan(1);
  });

  it('la aislación de 90 °C aguanta mejor el calor que la de 70 °C', () => {
    expect(factorTemperaturaRic(45, 90, 'B1')).toBeGreaterThan(factorTemperaturaRic(45, 70, 'B1'));
  });

  it('los métodos enterrados usan su propia columna (referencia 20 °C suelo)', () => {
    // A 30 °C, D1/D2 ya derratean porque su referencia es 20 °C de suelo.
    expect(factorTemperaturaRic(30, 90, 'D1')).toBeLessThan(1);
    expect(factorTemperaturaRic(30, 90, 'B1')).toBe(1);
  });
});

describe('factorAgrupamientoRic', () => {
  it('sigue la tabla 4.6 del RIC', () => {
    expect(factorAgrupamientoRic(1)).toBe(1);
    expect(factorAgrupamientoRic(3)).toBe(1);
    expect(factorAgrupamientoRic(5)).toBe(0.8);
    expect(factorAgrupamientoRic(12)).toBe(0.7);
    expect(factorAgrupamientoRic(24)).toBe(0.7);
    expect(factorAgrupamientoRic(30)).toBe(0.6);
    expect(factorAgrupamientoRic(50)).toBe(0.5);
  });

  it('coincide con factorApilamiento en modo RIC', () => {
    for (const n of [1, 3, 5, 8, 12, 24, 30, 42, 60]) {
      expect(factorApilamiento(n, 'RIC'), `n=${n}`).toBe(factorAgrupamientoRic(n));
    }
  });

  it('difiere del NEC sobre 9 conductores — el error que traía la app', () => {
    // Antes la app aplicaba la tabla del NEC citando RIC N°4 Tabla 4.6.
    expect(factorApilamiento(12, 'NEC')).toBe(0.5);
    expect(factorApilamiento(12, 'RIC')).toBe(0.7);
    expect(factorApilamiento(30, 'NEC')).toBe(0.45);
    expect(factorApilamiento(30, 'RIC')).toBe(0.6);
    // Hasta 9 conductores ambas normas coinciden.
    for (const n of [1, 3, 5, 6, 8, 9]) {
      expect(factorApilamiento(n, 'NEC'), `n=${n}`).toBe(factorApilamiento(n, 'RIC'));
    }
  });
});

describe('itmNormalizadoRic', () => {
  it('devuelve el calibre comercial inmediatamente superior', () => {
    expect(itmNormalizadoRic(5)).toBe(6);
    expect(itmNormalizadoRic(8)).toBe(10);
    expect(itmNormalizadoRic(15)).toBe(16);
    expect(itmNormalizadoRic(30)).toBe(32);
    expect(itmNormalizadoRic(95)).toBe(100);
  });

  it('el ITM nunca queda bajo la corriente de diseño', () => {
    for (let i = 1; i <= 100; i++) {
      const itm = itmNormalizadoRic(i);
      if (itm != null) expect(itm, `${i} A`).toBeGreaterThanOrEqual(i);
    }
  });

  it('sobre el rango tabulado no inventa un calibre', () => {
    expect(itmNormalizadoRic(101)).toBeUndefined();
    expect(itmNormalizadoRic(500)).toBeUndefined();
    expect(itmNormalizadoRic(0)).toBeUndefined();
  });
});

describe('seccionPorAmpacidad', () => {
  it('elige la menor sección cuya Iz corregida cubre la corriente', () => {
    const r = seccionPorAmpacidad(60, { tipo: 'RZ1-K', metodo: 'B1', temperaturaC: 30, nConductores: 3 })!;
    expect(r.izCorregidaA).toBeGreaterThanOrEqual(60);
    expect(r.ft).toBe(1);
    expect(r.fn).toBe(1);
    // La sección anterior no debería alcanzar.
    const menores = seccionesDe('RZ1-K', 'B1').filter((s) => s < r.seccionMm2);
    const previa = menores[menores.length - 1];
    if (previa != null) expect(ampacidadRic('RZ1-K', previa, 'B1')!).toBeLessThan(60);
  });

  it('el agrupamiento obliga a subir de sección', () => {
    const solo = seccionPorAmpacidad(60, { tipo: 'RZ1-K', metodo: 'B1', nConductores: 3 })!;
    const agrupado = seccionPorAmpacidad(60, { tipo: 'RZ1-K', metodo: 'B1', nConductores: 12 })!;
    expect(agrupado.fn).toBe(0.7);
    expect(agrupado.seccionMm2).toBeGreaterThan(solo.seccionMm2);
  });

  it('la temperatura alta también obliga a subir de sección', () => {
    const fria = seccionPorAmpacidad(60, { tipo: 'RZ1-K', metodo: 'B1', temperaturaC: 30 })!;
    const calurosa = seccionPorAmpacidad(60, { tipo: 'RZ1-K', metodo: 'B1', temperaturaC: 50 })!;
    expect(calurosa.ft).toBeLessThan(fria.ft);
    expect(calurosa.seccionMm2).toBeGreaterThanOrEqual(fria.seccionMm2);
  });

  it('respeta la sección mínima impuesta', () => {
    const r = seccionPorAmpacidad(10, { tipo: 'RZ1-K', metodo: 'B1', seccionMinimaMm2: 6 })!;
    expect(r.seccionMm2).toBeGreaterThanOrEqual(6);
  });

  it('rechaza un conductor no apto para reunión de personas', () => {
    expect(seccionPorAmpacidad(20, { tipo: 'H07V-K', metodo: 'B1', aptoReunion: true })).toBeUndefined();
    expect(seccionPorAmpacidad(20, { tipo: 'H07Z1-K', metodo: 'B1', aptoReunion: true })).toBeDefined();
  });

  it('devuelve undefined cuando ninguna sección alcanza', () => {
    expect(seccionPorAmpacidad(5000, { tipo: 'RZ1-K', metodo: 'B1' })).toBeUndefined();
    expect(seccionPorAmpacidad(0, { tipo: 'RZ1-K', metodo: 'B1' })).toBeUndefined();
    expect(seccionPorAmpacidad(20, { tipo: 'inexistente', metodo: 'B1' })).toBeUndefined();
  });

  it('devuelve los datos que necesita el cálculo de caída de tensión', () => {
    const r = seccionPorAmpacidad(60, { tipo: 'RZ1-K', metodo: 'B1' })!;
    expect(r.r20OhmKm).toBeGreaterThan(0);
    expect(r.diametroMm).toBeGreaterThan(0);
    expect(r.tServicioC).toBe(90);
  });
});
