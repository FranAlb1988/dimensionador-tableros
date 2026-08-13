import { describe, expect, it } from 'vitest';
import type { jsPDF } from 'jspdf';
import { CRITERIOS_CCM_IEC, dibujarCriteriosSeleccion } from './pdf-criterios';

/**
 * Doble de jsPDF que registra lo dibujado. Alcanza para comprobar el
 * contenido: lo que importa es que la advertencia salga en la memoria, no
 * cómo se ve.
 */
function docFalso() {
  const textos: string[] = [];
  const colores: [number, number, number][] = [];
  const doc = {
    setFont: () => {},
    setFontSize: () => {},
    setTextColor: (r: number, g: number, b: number) => { colores.push([r, g, b]); },
    addPage: () => {},
    splitTextToSize: (t: string) => [t],
    text: (t: string | string[]) => { textos.push(...(Array.isArray(t) ? t : [t])); },
  };
  return { doc: doc as unknown as jsPDF, textos, colores };
}

const opciones = { y: 20, xInicio: 14, ancho: 180, pageHeight: 297 };

describe('advertencia de placeholders en la memoria PDF', () => {
  it('la dibuja cuando el resultado trae selecciones sin verificar', () => {
    const { doc, textos } = docFalso();
    dibujarCriteriosSeleccion(doc, {
      ...opciones,
      lineas: CRITERIOS_CCM_IEC,
      resultado: {
        asignaciones: [{ proteccion: { referencia: 'XT2N160', placeholder: true } }],
      },
    });
    const aviso = textos.find((t) => t.includes('placeholder'));
    expect(aviso).toBeDefined();
    expect(aviso).toContain('XT2N160');
    expect(aviso).toContain('no deben llevarse a plano');
  });

  it('va primero, antes de los criterios, para que no se pase por alto', () => {
    const { doc, textos } = docFalso();
    dibujarCriteriosSeleccion(doc, {
      ...opciones,
      lineas: CRITERIOS_CCM_IEC,
      resultado: { p: { referencia: 'X', placeholder: true } },
    });
    const iAviso = textos.findIndex((t) => t.includes('placeholder'));
    const iPrimerCriterio = textos.findIndex((t) => t.includes('Corriente de diseño'));
    expect(iAviso).toBeGreaterThan(-1);
    expect(iAviso).toBeLessThan(iPrimerCriterio);
  });

  it('la pinta en rojo y devuelve el color al negro', () => {
    const { doc, colores } = docFalso();
    dibujarCriteriosSeleccion(doc, {
      ...opciones,
      lineas: CRITERIOS_CCM_IEC,
      resultado: { p: { referencia: 'X', placeholder: true } },
    });
    expect(colores[0]).toEqual([180, 30, 30]);
    expect(colores[colores.length - 1]).toEqual([0, 0, 0]);
  });

  it('no ensucia una memoria que sí está toda verificada', () => {
    const { doc, textos, colores } = docFalso();
    dibujarCriteriosSeleccion(doc, {
      ...opciones,
      lineas: CRITERIOS_CCM_IEC,
      resultado: { asignaciones: [{ proteccion: { referencia: 'NSX100F' } }] },
    });
    expect(textos.some((t) => t.includes('placeholder'))).toBe(false);
    expect(colores).toHaveLength(0);
  });

  it('sin resultado se comporta como antes', () => {
    const { doc, textos } = docFalso();
    dibujarCriteriosSeleccion(doc, { ...opciones, lineas: CRITERIOS_CCM_IEC });
    expect(textos.some((t) => t.includes('placeholder'))).toBe(false);
    expect(textos.length).toBeGreaterThan(CRITERIOS_CCM_IEC.length);
  });
});
