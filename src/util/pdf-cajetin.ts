// Cajetín de proyecto compartido por todos los PDFs.
// Si no hay metadatos, no dibuja nada y devuelve el yStart sin tocar.

import type { jsPDF } from 'jspdf';
import { getMetadatos, tieneMetadatos, type MetadatosProyecto } from '../store/proyecto-meta';

interface OpcionesCajetin {
  /** Y inicial donde dibujar (mm). */
  y: number;
  /** Ancho disponible (mm), p.ej. pageWidth − 28 para 14 mm de margen lado. */
  ancho: number;
  /** Margen izquierdo (mm). */
  xInicio: number;
}

/**
 * Dibuja un cajetín horizontal compacto con los metadatos del proyecto.
 * Layout: dos columnas — izquierda con nombre/cliente/planta, derecha con plano/revisión/fecha.
 * Devuelve el `y` final para que el caller continúe debajo.
 * Si no hay metadatos llenos, devuelve `y` sin dibujar nada.
 */
export function dibujarCajetinProyecto(doc: jsPDF, opts: OpcionesCajetin): number {
  const meta = getMetadatos();
  if (!tieneMetadatos(meta)) return opts.y;

  const altoCajetin = 22;
  const x = opts.xInicio;
  const y = opts.y;
  const w = opts.ancho;
  const colW = w / 2;

  // Marco
  doc.setDrawColor(180);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, altoCajetin);
  doc.line(x + colW, y, x + colW, y + altoCajetin); // divisor

  // Columna izquierda
  const izq = x + 2;
  let yi = y + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  if (meta.nombre) {
    doc.text(truncate(meta.nombre, 70), izq, yi);
    yi += 4.2;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (meta.cliente || meta.planta) {
    const piezas = [meta.cliente && `Cliente: ${meta.cliente}`, meta.planta && `Planta: ${meta.planta}`].filter(Boolean);
    doc.text(truncate(piezas.join(' · '), 80), izq, yi);
    yi += 3.8;
  }
  if (meta.proyecto || meta.reviso || meta.aprobo) {
    const piezas: string[] = [];
    if (meta.proyecto) piezas.push(`Proyectó: ${meta.proyecto}`);
    if (meta.reviso) piezas.push(`Revisó: ${meta.reviso}`);
    if (meta.aprobo) piezas.push(`Aprobó: ${meta.aprobo}`);
    doc.text(truncate(piezas.join(' · '), 80), izq, yi);
  }

  // Columna derecha
  const der = x + colW + 2;
  let yd = y + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  if (meta.codigoHqr) {
    doc.text('Plano interno:', der, yd);
    doc.setFont('helvetica', 'normal');
    doc.text(meta.codigoHqr, der + 22, yd);
    doc.setFont('helvetica', 'bold');
    yd += 3.8;
  }
  if (meta.codigoCliente) {
    doc.text('Plano cliente:', der, yd);
    doc.setFont('helvetica', 'normal');
    doc.text(meta.codigoCliente, der + 22, yd);
    doc.setFont('helvetica', 'bold');
    yd += 3.8;
  }
  if (meta.revision || meta.fecha) {
    const piezas: string[] = [];
    if (meta.revision) piezas.push(`Rev: ${meta.revision}`);
    if (meta.fecha) piezas.push(`Fecha: ${meta.fecha}`);
    if (meta.aproboCliente) piezas.push(`Aprobó cliente: ${meta.aproboCliente}`);
    doc.setFont('helvetica', 'normal');
    doc.text(truncate(piezas.join(' · '), 60), der, yd);
    doc.setFont('helvetica', 'bold');
  }

  // Reset
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(0);

  return y + altoCajetin + 3;
}

/** Sufijo limpio para nombres de archivo: "codigoHqr" si está, si no, vacío. */
export function sufijoArchivoProyecto(): string {
  const meta = getMetadatos();
  const base = meta.codigoHqr || meta.cliente || '';
  return base ? `-${slug(base)}` : '';
}

function slug(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export type { MetadatosProyecto };
