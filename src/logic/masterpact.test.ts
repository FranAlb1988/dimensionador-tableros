import { describe, expect, it } from 'vitest';
import {
  bastidoresMasterpact,
  capacidadMasterpactKa,
  MASTERPACT_DISPONIBLES,
  nivelesMasterpact,
  sugerirMasterpact,
} from './masterpact';

describe('catálogo MasterPact', () => {
  it('trae los 476 modelos y los tres bastidores', () => {
    expect(MASTERPACT_DISPONIBLES.length).toBe(476);
    expect(bastidoresMasterpact()).toEqual(['MTZ1', 'MTZ2', 'MTZ3']);
  });

  it('cubre de 630 a 6300 A', () => {
    const ins = MASTERPACT_DISPONIBLES.map((m) => m.inA);
    expect(Math.min(...ins)).toBe(630);
    expect(Math.max(...ins)).toBe(6300);
  });

  it('el nivel es una dimensión aparte del calibre', () => {
    // Es la propiedad que faltaba en el placeholder: el mismo In existe en
    // varios niveles con Icu distintos.
    const de800 = MASTERPACT_DISPONIBLES.filter((m) => m.inA === 800 && m.polos === '3P');
    const niveles = new Set(de800.map((m) => m.nivel));
    const icus = new Set(de800.map((m) => m.icu415Ka));
    expect(niveles.size).toBeGreaterThan(2);
    expect(icus.size).toBeGreaterThan(2);
  });

  it('lista los niveles publicados', () => {
    const n = nivelesMasterpact();
    expect(n).toContain('N1');
    expect(n).toContain('H1');
    expect(n).toContain('L1');
  });

  it('reconstruye un modelo conocido con su referencia', () => {
    const m = MASTERPACT_DISPONIBLES.find(
      (x) => x.bastidor === 'MTZ1' && x.nivel === 'H1' && x.inA === 630
        && x.polos === '3P' && x.ejecucion === 'Fijo' && x.generacion === 'MTZ Active',
    )!;
    expect(m.icu415Ka).toBe(42);
    expect(m.icw1sKa).toBe(42);
    expect(m.categoriaIec).toBe('B');
    expect(m.anchoMm).toBe(276);
    expect(m.referencia).toBe('LV947110');
  });
});

describe('capacidadMasterpactKa', () => {
  it('cae al subir la tensión', () => {
    const m = MASTERPACT_DISPONIBLES.find((x) => x.icu690Ka != null && x.icu415Ka != null)!;
    expect(capacidadMasterpactKa(m, 400)!).toBeGreaterThanOrEqual(capacidadMasterpactKa(m, 690)!);
  });

  it('sobre la Ue del equipo no devuelve capacidad', () => {
    const m = MASTERPACT_DISPONIBLES.find((x) => x.ueMaxV === 690)!;
    expect(capacidadMasterpactKa(m, 1200)).toBeUndefined();
  });
});

describe('sugerirMasterpact', () => {
  it('elige el menor calibre que cubre la corriente', () => {
    expect(sugerirMasterpact(700)!.inA).toBe(800);
    expect(sugerirMasterpact(1700)!.inA).toBe(2000);
  });

  it('sube de nivel para alcanzar la Icc, no de calibre', () => {
    const base = sugerirMasterpact(700, { polos: '3P' })!;
    const fuerte = sugerirMasterpact(700, { polos: '3P', iccKa: 100 })!;
    expect(fuerte.inA).toBe(base.inA);
    expect(fuerte.bastidor).toBe(base.bastidor);
    expect(fuerte.nivel).not.toBe(base.nivel);
    expect(capacidadMasterpactKa(fuerte, 400)!).toBeGreaterThanOrEqual(100);
  });

  it('no sobreespecifica el nivel cuando no se pide Icc', () => {
    const a = sugerirMasterpact(700, { polos: '3P' })!;
    const b = sugerirMasterpact(700, { polos: '3P', iccKa: 42 })!;
    expect(capacidadMasterpactKa(a, 400)).toBe(capacidadMasterpactKa(b, 400));
  });

  it('respeta polos y ejecución', () => {
    const m = sugerirMasterpact(1000, { polos: '4P', ejecucion: 'Extraíble' })!;
    expect(m.polos).toBe('4P');
    expect(m.ejecucion).toBe('Extraíble');
  });

  it('soloConReferencia descarta los niveles sin SKU publicado', () => {
    const m = sugerirMasterpact(3500, { polos: '3P', soloConReferencia: true });
    expect(m?.referencia).toBeTruthy();
  });

  it('puede exigir Icw mínima para selectividad cronométrica', () => {
    const m = sugerirMasterpact(1000, { polos: '3P', icw1sKaMin: 85 })!;
    expect(m.icw1sKa!).toBeGreaterThanOrEqual(85);
  });

  it('devuelve undefined fuera de catálogo', () => {
    expect(sugerirMasterpact(7000)).toBeUndefined();
    expect(sugerirMasterpact(1000, { iccKa: 500 })).toBeUndefined();
    expect(sugerirMasterpact(0)).toBeUndefined();
  });
});
