// Calculadoras del grupo "Conductores": caída de tensión y corriente de diseño.
import type { Calculadora, EntradasCalc, ResultadoCalc } from './tipos';
import { leerFilas, num } from './tipos';
import {
  autollenarArea, autollenarConductor, autollenarDiametro, opcionesConductor,
  seccionDeConductor,
} from './conductores-catalogo';
import {
  anchoDeCapa, areaDuctoMaxima, areaPermitidaEscalerilla, derrateoMonopolarSinSeparacion,
  FRACCION_AREA_BANDEJA_RIC, type NormaAreaBandeja,
  distribuirEnCapas, MAX_CAPAS_PROYECTO,
  maxCapasEnEscalerilla, maxCapasGeometrico, type ModoTendido,
  porcentajeRelleno, PROFUNDIDAD_ESCALERILLA_MM,
  SECCION_MINIMA_MONOPOLAR_MM2, SEPARACION_MONOPOLAR_DIAMETROS,
  sugerirAnchoEscalerilla, type NormaRelleno,
  sugerirDucto, type TipoDucto,
} from './canalizaciones-catalogo';
import { factorDerrateoAltura, type NivelTension } from '../derrateo';
import {
  datosTipo, itmNormalizadoRic, metodosDe, metodosInstalacionRic,
  seccionPorAmpacidad, tiposConductorRic,
} from './ric-conductores';

const SQRT3 = Math.sqrt(3);

/** Norma con la que se aplica el factor de agrupamiento. */
export type NormaAgrupamiento = 'RIC' | 'NEC';

/**
 * Factor de corrección por agrupamiento (F3) de conductores en una misma
 * canalización. Las dos normas que usa la app agrupan distinto y no son
 * intercambiables:
 *
 *   Conductores    RIC N°4 Tabla 4.6    NEC 310.15(B)(3)(a)
 *   1 a 3                  1,00                 1,00
 *   4 a 6                  0,80                 0,80
 *   7 a 9                  0,70                 0,70
 *   10 a 20                0,70                 0,50
 *   21 a 24                0,70                 0,45
 *   25 a 30                0,60                 0,45
 *   31 a 40                0,60                 0,40
 *   41 a 42                0,60                 0,35
 *   más de 42              0,50                 0,35
 *
 * A partir de 10 conductores el NEC derratea mucho más, y aplicarlo a un
 * proyecto RIC sube el conductor uno o dos calibres sin necesidad. Antes esta
 * función tenía la tabla del NEC citando RIC N°4 Tabla 4.6.
 */
export function factorApilamiento(
  nConductores: number,
  norma: NormaAgrupamiento = 'RIC',
): number {
  if (nConductores <= 3) return 1;
  if (nConductores <= 6) return 0.8;
  if (norma === 'RIC') {
    if (nConductores <= 24) return 0.7;
    if (nConductores <= 42) return 0.6;
    return 0.5;
  }
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
  {
    key: 'conductor', label: 'Conductor', tipo: 'select' as const, defecto: '',
    opciones: opcionesConductor(), autollenar: autollenarConductor('R', 'X'),
    ayuda: 'Autocompleta R y X con valores típicos de cobre. Quedan editables.',
  },
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
    { key: 'nConductores', label: 'Conductores activos agrupados', unidad: '', defecto: 1, ayuda: 'Para el factor de agrupamiento F3.' },
    {
      key: 'normaF3', label: 'Norma del factor de agrupamiento', tipo: 'select', defecto: 'RIC',
      opciones: [
        { value: 'RIC', label: 'RIC N°4 Tabla 4.6 (Chile)' },
        { value: 'NEC', label: 'NEC 310.15(B)(3)(a)' },
      ],
      ayuda: 'Sobre 9 conductores las tablas divergen: con 12 en un ducto, RIC da 0,70 y NEC 0,50.',
    },
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
    const normaF3: NormaAgrupamiento = (e['normaF3'] ?? 'RIC') === 'NEC' ? 'NEC' : 'RIC';
    const F3 = factorApilamiento(Math.round(nConductores), normaF3);
    const corregida = In * F1;
    const base = Number.isFinite(Ip) ? Math.max(corregida, Ip) : corregida;
    const I = base / (F2 * F3);
    return { valores: { F2, F3, corregida, I } };
  },
};

