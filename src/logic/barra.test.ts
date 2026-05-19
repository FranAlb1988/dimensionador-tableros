import { describe, expect, it } from 'vitest';
import { sugerirBarra } from './barra';

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
});
