import type { ChangeEvent } from 'react';
import { ARRANQUE_LABEL, FASES, TIPOS_ARRANQUE, TIPOS_CARGA, useCcmCargas, useCcmStore } from '../store/ccm';
import type { Carga, UnidadPotencia } from '../types';
import { corrienteNominal } from '../logic/corriente';
import { fmtAmp } from '../util/format';
import { aKw, desdeKw } from '../util/potencia';

const inputCls =
  'w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded ' +
  'px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 ' +
  'text-sm tabular-nums';

const inputTexto = inputCls.replace('tabular-nums', '');

export function TablaCargas() {
  const cargas = useCcmCargas();
  const agregar = useCcmStore((s) => s.agregar);
  const eliminar = useCcmStore((s) => s.eliminar);
  const duplicar = useCcmStore((s) => s.duplicar);
  const actualizar = useCcmStore((s) => s.actualizar);
  const cargarEjemplo = useCcmStore((s) => s.cargarEjemplo);
  const limpiarStore = useCcmStore((s) => s.limpiar);

  const limpiar = () => {
    if (cargas.length === 0) return;
    const ok = window.confirm(`¿Eliminar las ${cargas.length} cargas del CCM? Esta acción no se puede deshacer.`);
    if (ok) limpiarStore();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button onClick={agregar} className={btnPrimary}>+ Agregar carga</button>
        {cargas.length === 0 && (
          <button onClick={cargarEjemplo} className={btnSecondary}>Cargar ejemplo</button>
        )}
        {cargas.length > 0 && (
          <button onClick={limpiar} className={`${btnDanger} ml-auto`}>Limpiar todo</button>
        )}
      </div>

      {cargas.length === 0 ? (
        <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center text-slate-500">
          No hay cargas. Agrega una o carga el ejemplo.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold border-b border-slate-200 dark:border-slate-800 min-w-[14rem]">
                  Descripción
                </th>
                <th className="px-3 py-2.5 text-left font-semibold border-b border-slate-200 dark:border-slate-800 w-32">
                  Tipo
                </th>
                <th className="px-3 py-2.5 text-right font-semibold border-b border-slate-200 dark:border-slate-800 w-36">
                  Potencia
                </th>
                <th className="px-3 py-2.5 text-right font-semibold border-b border-slate-200 dark:border-slate-800 w-20">V</th>
                <th className="px-3 py-2.5 text-left font-semibold border-b border-slate-200 dark:border-slate-800 w-16">Φ</th>
                <th className="px-3 py-2.5 text-right font-semibold border-b border-slate-200 dark:border-slate-800 w-16" title="Factor de servicio">FS</th>
                <th
                  className="px-3 py-2.5 text-right font-semibold border-b border-slate-200 dark:border-slate-800 w-24"
                  title="Corriente nominal de la carga (override). Si está vacío, se calcula desde P y V."
                >
                  In carga
                </th>
                <th
                  className="px-3 py-2.5 text-right font-semibold border-b border-slate-200 dark:border-slate-800 w-24 bg-slate-50 dark:bg-slate-800/50"
                  title="Corriente calculada (P / (√3 · V · cosφ · η)). Solo lectura."
                >
                  I calc
                </th>
                <th
                  className="px-3 py-2.5 text-right font-semibold border-b border-slate-200 dark:border-slate-800 w-24"
                  title="Corriente que define el frame del NSX (define el tamaño de gaveta). Opcional — fuerza el In mínimo del interruptor."
                >
                  I prot.
                </th>
                <th className="px-3 py-2.5 text-left font-semibold border-b border-slate-200 dark:border-slate-800 w-32">
                  Arranque
                </th>
                <th className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {cargas.map((c, i) => (
                <FilaCarga
                  key={c.id}
                  carga={c}
                  zebra={i % 2 === 1}
                  onChange={(p) => actualizar(c.id, p)}
                  onDuplicar={() => duplicar(c.id)}
                  onEliminar={() => eliminar(c.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const btnPrimary =
  'px-3 py-1.5 text-sm font-medium rounded bg-slate-900 text-white hover:bg-slate-700 ' +
  'dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white';
const btnSecondary =
  'px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 ' +
  'hover:bg-slate-100 dark:hover:bg-slate-800';
const btnDanger =
  'px-3 py-1.5 text-sm font-medium rounded text-red-700 hover:bg-red-50 ' +
  'dark:text-red-400 dark:hover:bg-red-950';

interface FilaProps {
  carga: Carga;
  zebra: boolean;
  onChange: (parcial: Partial<Carga>) => void;
  onDuplicar: () => void;
  onEliminar: () => void;
}

/** Display de potencia en la unidad elegida, redondeado a 2 decimales. */
function potenciaMostrada(carga: Carga): string {
  if (carga.potenciaKw == null) return '';
  const u: UnidadPotencia = carga.unidadPotencia ?? 'HP';
  const v = desdeKw(carga.potenciaKw, u);
  return Number(v.toFixed(2)).toString();
}

function FilaCarga({ carga, zebra, onChange, onDuplicar, onEliminar }: FilaProps) {
  const I = corrienteNominal(carga);
  const unidad: UnidadPotencia = carga.unidadPotencia ?? 'HP';

  const onNumber =
    (campo: 'corrienteA' | 'corrienteProteccionA' | 'tensionV' | 'factorServicio') =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(',', '.');
      const n = v === '' ? undefined : Number(v);
      if (n !== undefined && Number.isNaN(n)) return;
      onChange({ [campo]: n } as Partial<Carga>);
    };

  const onPotencia = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(',', '.');
    if (v === '') { onChange({ potenciaKw: undefined }); return; }
    const n = Number(v);
    if (Number.isNaN(n)) return;
    onChange({ potenciaKw: aKw(n, unidad) });
  };

  const toggleUnidad = () => {
    onChange({ unidadPotencia: unidad === 'HP' ? 'kW' : 'HP' });
  };

  const trCls = zebra
    ? 'bg-slate-50/60 dark:bg-slate-900/40'
    : 'bg-white dark:bg-slate-950';
  const cellCls = 'px-3 py-1.5 border-b border-slate-200 dark:border-slate-800';

  return (
    <tr className={`${trCls} hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors`}>
      <td className={cellCls}>
        <input
          className={inputTexto}
          type="text"
          value={carga.descripcion}
          onChange={(e) => onChange({ descripcion: e.target.value })}
          placeholder="Descripción"
        />
      </td>
      <td className={cellCls}>
        <select
          className={inputTexto}
          value={carga.tipo}
          onChange={(e) => onChange({ tipo: e.target.value as Carga['tipo'] })}
        >
          {TIPOS_CARGA.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td className={cellCls}>
        <div className="flex gap-1.5 items-stretch">
          <input
            className={`${inputCls} text-right flex-1 min-w-0`}
            type="number"
            step="0.1"
            min="0"
            value={potenciaMostrada(carga)}
            onChange={onPotencia}
          />
          <button
            type="button"
            onClick={toggleUnidad}
            title="Click para cambiar entre kW y HP"
            className={
              'px-2 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 ' +
              'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 ' +
              'select-none whitespace-nowrap shrink-0 w-11 text-slate-700 dark:text-slate-200'
            }
          >
            {unidad}
          </button>
        </div>
      </td>
      <td className={cellCls}>
        <input
          className={`${inputCls} text-right`}
          type="number" min="0"
          value={carga.tensionV}
          onChange={onNumber('tensionV')}
        />
      </td>
      <td className={cellCls}>
        <select
          className={inputTexto}
          value={carga.fases}
          onChange={(e) => onChange({ fases: e.target.value as Carga['fases'] })}
        >
          {FASES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </td>
      <td className={cellCls}>
        <input
          className={`${inputCls} text-right`}
          type="number" step="0.05" min="1"
          value={carga.factorServicio}
          onChange={onNumber('factorServicio')}
        />
      </td>
      <td className={cellCls}>
        <input
          className={`${inputCls} text-right`}
          type="number" step="0.1" min="0"
          value={carga.corrienteA ?? ''}
          onChange={onNumber('corrienteA')}
          placeholder="(calc)"
        />
      </td>
      <td className={`${cellCls} bg-slate-50 dark:bg-slate-900/60 text-right tabular-nums font-medium`}>
        {I > 0 ? (
          <span className="text-slate-700 dark:text-slate-200">{fmtAmp(I)}</span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className={cellCls}>
        <input
          className={`${inputCls} text-right`}
          type="number" step="1" min="0"
          value={carga.corrienteProteccionA ?? ''}
          onChange={onNumber('corrienteProteccionA')}
          placeholder="(auto)"
          title="Fuerza el frame mínimo del NSX. Vacío usa I calc × margen."
        />
      </td>
      <td className={cellCls}>
        {carga.tipo === 'motor' ? (
          <select
            className={inputTexto}
            value={carga.arranque ?? 'DOL'}
            onChange={(e) => onChange({ arranque: e.target.value as Carga['arranque'] })}
          >
            {TIPOS_ARRANQUE.map((a) => <option key={a} value={a}>{ARRANQUE_LABEL[a]}</option>)}
          </select>
        ) : (
          <span className="text-slate-400 text-sm">—</span>
        )}
      </td>
      <td className={`${cellCls} text-right whitespace-nowrap`}>
        <button
          onClick={onDuplicar}
          className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 px-1.5 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
          title="Duplicar"
          aria-label="Duplicar"
        >
          ⎘
        </button>
        <button
          onClick={onEliminar}
          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950 ml-1"
          title="Eliminar"
          aria-label="Eliminar"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
