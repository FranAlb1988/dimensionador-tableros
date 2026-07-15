import { describe, expect, it } from 'vitest';
import { sugerirArrancador } from './arrancador';
import type { Carga, TipoArranque } from '../types';

function motor(arranque: TipoArranque, kW = 30): Carga {
  return {
    id: 'm', descripcion: 'Motor', tipo: 'motor',
    potenciaKw: kW, tensionV: 400, fases: '3F', factorServicio: 1, arranque,
  };
}

describe('sugerirArrancador — notas de la simplificación DOL-equivalente', () => {
  it('YD declara los contactores y el temporizador no incluidos en el conteo', () => {
    const a = sugerirArrancador(motor('YD'))!;
    expect(a.placeholder).toBe(true);
    expect(a.notas).toContain('temporizador');
    expect(a.notas).toContain('no incluidos en el conteo');
  });

  it('PSV declara que el partidor suave real no está incluido', () => {
    const a = sugerirArrancador(motor('suave'))!;
    expect(a.notas).toContain('partidor suave');
  });

  it('VSD declara que el variador real no está incluido', () => {
    const a = sugerirArrancador(motor('variador'))!;
    expect(a.notas).toContain('variador de frecuencia');
  });

  it('DOL no lleva la nota de simplificación', () => {
    const a = sugerirArrancador(motor('DOL'))!;
    expect(a.notas ?? '').not.toContain('Modelado como Partida Directa');
  });
});
