import { useState, type RefObject } from 'react';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import type { ResultadoTdgNema } from '../logic/tdg-nema';
import { fmtAmp, fmtMm } from '../util/format';

import type { SubtipoTdg } from '../store/tdg';
import { dibujarCajetinProyecto, sufijoArchivoProyecto } from '../util/pdf-cajetin';

interface Props {
  svgRef: RefObject<SVGSVGElement | null>;
  resultado: ResultadoTdgNema;
  subtipo?: SubtipoTdg;
}

const btnCls =
  'px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 ' +
  'hover:bg-slate-100 dark:hover:bg-slate-800';

export function ExportarPdfTdgNemaBoton({ svgRef, resultado, subtipo = 'general' }: Props) {
  const [exportando, setExportando] = useState(false);
  const t = resultado.tablero;
  const tituloPdf = subtipo === 'fuerza'
    ? 'Tablero de fuerza NEMA — Vista frontal'
    : 'Dimensionador TDG NEMA — Vista frontal';
  const prefijoArchivo = subtipo === 'fuerza' ? 'fuerza-nema' : 'tdg-nema';

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
        `Columnas: ${t.columnas}   Alto: ${fmtMm(t.altoTotalMm)}   Ancho: ${fmtMm(t.anchoTotalMm)}   FLC total: ${fmtAmp(t.corrienteTotalA)}   Fs: ${(t.factorSimultaneidad * 100).toFixed(0)} %`,
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
      doc.text('Lista de salidas y referencias (TDG NEMA)', 14, 14);
      doc.setFontSize(9);
      doc.text(`Principal: ${t.principal.frameAF}AF · ${t.principal.rating} (${fmtAmp(t.principal.ratingA)})`, 14, 21);
      doc.text(`Barra: ${t.barra.frameAF}AF (rango FLC ${t.barra.flcMin}-${t.barra.flcMax} A)`, 14, 27);

      doc.setFontSize(8);
      const filas: string[][] = [
        ['#', 'Descripción', 'Tipo', 'P (kW)', 'I diseño (A)', 'Frame', 'Rating'],
        ...t.salidas.map((s, idx): string[] => [
          String(idx + 1),
          s.carga.descripcion || s.carga.id,
          s.carga.tipo,
          s.carga.potenciaKw != null ? s.carga.potenciaKw.toFixed(1) : '—',
          s.corrienteDisenoA.toFixed(1),
          `${s.breaker.frameAF}AF`,
          s.breaker.rating,
        ]),
      ];

      const cols = [10, 70, 22, 22, 26, 26, 26];
      const rowH = 6;
      let y = 36;
      filas.forEach((row, i) => {
        let x = 14;
        if (i === 0) doc.setFont('helvetica', 'bold');
        else doc.setFont('helvetica', 'normal');
        row.forEach((cell, ci) => {
          const colW = cols[ci]!;
          doc.rect(x, y - rowH + 2, colW, rowH);
          doc.text(truncate(cell, ci === 1 ? 32 : 14), x + 1.5, y);
          x += colW;
        });
        y += rowH;
        if (y > pageHeight - 14) { doc.addPage(); y = 22; }
      });

      const fecha = new Date().toISOString().slice(0, 10);
      doc.save(`${prefijoArchivo}${sufijoArchivoProyecto()}-${fecha}.pdf`);
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

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
