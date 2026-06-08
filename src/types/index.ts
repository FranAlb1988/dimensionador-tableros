// Tipos de dominio del dimensionador.

export type TipoTablero = 'CCM' | 'CDC' | 'TDG' | 'MT';

/** Norma del catálogo: IEC (Schneider Compact NSX, TeSys, Blokset) o NEMA (ANSI frames, NEMA contactors, X=6"). */
export type Norma = 'IEC' | 'NEMA';

// ----- Equipos auxiliares (documentación, sin dimensionado) -----

export type CategoriaAuxiliar = 'instrumentacion' | 'ups' | 'baterias' | 'cargador';

export interface EquipoAuxiliar {
  id: string;
  categoria: CategoriaAuxiliar;
  tag: string;
  descripcion: string;
  marca?: string;
  modelo?: string;
  ubicacion?: string;

  // Campos técnicos — se completan los que aplican por categoría.
  tensionVac?: number;       // UPS, Cargador (entrada o salida AC)
  tensionVdc?: number;       // UPS (salida), Banco baterías, Cargador (salida)
  potenciaKva?: number;      // UPS, Cargador
  autonomiaMin?: number;     // UPS
  capacidadAh?: number;      // Banco baterías
  cantidadCeldas?: number;   // Banco baterías
  tipoTecnologia?: string;   // Banco baterías (Pb-Ácido, Ni-Cd, Litio)
  corrienteSalidaA?: number; // Cargador
  modulosIo?: number;        // Instrumentación
  consumoW?: number;         // Instrumentación
  comunicacion?: string;     // Instrumentación

  notas?: string;
}

export type TipoCarga = 'motor' | 'resistivo' | 'iluminacion' | 'tomas' | 'otro';

export type Fases = '1F' | '3F';

export type TipoArranque = 'DOL' | 'YD' | 'suave' | 'variador';

/** Etiquetas de display para cada tipo de arranque (las claves internas se mantienen). */
export const ARRANQUE_LABEL: Record<TipoArranque, string> = {
  DOL: 'Partida Directa',
  YD: 'YD',
  suave: 'PSV',
  variador: 'VSD',
};

export type UnidadPotencia = 'kW' | 'HP';

export interface Carga {
  id: string;
  descripcion: string;
  tipo: TipoCarga;
  /** Potencia canónica en kW. Si se ingresó en HP, se almacena como kW (HP × 0.7457). */
  potenciaKw?: number;
  /** Unidad preferida de visualización/entrada. Default 'kW'. */
  unidadPotencia?: UnidadPotencia;
  /** Corriente nominal en A. Si no se da, se calcula desde potencia + tensión. */
  corrienteA?: number;
  /**
   * Corriente que define el frame mínimo del interruptor (A).
   * Si se ingresa, el NSX sugerido tendrá In ≥ este valor.
   * Como la familia (NSX100/160/250/400/630) define el tamaño de gaveta,
   * esto permite forzar un frame mayor que el estrictamente necesario.
   */
  corrienteProteccionA?: number;
  tensionV: number;
  fases: Fases;
  factorServicio: number;
  /** Solo aplica a motores. */
  arranque?: TipoArranque;
}

/** Tamaños relativos de gaveta Blokset. */
export type TamanoGaveta = '1/4' | '1/2' | '1' | '1+1/2' | '2';

export interface Gaveta {
  id: string;
  tamano: TamanoGaveta;
  /** Alto en mm de la gaveta. */
  altoMm: number;
  /** Versión. */
  version: 'fija' | 'extraible';
  /** Descripción del contenido alojado (motor + arranque, alimentador, etc.). */
  contenido: string;
  /** Referencia de la carga si aplica. */
  cargaId?: string;
  protecciones: Proteccion[];
}

/** Marca/fabricante del interruptor. */
export type MarcaProteccion = 'Schneider' | 'ABB' | 'Chint';

export type FamiliaProteccion =
  // Schneider
  | 'NSXm'
  | 'NSX100'
  | 'NSX160'
  | 'NSX250'
  | 'NSX400'
  | 'NSX630'
  | 'MasterpactNT'
  | 'MasterpactNW'
  | 'iC60N'
  | 'iC60H'
  // ABB Tmax (MCCB) y Emax 2 (ACB)
  | 'TmaxXT2'
  | 'TmaxXT4'
  | 'TmaxT4'
  | 'TmaxT5'
  | 'EmaxE1.2'
  | 'EmaxE2.2'
  | 'EmaxE4.2'
  | 'EmaxE6.2'
  // Chint NA1 (ACB)
  | 'NA1-2000'
  | 'NA1-3200'
  | 'NA1-4000'
  | 'NA1-6300';

