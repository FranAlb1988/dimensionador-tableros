import { describe, expect, it } from 'vitest';
import { autoMapear } from './auto-mapeo';
import {
  parsearArranque,
  parsearFases,
  parsearNumero,
  parsearTipo,
  parsearUnidadPotencia,
} from './normalizar';
import { construirCandidatas } from './index';
import { construirHoja, detectarFilaHeader } from './excel';
import { VALORES_GLOBALES_DEFAULT, type HojaArchivo } from './types';

describe('normalizadores', () => {
  it('parsearUnidadPotencia detecta HP y kW en headers', () => {
    expect(parsearUnidadPotencia('Potencia (HP)')).toBe('HP');
    expect(parsearUnidadPotencia('P (kW)')).toBe('kW');
    expect(parsearUnidadPotencia('Potencia')).toBeUndefined();
  });

  it('parsearTipo reconoce MCP, VDF como motor', () => {
    expect(parsearTipo('MCP', 'otro')).toBe('motor');
    expect(parsearTipo('VDF', 'otro')).toBe('motor');
    expect(parsearTipo('VFD', 'otro')).toBe('motor');
    expect(parsearTipo('iluminación', 'otro')).toBe('iluminacion');
    expect(parsearTipo('tomas corrientes', 'otro')).toBe('tomas');
    expect(parsearTipo('', 'motor')).toBe('motor');
    expect(parsearTipo('desconocido', 'otro')).toBe('otro');
  });

  it('parsearArranque mapea MCP→DOL, VDF→variador, ATS→suave', () => {
    expect(parsearArranque('MCP')).toBe('DOL');
    expect(parsearArranque('VDF')).toBe('variador');
    expect(parsearArranque('VFD')).toBe('variador');
    expect(parsearArranque('ATS')).toBe('suave');
    expect(parsearArranque('Y-Δ')).toBe('YD');
    expect(parsearArranque('Estrella-Triangulo')).toBe('YD');
    expect(parsearArranque('')).toBeUndefined();
  });

  it('parsearArranque acepta también las nuevas etiquetas Partida Directa / PSV / VSD', () => {
    expect(parsearArranque('Partida Directa')).toBe('DOL');
    expect(parsearArranque('partida directa')).toBe('DOL');
    expect(parsearArranque('PSV')).toBe('suave');
    expect(parsearArranque('psv')).toBe('suave');
    expect(parsearArranque('VSD')).toBe('variador');
    expect(parsearArranque('vsd')).toBe('variador');
  });

  it('parsearArranque no confunde "Partida VSD/suave/YD" con partida directa', () => {
    // La planilla de unilineales rotula las salidas con el prefijo "Partida",
    // así que la tecnología concreta debe ganarle al genérico → DOL.
    expect(parsearArranque('Partida VSD')).toBe('variador');
    expect(parsearArranque('Partida VSD Reserva')).toBe('variador');
    expect(parsearArranque('Partida suave')).toBe('suave');
    expect(parsearArranque('Partida estrella-triangulo')).toBe('YD');
    // y las variantes de partida directa siguen siendo DOL
    expect(parsearArranque('Partida Directa')).toBe('DOL');
    expect(parsearArranque('Partida Directa Reversible')).toBe('DOL');
    expect(parsearArranque('Partida Directa Reserva')).toBe('DOL');
  });

  it('parsearFases reconoce 3F, III, trifásico', () => {
    expect(parsearFases('3F', '1F')).toBe('3F');
    expect(parsearFases('III', '1F')).toBe('3F');
    expect(parsearFases('trifasica', '1F')).toBe('3F');
    expect(parsearFases('1F', '3F')).toBe('1F');
    expect(parsearFases('monofasico', '3F')).toBe('1F');
    expect(parsearFases('', '3F')).toBe('3F');
  });

  it('parsearNumero tolera coma decimal y unidades', () => {
    expect(parsearNumero('7,5 HP')).toBe(7.5);
    expect(parsearNumero('100')).toBe(100);
    expect(parsearNumero(25)).toBe(25);
    expect(parsearNumero('')).toBeUndefined();
    expect(parsearNumero('abc')).toBeUndefined();
  });
});