/** Tamaño de ducto (conduit) por porcentaje de relleno, con múltiples calibres. */
const tamanoDucto: Calculadora = {
  id: 'tamano-ducto',
  grupo: 'conductores',
  nombre: 'Tamaño de ducto (conduit)',
  descripcion: 'Diámetro mínimo de tubería metálica (EMT) o PVC por porcentaje de relleno. '
    + 'RIC N°4: 50% con un conductor, 33% con dos o más. NEC Cap. 9 Tabla 1: 53%, 31% y 40%. '
    + 'Admite grupos con calibres distintos (fases, neutro, tierra).',
  norma: 'RIC N°4 · NEC Cap. 9',
  formula: 'Área total = Σ (n · área por calibre)    Área interna mínima = Área total / %relleno',
  campos: [
    {
      key: 'tipo', label: 'Tipo de ducto', tipo: 'select', defecto: 'metalico',
      opciones: [
        { value: 'metalico', label: 'Metálico (EMT)' },
        { value: 'pvc', label: 'PVC Sch. 40' },
      ],
    },
    {
      key: 'normaRelleno', label: 'Norma del porcentaje de relleno', tipo: 'select', defecto: 'RIC',
      opciones: [
        { value: 'RIC', label: 'RIC N°4 (Chile)' },
        { value: 'NEC', label: 'NEC Cap. 9, Tabla 1' },
      ],
      ayuda: 'Con 3 o más conductores el RIC admite 33% y el NEC 40%: aplicar el NEC en Chile subdimensiona la tubería.',
    },
    {
      key: 'grupos', label: 'Conductores en el ducto', tipo: 'lista',
      filasMin: 1, filasMax: 10, etiquetaFila: 'Calibre',
      ayuda: 'Un grupo por cada calibre distinto que va dentro del ducto.',
      filaCampos: [
        {
          key: 'conductor', label: 'Conductor', tipo: 'select', defecto: '',
          opciones: opcionesConductor(), autollenar: autollenarArea('area'),
          ayuda: 'Autocompleta el área con aislación. Editable.',
        },
        { key: 'area', label: 'Área', unidad: 'mm²' },
        { key: 'cantidad', label: 'Cantidad', unidad: '', defecto: 3 },
      ],
    },
  ],
  salidas: [
    { key: 'totalConductores', label: 'Total de conductores', unidad: '', decimales: 0 },
    { key: 'areaTotal', label: 'Área total de conductores', unidad: 'mm²' },
    { key: 'relleno', label: 'Relleno admisible', unidad: '%', decimales: 0 },
    { key: 'areaRequerida', label: 'Área interna mínima del ducto', unidad: 'mm²' },
    { key: 'ducto', label: 'Ducto sugerido', esTexto: true, destacado: true },
    { key: 'rellenoReal', label: 'Relleno real del ducto', unidad: '%', decimales: 1 },
  ],
  calcular: (e): ResultadoCalc => {
    const tipo: TipoDucto = (e['tipo'] ?? 'metalico') === 'pvc' ? 'pvc' : 'metalico';
    const filas = leerFilas(e, 'grupos', ['area', 'cantidad']);
    let areaTotal = 0;
    let totalConductores = 0;
    for (const f of filas) {
      const a = Number((f.area ?? '').replace(',', '.'));
      const n = Math.round(Number((f.cantidad ?? '').replace(',', '.')));
      if (Number.isFinite(a) && a > 0 && Number.isFinite(n) && n >= 1) {
        areaTotal += a * n;
        totalConductores += n;
      }
    }
    if (totalConductores === 0) {
      return { valores: {}, error: 'Agrega al menos un grupo con área y cantidad.' };
    }
    const normaRelleno: NormaRelleno = (e['normaRelleno'] ?? 'RIC') === 'NEC' ? 'NEC' : 'RIC';
    const relleno = porcentajeRelleno(totalConductores, normaRelleno);
    const areaRequerida = areaTotal / relleno;
    const ducto = sugerirDucto(tipo, areaRequerida);
    if (!ducto) {
      return {
        valores: { totalConductores, areaTotal, relleno: relleno * 100, areaRequerida },
        textos: { ducto: 'Supera el catálogo (4″)' },
        nota: `El área interna requerida (${areaRequerida.toFixed(0)} mm²) supera el ducto de 4″ (${areaDuctoMaxima(tipo).toFixed(0)} mm²). Divide los conductores en varios ductos.`,
      };
    }
    const rellenoReal = (areaTotal / ducto.areaInternaMm2) * 100;
    return {
      valores: { totalConductores, areaTotal, relleno: relleno * 100, areaRequerida, rellenoReal },
      textos: { ducto: `${ducto.nombre} ${tipo === 'pvc' ? 'PVC' : 'EMT'}` },
    };
  },
};

