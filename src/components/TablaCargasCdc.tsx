import type { ChangeEvent } from 'react';
import { FASES, TIPOS_CARGA } from '../store/ccm';
import { MODULOS_POR_FILA_OPCIONES, useCdcCargas, useCdcOpciones, useCdcStore } from '../store/cdc';
import type { Carga, UnidadPotencia } from '../types';
import { corrienteNominal } from '../logic/corriente';
import { fmtAmp } from '../util/format';
import { aKw, desdeKw } from '../util/potencia';

const inputCls =
  'w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded ' +
  'px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 ' +
  'text-sm tabular-nums';
const inputTexto = inputCls.replace('tabular-nums', '');

function potenciaMostrada(c: Carga): string {
  if (c.potenciaKw == null) return '';
  const u: UnidadPotencia = c.unidadPotencia ?? 'kW';
  return Number(desdeKw(c.potenciaKw, u).toFixed(2)).toString();
}

export function TablaCargasCdc() {
  const cargas = useCdcCargas();
  const opciones = useCdcOpciones();
  const setOpciones = useCdcStore((s) => s.setOpciones);
  const agregar = useCdcStore((s) => s.agregar);
  const duplicar = useCdcStore((s) => s.duplicar);
  const eliminar = useCdcStore((s) => s.eliminar);
  const actualizar = useCdcStore((s) => s.actualizar);
  const cargarEjemplo = useCdcStore((s) => s.cargarEjemplo);
  const limpiarStore = useCdcStore((s) => s.limpiar);

  const limpiar = () => {
    if (cargas.length === 0) return;
    const ok = window.confirm(`¿Eliminar los ${cargas.length} circuitos del CDC? Esta acción no se puede deshacer.`);
    if (ok) limpiarStore();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={agregar} className={btnPrimary}>+ Agregar circuito</button>
        {cargas.length === 0 && (
          <button onClick={cargarEjemplo} className={btnSecondary}>Cargar ejemplo</button>
        )}

        <label className="ml-2 flex items-center gap-2 text-sm">
          <span className="text-slate-600 dark:text-slate-300">Módulos / fila</span>
          <select
            value={opciones.modulosPorFila}
            onChange={(e) => setOpciones({ modulosPorFila: Number(e.target.value) })}
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-sm"
          >
            {MODULOS_POR_FILA_OPCIONES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm" title="Módulos reservados al inicio de cada fila (p. ej. 2 para un diferencial cabecera).">
          <span className="text-slate-600 dark:text-slate-300">Reserva / fila</span>
          <input
            type="number" min="0" max={opciones.modulosPorFila - 1} step="1"
            value={opciones.reservaPorFila}
            onChange={(e) => setOpciones({ reservaPorFila: Math.max(0, Number(e.target.value) || 0) })}
            className="w-16 text-right bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-sm"
          />
        </label>

        {cargas.length > 0 && (
          <button onClick={limpiar} className={`${btnDanger} ml-auto`}>Limpiar todo</button>
        )}
      </div>

      {cargas.length === 0 ? (
        <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center text-slate-500 dark:text-slate-400">
          Sin circuitos. Agrega uno o carga el ejemplo.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold border-b border-slate-200 dark:border-slate-800 min-w-[14rem]">Descripción</th>
                <th className="px-3 py-2.5 text-left font-semibold border-b border-slate-200 dark:border-slate-800 w-32">Tipo</th>
                <th className="px-3 py-2.5 text-right font-semibold border-b border-slate-200 dark:border-slate-800 w-36">Potencia</th>
                <th className="px-3 py-2.5 text-right font-semibold border-b border-slate-200 dark:border-slate-800 w-20">V</th>
                <th className="px-3 py-2.5 text-left font-semibold border-b border-slate-200 dark:border-slate-800 w-16">Φ</th>
                <th className="px-3 py-2.5 text-right font-semibold border-b border-slate-200 dark:border-slate-800 w-16" title="Factor de servicio">FS</th>
                <th className="px-3 py-2.5 text-right font-semibold border-b border-slate-200 dark:border-slate-800 w-24" title="Corriente nominal de la carga (override).">In carga</th>
                <th className="px-3 py-2.5 text-right font-semibold border-b border-slate-200 dark:border-slate-800 w-24 bg-slate-50 dark:bg-slate-800/50" title="Corriente calculada.">I calc</th>
                <th className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {cargas.map((c, i) => (
                <Fila
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
  'px-3 py-1.5 text-sm font-medium rounded text-red-700 dark:text-red-300 hover:bg-red-50 ' +
  'dark:text-red-400 dark:hover:bg-red-950';

interface FilaProps {
  carga: Carga;
  zebra: boolean;
  onChange: (p: Partial<Carga>) => void;
  onDuplicar: () => void;
  onEliminar: () => void;
}

function Fila({ carga, zebra, onChange, onDuplicar, onEliminar }: FilaProps) {
  const I = corrienteNominal(carga);
  const unidad: UnidadPotencia = carga.unidadPotencia ?? 'kW';

  const onNumber =
    (campo: 'corrienteA' | 'tensionV' | 'factorServicio') =>
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

  const trCls = zebra ? 'bg-slate-50/60 dark:bg-slate-900/40' : 'bg-white dark:bg-slate-950';
  const cellCls = 'px-3 py-1.5 border-b border-slate-200 dark:border-slate-800';

  return (
    <tr className={`${trCls} hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors`}>
      <td className={cellCls}>
        <input className={inputTexto} type="text" value={carga.descripcion}
          onChange={(e) => onChange({ descripcion: e.target.value })}
          placeholder="Descripción" />
      </td>
      <td className={cellCls}>
        <select className={inputTexto} value={carga.tipo}
          onChange={(e) => onChange({ tipo: e.target.value as Carga['tipo'] })}>
          {TIPOS_CARGA.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td className={cellCls}>
        <div className="flex gap-1.5 items-stretch">
          <input className={`${inputCls} text-right flex-1 min-w-0`}
            type="number" step="0.1" min="0"
            value={potenciaMostrada(carga)} onChange={onPotencia} />
          <button type="button"
            onClick={() => onChange({ unidadPotencia: unidad === 'HP' ? 'kW' : 'HP' })}
            title="Cambiar unidad"
            className="px-2 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 select-none whitespace-nowrap shrink-0 w-11">
            {unidad}
          </button>
        </div>
      </td>
      <td className={cellCls}>
        <input className={`${inputCls} text-right`} type="number" min="0"
          value={carga.tensionV} onChange={onNumber('tensionV')} />
      </td>
      <td className={cellCls}>
        <select className={inputTexto} value={carga.fases}
          onChange={(e) => onChange({ fases: e.target.value as Carga['fases'] })}>
          {FASES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </td>
      <td className={cellCls}>
        <input className={`${inputCls} text-right`} type="number" step="0.05" min="1"
          value={carga.factorServicio} onChange={onNumber('factorServicio')} />
      </td>
      <td className={cellCls}>
        <input className={`${inputCls} text-right`} type="number" step="0.1" min="0"
          value={carga.corrienteA ?? ''} onChange={onNumber('corrienteA')}
          placeholder="(calc)" />
      </td>
      <td className={`${cellCls} bg-slate-50 dark:bg-slate-900/60 text-right tabular-nums font-medium`}>
        {I > 0 ? <span>{fmtAmp(I)}</span> : <span className="text-slate-400">—</span>}
      </td>
      <td className={`${cellCls} text-right whitespace-nowrap`}>
        <button onClick={onDuplicar} title="Duplicar"
          className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 px-1.5 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700">⎘</button>
        <button onClick={onEliminar} title="Eliminar"
          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950 ml-1">✕</button>
      </td>
    </tr>
  );
}
