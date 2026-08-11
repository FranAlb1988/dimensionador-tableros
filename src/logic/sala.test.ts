import { describe, expect, it } from 'vitest';
import { EQUIPOS_REFERENCIA, SALA_REFERENCIA } from './carga-piso';
import {
  condicionDe,
  CRITERIOS_POR_DEFECTO,
  dimensionarSala,
  dimensionesTipicas,
  holguraFrontalPorDefecto,
  HOLGURA_NEC_MM,
  type CriteriosSala,
  type EquipoEnSala,
} from './sala';

/** Los equipos reales de 03300-SEL-001, con los HVAC montados en muro. */
function equiposDeLaSalaReal(): EquipoEnSala[] {
  return EQUIPOS_REFERENCIA
    .filter((e) => e.anchoMm != null && e.profundidadMm != null)
    .map((e) => ({
      nombre: e.tag,
      anchoMm: e.anchoMm!,
      profundidadMm: e.profundidadMm!,
      cantidad: 1,
      enMuro: e.tipo === 'hvac',
    }));
}

const criterios = (p: Partial<CriteriosSala> = {}): CriteriosSala => ({
  ...CRITERIOS_POR_DEFECTO, ...p,
});

describe('condición de trabajo según la disposición', () => {
  it('dos filas enfrentadas dejan partes vivas a ambos lados', () => {
    expect(condicionDe('dosFilasEnfrentadas')).toBe(3);
    expect(condicionDe('unaFila')).toBe(2);
    expect(condicionDe('dosFilasEspalda')).toBe(2);
  });

  it('la condición 3 pide 200 mm más de pasillo que la 2', () => {
    expect(holguraFrontalPorDefecto('dosFilasEnfrentadas')).toBe(HOLGURA_NEC_MM.condicion3);
    expect(holguraFrontalPorDefecto('unaFila')).toBe(HOLGURA_NEC_MM.condicion2);
    expect(HOLGURA_NEC_MM.condicion3 - HOLGURA_NEC_MM.condicion2).toBe(200);
  });
});

describe('reproducción de la sala real', () => {
  it('con dos filas enfrentadas llega a las medidas de 03300-SEL-001', () => {
    // Es la validación que importa: 36,56 × 4,56 m reales contra lo estimado.
    const r = dimensionarSala(equiposDeLaSalaReal(), criterios({
      disposicion: 'dosFilasEnfrentadas',
      holguraFrontalMm: HOLGURA_NEC_MM.condicion3,
      holguraLateralMm: 600,
    }))!;

    expect(r.anchoM).toBeCloseTo(SALA_REFERENCIA.anchoM, 1);
    expect(Math.abs(r.largoM - SALA_REFERENCIA.largoM)).toBeLessThan(1);
    const superficieReal = SALA_REFERENCIA.largoM * SALA_REFERENCIA.anchoM;
    expect(Math.abs(r.superficieM2 - superficieReal) / superficieReal).toBeLessThan(0.03);
  });

  it('las otras disposiciones no dan esas medidas, y por eso la disposición es una entrada', () => {
    const eq = equiposDeLaSalaReal();
    const unaFila = dimensionarSala(eq, criterios({ disposicion: 'unaFila' }))!;
    // Una sola fila duplica el largo: 70 m no caben en un contenedor de 3 módulos.
    expect(unaFila.largoM).toBeGreaterThan(SALA_REFERENCIA.largoM * 1.8);
    expect(unaFila.anchoM).toBeLessThan(SALA_REFERENCIA.anchoM);
  });

  it('los equipos de muro no consumen planta', () => {
    const conMuro = dimensionarSala(equiposDeLaSalaReal(), criterios())!;
    const sinMarcar = dimensionarSala(
      equiposDeLaSalaReal().map((e) => ({ ...e, enMuro: false })), criterios(),
    )!;
    // Los 9 HVAC son 11,4 m de frente que, montados en muro, no alargan la sala.
    expect(conMuro.frenteEnMuroMm).toBeCloseTo(11430, -2);
    expect(sinMarcar.largoM).toBeGreaterThan(conMuro.largoM + 11);
  });
});

