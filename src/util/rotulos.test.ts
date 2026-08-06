import { describe, expect, it } from 'vitest';
import { nombreDeFila, rotuloDeCampo } from './rotulos';

describe('nombreDeFila', () => {
  it('usa la descripción cuando la hay', () => {
    expect(nombreDeFila('Bomba agua potable', 0)).toBe('Bomba agua potable');
  });

  it('cae al número de fila mientras no haya descripción', () => {
    // Una fila recién agregada no tiene con qué distinguirse de otra: sin esto,
    // todos sus controles se anunciarían igual.
    expect(nombreDeFila('', 0)).toBe('carga 1 sin descripción');
    expect(nombreDeFila('   ', 4)).toBe('carga 5 sin descripción');
    expect(nombreDeFila(undefined, 2)).toBe('carga 3 sin descripción');
  });

  it('admite otro sustantivo según la tabla', () => {
    expect(nombreDeFila('', 0, 'salida')).toBe('salida 1 sin descripción');
    expect(nombreDeFila('', 1, 'celda')).toBe('celda 2 sin descripción');
  });

  it('descarta los espacios de una descripción a medio escribir', () => {
    expect(nombreDeFila('  Compresor  ', 0)).toBe('Compresor');
  });
});

describe('rotuloDeCampo', () => {
  it('junta columna y fila, que es lo que faltaba', () => {
    // El encabezado de la tabla aporta la columna; un lector de pantalla no
    // tenía de dónde sacar la fila.
    expect(rotuloDeCampo('Tensión', 'Bomba agua potable')).toBe('Tensión de Bomba agua potable');
  });

  it('sirve igual con el nombre de respaldo', () => {
    expect(rotuloDeCampo('Fases', nombreDeFila('', 0)))
      .toBe('Fases de carga 1 sin descripción');
  });
});
