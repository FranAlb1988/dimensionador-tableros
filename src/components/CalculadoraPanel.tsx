import { useState, type ComponentType } from 'react';
import type { Calculadora, CampoCalc, EntradasCalc, ResultadoCalc } from '../logic/calculos';
import { fmtCantidad } from '../util/format';
import { ExportarMemoriaPdfBoton } from './ExportarMemoriaPdfBoton';
import { EscalerillaVista } from './EscalerillaVista';

/** Registro de visualizaciones por identificador. */
const VISUALIZACIONES: Record<string, ComponentType<{ entradas: EntradasCalc; resultado: ResultadoCalc }>> = {
  escalerilla: EscalerillaVista,
};

const inputCls =
  'w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded ' +
  'px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500';

function entradasIniciales(calc: Calculadora): EntradasCalc {
  const e: EntradasCalc = {};
  for (const campo of calc.campos) {
    if (campo.tipo === 'lista' && campo.filaCampos) {
      const count = campo.filasMin ?? 1;
      e[`${campo.key}.count`] = String(count);
      for (let i = 0; i < count; i += 1) {
        for (const sc of campo.filaCampos) {
          e[`${campo.key}.${i}.${sc.key}`] = sc.defecto != null ? String(sc.defecto) : '';
        }
      }
    } else {
      e[campo.key] = campo.defecto != null ? String(campo.defecto) : '';
    }
  }
  return e;
}

