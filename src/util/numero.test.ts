import { describe, expect, it } from 'vitest';
import { parsearNumero } from './numero';

describe('parsearNumero', () => {
  it('lee números normales', () => {
    expect(parsearNumero('36.56')).toBe(36.56);
    expect(parsearNumero('0')).toBe(0);
    expect(parsearNumero('-7')).toBe(-7);
    expect(parsearNumero(' 2400 ')).toBe(2400);
  });

  it('acepta la coma como separador decimal', () => {
    // La app muestra "36,56" en todos lados; no admitirlo de vuelta sería raro.
    expect(parsearNumero('36,56')).toBe(36.56);
    expect(parsearNumero('0,95')).toBe(0.95);
  });

  it('el campo vacío no es cero', () => {
    // Es el punto de la función. Con `Number('')` daba 0 y bastaba borrar un
    // campo para que el cálculo se rehiciera con cero, sin poder vaciarlo para
    // reescribirlo.
    expect(parsearNumero('')).toBeUndefined();
    expect(parsearNumero('   ')).toBeUndefined();
    expect(Number('')).toBe(0);
  });

  it('descarta lo que está a medio escribir o no es número', () => {
    expect(parsearNumero('-')).toBeUndefined();
    expect(parsearNumero('abc')).toBeUndefined();
    expect(parsearNumero('1,2,3')).toBeUndefined();
  });

  it('descarta infinitos, que colarían un cálculo sin sentido', () => {
    expect(parsearNumero('Infinity')).toBeUndefined();
    expect(parsearNumero('1e999')).toBeUndefined();
  });

  it('un punto final no rompe: es un número a medio escribir válido', () => {
    expect(parsearNumero('3.')).toBe(3);
    expect(parsearNumero('3,')).toBe(3);
  });
});
