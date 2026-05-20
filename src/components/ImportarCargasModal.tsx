import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  autoMapear,
  candidataACarga,
  construirCandidatas,
  parsearArchivo,
  VALORES_GLOBALES_DEFAULT,
  type ArchivoParseado,
  type CampoMapeable,
  type CargaCandidata,
  type HojaArchivo,
  type MapeoColumnas,
  type ValoresGlobales,
} from '../importers';
import { useCcmStore } from '../store/ccm';
import { fmtAmp } from '../util/format';
import { desdeKw } from '../util/potencia';
import { ARRANQUE_LABEL, type Fases, type TipoArranque, type TipoCarga, type UnidadPotencia } from '../types';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

const CAMPOS: { campo: CampoMapeable; label: string; hint?: string }[] = [
  { campo: 'tag', label: 'Tag' },
  { campo: 'descripcion', label: 'Descripción' },
  { campo: 'potencia', label: 'Potencia', hint: 'HP o kW (selecciona la unidad)' },
  { campo: 'corrienteA', label: 'In carga (A)' },
  { campo: 'tipo', label: 'Tipo carga' },
  { campo: 'arranque', label: 'Partidor / arranque', hint: 'MCP→DOL, VDF→variador, etc.' },
  { campo: 'tensionV', label: 'Tensión (V)' },
  { campo: 'fases', label: 'Fases (1F / 3F)' },
  { campo: 'factorServicio', label: 'Factor de servicio' },
];

const TIPOS: readonly TipoCarga[] = ['motor', 'resistivo', 'iluminacion', 'tomas', 'otro'];
const ARRANQUES: readonly TipoArranque[] = ['DOL', 'YD', 'suave', 'variador'];
const FASES: readonly Fases[] = ['1F', '3F'];
const UNIDADES: readonly UnidadPotencia[] = ['kW', 'HP'];