/** Ancho de escalerilla portaconductores, con múltiples calibres y capas. */
const anchoEscalerilla: Calculadora = {
  id: 'ancho-escalerilla',
  grupo: 'conductores',
  nombre: 'Ancho de escalerilla portaconductores',
  descripcion: `Ancho de bandeja portacable en función del tendido. Los alimentadores monopolares se separan un diámetro entre sí —es lo que mantiene su ampacidad—; los circuitos multiconductores van juntos. Bandeja de ${PROFUNDIDAD_ESCALERILLA_MM} mm de alto, máximo ${MAX_CAPAS_PROYECTO} capas por regla de proyecto.`,
  norma: 'NEC 392.22 / 392.80 · IEC 60364-5-52',
  formula: `Ancho = Σ Ø + (n−1)·s·Ø    (s = ${SEPARACION_MONOPOLAR_DIAMETROS} para alimentadores, 0 para circuitos juntos)`,
  campos: [
    {
      key: 'modo', label: 'Tipo de tendido', tipo: 'select', defecto: 'alimentadores',
      opciones: [
        { value: 'alimentadores', label: 'Alimentadores — monopolares separados' },
        { value: 'circuitos', label: 'Circuitos — multiconductores juntos' },
      ],
      ayuda: 'Los monopolares de alimentador se separan un diámetro (NEC 392.80(A)(2), IEC 60364-5-52): sin esa separación la ampacidad cae al 65-75% de la de aire libre.',
    },
    {
      key: 'normaArea', label: 'Norma del área ocupada', tipo: 'select', defecto: 'RIC',
      opciones: [
        { value: 'RIC', label: `RIC — ${Math.round(FRACCION_AREA_BANDEJA_RIC * 100)}% de ancho × alto` },
        { value: 'NEC', label: 'NEC 392.22(A) — por ancho' },
      ],
      ayuda: 'Son modelos distintos: el RIC limita al 40% de la sección útil (depende del alto), el NEC publica un área por ancho (no depende del alto).',
    },
    {
      key: 'capas', label: 'Capas', unidad: '', defecto: 1,
      ayuda: `Capas pedidas (1 o ${MAX_CAPAS_PROYECTO}). Se ajusta hacia abajo si exceden el alto útil (${PROFUNDIDAD_ESCALERILLA_MM} mm) o el tope de proyecto de ${MAX_CAPAS_PROYECTO} capas.`,
    },
    {
      key: 'grupos', label: 'Conductores en la escalerilla', tipo: 'lista',
      filasMin: 1, filasMax: 10, etiquetaFila: 'Calibre',
      ayuda: 'Un grupo por cada calibre distinto en la escalerilla.',
      filaCampos: [
        {
          key: 'conductor', label: 'Conductor', tipo: 'select', defecto: '',
          opciones: opcionesConductor(), autollenar: autollenarDiametro('diametro'),
          ayuda: 'Autocompleta el diámetro exterior. Editable.',
        },
        { key: 'diametro', label: 'Diámetro', unidad: 'mm' },
        { key: 'cantidad', label: 'Cantidad', unidad: '', defecto: 3 },
      ],
    },
  ],
  salidas: [
    { key: 'totalConductores', label: 'Total de conductores', unidad: '', decimales: 0 },
    { key: 'capasUsadas', label: 'Capas usadas', unidad: '', decimales: 0 },
    { key: 'separacion', label: 'Separación entre conductores', unidad: 'mm' },
    { key: 'anchoRequerido', label: 'Ancho requerido por capa (Ø + separación)', unidad: 'mm' },
    { key: 'areaConductores', label: 'Área de los conductores', unidad: 'mm²' },
    { key: 'areaPermitida', label: 'Área admisible de la bandeja', unidad: 'mm²' },
    { key: 'alturaUsada', label: `Altura ocupada (sobre ${PROFUNDIDAD_ESCALERILLA_MM} mm)`, unidad: 'mm' },
    { key: 'anchoSugerido', label: 'Escalerilla sugerida', unidad: 'mm', destacado: true, decimales: 0 },
    { key: 'ocupacionNec', label: 'Ocupación del área', unidad: '%', decimales: 1 },
    { key: 'ocupacionAltura', label: 'Ocupación del alto', unidad: '%', decimales: 1 },
    { key: 'ampacidadPct', label: 'Ampacidad aplicable (de la de aire libre)', unidad: '%', decimales: 0 },
  ],
  calcular: (e): ResultadoCalc => {
    const capasPedidas = Math.max(1, Math.round(num(e, 'capas') || 1));
    const filas = leerFilas(e, 'grupos', ['conductor', 'diametro', 'cantidad']);
    const diametros: number[] = [];
    let totalConductores = 0;
    let areaConductores = 0;
    // Secciones de cobre de las filas tomadas del catálogo. Las filas con
    // diámetro escrito a mano no aportan sección, y sin ella no se puede
    // decidir si el monopolar llega a 1/0 AWG ni si pasa los 600 kcmil.
    const secciones: number[] = [];
    let hayManual = false;
    for (const f of filas) {
      const d = Number((f.diametro ?? '').replace(',', '.'));
      const n = Math.round(Number((f.cantidad ?? '').replace(',', '.')));
      if (Number.isFinite(d) && d > 0 && Number.isFinite(n) && n >= 1) {
        for (let i = 0; i < n; i += 1) diametros.push(d);
        totalConductores += n;
        areaConductores += n * (Math.PI * d * d) / 4;
        const sec = seccionDeConductor(f.conductor);
        if (sec != null) secciones.push(sec);
        else hayManual = true;
      }
    }
    if (totalConductores === 0) {
      return { valores: {}, error: 'Agrega al menos un grupo con diámetro y cantidad.' };
    }

    const modo: ModoTendido = (e['modo'] ?? 'alimentadores') === 'circuitos'
      ? 'circuitos' : 'alimentadores';
    const sepDiametros = modo === 'alimentadores' ? SEPARACION_MONOPOLAR_DIAMETROS : 0;

    const maxDia = Math.max(...diametros);
    const seccionMayorMm2 = secciones.length > 0 ? Math.max(...secciones) : 0;
    const maxCapasPorAlto = maxCapasEnEscalerilla(maxDia);
    if (maxCapasPorAlto < 1) {
      return {
        valores: { totalConductores, areaConductores },
        nota: `El diámetro mayor (${maxDia.toFixed(1)} mm) supera el alto útil de la bandeja (${PROFUNDIDAD_ESCALERILLA_MM} mm). No cabe ni una sola capa.`,
      };
    }

    const capasUsadas = Math.min(capasPedidas, maxCapasPorAlto, totalConductores);
    // Con separación cada conductor arrastra su hueco, así que la distribución
    // se balancea por el ancho real ocupado y no solo por el diámetro.
    const distribuidos = distribuirEnCapas(diametros, (d) => d * (1 + sepDiametros), capasUsadas);
    const anchoRequerido = Math.max(...distribuidos.map((capa) => anchoDeCapa(capa, sepDiametros)));
    const separacion = sepDiametros > 0 ? maxDia * sepDiametros : 0;
    const alturaUsada = distribuidos.reduce((s, capa) => s + Math.max(0, ...capa), 0);
    const ocupacionAltura = (alturaUsada / PROFUNDIDAD_ESCALERILLA_MM) * 100;

    const normaArea: NormaAreaBandeja = (e['normaArea'] ?? 'RIC') === 'NEC' ? 'NEC' : 'RIC';
    // En modo alimentadores el área que manda es la de la Tabla 392.22(B)(1),
    // que no está incorporada; con separación mantenida el criterio de ancho es
    // más restrictivo de todos modos, así que se dimensiona por ancho y se
    // informa el área sin usarla como filtro.
    const areaFiltro = modo === 'alimentadores' ? 0 : areaConductores;
    const anchoSugerido = sugerirAnchoEscalerilla(anchoRequerido, areaFiltro, normaArea);
    if (anchoSugerido == null) {
      return {
        valores: { totalConductores, capasUsadas, anchoRequerido, areaConductores, alturaUsada, ocupacionAltura },
        nota: `Ningún ancho del catálogo cumple los dos criterios NEC 392: ancho ≥ ${anchoRequerido.toFixed(0)} mm y área admisible ≥ ${areaConductores.toFixed(0)} mm². Divide los conductores en varias escalerillas.`,
      };
    }
    const areaPermitida = areaPermitidaEscalerilla(anchoSugerido, normaArea);
    const ocupacionNec = (areaConductores / areaPermitida) * 100;

    const partes: string[] = [];
    if (capasPedidas > maxCapasPorAlto) {
      const geom = maxCapasGeometrico(maxDia);
      const motivo = maxCapasPorAlto < geom
        ? `el tope de proyecto es ${MAX_CAPAS_PROYECTO} capas`
        : `en una bandeja de ${PROFUNDIDAD_ESCALERILLA_MM} mm de alto solo caben ${maxCapasPorAlto} `
          + `(limitado por el conductor de ⌀${maxDia.toFixed(1)} mm)`;
      partes.push(`Pediste ${capasPedidas} capas, pero ${motivo}. Se usaron ${capasUsadas}.`);
    }

    // Ampacidad aplicable. Es el punto del modo "alimentadores": la separación
    // de un diámetro en capa única es lo que permite usar la ampacidad al aire
    // libre completa (NEC 392.80(A)(2)); sin ella se cae al 65 % o 75 %.
    let ampacidadPct: number;
    if (modo === 'circuitos') {
      ampacidadPct = 100;
      partes.push(
        `${totalConductores} conductores tendidos juntos en ${capasUsadas} capa(s). `
        + `Área limitada por ${normaArea === 'RIC'
          ? `el ${Math.round(FRACCION_AREA_BANDEJA_RIC * 100)} % de la sección útil (RIC)`
          : 'la Tabla 392.22(A) del NEC'}. `
        + 'Aplica el factor de agrupamiento de la tabla que corresponda a la cantidad de circuitos.',
      );
    } else if (capasUsadas === 1) {
      ampacidadPct = 100;
      partes.push(
        `Alimentadores monopolares en capa única con separación mantenida de `
        + `${separacion.toFixed(1)} mm (un diámetro): se conserva la ampacidad al aire libre `
        + '(NEC 392.80(A)(2); "espaciado" según IEC 60364-5-52).',
      );
    } else {
      // Dos capas: la separación horizontal ya no basta.
      ampacidadPct = Math.round(derrateoMonopolarSinSeparacion(seccionMayorMm2) * 100);
      partes.push(
        `⚠ Monopolares en ${capasUsadas} capas: la separación entre capas no está mantenida, `
        + `así que no aplica la ampacidad al aire libre. NEC 392.80(A)(2) limita a `
        + `${ampacidadPct} % de la Tabla 310.17, e IEC 60364-5-52 (Tabla B.52.20, nota 2) advierte `
        + 'que sus factores tabulados no cubren varias capas tocándose. Verifica la ampacidad aparte.',
      );
    }

    if (modo === 'alimentadores') {
      if (secciones.some((x) => x < SECCION_MINIMA_MONOPOLAR_MM2)) {
        partes.push(
          `⚠ Hay conductores bajo ${SECCION_MINIMA_MONOPOLAR_MM2} mm² (1/0 AWG): `
          + 'NEC 392.10(B)(1) no admite monopolares menores en bandeja — van dentro de '
          + 'un cable multiconductor.',
        );
      }
      if (hayManual) {
        partes.push(
          'Hay filas con diámetro manual: sin la sección de cobre no se verifica el '
          + 'mínimo de 1/0 AWG ni el umbral de 600 kcmil. Elige el conductor del catálogo '
          + 'para que se comprueben.',
        );
      }
      partes.push(
        'El ancho lo fija la suma de diámetros más la separación. El área de los '
        + 'monopolares se rige por la Tabla 392.22(B)(1), que no está incorporada; con '
        + 'separación mantenida el criterio de ancho es el más restrictivo, así que el '
        + 'área se informa como referencia y no decide el ancho.',
      );
    }

    return {
      valores: {
        totalConductores, capasUsadas, separacion,
        anchoRequerido, areaConductores, areaPermitida,
        alturaUsada,
        anchoSugerido, ocupacionNec, ocupacionAltura, ampacidadPct,
      },
      nota: partes.join(' '),
    };
  },
  visualizacion: 'escalerilla',
};