export interface Proteccion {
  id: string;
  familia: FamiliaProteccion;
  /** Marca del interruptor (por defecto Schneider si se omite). */
  marca?: MarcaProteccion;
  /** Referencia comercial. */
  referencia: string;
  /** Corriente nominal en A. */
  inA: number;
  /** Capacidad de corte en kA. */
  icuKA: number;
  polos: 1 | 2 | 3 | 4;
  curva?: 'B' | 'C' | 'D' | 'TM-D' | 'MA';
  /** Módulos DIN ocupados (para CDC). */
  modulosDin?: number;
  placeholder?: boolean;
  notas?: string;
}

export interface Arrancador {
  id: string;
  /** Referencia del contactor TeSys. */
  contactor: string;
  /** Referencia del relé térmico o electrónico. */
  releTermico?: string;
  /** Tipo de arranque que materializa. */
  tipo: TipoArranque;
  /** Potencia nominal AC-3 a 400 V en kW. */
  potenciaKw400V: number;
  /** Tamaño de gaveta sugerido para alojarlo (junto al interruptor). */
  tamanoGaveta: TamanoGaveta;
  placeholder?: boolean;
  notas?: string;
}

export interface DefinicionGavetaCatalogo {
  tamano: TamanoGaveta;
  /** Alto típico en mm para Blokset. */
  altoMm: number;
  /** Cuántas unidades base equivale (ej. ¼ = 1, ½ = 2, 1 = 4, 1½ = 6, 2 = 8). */
  unidadesBase: number;
  placeholder?: boolean;
}

export interface DefinicionColumnaCatalogo {
  altoTotalMm: number;
  anchoMm: number;
  profundidadMm: number;
  reservaCabezalMm: number;
  reservaZocaloMm: number;
  altoUtilMm: number;
}

export interface Columna {
  id: string;
  /** Alto útil disponible en mm para gavetas. */
  altoUtilMm: number;
  /** Ancho de columna típico Blokset en mm. */
  anchoMm: number;
  /** Profundidad en mm. */
  profundidadMm: number;
  gavetas: Gaveta[];
  /** Espacio sobrante en mm tras alojar las gavetas. */
  espacioRemanenteMm: number;
  /**
   * Columna de incoming/acometida: entrada de cables, lugs, conexión a barras
   * y compartimento de medida. Sin gavetas de salida.
   */
  esIncoming?: boolean;
}

/**
 * Equipos de medida del CCM: transformadores de tensión (PT) y de corriente
 * (CT), luces piloto e instrumento de medida. Van en un compartimento de medida.
 */
export interface MedidaCcm {
  /** Transformadores de tensión (PT). */
  transformadoresTension: number;
  /** Transformadores de corriente (CT). */
  transformadoresCorriente: number;
  /** Luces piloto (presencia de fase). */
  lucesPiloto: number;
  /** Instrumento de medida. */
  instrumento: string;
}

export interface Tablero {
  tipo: TipoTablero;
  columnas: Columna[];
  /** Reservas verticales por columna (cabezal de barras + zócalo) en mm. */
  reservaCabezalMm: number;
  reservaZocaloMm: number;
  /** Equipos de medida del CCM. */
  medida: MedidaCcm;
  /** FLC total sumada (corriente de diseño de las cargas). */
  corrienteTotalA: number;
  /** Factor F2 de derrateo por altura aplicado (1 = sin derrateo). */
  factorDerrateoAltura: number;
  /** Corriente con que se selecciona la barra: FLC / F2. */
  corrienteSeleccionBarraA: number;
  /** Barra principal sugerida (undefined si la corriente excede el catálogo). */
  barra?: Barra;
  /** Dimensiones totales en mm. */
  altoTotalMm: number;
  anchoTotalMm: number;
  profundidadTotalMm: number;
}

export interface AsignacionCarga {
  carga: Carga;
  proteccion: Proteccion;
  arrancador?: Arrancador;
  gaveta: Gaveta;
}

