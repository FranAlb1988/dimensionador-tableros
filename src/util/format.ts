// Formatos en español de Chile: coma decimal, punto separador de miles.

const FMT_NUM = new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const FMT_NUM_FIJO = new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const FMT_FACTOR = new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 3,
  minimumFractionDigits: 3,
});

export function fmtNumero(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return FMT_NUM.format(n);
}

export function fmtNumeroFijo(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return FMT_NUM_FIJO.format(n);
}

export function fmtMm(n: number): string {
  return `${fmtNumero(Math.round(n))} mm`;
}

export function fmtAmp(n: number): string {
  return `${fmtNumeroFijo(n)} A`;
}

export function fmtKw(n: number): string {
  return `${fmtNumeroFijo(n)} kW`;
}

/** Factor adimensional con 3 decimales (p.ej. derrateo F2 = 0,994). */
export function fmtFactor(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return FMT_FACTOR.format(n);
}
