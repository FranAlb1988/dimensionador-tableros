// Serializa/deserializa el estado de proyecto: CCM + TDG + CDC, con multi-tablero.
// Versionado: v3 = multi-tablero (lista de tableros por tipo).
// Retrocompat: v1/v2 (single-tablero) se migran a un solo tablero por tipo.

import type { Carga, EquipoAuxiliar, Norma } from '../types';
import { useCcmStore, type CcmTablero } from './ccm';
import { useTdgStore, type SubtipoTdg, type TdgTablero } from './tdg';
import { useCdcStore, type CdcTablero, type SubtipoCdc } from './cdc';
import { useAuxiliaresStore } from './auxiliares';
import { METADATOS_VACIOS, useMetaStore, type MetadatosProyecto } from './proyecto-meta';
import { OPCIONES_CDC_DEFAULT, type OpcionesCdc } from '../logic/cdc';

const VERSION = 5;
const META_APP = 'dimensionador-tableros';

export interface ProyectoSerializado {
  app: string;
  version: number;
  exportadoEn: string;
  metadatos: MetadatosProyecto;
  ccm: { tableros: CcmTablero[]; activoId: string | null };
  tdg: { tableros: TdgTablero[]; activoId: string | null };
  cdc: { tableros: CdcTablero[]; activoId: string | null };
  auxiliares: { equipos: EquipoAuxiliar[] };
}

let migId = 0;
function nuevoIdMig(prefix: string): string {
  migId += 1;
  return `${prefix}-mig-${Date.now().toString(36)}-${migId}`;
}

export function capturarProyecto(): ProyectoSerializado {
  const ccm = useCcmStore.getState();
  const tdg = useTdgStore.getState();
  const cdc = useCdcStore.getState();
  const aux = useAuxiliaresStore.getState();
  const meta = useMetaStore.getState();
  return {
    app: META_APP,
    version: VERSION,
    exportadoEn: new Date().toISOString(),
    metadatos: meta.metadatos,
    ccm: { tableros: ccm.tableros, activoId: ccm.activoId },
    tdg: { tableros: tdg.tableros, activoId: tdg.activoId },
    cdc: { tableros: cdc.tableros, activoId: cdc.activoId },
    auxiliares: { equipos: aux.equipos },
  };
}

export function aplicarProyecto(data: unknown): void {
  const p = validar(data);
  useMetaStore.setState({ metadatos: p.metadatos });
  useCcmStore.setState({ tableros: p.ccm.tableros, activoId: p.ccm.activoId });
  useTdgStore.setState({ tableros: p.tdg.tableros, activoId: p.tdg.activoId });
  useCdcStore.setState({ tableros: p.cdc.tableros, activoId: p.cdc.activoId });
  useAuxiliaresStore.setState({ equipos: p.auxiliares.equipos });
}

export function nuevoProyecto(): void {
  // Deja un único tablero vacío por tipo (default subtipo general) y lista de auxiliares vacía.
  const ccmT: CcmTablero = { id: nuevoIdMig('ccm'), nombre: 'Tablero 1', norma: 'NEMA', cargas: [] };
  const tdgT: TdgTablero = { id: nuevoIdMig('tdg'), nombre: 'Tablero 1', subtipo: 'general', norma: 'NEMA', factorSimultaneidad: 0.8, salidas: [] };
  const cdcT: CdcTablero = { id: nuevoIdMig('cdc'), nombre: 'Tablero 1', subtipo: 'general', opciones: { ...OPCIONES_CDC_DEFAULT }, cargas: [] };
  useCcmStore.setState({ tableros: [ccmT], activoId: ccmT.id });
  useTdgStore.setState({ tableros: [tdgT], activoId: tdgT.id });
  useCdcStore.setState({ tableros: [cdcT], activoId: cdcT.id });
  useAuxiliaresStore.setState({ equipos: [] });
  useMetaStore.setState({ metadatos: { ...METADATOS_VACIOS } });
}