describe('autoMapear', () => {
  it('detecta columnas típicas de una extracción AutoCAD', () => {
    const m = autoMapear(['TAG', 'DESCRIPCIÓN', 'HP', 'PARTIDOR', 'V', 'FASES']);
    expect(m.tag).toBe('TAG');
    expect(m.descripcion).toBe('DESCRIPCIÓN');
    expect(m.potencia).toBe('HP');
    expect(m.arranque).toBe('PARTIDOR');
    expect(m.tensionV).toBe('V');
    expect(m.fases).toBe('FASES');
  });

  it('detecta las columnas de la planilla de unilineales (HQR)', () => {
    const m = autoMapear([
      'N° Nodo', 'No Plano', 'Tipo de salida', 'Tag Motor', 'Descripción 1',
      'Descripción  2', 'Tag Equipo', 'Tag VSD', 'Potencia kW', 'Nema', 'MCP',
    ]);
    expect(m.tag).toBe('Tag Motor');
    expect(m.descripcion).toBe('Descripción 1');
    expect(m.potencia).toBe('Potencia kW');
    expect(m.arranque).toBe('Tipo de salida');
  });

  it('detecta variantes en inglés', () => {
    const m = autoMapear(['Tag ID', 'Service', 'Power (kW)', 'Starter', 'Voltage', 'Phases']);
    expect(m.tag).toBe('Tag ID');
    expect(m.descripcion).toBe('Service');
    expect(m.potencia).toBe('Power (kW)');
    expect(m.arranque).toBe('Starter');
    expect(m.tensionV).toBe('Voltage');
    expect(m.fases).toBe('Phases');
  });

  it('respeta sin colisión: si solo hay HP, no mapea Power al tag', () => {
    const m = autoMapear(['Tag', 'HP']);
    expect(m.tag).toBe('Tag');
    expect(m.potencia).toBe('HP');
    expect(m.descripcion).toBeUndefined();
  });

  it('ignora Count y Name que agrega AutoCAD DATAEXTRACTION', () => {
    // Salida típica de DATAEXTRACTION sobre bloques de motor con atributos.
    const m = autoMapear(['Count', 'Name', 'TAG', 'DESCRIPCION', 'HP', 'PARTIDOR', 'TENSION', 'FASES']);
    expect(m.tag).toBe('TAG');
    expect(m.descripcion).toBe('DESCRIPCION');
    expect(m.potencia).toBe('HP');
    expect(m.arranque).toBe('PARTIDOR');
    expect(m.tensionV).toBe('TENSION');
    expect(m.fases).toBe('FASES');
    // Count y Name no deben aparecer como ningún campo.
    expect(Object.values(m)).not.toContain('Count');
    expect(Object.values(m)).not.toContain('Name');
  });
});

describe('construirCandidatas — flujo end-to-end', () => {
  const hojaConTag: HojaArchivo = {
    nombre: 'CCM',
    headers: ['TAG', 'DESCRIPCIÓN', 'HP', 'PARTIDOR'],
    filas: [
      { TAG: 'EM-001', DESCRIPCIÓN: 'BOMBA AGITADOR', HP: 60, PARTIDOR: 'MCP' },
      { TAG: 'VFD-002', DESCRIPCIÓN: 'BOMBA RECUPERACIÓN', HP: 40, PARTIDOR: 'VDF' },
      { TAG: 'EM-003', DESCRIPCIÓN: 'BOMBA DOSIFICACIÓN', HP: 0.5, PARTIDOR: 'MCP' },
    ],
  };

  it('mapea cargas con TAG + DESCRIPCIÓN, HP detectado como unidad', () => {
    const map = autoMapear(hojaConTag.headers);
    const cs = construirCandidatas(hojaConTag, map, VALORES_GLOBALES_DEFAULT);
    expect(cs).toHaveLength(3);
    const c1 = cs[0]!;
    expect(c1.descripcion).toContain('EM-001');
    expect(c1.descripcion).toContain('BOMBA AGITADOR');
    expect(c1.tipo).toBe('motor');
    expect(c1.arranque).toBe('DOL'); // MCP → DOL
    expect(c1.unidadPotencia).toBe('HP'); // detectado desde header
    expect(c1.potenciaKw).toBeCloseTo(60 * 0.7457, 3);
    const c2 = cs[1]!;
    expect(c2.arranque).toBe('variador'); // VDF → variador
    const c3 = cs[2]!;
    expect(c3.potenciaKw).toBeCloseTo(0.5 * 0.7457, 4);
  });

  it('marca warning cuando faltan datos esenciales', () => {
    const hoja: HojaArchivo = {
      nombre: 'X',
      headers: ['TAG', 'HP'],
      filas: [{ TAG: '', HP: '' }],
    };
    const cs = construirCandidatas(hoja, autoMapear(hoja.headers), VALORES_GLOBALES_DEFAULT);
    expect(cs[0]!.warnings.length).toBeGreaterThan(0);
    expect(cs[0]!.incluir).toBe(false);
  });

  it('si la celda de potencia trae unidad explícita, prevalece sobre el header', () => {
    const hoja: HojaArchivo = {
      nombre: 'X',
      headers: ['Potencia'],
      filas: [{ Potencia: '15 kW' }],
    };
    const map = autoMapear(hoja.headers);
    const cs = construirCandidatas(hoja, map, { ...VALORES_GLOBALES_DEFAULT, unidadPotencia: 'HP' });
    expect(cs[0]!.unidadPotencia).toBe('kW');
    expect(cs[0]!.potenciaKw).toBe(15);
  });
});

