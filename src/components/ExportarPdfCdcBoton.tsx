import { useState, type RefObject } from 'react';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import type { ResultadoCdc } from '../logic/cdc';
import { fmtAmp, fmtMm } from '../util/format';
import { corrienteNominal } from '../logic/corriente';
import type { SubtipoCdc } from '../store/cdc';
import { dibujarCajetinProyecto, sufijoArchivoProyecto } from '../util/pdf-cajetin';

interface Props {
  svgRef: RefObject<SVGSVGElement | null>;
  resultado: ResultadoCdc;
  subtipo?: SubtipoCdc;
}

const btnCls =
  'px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 ' +
  'hover:bg-slate-100 dark:hover:bg-slate-800';

export function ExportarPdfCdcBoton({ svgRef, resultado, subtipo = 'general' }: Props) {
  const [exportando, setExportando] = useState(false);
  const t = resultado.tablero;
  const tituloPdf = subtipo === 'alumbrado'
    ? 'Tablero de alumbrado — Vista frontal'
    : 'Dimensionador CDC — Vista frontal';
  const prefijoArchivo = subtipo === 'alumbrado' ? 'alumbrado' : 'cdc';

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
        `Cofres: ${t.cofres.length}   Circuitos: ${t.totalAsignaciones}   Módulos: ${t.totalModulos}   Alto: ${fmtMm(t.altoTotalMm)}   Ancho: ${fmtMm(t.anchoTotalMm)}`,
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
      doc.text('Lista de circuitos y protecciones (CDC)', 14, 14);
      doc.setFontSize(8);

      const filas: string[][] = [
        ['#', 'Descripción', 'Tipo', 'P (kW)', 'V', 'Φ', 'I (A)', 'Protección', 'Mód.'],
        ...resultado.asignaciones.map((a, idx): string[] => {
          const I = corrienteNominal(a.carga);
          return [
            String(idx + 1),
            a.carga.descripcion || a.carga.id,
            a.carga.tipo,
            a.carga.potenciaKw != null ? a.carga.potenciaKw.toFixed(2) : '—',
            String(a.carga.tensionV),
            a.carga.fases,
            I > 0 ? fmtAmp(I) : '—',
            a.proteccion.referencia,
            String(a.modulosDin),
          ];
        }),
      ];

      const cols = [8, 70, 22, 18, 14, 12, 18, 60, 14];
      const rowH = 6;
      let y = 22;
      filas.forEach((row, i) => {
        let x = 14;
        if (i === 0) doc.setFont('helvetica', 'bold');
        else doc.setFont('helvetica', 'normal');
        row.forEach((cell, ci) => {
          const colW = cols[ci]!;
          doc.rect(x, y - rowH + 2, colW, rowH);
          doc.text(truncate(cell, ci === 1 || ci === 7 ? 32 : 12), x + 1.5, y);
          x += colW;
        });
        y += rowH;
        if (y > pageHeight - 14) { doc.addPage(); y = 22; }
      });

      const fecha = new Date().toISOString().slice(0, 10);
      doc.save(`${prefijoArchivo}-dimensionado${sufijoArchivoProyecto()}-${fecha}.pdf`);
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
