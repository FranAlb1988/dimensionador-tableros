import { describe, expect, it } from 'vitest';
import { cargasContraincendio } from './advertencias-ccm';
import type { Carga } from '../types';

function carga(descripcion: string): Carga {
  return {
    id: descripcion, descripcion, tipo: 'motor',
    potenciaKw: 22, tensionV: 400, fases: '3F', factorServicio: 1, arranque: 'DOL',
  };
}

describe('cargasContraincendio', () => {
  it('detecta variantes habituales de bomba contraincendio', () => {
    const positivas = [
      'Bomba contraincendio',
      'Bomba contra incendio',
      'Bomba contra-incendios',
      'Fire pump principal',
      'Bomba jockey',
      'Bomba PCI',
      'Bomba P.C.I.',
    ];
    for (const d of positivas) {
      expect(cargasContraincendio([carga(d)]), d).toHaveLength(1);
    }
  });

  it('no marca cargas normales', () => {
    const negativas = [
      'Bomba agua potable',
      'Compresor',
      'Ventilador extractor',
      'Bomba de incendio forestal apagado', // contiene "incendio" pero no "contra incendio"
      'Capacitor banco',
    ];
    expect(cargasContraincendio(negativas.map(carga))).toHaveLength(0);
  });

  it('devuelve todas las coincidencias en orden', () => {
    const lista = [carga('Bomba agua'), carga('Bomba contraincendio'), carga('Bomba jockey')];
    const r = cargasContraincendio(lista);
    expect(r.map((c) => c.descripcion)).toEqual(['Bomba contraincendio', 'Bomba jockey']);
  });
});