// ----- CCM NEMA -----

export interface MotorNemaCatalogo {
  hp: number;
  kw: number;
  /** Corriente de plena carga en A (a la tensión del catálogo: 400 V por defecto en AB CENTERLINE 2100). */
  flaA: number | null;
  /** Frame del Motor Circuit Protector en A (AT = Ampere Trip). */
  mcpFrameA: number | null;
  /** Módulo de sensado de sobrecarga (p.ej. "0.5-30 A (E300)"). */
  moduloOL: string | null;
  /** Tamaño NEMA del contactor (1-9). */
  contactorSize: number | null;
  /** Espacios CENTERLINE 2100 (1 espacio = 6" = 152,4 mm). Fraccional permitido (1.5, 2, 2.5, 3.5, 6). */
  espaciosX: number;
  version: 'extraible' | 'fijo';
}

export interface BreakerNemaFrame {
  frameAF: number;
  icuRange: string;
  espaciosX: number;
}

export interface BreakerNemaRating {
  frameAF: number;
  /** Texto comercial (p.ej. "100AT", "400AS"). */
  trip?: string;
  setting?: string;
  /** Valor numérico — para FDR es trip (AT), para electronic es setting (AS). */
  tripA?: number;
  settingA?: number;
}

export interface BreakerNemaSeleccionado {
  frameAF: number;
  /** AT (FDR) o AS (electronic). */
  rating: string;
  ratingA: number;
  ratingTipo: 'AT' | 'AS';
  espaciosX: number;
  icuRange: string;
}

export interface BarraNemaCatalogo {
  flcMin: number;
  flcMax: number;
  capacidadA: number;
  tiempoCociS: number;
}

export interface EnvolventeCcmNemaCatalogo {
  xMm: number;
  altoTotalMm: number;
  altoUtilXEspacios: number;
  altoUtilMm: number;
  anchoColumnaMm: number;
  profundidadMm: number;
  reservaCabezalMm: number;
}

export interface AsignacionCcmNema {
  carga: Carga;
  /** Solo presente para tipo motor. */
  motor?: MotorNemaCatalogo;
  /** Solo presente para alimentador (no motor). */
  breaker?: BreakerNemaSeleccionado;
  /** Espacios X que ocupa la gaveta (suma motor + breaker). */
  espaciosX: number;
  version: 'extraible' | 'fijo';
  /** Corriente de diseño usada para la asignación (A). */
  corrienteDisenoA: number;
}

export interface ColumnaCcmNema {
  indice: number;
  altoUtilXEspacios: number;
  asignaciones: AsignacionCcmNema[];
  espaciosUsados: number;
  espaciosLibres: number;
  /**
   * Columna de incoming/acometida: entrada de cables, lugs, conexión a barras
   * y compartimento de medida. Sin gavetas/asignaciones de salida.
   */
  esIncoming?: boolean;
}

export interface TableroCcmNema {
  norma: 'NEMA';
  tipo: 'CCM';
  columnas: ColumnaCcmNema[];
  /** FLC sumada (corriente real de las cargas, sin derrateo). */
  corrienteTotalA: number;
  /** Equipos de medida del CCM. */
  medida: MedidaCcm;
  /** Factor F2 de derrateo por altura aplicado (1 = sin derrateo). */
  factorDerrateoAltura: number;
  /** Corriente con que se seleccionó la barra: corrienteTotalA / F2. */
  corrienteSeleccionBarraA: number;
  barra: BarraNemaCatalogo;
  altoTotalMm: number;
  anchoTotalMm: number;
  profundidadTotalMm: number;
  xMm: number;
}

// ----- CCM MT (Allen-Bradley CENTERLINE 2500 — vacuum contactors) -----

export interface ContactorMtCatalogo {
  /** Corriente nominal continua del contactor (A). */
  frameA: number;
  /** Texto comercial p. ej. "AB SVR 720 A (vacuum)". */
  modelo: string;
  /** Clases de tensión soportadas (kV). */
  claseKv: readonly number[];
  /**
   * Espacios verticales que ocupa el starter en la columna estándar de la
   * envolvente (la columna tiene `espaciosVerticales` totales — típicamente 2).
   */
  espaciosColumnaV: number;
}

