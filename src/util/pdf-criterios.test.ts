import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import {
  CRITERIOS_CCM_IEC,
  CRITERIOS_CCM_NEMA,
  CRITERIOS_CDC,
  dibujarCriteriosSeleccion,
} from './pdf-criterios';

describe('dibujarCriteriosSeleccion', () => {
  it('dibuja los criterios y devuelve una Y mayor a la inicial', () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const yFinal = dibujarCriteriosSeleccion(doc, {
      y: 30, xInicio: 14, ancho: 269, pageHeight: 210, lineas: CRITERIOS_CCM_IEC,
    });
    expect(yFinal).toBeGreaterThan(30);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('salta de página cuando no queda espacio', () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    dibujarCriteriosSeleccion(doc, {
      y: 200, xInicio: 14, ancho: 269, pageHeight: 210, lineas: CRITERIOS_CCM_NEMA,
    });
    expect(doc.getNumberOfPages()).toBe(2);
  });

  it('los criterios documentan el doble margen y las referencias normativas', () => {
    const texto = CRITERIOS_CCM_IEC.join(' ');
    expect(texto).toContain('doble margen');
    expect(texto).toContain('1,44');
    expect(texto).toContain('IEC 60947-4-1');
    expect(texto).toContain('NEC 430.52');
    expect(CRITERIOS_CCM_NEMA.join(' ')).toContain('E300');
  });

  it('los criterios del CDC documentan la coordinación con el trafo y la Icc', () => {
    const texto = CRITERIOS_CDC.join(' ');
    expect(texto).toContain('mayor consumidor');
    expect(texto).toContain('In del secundario');
    expect(texto).toContain('Icc de barra');
    expect(texto).toContain('IEC 61439');
  });

  it('usa solo glifos compatibles con WinAnsi (cp1252) de las fuentes estándar jsPDF', () => {
    const prohibidos = ['≥', '≤', '√', 'Σ', 'φ', 'η', '→', '↔'];
    for (const linea of [...CRITERIOS_CCM_IEC, ...CRITERIOS_CCM_NEMA, ...CRITERIOS_CDC]) {
      for (const g of prohibidos) {
        expect(linea.includes(g), `glifo no WinAnsi "${g}" en: ${linea}`).toBe(false);
      }
    }
  });
});
