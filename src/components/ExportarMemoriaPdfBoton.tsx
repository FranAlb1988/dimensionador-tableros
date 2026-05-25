import { useState } from 'react';
import { jsPDF } from 'jspdf';
import type { Calculadora, CampoCalc, EntradasCalc, ResultadoCalc } from '../logic/calculos';
import { fmtCantidad } from '../util/format';
import { dibujarCajetinProyecto, sufijoArchivoProyecto } from '../util/pdf-cajetin';

interface Props {
  calculadora: Calculadora;
  entradas: EntradasCalc;
  resultado: ResultadoCalc;
}

const btnCls =
  'px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 ' +
  'hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed';

/** Texto a mostrar para una entrada (la etiqueta de la opción si es un select). */
function textoEntrada(campo: CampoCalc, entradas: EntradasCalc): string {
  const raw = entradas[campo.key] ?? '';
  if (campo.tipo === 'select') {
    return campo.opciones?.find((o) => o.value === raw)?.label ?? raw;
  }
  return raw.trim() === '' ? '—' : raw;
}

export function ExportarMemoriaPdfBoton({ calculadora, entradas, resultado }: Props) {
  const [exportando, setExportando] = useState(false);

  function exportar() {
    setExportando(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      const ancho = pageW - 2 * margin;

      doc.setFontSize(15);
      doc.text('Memoria de cálculo', margin, 16);
      doc.setFontSize(11);
      doc.text(calculadora.nombre, margin, 23);
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(calculadora.norma, margin, 28);
      doc.setTextColor(0);

      let y = dibujarCajetinProyecto(doc, { y: 32, xInicio: margin, ancho });

      const colLabel = ancho * 0.62;
      const colValor = ancho - colLabel;
      const rowH = 7;

      function seccion(titulo: string): void {
        if (y > pageH - 30) { doc.addPage(); y = 16; }
        y += 4;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(titulo, margin, y);
        doc.setFont('helvetica', 'normal');
        y += 3;
      }

      function fila(label: string, valor: string, destacado = false): void {
        if (y > pageH - 16) { doc.addPage(); y = 16; }
        doc.setFontSize(9);
        if (destacado) doc.setFillColor(30, 41, 59);
        else doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, colLabel, rowH, 'F');
        doc.rect(margin + colLabel, y, colValor, rowH, 'F');
        doc.setDrawColor(210);
        doc.rect(margin, y, colLabel, rowH);
        doc.rect(margin + colLabel, y, colValor, rowH);
        doc.setTextColor(destacado ? 255 : 30);
        doc.setFont('helvetica', destacado ? 'bold' : 'normal');
        doc.text(label, margin + 2, y + 4.8);
        doc.text(valor, margin + colLabel + 2, y + 4.8);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'normal');
        y += rowH;
      }

      seccion('Datos de entrada');
      for (const campo of calculadora.campos) {
        if (campo.tipo === 'lista' && campo.filaCampos) {
          fila(campo.label, '');
          const count = Math.max(0, Math.round(Number(entradas[`${campo.key}.count`] ?? '0')));
          for (let i = 0; i < count; i += 1) {
            const partes: string[] = [];
            for (const sc of campo.filaCampos) {
              const v = entradas[`${campo.key}.${i}.${sc.key}`] ?? '';
              const display = sc.tipo === 'select'
                ? (sc.opciones?.find((o) => o.value === v)?.label ?? v)
                : v;
              const u = sc.unidad ? ` ${sc.unidad}` : '';
              if (display.trim() !== '') partes.push(`${sc.label}: ${display}${u}`);
            }
            fila(`  ${i + 1}.`, partes.join(' · '));
          }
        } else {
          const u = campo.unidad ? ` (${campo.unidad})` : '';
          fila(`${campo.label}${u}`, textoEntrada(campo, entradas));
        }
      }

      seccion('Fórmula aplicada');
      doc.setFontSize(9);
      for (const linea of doc.splitTextToSize(calculadora.formula, ancho - 4) as string[]) {
        if (y > pageH - 16) { doc.addPage(); y = 16; }
        y += 5;
        doc.text(linea, margin + 2, y);
      }
      y += 2;

      seccion('Resultados');
      for (const salida of calculadora.salidas) {
        let txt: string;
        if (salida.esTexto) {
          txt = resultado.textos?.[salida.key] ?? '—';
        } else {
          const v = resultado.valores[salida.key];
          const u = salida.unidad ? ` ${salida.unidad}` : '';
          txt = v == null ? '—' : `${fmtCantidad(v, salida.decimales ?? 2)}${u}`;
        }
        fila(salida.label, txt, salida.destacado);
      }

      if (resultado.nota) {
        y += 4;
        doc.setFontSize(8);
        doc.setTextColor(90);
        for (const linea of doc.splitTextToSize(`Nota: ${resultado.nota}`, ancho) as string[]) {
          if (y > pageH - 14) { doc.addPage(); y = 16; }
          y += 4;
          doc.text(linea, margin, y);
        }
        doc.setTextColor(0);
      }

      const fecha = new Date().toISOString().slice(0, 10);
      doc.save(`memoria-${calculadora.id}${sufijoArchivoProyecto()}-${fecha}.pdf`);
    } finally {
      setExportando(false);
    }
  }

  return (
    <button onClick={exportar} disabled={exportando || !!resultado.error} className={btnCls}>
      {exportando ? 'Exportando…' : '⬇ Exportar memoria PDF'}
    </button>
  );
}
