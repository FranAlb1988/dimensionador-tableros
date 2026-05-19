import { useState, type RefObject } from 'react';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import type { ResultadoMt } from '../logic/mt';
import { TIPO_CELDA_MT_LABEL } from '../types';
import { fmtAmp, fmtMm } from '../util/format';
import { dibujarCajetinProyecto, sufijoArchivoProyecto } from '../util/pdf-cajetin';

interface Props {
  svgRef: RefObject<SVGSVGElement | null>;
  resultado: ResultadoMt;
}

const btnCls =
  'px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 ' +
  'hover:bg-slate-100 dark:hover:bg-slate-800';

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function ExportarPdfMtBoton({ svgRef, resultado }: Props) {
  const [exportando, setExportando] = useState(false);
  const t = resultado.tablero;

  async function exportar() {
    if (!svgRef.current || !t) return;
    try {
      setExportando(true);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFontSize(14);
      doc.text('Dimensionador Switchgear MT — Vista frontal', 14, 14);
      doc.setFontSize(9);
      doc.text(
        `Clase: ${t.claseTensionKv} kV   Icc: ${t.iccKa} kA   Barra: ${fmtAmp(t.corrienteBarraA)}   Celdas: ${t.celdas.length}   Ancho: ${fmtMm(t.anchoTotalMm)}`,
        14, 20,
      );

      const yTrasCajetin = dibujarCajetinProyecto(doc, { y: 24, xInicio: 14, ancho: pageWidth - 28 });

      const svg = svgRef.current;
      const vb = svg.viewBox.baseVal;
      const ratio = vb.height / vb.width;
      const margin = 14;
      const availW = pageWidth - 2 * margin;
      const availH = pageHeight - yTrasCajetin - 4;
      let drawW = availW;
      let drawH = availW * ratio;
      if (drawH > availH) { drawH = availH; drawW = availH / ratio; }
      const xPos = (pageWidth - drawW) / 2;
      await svg2pdf(svg, doc, { x: xPos, y: yTrasCajetin, width: drawW, height: drawH });

      doc.addPage();
      doc.setFontSize(14);
      doc.text('Lista de celdas (Switchgear MT)', 14, 14);
      doc.setFontSize(9);
      doc.text(`Barra principal: ${fmtAmp(t.corrienteBarraA)} · ${t.claseTensionKv} kV · ${t.iccKa} kA`, 14, 21);
      doc.text(`Dimensiones: ${fmtMm(t.anchoTotalMm)} (ancho) × ${fmtMm(t.altoTotalMm)} (alto) × ${fmtMm(t.profundidadTotalMm)} (fondo)`, 14, 27);

      doc.setFontSize(8);
      const filas: string[][] = [
        ['#', 'Descripción', 'Tipo', 'I diseño (A)', 'Ancho (mm)'],
        ...t.celdas.map((c, idx): string[] => [
          String(idx + 1),
          c.salida.descripcion || c.salida.id,
          TIPO_CELDA_MT_LABEL[c.salida.tipoCelda],
          c.corrienteA.toFixed(0),
          String(c.anchoMm),
        ]),
      ];

      const cols = [10, 90, 40, 30, 26];
      const rowH = 6;
      let y = 36;
      filas.forEach((row, i) => {
        let x = 14;
        doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
        row.forEach((cell, ci) => {
          const colW = cols[ci]!;
          doc.rect(x, y - rowH + 2, colW, rowH);
          doc.text(truncate(cell, ci === 1 ? 42 : 18), x + 1.5, y);
          x += colW;
        });
        y += rowH;
        if (y > pageHeight - 14) { doc.addPage(); y = 22; }
      });

      const fecha = new Date().toISOString().slice(0, 10);
      doc.save(`switchgear-mt${sufijoArchivoProyecto()}-${fecha}.pdf`);
    } finally {
      setExportando(false);
    }
  }

  return (
    <button onClick={exportar} disabled={exportando || !t}
      className={`${btnCls} disabled:opacity-50 disabled:cursor-not-allowed`}>
      {exportando ? 'Exportando…' : '⬇ Exportar PDF'}
    </button>
  );
}
