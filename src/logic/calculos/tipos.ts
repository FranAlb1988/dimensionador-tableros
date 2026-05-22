// Modelo declarativo de las calculadoras eléctricas.
// Cada calculadora define sus campos de entrada, sus salidas y una función pura
// `calcular`. El panel genérico (CalculadoraPanel) renderiza cualquier calculadora
// a partir de esta descripción, y la exportación a PDF la consume igual.

export type GrupoCalc = 'basicos' | 'conductores' | 'avanzados';

export const GRUPO_LABEL: Record<GrupoCalc, string> = {
  basicos: 'Básicos',
  conductores: 'Conductores',
  avanzados: 'Avanzados',
};

export interface OpcionCampo {
  value: string;
  label: string;
}

export interface CampoCalc {
  key: string;
  label: string;
  unidad?: string;
  tipo?: 'number' | 'select';
  opciones?: readonly OpcionCampo[];
  /** Valor por defecto al abrir la calculadora. */
  defecto?: number | string;
  /** Texto de ayuda breve (tooltip). */
  ayuda?: string;
  /** Si true, el campo puede quedar vacío sin marcar error (entrada opcional). */
  opcional?: boolean;
  /**
   * Si está definido, al cambiar este campo se autocompletan otros campos.
   * Devuelve un mapa de clave→valor a fusionar en las entradas.
   */
  autollenar?: (valor: string) => Record<string, string>;
}

export interface SalidaCalc {
  key: string;
  label: string;
  unidad?: string;
  /** Resultado principal — se resalta visualmente. */
  destacado?: boolean;
  /** Decimales a mostrar (por defecto 2). */
  decimales?: number;
  /** Si true, el valor es textual y se lee de `resultado.textos`. */
  esTexto?: boolean;
}

/** Entradas crudas del formulario: texto para number, value para select. */
export type EntradasCalc = Record<string, string>;

export interface ResultadoCalc {
  /** Valores numéricos por clave de salida. */
  valores: Record<string, number>;
  /** Valores textuales por clave de salida (para salidas con `esTexto`). */
  textos?: Record<string, string>;
  /** Mensaje de error si las entradas no permiten calcular. */
  error?: string;
  /** Nota informativa opcional (p.ej. resultado de una verificación). */
  nota?: string;
}

export interface Calculadora {
  id: string;
  grupo: GrupoCalc;
  nombre: string;
  descripcion: string;
  /** Norma o referencia (p.ej. "RIC N°4 · IEEE Std 519"). */
  norma: string;
  /** Fórmula en texto legible. */
  formula: string;
  campos: readonly CampoCalc[];
  salidas: readonly SalidaCalc[];
  calcular: (e: EntradasCalc) => ResultadoCalc;
}

/** Parsea un campo numérico de las entradas. Devuelve NaN si está vacío o es inválido. */
export function num(e: EntradasCalc, key: string): number {
  const raw = e[key];
  if (raw == null || raw.trim() === '') return Number.NaN;
  const v = Number(raw.replace(',', '.'));
  return Number.isFinite(v) ? v : Number.NaN;
}

/** Indica si todas las claves dadas tienen un número finito. */
export function todasPresentes(e: EntradasCalc, keys: readonly string[]): boolean {
  return keys.every((k) => Number.isFinite(num(e, k)));
}
