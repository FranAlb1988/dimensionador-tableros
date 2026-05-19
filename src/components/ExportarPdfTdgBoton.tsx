import { useState, type RefObject } from 'react';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import type { ResultadoTdg } from '../logic/tdg';
import { fmtAmp, fmtMm } from '../util/format';
import { corrienteNominal } from '../logic/corriente';

import type { SubtipoTdg } from '../store/tdg';
import { dibujarCajetinProyecto, sufijoArchivoProyecto } from '../util/pdf-cajetin';

interface Props {
  svgRef: RefObject<SVGSVGElement | null>;
  resultado: ResultadoTdg;
  subtipo?: SubtipoTdg;
}

const btnCls =
  'px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 ' +
  'hover:bg-slate-100 dark:hover:bg-slate-800';

/**
 * Exporta el TDG a PDF:
 *  1. Página vista frontal (vector)
 *  2. Página BOM con principal, barra y salidas
 */
export function ExportarPdfTdgBoton({ svgRef, resultado, subtipo = 'general' }: Props) {
  const [exportando, setExportando] = useState(false);
  const t = resultado.tablero;
  const tituloPdf = subtipo === 'fuerza'
    ? 'Tablero de fuerza — Vista frontal'
    : 'Dimensionador TDG — Vista frontal';
  const prefijoArchivo = subtipo === 'fuerza' ? 'fuerza' : 'tdg';

  async function exportar() {
    if (!svgRef.current || !t) return;
    try {
      setExportando(true);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFontSize(14);
      doc.text(tituloPdf, 14, 14);
      doc.setFontSize(9);
      doc.text(
        `Columnas: ${t.columnas}   Alto: ${fmtMm(t.altoTotalMm)}   Ancho: ${fmtMm(t.anchoTotalMm)}   I total: ${fmtAmp(t.corrienteTotalA)}   Fs: ${(t.factorSimultaneidad * 100).toFixed(0)} %`,
        14,
        20,
      );

      const yTrasCajetin = dibujarCajetinProyecto(doc, { y: 24, xInicio: 14, ancho: pageWidth - 28 });

      const svg = svgRef.current;
      const vb = svg.viewBox.baseVal;
      const svgRatio = vb.height / vb.width;
      const margin = 14;
      const availW = pageWidth - 2 * margin;
      const availH = pageHeight - yTrasCajetin - 4;
      let drawW = availW;
      let drawH = availW * svgRatio;
      if (drawH > availH) {
        drawH = availH;
        drawW = availH / svgRatio;
      }
      const xPos = (pageWidth - drawW) / 2;
      const yPos = yTrasCajetin;

      await svg2pdf(svg, doc, { x: xPos, y: yPos, width: drawW, height: drawH });

      doc.addPage();
      doc.setFontSize(14);
      doc.text('Lista de salidas y referencias', 14, 14);
      doc.setFontSize(9);
      doc.text(
        `Principal: ${t.principal.referencia} (${fmtAmp(t.principal.inA)}, Icu ${t.principal.icuKA} kA)`,
        14, 21,
      );
      doc.text(
        `Barras: ${t.barra.referencia} (${fmtAmp(t.barra.inA)}, ${t.barra.seccionMm2} mm²)`,
        14, 27,
      );

      doc.setFontSize(8);
      const filas: string[][] = [
        ['#', 'Descripción', 'Tipo', 'P (kW)', 'In carga (A)', 'I diseño (A)', 'Protección', 'Familia'],
        ...t.salidas.map((s, idx): string[] => {
          const I = corrienteNominal(s.carga);
          return [
            String(idx + 1),
            s.carga.descripcion || s.carga.id,
            s.carga.tipo,
            s.carga.potenciaKw != null ? s.carga.potenciaKw.toFixed(1) : '—',
            I > 0 ? I.toFixed(1) : '—',
            s.corrienteDisenoA.toFixed(1),
            s.proteccion.referencia,
            s.proteccion.familia,
          ];
        }),
      ];

      const cols = [10, 60, 22, 18, 22, 22, 60, 24];
      const rowH = 6;
      let y = 36;
      filas.forEach((row, i) => {
        let x = 14;
        if (i === 0) doc.setFont('helvetica', 'bold');
        else doc.setFont('helvetica', 'normal');
        row.forEach((cell, ci) => {
          const colW = cols[ci]!;
          doc.rect(x, y - rowH + 2, colW, rowH);
          doc.text(truncate(cell, ci === 1 || ci === 6 ? 28 : 14), x + 1.5, y);
          x += colW;
        });
        y += rowH;
        if (y > pageHeight - 14) {
          doc.addPage();
          y = 22;
        }
      });

      const fecha = new Date().toISOString().slice(0, 10);
      doc.save(`${prefijoArchivo}-dimensionado${sufijoArchivoProyecto()}-${fecha}.pdf`);
    } finally {
      setExportando(false);
    }
  }

  return (
    <button
      onClick={exportar}
      disabled={exportando || !t}
      className={`${btnCls} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {exportando ? 'Exportando…' : '⬇ Exportar PDF'}
    </button>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