/**
 * Sección de conductor por ampacidad (RIC N°04).
 *
 * Cierra el cálculo que `corrienteDiseno` dejaba a medias: aquella entrega la
 * corriente a buscar en la tabla, y esta trae la tabla y devuelve la sección.
 */
const seccionConductor: Calculadora = {
  id: 'seccion-conductor-ric',
  grupo: 'conductores',
  nombre: 'Sección de conductor por ampacidad (RIC)',
  descripcion: 'Menor sección cuya capacidad de corriente, corregida por temperatura '
    + 'ambiente y agrupamiento, cubre la corriente de diseño. Usa las tablas de '
    + 'capacidad del RIC N°04 por tipo de conductor y método de instalación.',
  norma: 'RIC N°4 · Tablas 4.1, 4.4, 4.6',
  formula: 'Iz corregida = Iz tabla · ft · fn ≥ I diseño',
  campos: [
    { key: 'I', label: 'Corriente de diseño', unidad: 'A' },
    {
      key: 'tipo', label: 'Tipo de conductor', tipo: 'select', defecto: 'RZ1-K',
      opciones: tiposConductorRic().map((t) => ({
        value: t.tipo,
        label: `${t.tipo} (${t.tServicioC ?? 70} °C${t.aptoReunion ? ', apto reunión' : ''})`,
      })),
    },
    {
      key: 'metodo', label: 'Método de instalación', tipo: 'select', defecto: 'B1',
      opciones: metodosInstalacionRic().map((m) => ({
        value: m.metodo,
        label: `${m.metodo} — ${(m.descripcion ?? '').slice(0, 48)}`,
      })),
      ayuda: 'D1 y D2 son enterrados: su referencia térmica es 20 °C de suelo, no 30 °C de aire.',
    },
    { key: 'temperatura', label: 'Temperatura ambiente', unidad: '°C', defecto: 30 },
    { key: 'nConductores', label: 'Conductores activos agrupados', unidad: '', defecto: 3 },
    {
      key: 'reunion', label: 'Local de reunión de personas', tipo: 'select', defecto: 'no',
      opciones: [
        { value: 'no', label: 'No' },
        { value: 'si', label: 'Sí — exigir conductor apto' },
      ],
      ayuda: 'RIC N°04 Tabla 4.2: exige libre de halógenos, baja opacidad y baja toxicidad.',
    },
  ],
  salidas: [
    { key: 'ft', label: 'Factor por temperatura (ft)', unidad: '', decimales: 2 },
    { key: 'fn', label: 'Factor por agrupamiento (fn)', unidad: '', decimales: 2 },
    { key: 'izTabla', label: 'Iz de tabla', unidad: 'A' },
    { key: 'izCorregida', label: 'Iz corregida', unidad: 'A' },
    // Las secciones comerciales son 1,5 / 2,5 / 4 / 6…: un decimal basta.
    { key: 'seccion', label: 'Sección mínima', unidad: 'mm²', destacado: true, decimales: 1 },
    { key: 'itm', label: 'ITM normalizado', unidad: 'A', decimales: 0 },
  ],
  calcular: (e): ResultadoCalc => {
    const I = num(e, 'I');
    const temperatura = num(e, 'temperatura');
    const nConductores = num(e, 'nConductores');
    const tipo = e['tipo'] ?? 'RZ1-K';
    const metodo = e['metodo'] ?? 'B1';
    if (![I, temperatura, nConductores].every(Number.isFinite)) {
      return { valores: {}, error: 'Completa corriente, temperatura y número de conductores.' };
    }
    if (I <= 0) return { valores: {}, error: 'La corriente de diseño debe ser mayor que 0.' };
    if (nConductores < 1) return { valores: {}, error: 'El número de conductores debe ser ≥ 1.' };

    const aptoReunion = e['reunion'] === 'si';
    const r = seccionPorAmpacidad(I, {
      tipo, metodo, temperaturaC: temperatura,
      nConductores: Math.round(nConductores), aptoReunion,
    });
    if (!r) {
      const t = datosTipo(tipo);
      if (aptoReunion && t && !t.aptoReunion) {
        return {
          valores: {},
          error: `${tipo} no es apto para locales de reunión de personas (RIC N°04 Tabla 4.2). `
            + 'Usa H07Z1-K o RZ1-K.',
        };
      }
      const disponibles = metodosDe(tipo);
      if (!disponibles.includes(metodo)) {
        return {
          valores: {},
          error: `El método ${metodo} no está tabulado para ${tipo}. `
            + `Disponibles: ${disponibles.join(', ')}.`,
        };
      }
      return {
        valores: {},
        error: `Ninguna sección tabulada de ${tipo} en método ${metodo} cubre ${I} A `
          + 'con esos factores. Divide el circuito o cambia el método de instalación.',
      };
    }

    const itm = itmNormalizadoRic(I);
    const nota = itm == null
      ? 'Sobre 100 A el RIC no enumera calibres de ITM: tómalo del catálogo del fabricante.'
      : undefined;
    return {
      valores: {
        ft: r.ft, fn: r.fn, izTabla: r.izTablaA, izCorregida: r.izCorregidaA,
        seccion: r.seccionMm2, ...(itm != null ? { itm } : {}),
      },
      ...(nota ? { nota } : {}),
    };
  },
};

export const CALCULADORAS_CONDUCTORES: readonly Calculadora[] = [
  caidaPermanente,
  caidaPartida,
  corrienteDiseno,
  seccionConductor,
  tamanoDucto,
  anchoEscalerilla,
];
