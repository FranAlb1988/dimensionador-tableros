// Calculadoras del grupo "Conductores": caída de tensión y corriente de diseño.
import type { Calculadora, EntradasCalc, ResultadoCalc } from './tipos';
import { num } from './tipos';
import { factorDerrateoAltura, type NivelTension } from '../derrateo';

const SQRT3 = Math.sqrt(3);

/**
 * Factor de corrección por apilamiento (F3) según RIC N°4, Tabla 4.6.
 * Hasta 3 conductores activos no hay corrección.
 */
export function factorApilamiento(nConductores: number): number {
  if (nConductores <= 3) return 1;
  if (nConductores <= 6) return 0.8;
  if (nConductores <= 9) return 0.7;
  if (nConductores <= 20) return 0.5;
  if (nConductores <= 30) return 0.45;
  if (nConductores <= 40) return 0.4;
  return 0.35;
}

/** Núcleo común del cálculo de caída de tensión en un conductor. */
function caidaTension(
  e: EntradasCalc,
  claveCorriente: string,
  claveCosPhi: string,
): { I: number; deltaVpct: number; deltaV: number } | { error: string } {
  const I = num(e, claveCorriente);
  const L = num(e, 'L');
  const R = num(e, 'R');
  const X = num(e, 'X');
  const cosPhi = num(e, claveCosPhi);
  const n = num(e, 'n');
  const Vs = num(e, 'Vs');
  const es3F = (e['fases'] ?? '3F') === '3F';
  if (![I, L, R, X, cosPhi, n, Vs].every(Number.isFinite)) {
    return { error: 'Completa todos los campos.' };
  }
  if (n <= 0 || Vs <= 0) return { error: 'n y Vs deben ser mayores que cero.' };
  if (cosPhi < 0 || cosPhi > 1) return { error: 'cosφ debe estar entre 0 y 1.' };
  const senPhi = Math.sqrt(Math.max(1 - cosPhi * cosPhi, 0));
  const k = es3F ? SQRT3 : 2;
  const Lkm = L / 1000;
  const deltaVpct = ((k * I * Lkm * (R * cosPhi + X * senPhi)) / (n * Vs)) * 100;
  return { I, deltaVpct, deltaV: (deltaVpct / 100) * Vs };
}

const camposLinea = [
  { key: 'L', label: 'Longitud del circuito', unidad: 'm' },
  { key: 'R', label: 'Resistencia del conductor', unidad: 'Ω/km' },
  { key: 'X', label: 'Reactancia del conductor', unidad: 'Ω/km' },
  { key: 'n', label: 'Conductores por fase', unidad: '', defecto: 1 },
  { key: 'Vs', label: 'Tensión en la fuente', unidad: 'V', defecto: 400 },
  {
    key: 'fases', label: 'Fases', tipo: 'select' as const, defecto: '3F',
    opciones: [{ value: '3F', label: 'Trifásica' }, { value: '1F', label: 'Monofásica' }],
  },
];

/** Caída de tensión en régimen permanente. */
const caidaPermanente: Calculadora = {
  id: 'caida-permanente',
  grupo: 'conductores',
  nombre: 'Caída de tensión — régimen permanente',
  descripcion: 'Caída de tensión de un alimentador en operación normal. Límite RIC N°3: 3% en alimentadores, 5% al punto más lejano.',
  norma: 'RIC N°3 · NEC',
  formula: 'ΔV% = k·I·L·(R·cosφ + X·senφ) / (n·Vs)·100   (k = √3 en 3F, 2 en 1F; L en km)',
  campos: [
    { key: 'I', label: 'Corriente de la carga', unidad: 'A' },
    { key: 'cosPhi', label: 'Factor de potencia (cosφ)', unidad: '', defecto: 0.85 },
    ...camposLinea,
  ],
  salidas: [
    { key: 'deltaVpct', label: 'Caída de tensión', unidad: '%', destacado: true },
    { key: 'deltaV', label: 'Caída de tensión', unidad: 'V' },
  ],
  calcular: (e): ResultadoCalc => {
    const r = caidaTension(e, 'I', 'cosPhi');
    if ('error' in r) return { valores: {}, error: r.error };
    const nota = r.deltaVpct > 3
      ? `Supera el 3% admisible para alimentadores (RIC N°3).`
      : 'Dentro del 3% admisible para alimentadores.';
    return { valores: { deltaVpct: r.deltaVpct, deltaV: r.deltaV }, nota };
  },
};

