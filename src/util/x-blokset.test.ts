import { describe, expect, it } from 'vitest';
import { altoUtilColumnaEnX, fmtX, tamanoEnX, tamanoEnXTexto } from './x-blokset';

describe('tamanoEnX', () => {
  it('mapea cada tamaño a su fracción', () => {
    expect(tamanoEnX('1/4')).toBe(0.25);
    expect(tamanoEnX('1/2')).toBe(0.5);
    expect(tamanoEnX('1')).toBe(1);
    expect(tamanoEnX('1+1/2')).toBe(1.5);
    expect(tamanoEnX('2')).toBe(2);
  });
});

describe('tamanoEnXTexto', () => {
  it('renderiza con fracciones unicode', () => {
    expect(tamanoEnXTexto('1/4')).toBe('¼ X');
    expect(tamanoEnXTexto('1/2')).toBe('½ X');
    expect(tamanoEnXTexto('1+1/2')).toBe('1½ X');
    expect(tamanoEnXTexto('2')).toBe('2 X');
  });
});

describe('fmtX', () => {
  it('formatea valores redondos', () => {
    expect(fmtX(0.25)).toBe('¼ X');
    expect(fmtX(0.5)).toBe('½ X');
    expect(fmtX(1.5)).toBe('1½ X');
    expect(fmtX(3)).toBe('3 X');
  });

  it('formatea valores no estándar con coma', () => {
    expect(fmtX(0.75)).toBe('¾ X');
    expect(fmtX(2.25)).toBe('2,25 X');
  });
});

describe('altoUtilColumnaEnX', () => {
  it('column útil 1800 / 600 (1 X) = 3 X', () => {
    expect(altoUtilColumnaEnX()).toBe(3);
  });
});
