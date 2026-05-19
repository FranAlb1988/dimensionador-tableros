import type { ChangeEvent } from 'react';
import { FASES, TIPOS_CARGA } from '../store/ccm';
import { useTdgFactorSimultaneidad, useTdgSalidas, useTdgStore } from '../store/tdg';
import type { Carga, UnidadPotencia } from '../types';
import { corrienteNominal } from '../logic/corriente';
import { fmtAmp, fmtNumeroFijo } from '../util/format';
import { aKw, desdeKw } from '../util/potencia';

function potenciaMostrada(c: Carga): string {
  if (c.potenciaKw == null) return '';
  const u: UnidadPotencia = c.unidadPotencia ?? 'kW';
  return Number(desdeKw(c.potenciaKw, u).toFixed(2)).toString();
}

const inputCls =
  'w-full bg-transparent border border-slate-300 dark:border-slate-700 rounded px-2 py-1 ' +
  'focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 text-sm';

const btnPrimary =
  'px-3 py-1.5 text-sm font-medium rounded bg-slate-900 text-white hover:bg-slate-700 ' +
  'dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white';
const btnSecondary =
  'px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 ' +
  'hover:bg-slate-100 dark:hover:bg-slate-800';
const btnDanger =
  'px-3 py-1.5 text-sm font-medium rounded text-red-700 hover:bg-red-50 ' +
  'dark:text-red-400 dark:hover:bg-red-950';

export function TablaSalidas() {
  const salidas = useTdgSalidas();
  const fs = useTdgFactorSimultaneidad();
  const setFs = useTdgStore((s) => s.setFactorSimultaneidad);
  const agregar = useTdgStore((s) => s.agregar);
  const duplicar = useTdgStore((s) => s.duplicar);
  const eliminar = useTdgStore((s) => s.eliminar);
  const actualizar = useTdgStore((s) => s.actualizar);
  const cargarEjemplo = useTdgStore((s) => s.cargarEjemplo);
  const limpiarStore = useTdgStore((s) => s.limpiar);

  const limpiar = () => {
    if (salidas.length === 0) return;
    const ok = window.confirm(`¿Eliminar las ${salidas.length} salidas del TDG? Esta acción no se puede deshacer.`);
    if (ok) limpiarStore();
  };

  const onFs = (e: ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value.replace(',', '.'));
    if (!Number.isNaN(v)) setFs(v);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={agregar} className={btnPrimary}>+ Agregar salida</button>
        {salidas.length === 0 && (
          <button onClick={cargarEjemplo} className={btnSecondary}>Cargar ejemplo</button>
        )}
        <label className="ml-2 flex items-center gap-2 text-sm">
          <span className="text-slate-600 dark:text-slate-300">Factor de simultaneidad</span>
          <input
            type="number"
            step="0.05"
            min="0.1"
            max="1"
            value={fs}
            onChange={onFs}
            className={`${inputCls} w-20 text-right`}
          />
          <span className="text-slate-500 text-xs">({fmtNumeroFijo(fs * 100)} %)</span>
        </label>
        {salidas.length > 0 && (
          <button onClick={limpiar} className={`${btnDanger} ml-auto`}>Limpiar todo</button>
        )}
      </div>

      {salidas.length === 0 ? (
        <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center text-slate-500">
          No hay salidas. Agrega una o carga el ejemplo.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Descripción</th>
                <th className="px-2 py-2 text-left font-medium w-28">Tipo</th>
                <th className="px-2 py-2 text-right font-medium w-36">Potencia</th>
                <th className="px-2 py-2 text-right font-medium w-24">In (A)</th>
                <th className="px-2 py-2 text-right font-medium w-20">V</th>
                <th className="px-2 py-2 text-left font-medium w-16">Fases</th>
                <th className="px-2 py-2 text-right font-medium w-20">FS</th>
                <th className="px-2 py-2 text-right font-medium w-24">I calc</th>
                <th className="px-2 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {salidas.map((s) => (
                <FilaSalida
                  key={s.id}
                  carga={s}
                  onChange={(p) => actualizar(s.id, p)}
                  onDuplicar={() => duplicar(s.id)}
                  onEliminar={() => eliminar(s.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface FilaProps {
  carga: Carga;
  onChange: (parcial: Partial<Carga>) => void;
  onDuplicar: () => void;
  onEliminar: () => void;
}

function FilaSalida({ carga, onChange, onDuplicar, onEliminar }: FilaProps) {
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

  const toggleUnidad = () => onChange({ unidadPotencia: unidad === 'HP' ? 'kW' : 'HP' });

  return (
    <tr className="border-t border-slate-200 dark:border-slate-800">
      <td className="px-2 py-1">
        <input
          className={inputCls}
          type="text"
          value={carga.descripcion}
          onChange={(e) => onChange({ descripcion: e.target.value })}
          placeholder="Descripción"
        />
      </td>
      <td className="px-2 py-1">
        <select
          className={inputCls}
          value={carga.tipo}
          onChange={(e) => onChange({ tipo: e.target.value as Carga['tipo'] })}
        >
          {TIPOS_CARGA.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td className="px-2 py-1">
        <div className="flex gap-1">
          <input
            className={`${inputCls} text-right flex-1 min-w-0`}
            type="number" step="0.1" min="0"
            value={potenciaMostrada(carga)}
            onChange={onPotencia}
          />
          <button
            type="button"
            onClick={toggleUnidad}
            title="Click para cambiar entre kW y HP"
            className="px-2 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 select-none whitespace-nowrap shrink-0 w-11 text-slate-700 dark:text-slate-200"
          >
            {unidad}
          </button>
        </div>
      </td>
      <td className="px-2 py-1">
        <input
          className={`${inputCls} text-right`}
          type="number" step="0.1" min="0"
          value={carga.corrienteA ?? ''}
          onChange={onNumber('corrienteA')}
          placeholder="(calc)"
        />
      </td>
      <td className="px-2 py-1">
        <input
          className={`${inputCls} text-right`}
          type="number" min="0"
          value={carga.tensionV}
          onChange={onNumber('tensionV')}
        />
      </td>
      <td className="px-2 py-1">
        <select
          className={inputCls}
          value={carga.fases}
          onChange={(e) => onChange({ fases: e.target.value as Carga['fases'] })}
        >
          {FASES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </td>
      <td className="px-2 py-1">
        <input
          className={`${inputCls} text-right`}
          type="number" step="0.05" min="1"
          value={carga.factorServicio}
          onChange={onNumber('factorServicio')}
        />
      </td>
      <td className="px-2 py-1 text-right tabular-nums text-slate-500">
        {I > 0 ? fmtAmp(I) : '—'}
      </td>
      <td className="px-2 py-1 text-right whitespace-nowrap">
        <button onClick={onDuplicar} className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 px-1" title="Duplicar">⎘</button>
        <button onClick={onEliminar} className="text-xs text-red-600 hover:text-red-800 dark:hover:text-red-400 px-1" title="Eliminar">✕</button>
      </td>
    </tr>
  );
}