/** Caída de tensión durante la partida de un motor. */
const caidaPartida: Calculadora = {
  id: 'caida-partida',
  grupo: 'conductores',
  nombre: 'Caída de tensión — partida de motor',
  descripcion: 'Caída de tensión durante el arranque. Partida directa: corriente ≈ 7×In, cosφ ≈ 0,2 (IEEE 399). Límite del proyecto: 15% en bornes del motor.',
  norma: 'RIC N°3 · IEEE Std 399',
  formula: 'Iarr = In·factor    ΔV% = k·Iarr·L·(R·cosφₐ + X·senφₐ) / (n·Vs)·100',
  campos: [
    { key: 'In', label: 'Corriente nominal del motor', unidad: 'A' },
    { key: 'factor', label: 'Factor de partida', unidad: '×In', defecto: 7, ayuda: 'Partida directa ≈ 7×In.' },
    { key: 'cosPhiArr', label: 'cosφ en la partida', unidad: '', defecto: 0.2 },
    ...camposLinea,
  ],
  salidas: [
    { key: 'Iarr', label: 'Corriente de partida', unidad: 'A' },
    { key: 'deltaVpct', label: 'Caída de tensión en la partida', unidad: '%', destacado: true },
    { key: 'deltaV', label: 'Caída de tensión', unidad: 'V' },
  ],
  calcular: (e): ResultadoCalc => {
    const In = num(e, 'In');
    const factor = num(e, 'factor');
    if (!Number.isFinite(In) || !Number.isFinite(factor)) {
      return { valores: {}, error: 'Completa la corriente nominal y el factor de partida.' };
    }
    const Iarr = In * factor;
    const r = caidaTension({ ...e, Iarr: String(Iarr) }, 'Iarr', 'cosPhiArr');
    if ('error' in r) return { valores: {}, error: r.error };
    const nota = r.deltaVpct > 15
      ? 'Supera el 15% admisible en bornes del motor durante la partida.'
      : 'Dentro del 15% admisible en la partida.';
    return { valores: { Iarr, deltaVpct: r.deltaVpct, deltaV: r.deltaV }, nota };
  },
};

/** Corriente de diseño / ampacidad con factores F1, F2 y F3. */
const corrienteDiseno: Calculadora = {
  id: 'corriente-diseno',
  grupo: 'conductores',
  nombre: 'Corriente de diseño (ampacidad)',
  descripcion: 'Corriente a buscar en las tablas de capacidad de corriente, con factores de carga (F1), altura (F2) y apilamiento (F3).',
  norma: 'RIC N°7 / N°4 · NEC · IEEE Std 37.20',
  formula: 'I = máx(Ip, In·F1) / (F2·F3)',
  campos: [
    { key: 'In', label: 'Corriente nominal de la carga', unidad: 'A' },
    { key: 'Ip', label: 'Corriente de la protección', unidad: 'A', opcional: true, ayuda: 'Opcional. Si se ingresa, I ≥ esta corriente.' },
    {
      key: 'F1', label: 'Factor de carga (F1)', tipo: 'select', defecto: '1.25',
      opciones: [
        { value: '1.25', label: 'Motor régimen permanente (1,25)' },
        { value: '1.20', label: 'Alimentador con reserva (1,20)' },
        { value: '1', label: 'Sin reserva (1,00)' },
      ],
    },
    { key: 'altitud', label: 'Altitud de operación', unidad: 'm.s.n.m.', defecto: 2300 },
    {
      key: 'nivel', label: 'Nivel de tensión', tipo: 'select', defecto: 'BT',
      opciones: [{ value: 'BT', label: 'Baja tensión' }, { value: 'MT', label: 'Media tensión' }],
    },
    { key: 'nConductores', label: 'Conductores activos agrupados', unidad: '', defecto: 1, ayuda: 'Para el factor de apilamiento F3 (RIC N°4).' },
  ],
  salidas: [
    { key: 'F2', label: 'Factor por altura (F2)', unidad: '', decimales: 3 },
    { key: 'F3', label: 'Factor por apilamiento (F3)', unidad: '', decimales: 2 },
    { key: 'corregida', label: 'Corriente corregida In·F1', unidad: 'A' },
    { key: 'I', label: 'Corriente de tabla', unidad: 'A', destacado: true },
  ],
  calcular: (e): ResultadoCalc => {
    const In = num(e, 'In');
    const Ip = num(e, 'Ip');
    const F1 = num(e, 'F1');
    const altitud = num(e, 'altitud');
    const nConductores = num(e, 'nConductores');
    const nivel: NivelTension = (e['nivel'] ?? 'BT') === 'MT' ? 'MT' : 'BT';
    if (![In, F1, altitud, nConductores].every(Number.isFinite)) {
      return { valores: {}, error: 'Completa corriente nominal, factores y altitud.' };
    }
    if (nConductores < 1) return { valores: {}, error: 'El número de conductores debe ser ≥ 1.' };
    const F2 = factorDerrateoAltura(altitud, nivel);
    const F3 = factorApilamiento(Math.round(nConductores));
    const corregida = In * F1;
    const base = Number.isFinite(Ip) ? Math.max(corregida, Ip) : corregida;
    const I = base / (F2 * F3);
    return { valores: { F2, F3, corregida, I } };
  },
};

export const CALCULADORAS_CONDUCTORES: readonly Calculadora[] = [
  caidaPermanente,
  caidaPartida,
  corrienteDiseno,
];
