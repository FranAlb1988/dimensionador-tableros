import { useState, type RefObject } from 'react';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import type { ResultadoCcmNema } from '../logic/ccm-nema';
import { fmtAmp, fmtFactor, fmtMm } from '../util/format';
import { dibujarCajetinProyecto, sufijoArchivoProyecto } from '../util/pdf-cajetin';
import { CRITERIOS_CCM_NEMA, dibujarCriteriosSeleccion } from '../util/pdf-criterios';

interface Props {
  svgRef: RefObject<SVGSVGElement | null>;
  resultado: ResultadoCcmNema;
}

const btnCls =
  'px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 ' +
  'hover:bg-slate-100 dark:hover:bg-slate-800';

export function ExportarPdfCcmNemaBoton({ svgRef, resultado }: Props) {
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
      doc.text('Dimensionador CCM NEMA — Vista frontal', 14, 14);
      doc.setFontSize(9);
      const derrateoTxt = t.factorDerrateoAltura < 1
        ? `   Derrateo F2: ${fmtFactor(t.factorDerrateoAltura)} (selección ${fmtAmp(t.corrienteSeleccionBarraA)})`
        : '';
      doc.text(
        `Columnas: ${t.columnas.length}   Alto: ${fmtMm(t.altoTotalMm)}   Ancho: ${fmtMm(t.anchoTotalMm)}   FLC: ${fmtAmp(t.corrienteTotalA)}   Barra: ${t.barra.capacidadA} A${derrateoTxt}`,
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
      doc.text('Lista de cargas y referencias (NEMA)', 14, 14);
      doc.setFontSize(8);

      const filas: string[][] = [
        ['#', 'Descripción', 'Tipo', 'HP', 'FLA', 'Contactor', 'MCP/Frame', 'Rating', 'Espacios'],
        ...resultado.asignaciones.map((a, idx): string[] => {
          const m = a.motor;
          const b = a.breaker;
          return [
            String(idx + 1),
            a.carga.descripcion || a.carga.id,
            a.carga.tipo,
            m ? `${m.hp}` : '—',
            m?.flaA != null ? `${m.flaA}` : a.corrienteDisenoA.toFixed(1),
            m?.contactorSize != null ? `NEMA ${m.contactorSize}` : '—',
            m?.mcpFrameA != null ? `MCP ${m.mcpFrameA}` : b ? `${b.frameAF}AF` : '—',
            b ? b.rating : '—',
            `${a.espaciosX}X · ${a.version}`,
          ];
        }),
      ];

      const cols = [8, 56, 18, 14, 18, 26, 26, 24, 28];
      const rowH = 6;
      let y = 22;
      filas.forEach((row, i) => {
        let x = 14;
        if (i === 0) doc.setFont('helvetica', 'bold');
        else doc.setFont('helvetica', 'normal');
        row.forEach((cell, ci) => {
          const colW = cols[ci]!;
          doc.rect(x, y - rowH + 2, colW, rowH);
          doc.text(truncate(cell, ci === 1 ? 26 : 13), x + 1.5, y);
          x += colW;
        });
        y += rowH;
        if (y > pageHeight - 14) { doc.addPage(); y = 22; }
      });

      // ----- Criterios de selección (documenta márgenes y fórmulas) -----
      dibujarCriteriosSeleccion(doc, {
        y: y + 6,
        xInicio: 14,
        ancho: pageWidth - 28,
        pageHeight,
        lineas: CRITERIOS_CCM_NEMA,
        resultado,
      });

      const fecha = new Date().toISOString().slice(0, 10);
      doc.save(`ccm-nema${sufijoArchivoProyecto()}-${fecha}.pdf`);
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