export interface EnvolventeCcmMtCatalogo {
  anchoColumnaMm: number;
  altoTotalMm: number;
  profundidadMm: number;
  /** Espacios verticales que tiene cada columna para alojar starters. */
  espaciosVerticales: number;
}

export interface ProteccionMtCatalogo {
  /** Modelo del relé multifunción. */
  modelo: string;
  /** Funciones ANSI que cubre (49, 50, 51, 46, …). */
  ansi: readonly string[];
}

export interface AsignacionCcmMt {
  carga: Carga;
  contactor: ContactorMtCatalogo;
  /** Relé de protección de la celda del starter. */
  proteccion: ProteccionMtCatalogo;
  /** Espacios verticales que ocupa este starter. */
  espaciosV: number;
  /** Corriente de diseño usada en la asignación (A, en lado del motor). */
  corrienteDisenoA: number;
}

export interface ColumnaCcmMt {
  indice: number;
  asignaciones: AsignacionCcmMt[];
  espaciosUsados: number;
  espaciosLibres: number;
}

export interface PrincipalMtCatalogo {
  /** Corriente nominal del interruptor de entrada (A). */
  frameA: number;
  modelo: string;
}

export interface TableroCcmMt {
  tipo: 'CCM';
  norma: 'MT';
  columnas: ColumnaCcmMt[];
  /** FLA total (suma de corrientes de diseño en lado del motor). */
  corrienteTotalA: number;
  /** Factor F2 de derrateo aplicado (1 = sin derrateo). */
  factorDerrateoAltura: number;
  /** Corriente con que se selecciona el contactor / barra: I_diseño / F2. */
  corrienteSeleccionBarraA: number;
  /** Capacidad de la barra principal seleccionada (A). */
  barraA: number;
  /** Interruptor general de la celda de entrada. */
  principal: PrincipalMtCatalogo;
  /** Relé de protección de la celda de entrada (alimentador). */
  proteccionEntrada: ProteccionMtCatalogo;
  /** Si el lineup incluye una celda de medida (PT/CT). */
  incluyeMedida: boolean;
  altoTotalMm: number;
  anchoTotalMm: number;
  profundidadTotalMm: number;
}

// ----- TDG NEMA -----

export interface SwitchgearBtBarraNema {
  flcMin: number;
  flcMax: number;
  frameAF: number;
}

export interface SwitchgearBtMainNema {
  flcMin: number;
  flcMax: number;
  frameAF: number;
  rating: string;
  ratingA: number;
}

export interface EnvolventeTdgNemaCatalogo {
  altoTotalMm: number;
  anchoColumnaMm: number;
  profundidadMm: number;
  reservaPrincipalMm: number;
  reservaBarrasMm: number;
  reservaZocaloMm: number;
  altoUtilSalidasMm: number;
  altoCeldaSalidaMm: number;
}

export interface SalidaAsignadaNema {
  carga: Carga;
  breaker: BreakerNemaSeleccionado;
  /** Corriente de diseño usada (A). */
  corrienteDisenoA: number;
}

export interface TableroTdgNema {
  norma: 'NEMA';
  tipo: 'TDG';
  principal: SwitchgearBtMainNema;
  barra: SwitchgearBtBarraNema;
  salidas: SalidaAsignadaNema[];
  /** FLC total (suma × factor de simultaneidad). */
  corrienteTotalA: number;
  factorSimultaneidad: number;
  /** 1 columna principal + columnas de salidas. */
  columnas: number;
  altoTotalMm: number;
  anchoTotalMm: number;
  profundidadTotalMm: number;
}

// ----- TDG -----

export interface Barra {
  id: string;
  /** Texto comercial, p.ej. "Cu 80×5 mm". */
  referencia: string;
  /** Capacidad nominal en A. */
  inA: number;
  material: 'Cu' | 'Al';
  /** Texto descriptivo de geometría, p.ej. "80×5" o "2×(160×10)". */
  dimensionMm: string;
  /** Sección recta total por fase en mm². */
  seccionMm2: number;
  placeholder?: boolean;
  notas?: string;
}

export interface EnvolventePrismaCatalogo {
  altoTotalMm: number;
  anchoColumnaMm: number;
  profundidadMm: number;
  reservaPrincipalMm: number;
  reservaBarrasMm: number;
  reservaZocaloMm: number;
  altoUtilSalidasMm: number;
}

