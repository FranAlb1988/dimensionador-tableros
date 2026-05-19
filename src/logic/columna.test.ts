import { describe, expect, it } from 'vitest';
import { distribuirEnColumnas, resetContadorColumnas } from './columna';
import type { Gaveta } from '../types';

function gaveta(id: string, altoMm: number): Gaveta {
  return {
    id, tamano: '1/4', altoMm, version: 'extraible',
    contenido: '', protecciones: [],
  };
}

describe('distribuirEnColumnas (FFD)', () => {
  it('coloca todas las gavetas que caben en una sola columna', () => {
    resetContadorColumnas();
    const cols = distribuirEnColumnas(
      [gaveta('a', 600), gaveta('b', 600), gaveta('c', 300)],
      { altoUtilMm: 1800 },
    );
    expect(cols).toHaveLength(1);
    expect(cols[0]!.gavetas).toHaveLength(3);
    expect(cols[0]!.espacioRemanenteMm).toBe(300);
  });

  it('abre una segunda columna cuando no cabe', () => {
    resetContadorColumnas();
    const cols = distribuirEnColumnas(
      [gaveta('a', 1200), gaveta('b', 900), gaveta('c', 600)],
      { altoUtilMm: 1800 },
    );
    // FFD por altura desc: 1200, 900, 600. col1: 1200 → falta 600. col1+600=1800 (cabe c). col2: 900.
    expect(cols).toHaveLength(2);
    expect(cols[0]!.gavetas.map((g) => g.id)).toEqual(['a', 'c']);
    expect(cols[1]!.gavetas.map((g) => g.id)).toEqual(['b']);
  });

  it('lanza si una gaveta excede el alto útil', () => {
    expect(() => distribuirEnColumnas([gaveta('big', 2000)], { altoUtilMm: 1800 })).toThrow();
  });

  it('lista vacía produce 0 columnas', () => {
    const cols = distribuirEnColumnas([], { altoUtilMm: 1800 });
    expect(cols).toEqual([]);
  });
});
