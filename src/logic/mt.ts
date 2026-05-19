import celdasData from '../data/mt/celdas-mt.json';
import envolventeData from '../data/mt/envolvente-mt.json';
import type {
  CeldaAsignadaMt,
  CeldaMtCatalogo,
  CeldasMtCatalogoRaiz,
  EnvolventeMtCatalogo,
  SalidaMt,
  TableroMt,
  TipoCeldaMt,
} from '../types';

export const CATALOGO_MT = celdasData as CeldasMtCatalogoRaiz;
export const ENVOLVENTE_MT = envolventeData as EnvolventeMtCatalogo;

const CELDAS_POR_TIPO = new Map<TipoCeldaMt, CeldaMtCatalogo>(
  CATALOGO_MT.celdas.map((c) => [c.tipo, c]),
);

/** Orden de despliegue de la línea de celdas. */
const ORDEN_TIPO: Record<TipoCeldaMt, number> = {
  entrada: 0,
  salida: 1,
  acople: 2,
  medida: 3,
};

export interface ResultadoMt {
  celdas: CeldaAsignadaMt[];
  salidasSinAsignar: SalidaMt[];
  tablero?: TableroMt;
  motivo?: string;
}

/**
 * Corriente nominal trifásica a partir de potencia aparente.
 * I[A] = S[MVA] · 1000 / (√3 · U[kV])
 */
export function corrienteDesdeMva(mva: number, kv: number): number {
  if (!(mva > 0) || !(kv > 0)) return 0;
  return (mva * 1000) / (Math.sqrt(3) * kv);
}

function corrienteDeSalida(s: SalidaMt, kv: number): number {
  if (s.corrienteA != null && s.corrienteA > 0) return s.corrienteA;
  if (s.potenciaMva != null && s.potenciaMva > 0) return corrienteDesdeMva(s.potenciaMva, kv);
  return 0;
}

function anchoCelda(tipo: TipoCeldaMt, claseTensionKv: number): number | undefined {
  const cat = CELDAS_POR_TIPO.get(tipo);
  if (!cat) return undefined;
  return cat.anchoMm[String(claseTensionKv)];
}

/** Barra mínima del catálogo cuya capacidad cubre la corriente requerida. */
export function sugerirBarraMt(corriente: number): number | undefined {
  if (!(corriente >= 0)) return undefined;
  return CATALOGO_MT.barrasA.toSorted((a, b) => a - b).find((a) => a >= corriente);
}

/**
 * Dimensionamiento del switchgear MT (celdas metal-clad genéricas).
 *  1. Cada celda toma su corriente (corrienteA o derivada de MVA) y su ancho del catálogo
 *     según el tipo y la clase de tensión.
 *  2. La barra principal se elige por la corriente requerida = máx(entrada/acople, Σ salidas).
 *  3. Las celdas se ordenan: entrada → salidas → acople → medida.
 *
 * Reglas y datos marcados como ajustables: refinar con la planilla P268 hoja
 * "SWITCHGEAR BT y MT" cuando esté disponible.
 */
export function dimensionarMt(
  salidas: readonly SalidaMt[],
  claseTensionKv: number,
  iccKa: number,
): ResultadoMt {
  if (!CATALOGO_MT.clasesTensionKv.includes(claseTensionKv)) {
    return {
      celdas: [], salidasSinAsignar: [...salidas],
      motivo: `Clase de tensión ${claseTensionKv} kV fuera de catálogo (${CATALOGO_MT.clasesTensionKv.join(', ')} kV).`,
    };
  }
  if (!CATALOGO_MT.iccKaDisponibles.includes(iccKa)) {
    return {
      celdas: [], salidasSinAsignar: [...salidas],
      motivo: `Icc ${iccKa} kA fuera de catálogo (${CATALOGO_MT.iccKaDisponibles.join(', ')} kA).`,
    };
  }

  const celdas: CeldaAsignadaMt[] = [];
  const salidasSinAsignar: SalidaMt[] = [];

  for (const s of salidas) {
    const ancho = anchoCelda(s.tipoCelda, claseTensionKv);
    if (ancho == null) {
      salidasSinAsignar.push(s);
      continue;
    }
    const corrienteA = corrienteDeSalida(s, claseTensionKv);
    celdas.push({ salida: s, anchoMm: ancho, corrienteA });
  }

  if (celdas.length === 0) {
    return { celdas, salidasSinAsignar, motivo: 'Sin celdas válidas para dimensionar.' };
  }

  celdas.sort((a, b) => {
    const d = ORDEN_TIPO[a.salida.tipoCelda] - ORDEN_TIPO[b.salida.tipoCelda];
    return d !== 0 ? d : 0;
  });

  const corrEntradaAcople = Math.max(
    0,
    ...celdas
      .filter((c) => c.salida.tipoCelda === 'entrada' || c.salida.tipoCelda === 'acople')
      .map((c) => c.corrienteA),
  );
  const sumaSalidas = celdas
    .filter((c) => c.salida.tipoCelda === 'salida')
    .reduce((acc, c) => acc + c.corrienteA, 0);
  const corrienteRequeridaA = Math.max(corrEntradaAcople, sumaSalidas);

  const corrienteBarraA = sugerirBarraMt(corrienteRequeridaA);
  if (corrienteBarraA == null) {
    return {
      celdas, salidasSinAsignar,
      motivo: `Sin barra MT en catálogo para ${corrienteRequeridaA.toFixed(0)} A (máx ${Math.max(...CATALOGO_MT.barrasA)} A).`,
    };
  }

  const anchoTotalMm = celdas.reduce((acc, c) => acc + c.anchoMm, 0);

  const tablero: TableroMt = {
    tipo: 'MT',
    claseTensionKv,
    iccKa,
    corrienteBarraA,
    corrienteRequeridaA,
    celdas,
    anchoTotalMm,
    altoTotalMm: ENVOLVENTE_MT.altoTotalMm,
    profundidadTotalMm: ENVOLVENTE_MT.profundidadMm,
  };

  return { celdas, salidasSinAsignar, tablero };
}