export function descargarProyecto(nombre: string = nombreArchivoPorDefecto()): void {
  const data = capturarProyecto();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre.endsWith('.json') ? nombre : `${nombre}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function cargarDesdeArchivo(file: File): Promise<void> {
  const txt = await file.text();
  const data = JSON.parse(txt);
  aplicarProyecto(data);
}

function nombreArchivoPorDefecto(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `dimensionador-${yyyy}${mm}${dd}-${hh}${mi}.json`;
}

interface ProyectoV1Like {
  app?: string;
  version?: number;
  exportadoEn?: string;
  ccm?: { norma?: Norma; cargas?: Carga[] };
  tdg?: { norma?: Norma; factorSimultaneidad?: number; salidas?: Carga[] };
  cdc?: { opciones?: OpcionesCdc; cargas?: Carga[] };
}

interface ProyectoV3Like {
  app?: string;
  version?: number;
  exportadoEn?: string;
  metadatos?: Partial<MetadatosProyecto>;
  ccm?: { tableros?: CcmTablero[]; activoId?: string | null };
  tdg?: { tableros?: TdgTablero[]; activoId?: string | null };
  cdc?: { tableros?: CdcTablero[]; activoId?: string | null };
  auxiliares?: { equipos?: EquipoAuxiliar[] };
}

function validar(data: unknown): ProyectoSerializado {
  if (!data || typeof data !== 'object') throw new Error('Archivo inválido: no es un objeto JSON.');
  const d = data as ProyectoV1Like & ProyectoV3Like;
  if (d.app !== META_APP) {
    throw new Error(`Archivo no reconocido (app = ${d.app ?? 'sin marca'}). Se esperaba "${META_APP}".`);
  }
  const version = typeof d.version === 'number' ? d.version : 0;
  if (version > VERSION) {
    throw new Error(
      `El archivo proviene de una versión más nueva (v${version}). Esta app soporta hasta v${VERSION}.`,
    );
  }

  // v3 = multi-tablero. Archivos guardados antes de Fase 2 pueden no traer `subtipo`; se rellena.
  if (version >= 3) {
    const ccmTableros = Array.isArray(d.ccm?.tableros) ? d.ccm!.tableros! : [];
    const tdgTablerosRaw = Array.isArray(d.tdg?.tableros) ? d.tdg!.tableros! : [];
    const cdcTablerosRaw = Array.isArray(d.cdc?.tableros) ? d.cdc!.tableros! : [];
    if (ccmTableros.length === 0 || tdgTablerosRaw.length === 0 || cdcTablerosRaw.length === 0) {
      throw new Error('Cada tipo de tablero debe tener al menos uno.');
    }
    const tdgTableros: TdgTablero[] = tdgTablerosRaw.map((t) => ({
      ...t,
      subtipo: (t.subtipo ?? 'general') as SubtipoTdg,
    }));
    const cdcTableros: CdcTablero[] = cdcTablerosRaw.map((t) => ({
      ...t,
      subtipo: (t.subtipo ?? 'general') as SubtipoCdc,
    }));
    const auxEquipos: EquipoAuxiliar[] = Array.isArray(d.auxiliares?.equipos)
      ? d.auxiliares!.equipos!
      : [];

    const metadatos: MetadatosProyecto = { ...METADATOS_VACIOS, ...(d.metadatos ?? {}) };

    return {
      app: META_APP,
      version: VERSION,
      exportadoEn: d.exportadoEn ?? new Date().toISOString(),
      metadatos,
      ccm: { tableros: ccmTableros, activoId: d.ccm?.activoId ?? ccmTableros[0]!.id },
      tdg: { tableros: tdgTableros, activoId: d.tdg?.activoId ?? tdgTableros[0]!.id },
      cdc: { tableros: cdcTableros, activoId: d.cdc?.activoId ?? cdcTableros[0]!.id },
      auxiliares: { equipos: auxEquipos },
    };
  }

  // v1/v2 = single-tablero por tipo. Convertir a multi.
  if (!d.ccm || !d.tdg) throw new Error('Estructura inválida: faltan secciones CCM o TDG.');
  if (!Array.isArray(d.ccm.cargas) || !Array.isArray(d.tdg.salidas)) {
    throw new Error('Estructura inválida: cargas o salidas no son arrays.');
  }
  const ccmNorma: Norma = d.ccm.norma === 'IEC' ? 'IEC' : 'NEMA';
  const tdgNorma: Norma = d.tdg.norma === 'IEC' ? 'IEC' : 'NEMA';
  const fs = typeof d.tdg.factorSimultaneidad === 'number' && d.tdg.factorSimultaneidad > 0
    ? d.tdg.factorSimultaneidad
    : 0.8;
  const cdcCargas = Array.isArray(d.cdc?.cargas) ? d.cdc!.cargas! : [];
  const cdcOpciones: OpcionesCdc = {
    modulosPorFila: typeof d.cdc?.opciones?.modulosPorFila === 'number' ? d.cdc!.opciones!.modulosPorFila : OPCIONES_CDC_DEFAULT.modulosPorFila,
    reservaPorFila: typeof d.cdc?.opciones?.reservaPorFila === 'number' ? d.cdc!.opciones!.reservaPorFila : OPCIONES_CDC_DEFAULT.reservaPorFila,
  };

  const ccmT: CcmTablero = { id: nuevoIdMig('ccm'), nombre: 'Tablero 1', norma: ccmNorma, cargas: d.ccm.cargas };
  const tdgT: TdgTablero = { id: nuevoIdMig('tdg'), nombre: 'Tablero 1', subtipo: 'general', norma: tdgNorma, factorSimultaneidad: fs, salidas: d.tdg.salidas };
  const cdcT: CdcTablero = { id: nuevoIdMig('cdc'), nombre: 'Tablero 1', subtipo: 'general', opciones: cdcOpciones, cargas: cdcCargas };

  return {
    app: META_APP,
    version: VERSION,
    exportadoEn: d.exportadoEn ?? new Date().toISOString(),
    metadatos: { ...METADATOS_VACIOS },
    ccm: { tableros: [ccmT], activoId: ccmT.id },
    tdg: { tableros: [tdgT], activoId: tdgT.id },
    cdc: { tableros: [cdcT], activoId: cdcT.id },
    auxiliares: { equipos: [] },
  };
}
