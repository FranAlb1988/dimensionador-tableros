import { useState } from 'react';
import { jsPDF } from 'jspdf';
import type { CategoriaAuxiliar, EquipoAuxiliar } from '../types';
import { CATEGORIAS, CATEGORIAS_LABEL, COLUMNAS_POR_CATEGORIA, useAuxiliaresStore } from '../store/auxiliares';
import { dibujarCajetinProyecto, sufijoArchivoProyecto } from '../util/pdf-cajetin';

const btnCls =
  'px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 ' +
  'hover:bg-slate-100 dark:hover:bg-slate-800';

interface Props {
  /** Si se pasa, exporta solo esa categoría. Si no, exporta todas. */
  soloCategoria?: CategoriaAuxiliar;
}

/**
 * PDF con la lista de equipos auxiliares. Si se pasa una categoría, solo esa;
 * si no, una sección por cada categoría no vacía.
 */
export function ExportarPdfAuxiliaresBoton({ soloCategoria }: Props) {
  const [exportando, setExportando] = useState(false);
  const equipos = useAuxiliaresStore((s) => s.equipos);

  const categoriasAExportar: CategoriaAuxiliar[] = soloCategoria
    ? [soloCategoria]
    : CATEGORIAS.filter((c) => equipos.some((e) => e.categoria === c));

  const sinDatos = categoriasAExportar.every((c) => !equipos.some((e) => e.categoria === c));

  function exportar() {
    if (sinDatos) return;
    try {
      setExportando(true);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      doc.setFontSize(14);
      doc.text(
        soloCategoria
          ? `Equipos auxiliares — ${CATEGORIAS_LABEL[soloCategoria]}`
          : 'Equipos auxiliares — Inventario del proyecto',
        14, 14,
      );
      doc.setFontSize(9);
      doc.text(new Date().toISOString().slice(0, 10), pageW - 14, 14, { align: 'right' });

      let y = dibujarCajetinProyecto(doc, { y: 20, xInicio: 14, ancho: pageW - 28 });
      if (y === 20) y = 24; // sin cajetín, recupera espaciado
      doc.setFontSize(8);

      categoriasAExportar.forEach((cat, idx) => {
        const items = equipos.filter((e) => e.categoria === cat);
        if (items.length === 0) return;

        if (idx > 0) {
          y += 4;
          if (y > pageH - 30) { doc.addPage(); y = 22; }
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(CATEGORIAS_LABEL[cat], 14, y);
        y += 5;

        const cols = COLUMNAS_POR_CATEGORIA[cat];
        const colMm = repartirAnchos(cols.length, pageW - 28);
        const rowH = 6;

        doc.setFontSize(8);
        // Header
        let x = 14;
        doc.setFont('helvetica', 'bold');
        cols.forEach((c, ci) => {
          const w = colMm[ci]!;
          doc.rect(x, y - rowH + 2, w, rowH);
          doc.text(truncate(c.label, charsParaAncho(w)), x + 1.5, y);
          x += w;
        });
        y += rowH;
        doc.setFont('helvetica', 'normal');

        // Filas
        items.forEach((e) => {
          x = 14;
          cols.forEach((c, ci) => {
            const w = colMm[ci]!;
            const raw = e[c.campo as keyof EquipoAuxiliar];
            const txt = raw == null || raw === '' ? '—' : String(raw);
            doc.rect(x, y - rowH + 2, w, rowH);
            doc.text(truncate(txt, charsParaAncho(w)), x + 1.5, y);
            x += w;
          });
          y += rowH;
          if (y > pageH - 14) { doc.addPage(); y = 22; }
        });
      });

      const fecha = new Date().toISOString().slice(0, 10);
      const suf = sufijoArchivoProyecto();
      const nombre = soloCategoria
        ? `auxiliares-${soloCategoria}${suf}-${fecha}.pdf`
        : `auxiliares${suf}-${fecha}.pdf`;
      doc.save(nombre);
    } finally {
      setExportando(false);
    }
  }

  return (
    <button
      onClick={exportar}
      disabled={exportando || sinDatos}
      className={`${btnCls} disabled:opacity-50 disabled:cursor-not-allowed`}
      title={sinDatos ? 'Sin equipos en esta categoría' : 'Exportar a PDF'}
    >
      {exportando ? 'Exportando…' : '⬇ Exportar PDF'}
    </button>
  );
}

function repartirAnchos(n: number, totalMm: number): number[] {
  // Anchos parejos con un mínimo decente.
  const ancho = Math.max(18, Math.floor(totalMm / n));
  return Array.from({ length: n }, () => ancho);
}

function charsParaAncho(mm: number): number {
  return Math.max(4, Math.floor(mm / 1.6));
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
