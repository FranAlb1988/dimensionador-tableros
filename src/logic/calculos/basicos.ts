// Calculadoras del grupo "Básicos": Ley de Ohm, potencias y corriente.
import type { Calculadora, ResultadoCalc } from './tipos';
import { num } from './tipos';

const SQRT3 = Math.sqrt(3);

/** Ley de Ohm y potencia: a partir de 2 de {V, I, R} obtiene el resto. */
const leyDeOhm: Calculadora = {
  id: 'ley-ohm',
  grupo: 'basicos',
  nombre: 'Ley de Ohm y potencia',
  descripcion: 'Relación entre tensión, corriente, resistencia y potencia. Ingresa dos valores de V, I o R.',
  norma: 'Ley de Ohm · P = V·I',
  formula: 'V = I·R    P = V·I = I²·R = V²/R',
  campos: [
    { key: 'V', label: 'Tensión', unidad: 'V', opcional: true },
    { key: 'I', label: 'Corriente', unidad: 'A', opcional: true },
    { key: 'R', label: 'Resistencia', unidad: 'Ω', opcional: true },
  ],
  salidas: [
    { key: 'V', label: 'Tensión', unidad: 'V' },
    { key: 'I', label: 'Corriente', unidad: 'A' },
    { key: 'R', label: 'Resistencia', unidad: 'Ω' },
    { key: 'P', label: 'Potencia', unidad: 'W', destacado: true },
  ],
  calcular: (e): ResultadoCalc => {
    const V = num(e, 'V');
    const I = num(e, 'I');
    const R = num(e, 'R');
    const tieneV = Number.isFinite(V);
    const tieneI = Number.isFinite(I);
    const tieneR = Number.isFinite(R);
    const n = [tieneV, tieneI, tieneR].filter(Boolean).length;
    if (n < 2) return { valores: {}, error: 'Ingresa al menos dos de V, I o R.' };

    let v = V, i = I, r = R;
    if (tieneV && tieneI) {
      if (I === 0) return { valores: {}, error: 'La corriente no puede ser cero.' };
      r = V / I;
    } else if (tieneV && tieneR) {
      if (R === 0) return { valores: {}, error: 'La resistencia no puede ser cero.' };
      i = V / R;
    } else {
      v = I * R;
    }
    return { valores: { V: v, I: i, R: r, P: v * i } };
  },
};

/** Triángulo de potencias: a partir de P y fp obtiene S, Q y el ángulo. */
const trianguloPotencias: Calculadora = {
  id: 'triangulo-potencias',
  grupo: 'basicos',
  nombre: 'Triángulo de potencias',
  descripcion: 'Potencia aparente, reactiva y ángulo a partir de la potencia activa y el factor de potencia.',
  norma: 'Triángulo de potencias',
  formula: 'S = P/cosφ    Q = √(S²−P²)    φ = arccos(cosφ)',
  campos: [
    { key: 'P', label: 'Potencia activa', unidad: 'kW' },
    { key: 'fp', label: 'Factor de potencia (cosφ)', unidad: '', defecto: 0.9, ayuda: 'Entre 0 y 1.' },
  ],
  salidas: [
    { key: 'S', label: 'Potencia aparente', unidad: 'kVA', destacado: true },
    { key: 'Q', label: 'Potencia reactiva', unidad: 'kVAR' },
    { key: 'angulo', label: 'Ángulo φ', unidad: '°' },
    { key: 'senPhi', label: 'sen φ', unidad: '', decimales: 3 },
  ],
  calcular: (e): ResultadoCalc => {
    const P = num(e, 'P');
    const fp = num(e, 'fp');
    if (!Number.isFinite(P) || !Number.isFinite(fp)) {
      return { valores: {}, error: 'Ingresa la potencia activa y el factor de potencia.' };
    }
    if (fp <= 0 || fp > 1) return { valores: {}, error: 'El factor de potencia debe estar entre 0 y 1.' };
    const S = P / fp;
    const Q = Math.sqrt(Math.max(S * S - P * P, 0));
    const angulo = (Math.acos(fp) * 180) / Math.PI;
    return { valores: { S, Q, angulo, senPhi: Math.sin(Math.acos(fp)) } };
  },
};

/** Corriente a partir de la potencia, tensión, fp y rendimiento. */
const corrienteDesdePotencia: Calculadora = {
  id: 'corriente-potencia',
  grupo: 'basicos',
  nombre: 'Corriente desde potencia',
  descripcion: 'Corriente de línea de una carga trifásica o monofásica a partir de su potencia.',
  norma: 'I = P / (√3·V·cosφ·η)',
  formula: '3F: I = P·1000 / (√3·V·cosφ·η)    1F: I = P·1000 / (V·cosφ·η)',
  campos: [
    { key: 'P', label: 'Potencia', unidad: 'kW' },
    { key: 'V', label: 'Tensión', unidad: 'V', defecto: 400 },
    { key: 'fp', label: 'Factor de potencia (cosφ)', unidad: '', defecto: 0.85 },
    { key: 'eta', label: 'Rendimiento η', unidad: '', defecto: 0.9, ayuda: 'Usa 1 para cargas no motrices.' },
    {
      key: 'fases', label: 'Fases', tipo: 'select', defecto: '3F',
      opciones: [{ value: '3F', label: 'Trifásica' }, { value: '1F', label: 'Monofásica' }],
    },
  ],
  salidas: [
    { key: 'I', label: 'Corriente de línea', unidad: 'A', destacado: true },
    { key: 'S', label: 'Potencia aparente', unidad: 'kVA' },
  ],
  calcular: (e): ResultadoCalc => {
    const P = num(e, 'P');
    const V = num(e, 'V');
    const fp = num(e, 'fp');
    const eta = num(e, 'eta');
    const es3F = (e['fases'] ?? '3F') === '3F';
    if (![P, V, fp, eta].every(Number.isFinite)) {
      return { valores: {}, error: 'Completa potencia, tensión, factor de potencia y rendimiento.' };
    }
    if (V <= 0 || fp <= 0 || fp > 1 || eta <= 0 || eta > 1) {
      return { valores: {}, error: 'Revisa los valores: V>0, 0<cosφ≤1, 0<η≤1.' };
    }
    const fases = es3F ? SQRT3 : 1;
    const I = (P * 1000) / (fases * V * fp * eta);
    const S = (fases * V * I) / 1000;
    return { valores: { I, S } };
  },
};

export const CALCULADORAS_BASICOS: readonly Calculadora[] = [
  leyDeOhm,
  trianguloPotencias,
  corrienteDesdePotencia,
];
