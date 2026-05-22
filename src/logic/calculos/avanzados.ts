// Calculadoras del grupo "Avanzados": cortocircuito, armónicos y malla de tierra.
import type { Calculadora, ResultadoCalc } from './tipos';
import { num } from './tipos';

const SQRT3 = Math.sqrt(3);

/** Sección mínima de un conductor por solicitación térmica de cortocircuito. */
const calibreCortocircuito: Calculadora = {
  id: 'calibre-cortocircuito',
  grupo: 'avanzados',
  nombre: 'Calibre mínimo por cortocircuito',
  descripcion: 'Sección mínima de cobre capaz de soportar térmicamente la corriente de una falla de cortocircuito.',
  norma: 'Ecuación I²t adiabática (cobre)',
  formula: 'A = Icc / √( 1,157·10⁵·log₁₀((234,5+T₂)/(234,5+T₁)) / t )',
  campos: [
    { key: 'Icc', label: 'Corriente de cortocircuito', unidad: 'A' },
    { key: 't', label: 'Duración de la falla', unidad: 's', defecto: 0.5 },
    { key: 'T1', label: 'Temperatura de operación', unidad: '°C', defecto: 90 },
    { key: 'T2', label: 'Temperatura de cortocircuito', unidad: '°C', defecto: 250 },
  ],
  salidas: [
    { key: 'A', label: 'Sección mínima', unidad: 'mm²', destacado: true },
  ],
  calcular: (e): ResultadoCalc => {
    const Icc = num(e, 'Icc');
    const t = num(e, 't');
    const T1 = num(e, 'T1');
    const T2 = num(e, 'T2');
    if (![Icc, t, T1, T2].every(Number.isFinite)) {
      return { valores: {}, error: 'Completa todos los campos.' };
    }
    if (t <= 0) return { valores: {}, error: 'La duración de la falla debe ser mayor que cero.' };
    if (T2 <= T1) return { valores: {}, error: 'La temperatura de cortocircuito debe ser mayor que la de operación.' };
    const K = 1.157e5 * Math.log10((234.5 + T2) / (234.5 + T1));
    const A = Icc / Math.sqrt(K / t);
    return { valores: { A } };
  },
};

/** Cortocircuito trifásico en una barra de baja tensión. */
const cortocircuitoBarra: Calculadora = {
  id: 'cortocircuito-barra',
  grupo: 'avanzados',
  nombre: 'Cortocircuito por barra',
  descripcion: 'Corriente de cortocircuito trifásico simétrico en una barra alimentada por un transformador y un tramo de cable.',
  norma: 'Método de impedancias · §6.5.9',
  formula: 'Zbase = V²LL/STR    ZTR = %Z·Zbase    |Zth| = ZTR + √(R²+X²)    Icc = VF/|Zth|',
  campos: [
    { key: 'Str', label: 'Potencia del transformador', unidad: 'kVA' },
    { key: 'pctZ', label: 'Impedancia del transformador %Z', unidad: '%', defecto: 5.75 },
    { key: 'Vll', label: 'Tensión de línea (secundario)', unidad: 'V', defecto: 400 },
    { key: 'L', label: 'Longitud del tramo de cable', unidad: 'm', defecto: 0, opcional: true, ayuda: '0 = cortocircuito en el secundario del transformador.' },
    { key: 'Runit', label: 'Resistencia del cable', unidad: 'Ω/km', defecto: 0.041, opcional: true },
    { key: 'Xunit', label: 'Reactancia del cable', unidad: 'Ω/km', defecto: 0.08, opcional: true },
    { key: 'nParalelos', label: 'Conductores en paralelo por fase', unidad: '', defecto: 1, opcional: true },
  ],
  salidas: [
    { key: 'Zbase', label: 'Impedancia base', unidad: 'Ω', decimales: 5 },
    { key: 'Ztr', label: 'Impedancia del transformador', unidad: 'Ω', decimales: 5 },
    { key: 'Zth', label: 'Impedancia equivalente |Zth|', unidad: 'Ω', decimales: 5 },
    { key: 'Icc', label: 'Corriente de cortocircuito', unidad: 'kA', destacado: true },
    { key: 'Scc', label: 'Potencia de cortocircuito', unidad: 'MVA' },
  ],
  calcular: (e): ResultadoCalc => {
    const Str = num(e, 'Str');
    const pctZ = num(e, 'pctZ');
    const Vll = num(e, 'Vll');
    if (![Str, pctZ, Vll].every(Number.isFinite)) {
      return { valores: {}, error: 'Completa la potencia, la impedancia %Z y la tensión.' };
    }
    if (Str <= 0 || Vll <= 0) return { valores: {}, error: 'La potencia y la tensión deben ser mayores que cero.' };
    const Vf = Vll / SQRT3;
    const Zbase = (Vll * Vll) / (Str * 1000);
    const Ztr = (pctZ / 100) * Zbase;

    let Ztramo = 0;
    const L = num(e, 'L');
    const Runit = num(e, 'Runit');
    const Xunit = num(e, 'Xunit');
    const nPar = num(e, 'nParalelos');
    if (Number.isFinite(L) && L > 0 && Number.isFinite(Runit) && Number.isFinite(Xunit)) {
      const n = Number.isFinite(nPar) && nPar >= 1 ? nPar : 1;
      const Lkm = L / 1000;
      const R = (Runit / n) * Lkm;
      const X = (Xunit / n) * Lkm;
      Ztramo = Math.hypot(R, X);
    }
    const Zth = Ztr + Ztramo;
    if (Zth <= 0) return { valores: {}, error: 'La impedancia equivalente resultó cero.' };
    const IccA = Vf / Zth;
    const SccVA = SQRT3 * Vll * IccA;
    return { valores: { Zbase, Ztr, Zth, Icc: IccA / 1000, Scc: SccVA / 1e6 } };
  },
};