describe('dimensionarSala', () => {
  const uno = (anchoMm: number, profundidadMm: number, cantidad = 1): EquipoEnSala =>
    ({ nombre: 'x', anchoMm, profundidadMm, cantidad });

  it('una fila suma frentes y toma la profundidad mayor', () => {
    const r = dimensionarSala(
      [uno(1000, 500), uno(2000, 800)],
      criterios({ holguraFrontalMm: 1000, holguraPosteriorMm: 0, holguraLateralMm: 500 }),
    )!;
    expect(r.largoM).toBeCloseTo((1000 + 2000 + 2 * 500) / 1000, 6);
    expect(r.anchoM).toBeCloseTo((800 + 1000) / 1000, 6);
    expect(r.filas).toHaveLength(1);
  });

  it('la holgura posterior se suma solo si se pide acceso por detrás', () => {
    const base = dimensionarSala([uno(1000, 500)], criterios({ holguraPosteriorMm: 0 }))!;
    const conAcceso = dimensionarSala([uno(1000, 500)], criterios({ holguraPosteriorMm: 800 }))!;
    expect(conAcceso.anchoM - base.anchoM).toBeCloseTo(0.8, 6);
  });

  it('dos filas enfrentadas comparten un pasillo; espalda con espalda necesita dos', () => {
    const eq = [uno(1000, 700), uno(1000, 700)];
    const enfrentadas = dimensionarSala(eq, criterios({
      disposicion: 'dosFilasEnfrentadas', holguraFrontalMm: 1200,
    }))!;
    const espalda = dimensionarSala(eq, criterios({
      disposicion: 'dosFilasEspalda', holguraFrontalMm: 1200,
    }))!;
    expect(enfrentadas.anchoM).toBeCloseTo((700 + 700 + 1200) / 1000, 6);
    expect(espalda.anchoM).toBeCloseTo((700 + 700 + 2 * 1200) / 1000, 6);
    // Espalda con espalda cuesta un pasillo entero más de ancho.
    expect(espalda.anchoM - enfrentadas.anchoM).toBeCloseTo(1.2, 6);
  });

  it('reparte en dos filas equilibrando el frente', () => {
    const r = dimensionarSala(
      [uno(4000, 500), uno(3000, 500), uno(2000, 500), uno(1000, 500)],
      criterios({ disposicion: 'dosFilasEnfrentadas' }),
    )!;
    const frentes = r.filas.map((f) => f.frenteMm).sort((a, b) => a - b);
    expect(frentes).toEqual([5000, 5000]);
  });

  it('la cantidad multiplica el frente', () => {
    const r = dimensionarSala([uno(1000, 500, 5)], criterios({ holguraLateralMm: 0 }))!;
    expect(r.largoM).toBeCloseTo(5, 6);
  });

  it('las holguras son la mayor parte de la sala, no la huella', () => {
    // En la sala real los equipos ocupan el 42 % y el resto es trabajo y
    // circulación. Por eso las holguras son entradas y no constantes ocultas.
    const r = dimensionarSala(equiposDeLaSalaReal(), criterios({
      disposicion: 'dosFilasEnfrentadas', holguraFrontalMm: 1200,
    }))!;
    expect(r.ocupacionPct).toBeLessThan(50);
  });

  it('sin equipos de piso no hay planta que dimensionar', () => {
    expect(dimensionarSala([], criterios())).toBeUndefined();
    expect(dimensionarSala([{ ...uno(1000, 500), enMuro: true }], criterios())).toBeUndefined();
  });

  it('ignora cantidades negativas o fraccionarias a la baja', () => {
    const r = dimensionarSala(
      [uno(1000, 500, 2), { ...uno(9000, 500), cantidad: -3 }],
      criterios({ holguraLateralMm: 0 }),
    )!;
    expect(r.largoM).toBeCloseTo(2, 6);
  });
});

describe('dimensionesTipicas', () => {
  it('devuelve medidas reales por tipo', () => {
    const ccm = dimensionesTipicas('ccm')!;
    expect(ccm.anchoMm).toBeGreaterThan(2000);
    expect(ccm.profundidadMm).toBe(508);
  });

  it('toma la profundidad mayor del tipo, que es la que fija el ancho de sala', () => {
    const cdc = dimensionesTipicas('cdc')!;
    const maximo = Math.max(
      ...EQUIPOS_REFERENCIA.filter((e) => e.tipo === 'cdc').map((e) => e.profundidadMm ?? 0),
    );
    expect(cdc.profundidadMm).toBe(maximo);
  });

  it('un tipo sin medidas no inventa dimensiones', () => {
    expect(dimensionesTipicas('extincion')).toBeUndefined();
  });
});
