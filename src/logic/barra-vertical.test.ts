import { describe, expect, it } from 'vitest';
import {
  BARRAS_VERTICALES,
  STAB_MAX_A,
  sugerirBarraVertical,
  verificarBarraVertical,
  type UnidadColumna,
} from './barra-vertical';

const u = (id: string, corrienteA: number, espaciosX = 2): UnidadColumna =>
  ({ id, descripcion: `carga ${id}`, corrienteA, espaciosX });

describe('catálogo de barra vertical CENTERLINE 2100', () => {
  it('publica las dos capacidades y su reparto por mitad', () => {
    expect(BARRAS_VERTICALES).toHaveLength(2);
    expect(BARRAS_VERTICALES[0]!.efectivaA).toBe(600);
    expect(BARRAS_VERTICALES[0]!.porMitadA).toBe(300);
    expect(BARRAS_VERTICALES[1]!.efectivaA).toBe(1200);
    expect(BARRAS_VERTICALES[1]!.porMitadA).toBe(600);
  });

  it('la capacidad efectiva es el doble de cada mitad', () => {
    for (const b of BARRAS_VERTICALES) {
      expect(b.efectivaA).toBe(b.porMitadA * 2);
    }
  });

  it('el stab limita cada unidad plug-in a 225 A', () => {
    expect(STAB_MAX_A).toBe(225);
  });
});

describe('verificarBarraVertical', () => {
  it('reparte las unidades entre mitades por orden de montaje', () => {
    // 12X de alto útil: la mitad son 6X, así que las tres primeras unidades de
    // 2X quedan arriba y las tres siguientes abajo.
    const v = verificarBarraVertical(
      [u('1', 100), u('2', 100), u('3', 100), u('4', 50), u('5', 50), u('6', 50)], 12,
    );
    expect(v.corrienteMitadSuperiorA).toBe(300);
    expect(v.corrienteMitadInferiorA).toBe(150);
    expect(v.corrienteTotalA).toBe(450);
  });

  it('una columna con el total dentro pero mal repartida no cumple', () => {
    // Es el punto del reparto 300/300: 500 A arriba y 100 abajo suman 600,
    // que cabe en la barra de 600 A efectivos, pero la mitad superior no.
    const v = verificarBarraVertical(
      [u('1', 250), u('2', 250), u('3', 50), u('4', 50)], 12,
    );
    expect(v.corrienteTotalA).toBe(600);
    expect(v.excedeTotal).toBe(false);
    expect(v.excedeMitad).toBe(true);
  });

  it('una columna equilibrada al límite cumple', () => {
    // 4 unidades de 2X en una columna de 8X: dos arriba y dos abajo.
    const v = verificarBarraVertical(
      [u('1', 150), u('2', 150), u('3', 150), u('4', 150)], 8,
    );
    expect(v.corrienteMitadSuperiorA).toBe(300);
    expect(v.corrienteMitadInferiorA).toBe(300);
    expect(v.excedeMitad).toBe(false);
    expect(v.usoMitadPct).toBe(100);
  });

  it('detecta las unidades que superan el stab', () => {
    const v = verificarBarraVertical([u('1', 100), u('2', 260), u('3', 240)], 12);
    expect(v.sobreStab.map((x) => x.id)).toEqual(['2', '3']);
  });

  it('sin unidades no hay corriente ni excesos', () => {
    const v = verificarBarraVertical([], 12);
    expect(v.corrienteTotalA).toBe(0);
    expect(v.excedeMitad).toBe(false);
    expect(v.sobreStab).toHaveLength(0);
  });

  it('una unidad que ocupa toda la columna cuenta en la mitad superior', () => {
    const v = verificarBarraVertical([u('1', 200, 12)], 12);
    expect(v.corrienteMitadSuperiorA).toBe(200);
    expect(v.corrienteMitadInferiorA).toBe(0);
  });
});

describe('sugerirBarraVertical', () => {
  it('elige la barra de 600 A cuando alcanza', () => {
    const b = sugerirBarraVertical([u('1', 150), u('2', 150), u('3', 150), u('4', 150)], 8)!;
    expect(b.efectivaA).toBe(600);
  });

  it('sube a 1200 A cuando la de 600 no da', () => {
    // 440 A por mitad: supera los 300 de la barra de 600 y cabe en los 600 de
    // la de 1200.
    const b = sugerirBarraVertical(
      [u('1', 220), u('2', 220), u('3', 220), u('4', 220)], 8,
    )!;
    expect(b.efectivaA).toBe(1200);
  });

  it('devuelve undefined cuando ni la mayor alcanza', () => {
    const enorme = Array.from({ length: 6 }, (_, i) => u(String(i), 220, 2));
    // 3 unidades de 220 A por mitad = 660 A > 600 A de la mitad mayor.
    expect(sugerirBarraVertical(enorme, 12)).toBeUndefined();
  });
});