/** Armónicos según IEEE Std 519: corriente real y distorsión de demanda. */
const armonicos: Calculadora = {
  id: 'armonicos-519',
  grupo: 'avanzados',
  nombre: 'Armónicos (IEEE 519)',
  descripcion: 'Corriente RMS real con distorsión y distorsión de demanda total (TDD).',
  norma: 'IEEE Std 519',
  formula: 'Irms = I₁·√(1 + THD²)    Iarm = I₁·THD    TDD = Iarm / IL·100',
  campos: [
    { key: 'I1', label: 'Corriente fundamental', unidad: 'A' },
    { key: 'THD', label: 'Distorsión armónica THDi', unidad: '%' },
    { key: 'IL', label: 'Corriente de demanda IL', unidad: 'A', ayuda: 'Corriente de carga máxima en el punto de acoplamiento.' },
  ],
  salidas: [
    { key: 'Irms', label: 'Corriente RMS real', unidad: 'A', destacado: true },
    { key: 'Iarm', label: 'Corriente armónica total', unidad: 'A' },
    { key: 'TDD', label: 'Distorsión de demanda total (TDD)', unidad: '%' },
  ],
  calcular: (e): ResultadoCalc => {
    const I1 = num(e, 'I1');
    const THD = num(e, 'THD');
    const IL = num(e, 'IL');
    if (![I1, THD, IL].every(Number.isFinite)) {
      return { valores: {}, error: 'Completa todos los campos.' };
    }
    if (IL <= 0) return { valores: {}, error: 'La corriente de demanda IL debe ser mayor que cero.' };
    const thd = THD / 100;
    const Irms = I1 * Math.sqrt(1 + thd * thd);
    const Iarm = I1 * thd;
    const TDD = (Iarm / IL) * 100;
    const nota = TDD > 5 ? 'La TDD supera el 5% — revisar límites IEEE 519 según Isc/IL.' : undefined;
    return { valores: { Irms, Iarm, TDD }, ...(nota ? { nota } : {}) };
  },
};

