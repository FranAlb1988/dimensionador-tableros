// Lector de archivos Excel/CSV via SheetJS.

import * as XLSX from 'xlsx';
import type { ArchivoParseado, FilaCruda, HojaArchivo } from './types';

/**
 * Parsea un File (XLSX/XLS/CSV) y devuelve sus hojas con headers y filas crudas.
 * - Para CSV/XLSX detecta automáticamente.
 * - Asume la primera fila no-vacía como headers.
 * - Ignora filas completamente vacías.
 */
export async function parsearArchivo(file: File): Promise<ArchivoParseado> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false, cellText: false });
  const hojas: HojaArchivo[] = [];
  for (const nombre of wb.SheetNames) {
    const sheet = wb.Sheets[nombre];
    if (!sheet) continue;
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: false, raw: true });
    if (matriz.length === 0) continue;
    const idxHeader = matriz.findIndex((row) => row.some((c) => String(c).trim() !== ''));
    if (idxHeader < 0) continue;
    const rawHeaders = matriz[idxHeader] as unknown[];
    const headers = rawHeaders.map((h, i) => String(h ?? '').trim() || `col_${i + 1}`);
    const filas: FilaCruda[] = [];
    for (let i = idxHeader + 1; i < matriz.length; i += 1) {
      const row = matriz[i] as unknown[];
      if (!row.some((c) => String(c).trim() !== '')) continue;
      const fila: FilaCruda = {};
      headers.forEach((h, j) => {
        const v = row[j];
        if (v == null || v === '') fila[h] = '';
        else if (typeof v === 'number' || typeof v === 'boolean') fila[h] = v;
        else fila[h] = String(v);
      });
      filas.push(fila);
    }
    hojas.push({ nombre, headers, filas });
  }
  return { nombreArchivo: file.name, hojas };
}