describe('detectarFilaHeader', () => {
  // Reproduce la estructura real de la planilla de unilineales: titulo arriba,
  // parametros del proyecto, y la tabla de equipos recien en la fila 29.
  function matrizPlanilla(): unknown[][] {
    const m: unknown[][] = [];
    m.push([]);                                             // fila 1 vacia
    m.push(['', 'PLANILLA UNILINEAL CMP V1.0']);            // fila 2: titulo
    m.push([]); m.push([]);
    m.push([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);            // fila 5: indices
    while (m.length < 28) m.push([]);
    m.push(['', 'N° Nodo', 'No Plano', 'Tipo de salida', 'Tag Motor',
            'Descripción 1', 'Descripción  2', 'Tag Equipo', 'Potencia kW']); // fila 29
    m.push(['', '', '', '', 'TAG_MOTOR', 'DESC_1', 'DESC_2', 'TAG_EQUIP', 'K_W']); // fila 30
    m.push(['', 1, 1, 'Partida Directa', '5767-MTR-3416', 'BOMBA', 'AGUA', '5767-TEC-3520', 7.5]);
    m.push(['', 2, 1, 'Partida VSD', '5767-MTR-3419', 'BOMBA', 'ACEITE', '5767-TEC-3523', 15]);
    return m;
  }

  it('encuentra la fila de encabezados aunque no sea la primera con contenido', () => {
    const m = matrizPlanilla();
    // indice 0-based: la fila 29 de Excel es el indice 28
    expect(detectarFilaHeader(m)).toBe(28);
  });

  it('no se queda con el titulo del proyecto', () => {
    const m = matrizPlanilla();
    expect(detectarFilaHeader(m)).not.toBe(1);
  });

  it('sigue funcionando con archivos normales (encabezados en la primera fila)', () => {
    const m: unknown[][] = [
      ['TAG', 'DESCRIPCIÓN', 'HP', 'PARTIDOR', 'V'],
      ['M-01', 'Bomba', 10, 'MCP', 400],
    ];
    expect(detectarFilaHeader(m)).toBe(0);
  });

  it('construirHoja arma los datos desde la fila indicada', () => {
    const m = matrizPlanilla();
    const hoja = construirHoja('Principal', m, detectarFilaHeader(m));
    expect(hoja.filaHeader).toBe(28);
    expect(hoja.headers).toContain('Tipo de salida');
    expect(hoja.headers).toContain('Potencia kW');
    // fila 30 (nombres de atributo) + las 2 de datos
    expect(hoja.filas).toHaveLength(3);
    const ultima = hoja.filas[2]!;
    expect(ultima['Tipo de salida']).toBe('Partida VSD');
    expect(ultima['Potencia kW']).toBe(15);
  });

  it('el auto-mapeo sobre la hoja detectada reconoce las columnas de la planilla', () => {
    const m = matrizPlanilla();
    const hoja = construirHoja('Principal', m, detectarFilaHeader(m));
    const mapa = autoMapear(hoja.headers);
    expect(mapa.tag).toBe('Tag Motor');
    expect(mapa.arranque).toBe('Tipo de salida');
    expect(mapa.potencia).toBe('Potencia kW');
    expect(mapa.descripcion).toBe('Descripción 1');
  });
});
