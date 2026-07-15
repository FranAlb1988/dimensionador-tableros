import { describe, expect, it } from 'vitest';
import { BARRAS_DISPONIBLES, sugerirBarra } from './barra';
import { MAX_BARRA_CCM_A, MAX_BARRA_CDC_A } from './limites-barra';

describe('sugerirBarra', () => {
  it('para 200 A elige la barra mínima del catálogo (250 A)', () => {
    const b = sugerirBarra(200);
    expect(b).toBeDefined();
    expect(b!.inA).toBe(250);
    expect(b!.material).toBe('Cu');
  });

  it('para 800 A justos elige Cu 80×5 (800 A)', () => {
    const b = sugerirBarra(800);
    expect(b!.inA).toBe(800);
  });

  it('para 1100 A elige Cu 100×10 (1500 A) porque 100×5 no alcanza', () => {
    const b = sugerirBarra(1100);
    expect(b!.inA).toBe(1500);
  });

  it('para corriente cero devuelve undefined', () => {
    expect(sugerirBarra(0)).toBeUndefined();
  });

  it('con tope CCM (3200 A) acepta hasta 3200 A', () => {
    const b = sugerirBarra(3000, MAX_BARRA_CCM_A);
    expect(b!.inA).toBe(3200);
  });

  it('con tope CCM (3200 A) rechaza corrientes mayores', () => {
    expect(sugerirBarra(3500, MAX_BARRA_CCM_A)).toBeUndefined();
  });

  it('con tope CDC (6000 A) acepta hasta 6000 A', () => {
    const b = sugerirBarra(5500, MAX_BARRA_CDC_A);
    expect(b!.inA).toBeGreaterThanOrEqual(5500);
    expect(b!.inA).toBeLessThanOrEqual(MAX_BARRA_CDC_A);
  });

  it('con tope CDC (6000 A) rechaza corrientes mayores', () => {
    expect(sugerirBarra(6500, MAX_BARRA_CDC_A)).toBeUndefined();
  });

  it('toda barra declara su referencia DIN 43671 libre aire y el inA queda por debajo', () => {
    for (const b of BARRAS_DISPONIBLES) {
      expect(b.dinLibreAireA, b.referencia).toBeDefined();
      // El valor de selección (envolvente) nunca puede superar el libre aire.
      expect(b.inA, b.referencia).toBeLessThanOrEqual(b.dinLibreAireA!);
    }
  });
});