export interface SalidaAsignada {
  carga: Carga;
  proteccion: Proteccion;
  /** Corriente de diseño usada para la asignación (A). */
  corrienteDisenoA: number;
}

// ----- CDC -----

export interface CofreCatalogo {
  id: string;
  referencia: string;
  modulosPorFila: number;
  filas: number;
  altoMm: number;
  anchoMm: number;
  profundidadMm: number;
  placeholder?: boolean;
}

/** Una fila DIN dentro de un cofre, ocupada por interruptores. */
export interface FilaDin {
  /** Posición 1..N dentro del cofre. */
  indice: number;
  modulosTotales: number;
  /** Lista de interruptores en orden, con la carga asociada. */
  modulos: AsignacionCdc[];
  /** Módulos reservados (p.ej. para diferencial cabecera). */
  reserva: number;
  /** Módulos libres tras carga + reserva. */
  modulosLibres: number;
}

export interface AsignacionCdc {
  carga: Carga;
  proteccion: Proteccion;
  /** Módulos DIN que ocupa esta protección (1..4). */
  modulosDin: number;
  /** Corriente de diseño (A) usada para la asignación. */
  corrienteDisenoA: number;
}

export interface Cofre {
  indice: number;
  catalogo: CofreCatalogo;
  filas: FilaDin[];
}

export interface TableroCdc {
  tipo: 'CDC';
  cofres: Cofre[];
  totalAsignaciones: number;
  totalModulos: number;
  /** Reserva (módulos) por fila aplicada en este dimensionado. */
  reservaPorFila: number;
  altoTotalMm: number;
  anchoTotalMm: number;
  profundidadTotalMm: number;
}

export interface TableroTdg {
  tipo: 'TDG';
  principal: Proteccion;
  barra: Barra;
  salidas: SalidaAsignada[];
  /** Suma de corrientes de diseño afectada por simultaneidad (A). */
  corrienteTotalA: number;
  factorSimultaneidad: number;
  /** Cantidad de columnas Prisma (1 + columnas-salidas). */
  columnas: number;
  altoTotalMm: number;
  anchoTotalMm: number;
  profundidadTotalMm: number;
}

// ----- MT (switchgear media tensión — celdas metal-clad genéricas) -----

export type TipoCeldaMt = 'entrada' | 'salida' | 'acople' | 'medida';

export const TIPO_CELDA_MT_LABEL: Record<TipoCeldaMt, string> = {
  entrada: 'Entrada',
  salida: 'Salida / alimentador',
  acople: 'Acople de barras',
  medida: 'Medida',
};

export interface CeldaMtCatalogo {
  tipo: TipoCeldaMt;
  /** Ancho de la celda (mm) indexado por clase de tensión (kV) como string. */
  anchoMm: Record<string, number>;
}

export interface CeldasMtCatalogoRaiz {
  clasesTensionKv: number[];
  iccKaDisponibles: number[];
  barrasA: number[];
  celdas: CeldaMtCatalogo[];
}

export interface EnvolventeMtCatalogo {
  altoTotalMm: number;
  profundidadMm: number;
  altoCompartimentoAltaMm: number;
  altoCompartimentoControlMm: number;
  zocaloMm: number;
}

/** Una celda definida por el usuario (entrada de datos). */
export interface SalidaMt {
  id: string;
  descripcion: string;
  tipoCelda: TipoCeldaMt;
  /** Potencia aparente en MVA (opcional, para derivar corriente si no se da corrienteA). */
  potenciaMva?: number;
  /** Corriente nominal en A. Si se ingresa, prevalece sobre la derivada de MVA. */
  corrienteA?: number;
}

export interface CeldaAsignadaMt {
  salida: SalidaMt;
  anchoMm: number;
  /** Corriente de diseño usada (A). */
  corrienteA: number;
}

export interface TableroMt {
  tipo: 'MT';
  claseTensionKv: number;
  iccKa: number;
  /** Barra principal seleccionada del catálogo (A). */
  corrienteBarraA: number;
  /** Corriente de diseño que define la barra (A). */
  corrienteRequeridaA: number;
  celdas: CeldaAsignadaMt[];
  anchoTotalMm: number;
  altoTotalMm: number;
  profundidadTotalMm: number;
}
