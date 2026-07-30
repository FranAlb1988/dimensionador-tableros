import type { Carga, Fases, TipoArranque, TipoCarga, UnidadPotencia } from '../types';

/** Campos a los que se puede mapear una columna del archivo de entrada. */
export type CampoMapeable =
  | 'descripcion'
  | 'tag'
  | 'potencia'
  | 'corrienteA'
  | 'tipo'
  | 'arranque'
  | 'tensionV'
  | 'fases'
  | 'factorServicio'
  | 'proteccion';

/** Mapeo "header del archivo → campo de Carga". Las llaves son nombres exactos de columna del archivo. */
export type MapeoColumnas = Partial<Record<CampoMapeable, string>>;

/** Valores globales aplicados a todas las filas cuando una columna no está mapeada. */
export interface ValoresGlobales {
  unidadPotencia: UnidadPotencia;
  tensionV: number;
  fases: Fases;
  factorServicio: number;
  tipoFallback: TipoCarga;
  arranqueMotorFallback: TipoArranque;
}

export const VALORES_GLOBALES_DEFAULT: ValoresGlobales = {
  unidadPotencia: 'HP',
  tensionV: 480,
  fases: '3F',
  factorServicio: 1,
  tipoFallback: 'motor',
  arranqueMotorFallback: 'DOL',
};

export type FilaCruda = Record<string, string | number | boolean | null | undefined>;

export interface CargaCandidata extends Omit<Carga, 'id'> {
  /** Identifier temporal (se reemplaza al confirmar). */
  tempId: string;
  /** Bandera para incluir/excluir del import. */
  incluir: boolean;
  /** Advertencias detectadas durante el parseo. */
  warnings: string[];
}

export interface HojaArchivo {
  nombre: string;
  headers: string[];
  filas: FilaCruda[];
  /**
   * Matriz completa de la hoja tal como vino del archivo. Se conserva para
   * poder rearmar la hoja con otra fila de encabezados sin releer el archivo.
   * Opcional: una hoja armada a mano (tests) no la necesita.
   */
  matriz?: unknown[][];
  /** Índice 0-based de la fila que se está usando como encabezados. */
  filaHeader?: number;
}

export interface ArchivoParseado {
  nombreArchivo: string;
  hojas: HojaArchivo[];
}
