import { describe, expect, it } from 'vitest';
import {
  cargaPisoSala,
  concentracionKgM2,
  EQUIPOS_REFERENCIA,
  huellaM2,
  pesoEspecificoKgM2,
  pesoEstimadoTablero,
  SALA_REFERENCIA,
  SOBRECARGA_PISO_DISENO_KGM2,
  tiposConPeso,
} from './carga-piso';

describe('sala de referencia 03300-SEL-001', () => {
  it('trae los criterios estructurales del proyecto', () => {
    expect(SALA_REFERENCIA.modulos).toBe(3);
    expect(SALA_REFERENCIA.largoM).toBe(36.56);
    expect(SALA_REFERENCIA.anchoM).toBe(4.56);
    expect(SOBRECARGA_PISO_DISENO_KGM2).toBe(1000);
    expect(SALA_REFERENCIA.sobrecargaTechoKgM2).toBe(350);
    expect(SALA_REFERENCIA.nieveKgM2).toBe(100);
    expect(SALA_REFERENCIA.vientoKgM2).toBe(150);
  });

  it('el listado suma exactamente el peso que declara la memoria', () => {
    const suma = EQUIPOS_REFERENCIA.reduce((s, e) => s + e.pesoKg, 0);
    expect(suma).toBe(SALA_REFERENCIA.pesoEquiposKgf);
    expect(EQUIPOS_REFERENCIA).toHaveLength(58);
  });

  it('incluye la climatización, que es 12 tonf de las 66', () => {
    const hvac = EQUIPOS_REFERENCIA.filter((e) => e.tipo === 'hvac');
    expect(hvac).toHaveLength(9);
    expect(hvac.reduce((s, e) => s + e.pesoKg, 0)).toBe(9 * 1362);
    expect(EQUIPOS_REFERENCIA.filter((e) => e.tipo === 'presurizador')).toHaveLength(2);
  });

  it('reproduce la carga promedio publicada', () => {
    const sup = SALA_REFERENCIA.largoM * SALA_REFERENCIA.anchoM;
    const r = cargaPisoSala([SALA_REFERENCIA.pesoEquiposKgf], sup)!;
    expect(Math.abs(r.promedioKgM2 - SALA_REFERENCIA.cargaPromedioKgM2)).toBeLessThan(1);
    expect(r.excede).toBe(false);
    expect(r.usoDisenoPct).toBeCloseTo(39.9, 0);
  });
});

describe('peso específico por tipo', () => {
  it('calcula un peso específico para los tipos con medidas', () => {
    const tipos = tiposConPeso();
    expect(tipos).toContain('ccm');
    expect(tipos).toContain('cdc');
    expect(tipos).toContain('vdfBt');
    expect(tipos).toContain('hvac');
    // Los extintores no declaran medidas: no entran.
    expect(tipos).not.toContain('extincion');
  });

  it('los valores están en el orden que muestra el listado real', () => {
    // Todos los tipos de tablero rondan los 800–1400 kg/m² de huella.
    for (const t of tiposConPeso()) {
      const k = pesoEspecificoKgM2(t)!;
      expect(k, t).toBeGreaterThan(300);
      expect(k, t).toBeLessThan(2500);
    }
  });

  it('un CCM del listado cae cerca de su propio peso específico', () => {
    const ccm = EQUIPOS_REFERENCIA.find((e) => e.tag === '03320-CCM-002')!;
    const est = pesoEstimadoTablero('ccm', ccm.anchoMm!, ccm.profundidadMm!)!;
    // 3.856 kg reales; el específico del tipo promedia varias columnas.
    expect(est.pesoKg).toBeGreaterThan(ccm.pesoKg * 0.6);
    expect(est.pesoKg).toBeLessThan(ccm.pesoKg * 1.6);
  });
});

describe('pesoEstimadoTablero', () => {
  it('escala con la huella', () => {
    const chico = pesoEstimadoTablero('ccm', 2000, 500)!;
    const grande = pesoEstimadoTablero('ccm', 4000, 500)!;
    expect(grande.pesoKg).toBeCloseTo(chico.pesoKg * 2, 5);
    expect(grande.especificoKgM2).toBe(chico.especificoKgM2);
  });

  it('da un orden de magnitud realista para un CCM típico', () => {
    // Un CCM de 3 columnas ~2400 × 600 mm.
    const e = pesoEstimadoTablero('ccm', 2400, 600)!;
    expect(e.pesoKg).toBeGreaterThan(800);
    expect(e.pesoKg).toBeLessThan(3000);
  });

  it('rechaza medidas inválidas o tipos sin datos', () => {
    expect(pesoEstimadoTablero('ccm', 0, 600)).toBeUndefined();
    expect(pesoEstimadoTablero('extincion', 1000, 600)).toBeUndefined();
  });
});

describe('carga de sala y concentración local', () => {
  it('el criterio de 1000 kg/m² es promedio de sala, no por huella', () => {
    // Casi todos los tableros del listado real superan 1000 kgf/m² sobre su
    // propia huella, y la sala promedia 398. Comparar la huella contra el
    // criterio de sala marcaría en rojo un diseño correcto.
    const porHuella = EQUIPOS_REFERENCIA
      .map((e) => (huellaM2(e) != null ? e.pesoKg / huellaM2(e)! : null))
      .filter((x): x is number => x != null);
    const sobre1000 = porHuella.filter((x) => x > SOBRECARGA_PISO_DISENO_KGM2).length;
    expect(sobre1000).toBeGreaterThan(porHuella.length / 3);

    const sup = SALA_REFERENCIA.largoM * SALA_REFERENCIA.anchoM;
    expect(cargaPisoSala([SALA_REFERENCIA.pesoEquiposKgf], sup)!.excede).toBe(false);
  });

  it('cargaPisoSala marca cuando el promedio supera el diseño', () => {
    const r = cargaPisoSala([200000], 100)!; // 2000 kgf/m²
    expect(r.excede).toBe(true);
    expect(r.usoDisenoPct).toBeCloseTo(200, 3);
  });

  it('ignora pesos negativos y admite lista vacía', () => {
    expect(cargaPisoSala([100, -50], 10)!.pesoTotalKg).toBe(100);
    expect(cargaPisoSala([], 10)!.promedioKgM2).toBe(0);
  });

  it('concentracionKgM2 reparte sobre la huella del equipo', () => {
    expect(concentracionKgM2(1000, 2000, 500)).toBeCloseTo(1000, 5);
    expect(concentracionKgM2(1000, 0, 500)).toBeUndefined();
  });

  it('sin superficie no hay carga de sala', () => {
    expect(cargaPisoSala([1000], 0)).toBeUndefined();
  });
});