/** Malla de puesta a tierra según IEEE Std 80-2013. */
const mallaTierra: Calculadora = {
  id: 'malla-tierra',
  grupo: 'avanzados',
  nombre: 'Malla de puesta a tierra (IEEE 80)',
  descripcion: 'Resistencia de la malla, tensiones de paso y contacto admisibles y reales para una malla reticular rectangular.',
  norma: 'IEEE Std 80-2013',
  formula: 'Rg, Cs, Eadm = (1000+k·Cs·ρs)·0,116/√t ; IG ; Em = ρe·Km·Ki·IG/Lc ; Es = ρe·Ks·Ki·IG/Ls',
  campos: [
    { key: 'rhoE', label: 'Resistividad equivalente del terreno', unidad: 'Ω·m' },
    { key: 'rhoS', label: 'Resistividad de la capa superficial', unidad: 'Ω·m', defecto: 3000 },
    { key: 'hs', label: 'Espesor de la capa superficial', unidad: 'm', defecto: 0.2 },
    { key: 'largo', label: 'Largo de la malla', unidad: 'm' },
    { key: 'ancho', label: 'Ancho de la malla', unidad: 'm' },
    { key: 'D', label: 'Espaciamiento del reticulado', unidad: 'm', defecto: 3 },
    { key: 'h', label: 'Profundidad de enterramiento', unidad: 'm', defecto: 0.6 },
    { key: 'd', label: 'Diámetro del conductor', unidad: 'm', defecto: 0.0127 },
    { key: 'LR', label: 'Largo total de varillas verticales', unidad: 'm', defecto: 0, opcional: true },
    { key: 'I1cc', label: 'Corriente de cortocircuito monofásico', unidad: 'A' },
    { key: 'E', label: 'Tensión nominal del sistema', unidad: 'V', defecto: 23000 },
    { key: 'ts', label: 'Tiempo de despeje de la falla', unidad: 's', defecto: 0.5 },
    {
      key: 'peso', label: 'Peso de la persona', tipo: 'select', defecto: '50',
      opciones: [{ value: '50', label: '50 kg (caso más severo)' }, { value: '70', label: '70 kg' }],
    },
  ],
  salidas: [
    { key: 'A', label: 'Área de la malla', unidad: 'm²' },
    { key: 'Lc', label: 'Largo del conductor reticulado', unidad: 'm' },
    { key: 'n', label: 'Conductores efectivos (n)', unidad: '', decimales: 2 },
    { key: 'Rg', label: 'Resistencia de la malla', unidad: 'Ω', destacado: true, decimales: 3 },
    { key: 'Cs', label: 'Factor capa superficial Cs', unidad: '', decimales: 3 },
    { key: 'Econtactoadm', label: 'Tensión de contacto admisible', unidad: 'V' },
    { key: 'Epasoadm', label: 'Tensión de paso admisible', unidad: 'V' },
    { key: 'IG', label: 'Corriente irradiada a tierra', unidad: 'A' },
    { key: 'Em', label: 'Tensión de contacto real', unidad: 'V', destacado: true },
    { key: 'Es', label: 'Tensión de paso real', unidad: 'V', destacado: true },
  ],
  calcular: (e): ResultadoCalc => {
    const rhoE = num(e, 'rhoE');
    const rhoS = num(e, 'rhoS');
    const hs = num(e, 'hs');
    const largo = num(e, 'largo');
    const ancho = num(e, 'ancho');
    const D = num(e, 'D');
    const h = num(e, 'h');
    const d = num(e, 'd');
    const LR = Number.isFinite(num(e, 'LR')) ? num(e, 'LR') : 0;
    const I1cc = num(e, 'I1cc');
    const E = num(e, 'E');
    const ts = num(e, 'ts');
    const k = (e['peso'] ?? '50') === '70' ? 0.157 : 0.116;

    if (![rhoE, rhoS, hs, largo, ancho, D, h, d, I1cc, E, ts].every(Number.isFinite)) {
      return { valores: {}, error: 'Completa todos los campos.' };
    }
    if ([rhoS, largo, ancho, D, h, d, ts].some((v) => v <= 0)) {
      return { valores: {}, error: 'Largo, ancho, espaciamiento, profundidad, diámetro y tiempo deben ser mayores que cero.' };
    }

    const A = largo * ancho;
    const LP = 2 * (largo + ancho);
    const nLargo = Math.round(ancho / D) + 1;
    const nAncho = Math.round(largo / D) + 1;
    const Lc = nLargo * largo + nAncho * ancho;
    const LT = Lc + LR;
    const n = (2 * LT) / LP;

    // Resistencia de la malla (Sverak, IEEE 80).
    const Rg = rhoE * (1 / LT + (1 / Math.sqrt(20 * A)) * (1 + 1 / (1 + h * Math.sqrt(20 / A))));

    // Factor de la capa superficial.
    const Cs = 1 - (0.09 * (1 - rhoE / rhoS)) / (2 * hs + 0.09);

    // Tensiones admisibles.
    const Econtactoadm = ((1000 + 1.5 * Cs * rhoS) * k) / Math.sqrt(ts);
    const Epasoadm = ((1000 + 6 * Cs * rhoS) * k) / Math.sqrt(ts);

    // Corriente irradiada a tierra.
    const IG = (E * I1cc) / Math.sqrt(E * E + Rg * Rg * I1cc * I1cc);

    // Factores geométricos.
    const Kii = 1 / Math.pow(2 * n, 2 / n);
    const Kh = Math.sqrt(1 + h);
    const Km = (1 / (2 * Math.PI)) * (
      Math.log(
        (D * D) / (16 * h * d) + ((D + 2 * h) ** 2) / (8 * D * d) - h / (4 * d),
      )
      + (Kii / Kh) * Math.log(8 / (Math.PI * (2 * n - 1)))
    );
    const Ki = 0.644 + 0.148 * n;
    const Ks = (1 / Math.PI) * (1 / (2 * h) + 1 / (D + h) + (1 / D) * (1 - Math.pow(0.5, n - 2)));

    // Tensiones reales.
    const Em = (rhoE * Km * Ki * IG) / Lc;
    const Ls = 0.75 * Lc + 0.85 * LR;
    const Es = (rhoE * Ks * Ki * IG) / Ls;

    const cumpleEm = Em <= Econtactoadm;
    const cumpleEs = Es <= Epasoadm;
    const nota = cumpleEm && cumpleEs
      ? 'Cumple: las tensiones reales de contacto y paso están bajo las admisibles (IEEE 80).'
      : `No cumple: ${!cumpleEm ? 'la tensión de contacto real supera la admisible' : ''}${!cumpleEm && !cumpleEs ? ' y ' : ''}${!cumpleEs ? 'la tensión de paso real supera la admisible' : ''}. Rediseñar la malla.`;

    return {
      valores: { A, Lc, n, Rg, Cs, Econtactoadm, Epasoadm, IG, Em, Es },
      nota,
    };
  },
};

export const CALCULADORAS_AVANZADOS: readonly Calculadora[] = [
  calibreCortocircuito,
  cortocircuitoBarra,
  armonicos,
  mallaTierra,
];
