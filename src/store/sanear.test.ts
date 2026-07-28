import { describe, expect, it } from 'vitest';
import { sanearCarga, sanearCargas, TENSION_FALLBACK } from './sanear';

describe('sanearCarga', () => {
  it('deja intacta una carga bien formada', () => {
    const { valor, avisos } = sanearCarga(
      {
        id: 'c1',
        descripcion: 'Bomba',
        tipo: 'motor',
        potenciaKw: 7.5,
        tensionV: 400,
        fases: '3F',
        factorServicio: 1.15,
        arranque: 'variador',
      },
      'CCM fila 1',
    );
    expect(avisos).toEqual([]);
    expect(valor.potenciaKw).toBe(7.5);
    expect(valor.tensionV).toBe(400);
    expect(valor.arranque).toBe('variador');
  });

  it('repara una tensión no numérica y lo avisa', () => {
    const { valor, avisos } = sanearCarga(
      { id: 'c1', tipo: 'motor', potenciaKw: 5, tensionV: 'abc', fases: '3F', factorServicio: 1 },
      'CCM fila 1',
    );
    expect(valor.tensionV).toBe(TENSION_FALLBACK);
    expect(avisos.some((a) => a.includes('tensión inválida'))).toBe(true);
  });

  it('descarta potencias y corrientes no positivas', () => {
    const { valor, avisos } = sanearCarga(
      { id: 'c1', tipo: 'motor', potenciaKw: -5, corrienteA: 0, tensionV: 400, fases: '3F', factorServicio: 1 },
      'CCM fila 2',
    );
    expect(valor.potenciaKw).toBeUndefined();
    expect(valor.corrienteA).toBeUndefined();
    expect(avisos.some((a) => a.includes('no tiene potencia ni corriente'))).toBe(true);
  });

  it('cae a valores por defecto cuando los enums no son válidos', () => {
    const { valor, avisos } = sanearCarga(
      { id: 'c1', tipo: 'inventado', fases: '7F', arranque: 'turbo', tensionV: 400, potenciaKw: 1, factorServicio: 1 },
      'CCM fila 3',
    );
    expect(valor.tipo).toBe('otro');
    expect(valor.fases).toBe('3F');
    expect(valor.arranque).toBeUndefined();
    expect(avisos.length).toBe(3);
  });

  it('acepta números escritos como texto con coma decimal', () => {
    const { valor } = sanearCarga(
      { id: 'c1', tipo: 'motor', potenciaKw: '7,5', tensionV: '400', fases: '3F', factorServicio: 1 },
      'CCM fila 4',
    );
    expect(valor.potenciaKw).toBe(7.5);
    expect(valor.tensionV).toBe(400);
  });

  it('rechaza cosPhi y rendimiento fuera del rango (0, 1]', () => {
    const { valor } = sanearCarga(
      { id: 'c1', tipo: 'motor', potenciaKw: 5, tensionV: 400, fases: '3F', factorServicio: 1, cosPhi: 1.4, rendimiento: 0 },
      'CCM fila 5',
    );
    expect(valor.cosPhi).toBeUndefined();
    expect(valor.rendimiento).toBeUndefined();
  });

  it('genera un id cuando falta', () => {
    const { valor } = sanearCarga({ tipo: 'motor', potenciaKw: 5, tensionV: 400 }, 'CCM fila 6');
    expect(valor.id).toBeTruthy();
  });

  it('nunca produce NaN en los campos numéricos obligatorios', () => {
    const { valor } = sanearCarga({ tensionV: NaN, factorServicio: NaN }, 'CCM fila 7');
    expect(Number.isFinite(valor.tensionV)).toBe(true);
    expect(Number.isFinite(valor.factorServicio)).toBe(true);
  });
});

describe('sanearCargas', () => {
  it('devuelve lista vacía si no es un array', () => {
    expect(sanearCargas(null, 'CCM').valor).toEqual([]);
    expect(sanearCargas({ a: 1 }, 'CCM').valor).toEqual([]);
  });

  it('numera los avisos por posición', () => {
    const { valor, avisos } = sanearCargas(
      [
        { id: 'a', tipo: 'motor', potenciaKw: 5, tensionV: 400, fases: '3F', factorServicio: 1 },
        { id: 'b', tipo: 'motor', potenciaKw: 5, tensionV: 'x', fases: '3F', factorServicio: 1 },
      ],
      'CCM',
    );
    expect(valor).toHaveLength(2);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('fila 2');
  });
});
