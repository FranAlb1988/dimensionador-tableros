import type { ChangeEvent } from 'react';
import {
  TIPOS_CELDA_MT,
  useMtClaseTension,
  useMtIcc,
  useMtSalidas,
  useMtStore,
} from '../store/mt';
import { CATALOGO_MT, corrienteDesdeMva } from '../logic/mt';
import { TIPO_CELDA_MT_LABEL, type SalidaMt } from '../types';
import { fmtAmp } from '../util/format';
import { nombreDeFila, rotuloDeCampo } from '../util/rotulos';

const inputCls =
  'w-full bg-transparent border border-slate-300 dark:border-slate-700 rounded px-2 py-1 ' +
  'focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm';

const btnPrimary =
  'px-3 py-1.5 text-sm font-medium rounded bg-slate-900 text-white hover:bg-slate-700 ' +
  'dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white';
const btnSecondary =
  'px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 ' +
  'hover:bg-slate-100 dark:hover:bg-slate-800';
const btnDanger =
  'px-3 py-1.5 text-sm font-medium rounded text-red-700 dark:text-red-300 hover:bg-red-50 ' +
  'dark:text-red-400 dark:hover:bg-red-950';

function corrienteEfectiva(s: SalidaMt, kv: number): number {
  if (s.corrienteA != null && s.corrienteA > 0) return s.corrienteA;
  if (s.potenciaMva != null && s.potenciaMva > 0) return corrienteDesdeMva(s.potenciaMva, kv);
  return 0;
}

export function TablaSalidasMt() {
  const salidas = useMtSalidas();
  const kv = useMtClaseTension();
  const icc = useMtIcc();
  const setClaseTension = useMtStore((s) => s.setClaseTension);
  const setIcc = useMtStore((s) => s.setIcc);
  const agregar = useMtStore((s) => s.agregar);
  const duplicar = useMtStore((s) => s.duplicar);
  const eliminar = useMtStore((s) => s.eliminar);
  const actualizar = useMtStore((s) => s.actualizar);
  const cargarEjemplo = useMtStore((s) => s.cargarEjemplo);
  const limpiarStore = useMtStore((s) => s.limpiar);

  const limpiar = () => {
    if (salidas.length === 0) return;
    const ok = window.confirm(`¿Eliminar las ${salidas.length} celdas del switchgear MT? Esta acción no se puede deshacer.`);
    if (ok) limpiarStore();
  };

  const numero = (e: ChangeEvent<HTMLInputElement>): number => {
    const v = Number(e.target.value);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 flex-wrap">
        <label className="text-sm flex items-center gap-2">
          <span className="text-slate-600 dark:text-slate-400">Clase de tensión</span>
          <select
            className={inputCls + ' w-auto'}
            value={kv}
            onChange={(e) => setClaseTension(Number(e.target.value))}
          >
            {CATALOGO_MT.clasesTensionKv.map((c) => (
              <option key={c} value={c}>{c} kV</option>
            ))}
          </select>
        </label>
        <label className="text-sm flex items-center gap-2">
          <span className="text-slate-600 dark:text-slate-400">Icc</span>
          <select
            className={inputCls + ' w-auto'}
            value={icc}
            onChange={(e) => setIcc(Number(e.target.value))}
          >
            {CATALOGO_MT.iccKaDisponibles.map((c) => (
              <option key={c} value={c}>{c} kA</option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <button className={btnSecondary} onClick={cargarEjemplo}>Cargar ejemplo</button>
          <button className={btnDanger} onClick={limpiar}>Limpiar</button>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Descripción</th>
              <th className="px-3 py-2 font-medium">Tipo de celda</th>
              <th className="px-3 py-2 font-medium">Potencia (MVA)</th>
              <th className="px-3 py-2 font-medium">Corriente (A)</th>
              <th className="px-3 py-2 font-medium text-right">I diseño</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {salidas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">
                  Sin celdas. Agrega una o carga el ejemplo.
                </td>
              </tr>
            )}
            {salidas.map((s, i) => {
              const nombre = nombreDeFila(s.descripcion, i, 'celda');
              const rotulo = (campo: string) => rotuloDeCampo(campo, nombre);
              return (
              <tr key={s.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="px-3 py-2 min-w-[200px]">
                  <input
                    className={inputCls}
                    value={s.descripcion}
                    placeholder="Descripción de la celda"
                    onChange={(e) => actualizar(s.id, { descripcion: e.target.value })}
                    aria-label={`Descripción de la celda ${i + 1}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    className={inputCls + ' w-auto'}
                    value={s.tipoCelda}
                    onChange={(e) => actualizar(s.id, { tipoCelda: e.target.value as SalidaMt['tipoCelda'] })}
                    aria-label={rotulo('Tipo de celda')}
                  >
                    {TIPOS_CELDA_MT.map((t) => (
                      <option key={t} value={t}>{TIPO_CELDA_MT_LABEL[t]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 w-28">
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    step="0.1"
                    value={s.potenciaMva ?? ''}
                    onChange={(e) => actualizar(s.id, { potenciaMva: numero(e) })}
                    aria-label={`${rotulo('Potencia')}, en MVA`}
                  />
                </td>
                <td className="px-3 py-2 w-28">
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    step="1"
                    value={s.corrienteA ?? ''}
                    onChange={(e) => actualizar(s.id, { corrienteA: numero(e) })}
                    aria-label={`${rotulo('Corriente')}, en amperes`}
                  />
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                  {fmtAmp(corrienteEfectiva(s, kv))}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-right">
                  <button className={btnSecondary + ' mr-1'} onClick={() => duplicar(s.id)} aria-label={`Duplicar ${nombre}`}>Duplicar</button>
                  <button className={btnDanger} onClick={() => eliminar(s.id)} aria-label={`Eliminar ${nombre}`}>Eliminar</button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className={btnPrimary} onClick={() => agregar('salida')}>+ Salida</button>
        <button className={btnSecondary} onClick={() => agregar('entrada')}>+ Entrada</button>
        <button className={btnSecondary} onClick={() => agregar('acople')}>+ Acople</button>
        <button className={btnSecondary} onClick={() => agregar('medida')}>+ Medida</button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Si se ingresan MVA y corriente, prevalece la corriente. Datos del catálogo MT
        son de referencia (clase 36 kV); ajustar con catálogo y especificación técnica del proyecto.
      </p>
    </div>
  );
}
