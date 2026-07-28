// Lector de archivos Excel/CSV via SheetJS.

import * as XLSX from 'xlsx';
import { autoMapear } from './auto-mapeo';
import type { ArchivoParseado, FilaCruda, HojaArchivo } from './types';

/** Cuántas filas del inicio se miran al buscar la fila de encabezados. */
const MAX_FILAS_SONDEO = 60;

/** Arma una hoja usando `idxHeader` como fila de encabezados. */
export function construirHoja(
  nombre: string,
  matriz: unknown[][],
  idxHeader: number,
): HojaArchivo {
  const rawHeaders = (matriz[idxHeader] ?? []) as unknown[];
  const headers = rawHeaders.map((h, i) => String(h ?? '').trim() || `col_${i + 1}`);
  const filas: FilaCruda[] = [];
  for (let i = idxHeader + 1; i < matriz.length; i += 1) {
    const row = (matriz[i] ?? []) as unknown[];
    if (!row.some((c) => String(c ?? '').trim() !== '')) continue;
    const fila: FilaCruda = {};
    headers.forEach((h, j) => {
      const v = row[j];
      if (v == null || v === '') fila[h] = '';
      else if (typeof v === 'number' || typeof v === 'boolean') fila[h] = v;
      else fila[h] = String(v);
    });
    filas.push(fila);
  }
  return { nombre, headers, filas, matriz, filaHeader: idxHeader };
}

/**
 * Elige la fila que mejor funciona como encabezados.
 *
 * No siempre es la primera fila con contenido: las planillas de ingeniería
 * suelen traer arriba un título, los datos del proyecto y parámetros varios, y
 * la tabla de equipos empieza mucho más abajo (en la planilla de unilineales
 * los encabezados están en la fila 29).
 *
 * Se puntúa cada fila candidata por cuántos campos reconoce el auto-mapeo;
 * gana la que más reconoce y, ante empate, la primera.
 */
export function detectarFilaHeader(matriz: unknown[][]): number {
  const primeraConDatos = matriz.findIndex((row) =>
    row.some((c) => String(c ?? '').trim() !== ''),
  );
  if (primeraConDatos < 0) return 0;

  let mejorIdx = primeraConDatos;
  let mejorPuntaje = 0;

  const limite = Math.min(matriz.length, MAX_FILAS_SONDEO);
  for (let i = primeraConDatos; i < limite; i += 1) {
    const row = (matriz[i] ?? []) as unknown[];
    const celdas = row.map((c) => String(c ?? '').trim());
    // Un encabezado real tiene varias columnas con texto, no un título suelto.
    if (celdas.filter((c) => c !== '').length < 3) continue;
    // Debe quedar al menos una fila debajo para que haya datos.
    if (i + 1 >= matriz.length) continue;

    const puntaje = Object.keys(
      autoMapear(celdas.map((c, j) => c || `col_${j + 1}`)),
    ).length;
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorIdx = i;
    }
  }

  // Si no se reconoció nada, quedarse con la primera fila con contenido.
  return mejorPuntaje > 0 ? mejorIdx : primeraConDatos;
}

/**
 * Parsea un File (XLSX/XLS/CSV) y devuelve sus hojas con headers y filas crudas.
 * La fila de encabezados se detecta automáticamente y puede cambiarse después
 * con `construirHoja`, sin volver a leer el archivo.
 */
export async function parsearArchivo(file: File): Promise<ArchivoParseado> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false, cellText: false });
  const hojas: HojaArchivo[] = [];
  for (const nombre of wb.SheetNames) {
    const sheet = wb.Sheets[nombre];
    if (!sheet) continue;
    // blankrows: true para que los índices coincidan con los de Excel.
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: true,
      raw: true,
    });
    if (matriz.length === 0) continue;
    if (!matriz.some((row) => row.some((c) => String(c ?? '').trim() !== ''))) continue;
    hojas.push(construirHoja(nombre, matriz, detectarFilaHeader(matriz)));
  }
  return { nombreArchivo: file.name, hojas };
}