export function ImportarCargasModal({ abierto, onCerrar }: Props) {
  const importar = useCcmStore((s) => s.importar);

  const [archivo, setArchivo] = useState<ArchivoParseado | null>(null);
  const [hojaSel, setHojaSel] = useState<string>('');
  const [mapeo, setMapeo] = useState<MapeoColumnas>({});
  const [globales, setGlobales] = useState<ValoresGlobales>(VALORES_GLOBALES_DEFAULT);
  const [candidatas, setCandidatas] = useState<CargaCandidata[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hojaActual: HojaArchivo | undefined = useMemo(
    () => archivo?.hojas.find((h) => h.nombre === hojaSel),
    [archivo, hojaSel],
  );

  // Recalcula candidatas cuando cambian mapeo o globales.
  useEffect(() => {
    if (!hojaActual) {
      setCandidatas([]);
      return;
    }
    setCandidatas(construirCandidatas(hojaActual, mapeo, globales));
  }, [hojaActual, mapeo, globales]);

  if (!abierto) return null;

  async function onArchivoSeleccionado(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargando(true);
    setError(null);
    try {
      const parseado = await parsearArchivo(file);
      if (parseado.hojas.length === 0) {
        setError('El archivo no contiene hojas con datos.');
        setArchivo(null);
        return;
      }
      setArchivo(parseado);
      const primera = parseado.hojas[0]!;
      setHojaSel(primera.nombre);
      setMapeo(autoMapear(primera.headers));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al leer el archivo.');
    } finally {
      setCargando(false);
    }
  }

  function onHojaChange(nombre: string) {
    if (!archivo) return;
    setHojaSel(nombre);
    const h = archivo.hojas.find((x) => x.nombre === nombre);
    if (h) setMapeo(autoMapear(h.headers));
  }

  function onMapeoChange(campo: CampoMapeable, value: string) {
    setMapeo((prev) => ({ ...prev, [campo]: value || undefined }));
  }

  function setGlobal<K extends keyof ValoresGlobales>(k: K, v: ValoresGlobales[K]) {
    setGlobales((g) => ({ ...g, [k]: v }));
  }

  function toggleIncluir(tempId: string) {
    setCandidatas((cs) => cs.map((c) => (c.tempId === tempId ? { ...c, incluir: !c.incluir } : c)));
  }

  function confirmar(modo: 'agregar' | 'reemplazar') {
    const seleccion = candidatas.filter((c) => c.incluir);
    if (seleccion.length === 0) return;
    const cargas = seleccion.map((c, i) => candidataACarga(c, `t-${Date.now().toString(36)}-${i}`));
    importar(cargas, modo);
    cerrar();
  }

  function cerrar() {
    setArchivo(null);
    setHojaSel('');
    setMapeo({});
    setCandidatas([]);
    setError(null);
    setGlobales(VALORES_GLOBALES_DEFAULT);
    onCerrar();
  }

  const incluidas = candidatas.filter((c) => c.incluir).length;
  const conWarning = candidatas.filter((c) => c.warnings.length > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-950 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold">Importar lista de cargas</h2>
          <button onClick={cerrar} className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 text-xl leading-none">✕</button>
        </header>

        <div className="overflow-y-auto px-4 py-4 space-y-4 flex-1">
          {!archivo ? (
            <PanelSubir cargando={cargando} error={error} onChange={onArchivoSeleccionado} />
          ) : (
            <>
              <PanelArchivo archivo={archivo} hojaSel={hojaSel} onHojaChange={onHojaChange} />
              <PanelMapeo
                hoja={hojaActual!}
                mapeo={mapeo}
                onChange={onMapeoChange}
              />
              <PanelGlobales globales={globales} setGlobal={setGlobal} />
              <PanelVistaPrevia candidatas={candidatas} toggleIncluir={toggleIncluir} />
            </>
          )}
        </div>

        <footer className="flex items-center gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {archivo && `${incluidas} de ${candidatas.length} seleccionadas`}
            {conWarning > 0 && <span className="ml-2 text-amber-700 dark:text-amber-400">· {conWarning} con avisos</span>}
          </span>
          <div className="ml-auto flex gap-2">
            <button onClick={cerrar} className="px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
              Cancelar
            </button>
            <button
              onClick={() => confirmar('agregar')}
              disabled={incluidas === 0}
              className="px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Agregar al CCM
            </button>
            <button
              onClick={() => confirmar('reemplazar')}
              disabled={incluidas === 0}
              className="px-3 py-1.5 text-sm font-medium rounded bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reemplazar cargas
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

interface PanelSubirProps {
  cargando: boolean;
  error: string | null;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

function PanelSubir({ cargando, error, onChange }: PanelSubirProps) {
  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-10 text-center">
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          Selecciona un archivo <strong>.xlsx</strong>, <strong>.xls</strong> o <strong>.csv</strong> con la lista de cargas.
        </p>
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white cursor-pointer">
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.tsv"
            onChange={onChange}
            className="hidden"
            disabled={cargando}
          />
          {cargando ? 'Leyendo…' : 'Seleccionar archivo'}
        </label>
        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      <AyudaAutoCad />
    </div>
  );
}

function AyudaAutoCad() {
  return (
    <details className="border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg select-none">
        ▸ Cómo generar este archivo desde AutoCAD (DATAEXTRACTION)
      </summary>
      <div className="px-4 pb-4 pt-1 text-sm text-slate-700 dark:text-slate-300 space-y-3">
        <p>
          AutoCAD trae una herramienta nativa que extrae los atributos de los bloques del unilineal a Excel/CSV.
          Una sola vez configuras el template (<code className="px-1 bg-slate-200 dark:bg-slate-800 rounded">.dxe</code>),
          después es un click por proyecto.
        </p>

        <div>
          <div className="font-medium mb-1">Pre-requisito (una vez por template HQR)</div>
          <p>
            Los bloques de motor / partidor del unilineal deben tener atributos. Mínimo recomendado:
          </p>
          <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
            <li><code className="px-1 bg-slate-200 dark:bg-slate-800 rounded">TAG</code> — identificación (p.ej. <span className="font-mono">EM-001</span>)</li>
            <li><code className="px-1 bg-slate-200 dark:bg-slate-800 rounded">DESCRIPCION</code> — servicio (p.ej. <span className="font-mono">BOMBA AGITADOR</span>)</li>
            <li><code className="px-1 bg-slate-200 dark:bg-slate-800 rounded">HP</code> o <code className="px-1 bg-slate-200 dark:bg-slate-800 rounded">KW</code> — potencia</li>
            <li><code className="px-1 bg-slate-200 dark:bg-slate-800 rounded">PARTIDOR</code> — MCP / VDF / CB / SST</li>
            <li><code className="px-1 bg-slate-200 dark:bg-slate-800 rounded">TENSION</code>, <code className="px-1 bg-slate-200 dark:bg-slate-800 rounded">FASES</code> (opcionales si son siempre los mismos)</li>
          </ul>
        </div>

        <div>
          <div className="font-medium mb-1">Paso a paso por proyecto</div>
          <ol className="list-decimal list-inside ml-2 space-y-1">
            <li>Abre el plano del unilineal en AutoCAD.</li>
            <li>Comando: <code className="px-1 bg-slate-200 dark:bg-slate-800 rounded">DATAEXTRACTION</code> (Enter).</li>
            <li>Elige <em>"Create a new data extraction"</em> → guarda el <code className="px-1 bg-slate-200 dark:bg-slate-800 rounded">.dxe</code> con un nombre genérico (p.ej. <em>"HQR-CCM.dxe"</em>) para reusarlo en futuros proyectos.</li>
            <li>Fuente: <em>"Drawings/Sheet set"</em> → seleccionar el plano actual.</li>
            <li>Objetos: filtra solo los bloques de motor/partidor (puedes desmarcar todos y dejar los del template HQR).</li>
            <li>Propiedades: marca solo los atributos relevantes (TAG, DESCRIPCION, HP, PARTIDOR, TENSION, FASES).</li>
            <li>Vista previa: <strong>desmarca "Combine identical rows"</strong> — cada motor debe ser una fila aparte.</li>
            <li>Salida: marca <em>"Output to External File (.xls .xlsx .csv .mdb .txt)"</em> y guarda como <strong>.xlsx</strong>.</li>
            <li>Finalizar. Arrastra el archivo aquí o usa "Seleccionar archivo".</li>
          </ol>
        </div>

        <div className="rounded p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
          <strong className="text-emerald-800 dark:text-emerald-200">Auto-detección:</strong>
          <span className="text-emerald-900 dark:text-emerald-100"> la app reconoce los nombres de columna comunes (TAG, DESCRIPCION, HP, PARTIDOR, TENSION, FASES, FS) y las traducciones al inglés. Si tu template usa otros nombres, los mapeas a mano en el paso siguiente y los nombres quedan guardados para futuros archivos.</span>
        </div>

        <div className="rounded p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs">
          <strong className="text-amber-800 dark:text-amber-200">Las columnas "Count" y "Name"</strong>
          <span className="text-amber-900 dark:text-amber-100"> que agrega DATAEXTRACTION automáticamente son ignoradas — no hace falta desmarcarlas en el wizard.</span>
        </div>
      </div>
    </details>
  );
}

function PanelArchivo({
  archivo, hojaSel, onHojaChange,
}: { archivo: ArchivoParseado; hojaSel: string; onHojaChange: (n: string) => void }) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm flex items-center gap-3 flex-wrap">
      <span className="text-slate-500">Archivo:</span>
      <span className="font-medium">{archivo.nombreArchivo}</span>
      <span className="text-slate-400">·</span>
      <span className="text-slate-500">Hoja:</span>
      {archivo.hojas.length === 1 ? (
        <span>{archivo.hojas[0]!.nombre} ({archivo.hojas[0]!.filas.length} filas)</span>
      ) : (
        <select
          value={hojaSel}
          onChange={(e) => onHojaChange(e.target.value)}
          className="border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900"
        >
          {archivo.hojas.map((h) => (
            <option key={h.nombre} value={h.nombre}>{h.nombre} ({h.filas.length} filas)</option>
          ))}
        </select>
      )}
    </div>
  );
}

interface PanelMapeoProps {
  hoja: HojaArchivo;
  mapeo: MapeoColumnas;
  onChange: (campo: CampoMapeable, value: string) => void;
}

function PanelMapeo({ hoja, mapeo, onChange }: PanelMapeoProps) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
      <div className="text-sm font-medium mb-2">Mapeo de columnas</div>
      <p className="text-xs text-slate-500 mb-3">
        Auto-detectado. Cambia el origen si la app no acertó. Campos sin columna usan el valor por defecto de abajo.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {CAMPOS.map((c) => (
          <label key={c.campo} className="flex items-center gap-2 text-sm">
            <span className="text-slate-600 dark:text-slate-300 w-32 shrink-0">{c.label}</span>
            <select
              value={mapeo[c.campo] ?? ''}
              onChange={(e) => onChange(c.campo, e.target.value)}
              className="flex-1 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900 text-sm"
            >
              <option value="">— sin columna —</option>
              {hoja.headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}

interface PanelGlobalesProps {
  globales: ValoresGlobales;
  setGlobal: <K extends keyof ValoresGlobales>(k: K, v: ValoresGlobales[K]) => void;
}

function PanelGlobales({ globales, setGlobal }: PanelGlobalesProps) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
      <div className="text-sm font-medium mb-2">Valores por defecto</div>
      <p className="text-xs text-slate-500 mb-3">
        Se aplican cuando una columna del archivo no está mapeada. La unidad de potencia se autodetecta si el header dice "HP" o "kW".
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-sm">
        <label className="flex flex-col">
          <span className="text-slate-500 text-xs mb-1">Unidad potencia</span>
          <select value={globales.unidadPotencia} onChange={(e) => setGlobal('unidadPotencia', e.target.value as UnidadPotencia)}
            className="border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900">
            {UNIDADES.map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="text-slate-500 text-xs mb-1">Tensión (V)</span>
          <input type="number" value={globales.tensionV} onChange={(e) => setGlobal('tensionV', Number(e.target.value) || 0)}
            className="border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900" />
        </label>
        <label className="flex flex-col">
          <span className="text-slate-500 text-xs mb-1">Fases</span>
          <select value={globales.fases} onChange={(e) => setGlobal('fases', e.target.value as Fases)}
            className="border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900">
            {FASES.map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="text-slate-500 text-xs mb-1">FS</span>
          <input type="number" step="0.05" value={globales.factorServicio} onChange={(e) => setGlobal('factorServicio', Number(e.target.value) || 1)}
            className="border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900" />
        </label>
        <label className="flex flex-col">
          <span className="text-slate-500 text-xs mb-1">Tipo fallback</span>
          <select value={globales.tipoFallback} onChange={(e) => setGlobal('tipoFallback', e.target.value as TipoCarga)}
            className="border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900">
            {TIPOS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="text-slate-500 text-xs mb-1">Arranque motor</span>
          <select value={globales.arranqueMotorFallback} onChange={(e) => setGlobal('arranqueMotorFallback', e.target.value as TipoArranque)}
            className="border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900">
            {ARRANQUES.map((a) => <option key={a} value={a}>{ARRANQUE_LABEL[a]}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

function PanelVistaPrevia({
  candidatas, toggleIncluir,
}: { candidatas: CargaCandidata[]; toggleIncluir: (id: string) => void }) {
  if (candidatas.length === 0) {
    return (
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm text-slate-500">
        Sin filas detectadas en la hoja.
      </div>
    );
  }
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
      <div className="text-sm font-medium px-3 py-2 border-b border-slate-200 dark:border-slate-800">
        Vista previa ({candidatas.length} filas)
      </div>
      <table className="w-full text-xs">
        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
          <tr>
            <th className="px-2 py-2 w-10"></th>
            <th className="px-2 py-2 text-left font-medium">Descripción</th>
            <th className="px-2 py-2 text-left font-medium w-24">Tipo</th>
            <th className="px-2 py-2 text-right font-medium w-28">Potencia</th>
            <th className="px-2 py-2 text-right font-medium w-20">In (A)</th>
            <th className="px-2 py-2 text-right font-medium w-16">V</th>
            <th className="px-2 py-2 text-left font-medium w-14">Φ</th>
            <th className="px-2 py-2 text-right font-medium w-14">FS</th>
            <th className="px-2 py-2 text-left font-medium w-24">Arranque</th>
            <th className="px-2 py-2 text-left font-medium">Avisos</th>
          </tr>
        </thead>
        <tbody>
          {candidatas.map((c, i) => {
            const u: UnidadPotencia = c.unidadPotencia ?? 'HP';
            const pStr = c.potenciaKw != null
              ? `${desdeKw(c.potenciaKw, u).toFixed(2)} ${u}`
              : '—';
            return (
              <tr key={c.tempId}
                className={`border-t border-slate-200 dark:border-slate-800 ${c.incluir ? '' : 'opacity-50'} ${i % 2 ? 'bg-slate-50/40 dark:bg-slate-900/40' : ''}`}>
                <td className="px-2 py-1 text-center">
                  <input type="checkbox" checked={c.incluir} onChange={() => toggleIncluir(c.tempId)} />
                </td>
                <td className="px-2 py-1">{c.descripcion}</td>
                <td className="px-2 py-1">{c.tipo}</td>
                <td className="px-2 py-1 text-right tabular-nums">{pStr}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-500">{c.corrienteA != null ? fmtAmp(c.corrienteA) : '—'}</td>
                <td className="px-2 py-1 text-right tabular-nums">{c.tensionV}</td>
                <td className="px-2 py-1">{c.fases}</td>
                <td className="px-2 py-1 text-right tabular-nums">{c.factorServicio}</td>
                <td className="px-2 py-1">{c.arranque ? ARRANQUE_LABEL[c.arranque] : '—'}</td>
                <td className="px-2 py-1 text-amber-700 dark:text-amber-400">
                  {c.warnings.length > 0 ? c.warnings.join('; ') : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
