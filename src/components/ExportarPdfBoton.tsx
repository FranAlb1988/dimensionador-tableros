import { useState, type RefObject } from 'react';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import type { ResultadoCcm } from '../logic/tablero';
import { fmtAmp, fmtMm } from '../util/format';
import { corrienteNominal } from '../logic/corriente';
import { desdeKw } from '../util/potencia';
import { tamanoEnXTexto } from '../util/x-blokset';
import type { UnidadPotencia } from '../types';
import { dibujarCajetinProyecto, sufijoArchivoProyecto } from '../util/pdf-cajetin';
import { ARRANQUE_LABEL } from '../store/ccm';

interface Props {
  svgRef: RefObject<SVGSVGElement | null>;
  resultado: ResultadoCcm;
}

const btnCls =
  'px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 ' +
  'hover:bg-slate-100 dark:hover:bg-slate-800';

/**
 * Exporta dos páginas a PDF:
 *  1. Vista frontal (SVG renderizado a vector con svg2pdf.js)
 *  2. BOM: tabla de cargas con protección, arrancador, gaveta
 */
export function ExportarPdfBoton({ svgRef, resultado }: Props) {
  const [exportando, setExportando] = useState(false);

  async function exportar() {
    if (!svgRef.current) return;
    try {
      setExportando(true);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      // pageWidth = 297, pageHeight = 210 mm
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // ----- Página 1: vista frontal -----
      doc.setFontSize(14);
      doc.text('Dimensionador CCM — Vista frontal', 14, 14);
      doc.setFontSize(9);
      doc.text(
        `Columnas: ${resultado.tablero.columnas.length}   Alto: ${fmtMm(resultado.tablero.altoTotalMm)}   Ancho: ${fmtMm(resultado.tablero.anchoTotalMm)}   Profundidad: ${fmtMm(resultado.tablero.profundidadTotalMm)}`,
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

      // ----- Página 2: BOM -----
      doc.addPage();
      doc.setFontSize(14);
      doc.text('Lista de cargas y referencias', 14, 14);

      doc.setFontSize(8);
      const filas: string[][] = [
        ['#', 'Descripción', 'Tipo', 'Potencia', 'I (A)', 'I prot.', 'Protección', 'Arrancador', 'Gaveta'],
        ...resultado.asignaciones.map((a, idx): string[] => {
          const I = corrienteNominal(a.carga);
          const u: UnidadPotencia = a.carga.unidadPotencia ?? 'HP';
          const pStr = a.carga.potenciaKw != null
            ? `${desdeKw(a.carga.potenciaKw, u).toFixed(1)} ${u}`
            : '—';
          return [
            String(idx + 1),
            a.carga.descripcion || a.carga.id,
            a.carga.tipo,
            pStr,
            I > 0 ? fmtAmp(I) : '—',
            a.carga.corrienteProteccionA ? `${a.carga.corrienteProteccionA} A` : '—',
            a.proteccion.referencia,
            a.arrancador
              ? `${ARRANQUE_LABEL[a.arrancador.tipo]} ${a.arrancador.contactor}${a.arrancador.releTermico ? '/' + a.arrancador.releTermico : ''}`
              : '—',
            tamanoEnXTexto(a.gaveta.tamano),
          ];
        }),
      ];

      const cols = [8, 52, 20, 22, 16, 16, 54, 54, 16];
      const rowH = 6;
      let y = 22;
      filas.forEach((row, i) => {
        let x = 14;
        if (i === 0) doc.setFont('helvetica', 'bold');
        else doc.setFont('helvetica', 'normal');
        row.forEach((cell, ci) => {
          const colW = cols[ci]!;
          doc.rect(x, y - rowH + 2, colW, rowH);
          doc.text(truncate(cell, ci === 1 || ci === 6 || ci === 7 ? 26 : 14), x + 1.5, y);
          x += colW;
        });
        y += rowH;
        if (y > pageHeight - 14) {
          doc.addPage();
          y = 22;
        }
      });

      const fecha = new Date().toISOString().slice(0, 10);
      doc.save(`ccm-dimensionado${sufijoArchivoProyecto()}-${fecha}.pdf`);
    } finally {
      setExportando(false);
    }
  }

  return (
    <button
      onClick={exportar}
      disabled={exportando || resultado.asignaciones.length === 0}
      className={`${btnCls} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {exportando ? 'Exportando…' : '⬇ Exportar PDF'}
    </button>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
