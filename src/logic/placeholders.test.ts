import { describe, expect, it } from 'vitest';
import {
  lineaCriterioPlaceholders,
  recolectarPlaceholders,
  totalPlaceholders,
} from './placeholders';

describe('recolectarPlaceholders', () => {
  it('encuentra ítems marcados a cualquier profundidad', () => {
    const resultado = {
      tablero: {
        columnas: [
          { gavetas: [{ proteccion: { referencia: 'XT2N160', placeholder: true } }] },
        ],
      },
      barra: { dimensionMm: '80x5', placeholder: true },
    };
    const items = recolectarPlaceholders(resultado);
    expect(items.map((i) => i.referencia)).toEqual(['80x5', 'XT2N160']);
  });

  it('agrupa repeticiones en vez de listarlas sueltas', () => {
    const resultado = {
      asignaciones: [
        { proteccion: { referencia: 'XT2N160', placeholder: true } },
        { proteccion: { referencia: 'XT2N160', placeholder: true } },
        { proteccion: { referencia: 'XT4S250', placeholder: true } },
      ],
    };
    const items = recolectarPlaceholders(resultado);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.referencia === 'XT2N160')!.veces).toBe(2);
    expect(totalPlaceholders(items)).toBe(3);
  });

  it('ignora lo que no está marcado', () => {
    const resultado = {
      asignaciones: [
        { proteccion: { referencia: 'NSX100F' } },
        { proteccion: { referencia: 'NSX160F', placeholder: false } },
      ],
    };
    expect(recolectarPlaceholders(resultado)).toEqual([]);
  });

  it('no se cuelga con referencias circulares', () => {
    // Los resultados enlazan carga y asignación en las dos direcciones.
    const carga: Record<string, unknown> = { id: 'c1' };
    const asignacion: Record<string, unknown> = {
      carga, proteccion: { referencia: 'X', placeholder: true },
    };
    carga['asignacion'] = asignacion;
    expect(recolectarPlaceholders({ asignaciones: [asignacion] })).toHaveLength(1);
  });

  it('cae a otros campos cuando no hay referencia', () => {
    const items = recolectarPlaceholders([
      { tamano: '1/2', placeholder: true },
      { modelo: 'Pragma 24', placeholder: true },
      { placeholder: true },
    ]);
    expect(items.map((i) => i.referencia).sort())
      .toEqual(['(sin referencia)', '1/2', 'Pragma 24']);
  });

  it('identifica al arrancador por su contactor', () => {
    // El arrancador no tiene campo `referencia`; sin esto salía listado como
    // "(sin referencia)" y no se sabía cuál verificar.
    const items = recolectarPlaceholders([
      { contactor: 'LC1D18', releTermico: 'LRD16', placeholder: true },
    ]);
    expect(items[0]!.referencia).toBe('LC1D18');
  });

  it('conserva la nota del catálogo', () => {
    const items = recolectarPlaceholders([
      { referencia: 'XT2S160', placeholder: true, notas: 'verificar SKU' },
    ]);
    expect(items[0]!.notas).toBe('verificar SKU');
  });

  it('tolera entradas vacías o primitivas', () => {
    expect(recolectarPlaceholders(null)).toEqual([]);
    expect(recolectarPlaceholders(42)).toEqual([]);
    expect(recolectarPlaceholders([])).toEqual([]);
  });
});

describe('lineaCriterioPlaceholders', () => {
  it('sin placeholders no ensucia la memoria', () => {
    expect(lineaCriterioPlaceholders([])).toBeUndefined();
  });

  it('nombra el total y las referencias afectadas', () => {
    const linea = lineaCriterioPlaceholders([
      { referencia: 'XT2N160', veces: 2 },
      { referencia: 'E2.2N', veces: 1 },
    ])!;
    expect(linea).toContain('3 seleccion');
    expect(linea).toContain('XT2N160 (x2)');
    expect(linea).toContain('E2.2N');
    expect(linea).toContain('no deben llevarse a plano');
  });

  it('no usa glifos fuera de WinAnsi, que jsPDF no dibuja', () => {
    const linea = lineaCriterioPlaceholders([{ referencia: 'X', veces: 1 }])!;
    // eslint-disable-next-line no-control-regex
    expect(/^[\x00-\xFF]*$/.test(linea)).toBe(true);
  });
});