export function CalculadoraPanel({ calculadora }: { calculadora: Calculadora }) {
  const [entradas, setEntradas] = useState<EntradasCalc>(() => entradasIniciales(calculadora));
  const resultado = calculadora.calcular(entradas);
  const Vista = calculadora.visualizacion ? VISUALIZACIONES[calculadora.visualizacion] : undefined;

  const set = (key: string, valor: string) => {
    const campo = calculadora.campos.find((c) => c.key === key);
    const extra = campo?.autollenar ? campo.autollenar(valor) : {};
    setEntradas((prev) => ({ ...prev, [key]: valor, ...extra }));
  };

  const setRowField = (listaKey: string, rowIdx: number, subkey: string, valor: string) => {
    const lista = calculadora.campos.find((c) => c.key === listaKey && c.tipo === 'lista');
    const subcampo = lista?.filaCampos?.find((c) => c.key === subkey);
    const extraRaw = subcampo?.autollenar ? subcampo.autollenar(valor) : {};
    const extra: EntradasCalc = {};
    for (const [sk, v] of Object.entries(extraRaw)) {
      extra[`${listaKey}.${rowIdx}.${sk}`] = v;
    }
    setEntradas((prev) => ({ ...prev, [`${listaKey}.${rowIdx}.${subkey}`]: valor, ...extra }));
  };

  const addRow = (listaKey: string) => {
    setEntradas((prev) => {
      const lista = calculadora.campos.find((c) => c.key === listaKey && c.tipo === 'lista');
      if (!lista || !lista.filaCampos) return prev;
      const count = Math.max(0, Math.round(Number(prev[`${listaKey}.count`] ?? '0')));
      const max = lista.filasMax ?? 10;
      if (count >= max) return prev;
      const next: EntradasCalc = { ...prev, [`${listaKey}.count`]: String(count + 1) };
      for (const sc of lista.filaCampos) {
        next[`${listaKey}.${count}.${sc.key}`] = sc.defecto != null ? String(sc.defecto) : '';
      }
      return next;
    });
  };

  const removeRow = (listaKey: string, rowIdx: number) => {
    setEntradas((prev) => {
      const lista = calculadora.campos.find((c) => c.key === listaKey && c.tipo === 'lista');
      if (!lista || !lista.filaCampos) return prev;
      const count = Math.max(0, Math.round(Number(prev[`${listaKey}.count`] ?? '0')));
      const min = lista.filasMin ?? 1;
      if (count <= min || rowIdx >= count) return prev;
      const subkeys = lista.filaCampos.map((c) => c.key);
      const next: EntradasCalc = { ...prev };
      for (let j = rowIdx; j < count - 1; j += 1) {
        for (const sk of subkeys) {
          next[`${listaKey}.${j}.${sk}`] = next[`${listaKey}.${j + 1}.${sk}`] ?? '';
        }
      }
      for (const sk of subkeys) {
        delete next[`${listaKey}.${count - 1}.${sk}`];
      }
      next[`${listaKey}.count`] = String(count - 1);
      return next;
    });
  };

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">{calculadora.nombre}</h2>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {calculadora.norma}
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{calculadora.descripcion}</p>
      </div>

      <div className="p-4 grid lg:grid-cols-2 gap-5">
        {/* Entradas */}
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Datos de entrada
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {calculadora.campos.map((campo) => {
              if (campo.tipo === 'lista' && campo.filaCampos) {
                return (
                  <CampoLista
                    key={campo.key}
                    campo={campo}
                    entradas={entradas}
                    setRowField={setRowField}
                    addRow={() => addRow(campo.key)}
                    removeRow={(i) => removeRow(campo.key, i)}
                  />
                );
              }
              return (
                <label key={campo.key} className="block" title={campo.ayuda}>
                  <span className="text-xs text-slate-600 dark:text-slate-300 mb-1 inline-block">
                    {campo.label}
                    {campo.unidad ? <span className="text-slate-500 dark:text-slate-400"> ({campo.unidad})</span> : null}
                    {campo.opcional ? <span className="text-slate-500 dark:text-slate-400"> · opcional</span> : null}
                  </span>
                  {campo.tipo === 'select' ? (
                    <select
                      className={inputCls}
                      value={entradas[campo.key] ?? ''}
                      onChange={(ev) => set(campo.key, ev.target.value)}
                    >
                      {campo.opciones?.map((op) => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      inputMode="decimal"
                      className={inputCls}
                      value={entradas[campo.key] ?? ''}
                      onChange={(ev) => set(campo.key, ev.target.value)}
                    />
                  )}
                </label>
              );
            })}
          </div>

          <div className="mt-3 rounded bg-slate-100 dark:bg-slate-800/60 px-3 py-2">
            {/* slate-600 y no 500: este rótulo va sobre la tarjeta tintada, no
                sobre blanco, y ahí el 500 se queda en 4,35:1. */}
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-0.5">Fórmula</div>
            <code className="text-xs text-slate-700 dark:text-slate-200 break-words">
              {calculadora.formula}
            </code>
          </div>
        </div>

        {/* Resultados */}
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Resultados
          </div>
          {resultado.error ? (
            <div className="text-sm text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded p-3">
              {resultado.error}
            </div>
          ) : (
            <>
              <dl className="space-y-1.5">
                {calculadora.salidas.map((salida) => {
                  const destacado = salida.destacado;
                  const valorTexto = salida.esTexto
                    ? (resultado.textos?.[salida.key] ?? '—')
                    : null;
                  const valor = salida.esTexto ? undefined : resultado.valores[salida.key];
                  return (
                    <div
                      key={salida.key}
                      className={
                        'flex items-baseline justify-between gap-3 rounded px-3 py-1.5 ' +
                        (destacado
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'bg-slate-50 dark:bg-slate-900/50')
                      }
                    >
                      <dt className={destacado ? 'text-sm font-medium' : 'text-sm text-slate-600 dark:text-slate-300'}>
                        {salida.label}
                      </dt>
                      <dd className={(destacado ? 'text-base font-bold' : 'text-sm font-medium') + ' tabular-nums'}>
                        {salida.esTexto
                          ? valorTexto
                          : valor == null ? '—' : fmtCantidad(valor, salida.decimales ?? 2)}
                        {!salida.esTexto && salida.unidad
                          ? <span className="font-normal opacity-70"> {salida.unidad}</span>
                          : null}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              {resultado.nota ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  {resultado.nota}
                </p>
              ) : null}
              <div className="mt-3">
                <ExportarMemoriaPdfBoton
                  calculadora={calculadora}
                  entradas={entradas}
                  resultado={resultado}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {Vista && !resultado.error && (
        <div className="border-t border-slate-200 dark:border-slate-800 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Visualización
          </div>
          <Vista entradas={entradas} resultado={resultado} />
        </div>
      )}
    </div>
  );
}

interface CampoListaProps {
  campo: CampoCalc;
  entradas: EntradasCalc;
  setRowField: (listaKey: string, rowIdx: number, subkey: string, valor: string) => void;
  addRow: () => void;
  removeRow: (rowIdx: number) => void;
}

function CampoLista({ campo, entradas, setRowField, addRow, removeRow }: CampoListaProps) {
  const subcampos = campo.filaCampos ?? [];
  const count = Math.max(0, Math.round(Number(entradas[`${campo.key}.count`] ?? '0')));
  const min = campo.filasMin ?? 1;
  const max = campo.filasMax ?? 10;

  return (
    <div className="sm:col-span-2 mt-1">
      <div className="text-xs text-slate-600 dark:text-slate-300 mb-1.5 font-medium" title={campo.ayuda}>
        {campo.label}
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-end gap-2 flex-wrap bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 w-5 mb-1.5">{i + 1}</span>
            {subcampos.map((sc) => {
              const valor = entradas[`${campo.key}.${i}.${sc.key}`] ?? '';
              return (
                <label key={sc.key} className="flex-1 min-w-[110px]" title={sc.ayuda}>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">
                    {sc.label}{sc.unidad ? ` (${sc.unidad})` : ''}
                  </span>
                  {sc.tipo === 'select' ? (
                    <select
                      className={inputCls}
                      value={valor}
                      onChange={(ev) => setRowField(campo.key, i, sc.key, ev.target.value)}
                    >
                      {sc.opciones?.map((op) => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      inputMode="decimal"
                      className={inputCls}
                      value={valor}
                      onChange={(ev) => setRowField(campo.key, i, sc.key, ev.target.value)}
                    />
                  )}
                </label>
              );
            })}
            <button
              type="button"
              onClick={() => removeRow(i)}
              disabled={count <= min}
              title="Quitar fila"
              className="mb-1.5 text-slate-500 hover:text-red-600 dark:text-red-300 dark:text-slate-400 dark:hover:text-red-400 disabled:opacity-30 disabled:hover:text-slate-500 px-2 py-1 text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
        {count < max && (
          <button
            type="button"
            onClick={addRow}
            className="text-sm text-slate-700 dark:text-slate-300 px-3 py-1.5 border border-dashed border-slate-300 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            + {campo.etiquetaFila ?? 'Fila'}
          </button>
        )}
      </div>
    </div>
  );
}
