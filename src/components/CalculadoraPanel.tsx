import { useState } from 'react';
import type { Calculadora, EntradasCalc } from '../logic/calculos';
import { fmtCantidad } from '../util/format';
import { ExportarMemoriaPdfBoton } from './ExportarMemoriaPdfBoton';

const inputCls =
  'w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded ' +
  'px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500';

function entradasIniciales(calc: Calculadora): EntradasCalc {
  const e: EntradasCalc = {};
  for (const campo of calc.campos) {
    e[campo.key] = campo.defecto != null ? String(campo.defecto) : '';
  }
  return e;
}

export function CalculadoraPanel({ calculadora }: { calculadora: Calculadora }) {
  const [entradas, setEntradas] = useState<EntradasCalc>(() => entradasIniciales(calculadora));
  const resultado = calculadora.calcular(entradas);

  const set = (key: string, valor: string) => {
    const campo = calculadora.campos.find((c) => c.key === key);
    const extra = campo?.autollenar ? campo.autollenar(valor) : {};
    setEntradas((prev) => ({ ...prev, [key]: valor, ...extra }));
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
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Datos de entrada
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {calculadora.campos.map((campo) => (
              <label key={campo.key} className="block" title={campo.ayuda}>
                <span className="text-xs text-slate-600 dark:text-slate-300 mb-1 inline-block">
                  {campo.label}
                  {campo.unidad ? <span className="text-slate-400"> ({campo.unidad})</span> : null}
                  {campo.opcional ? <span className="text-slate-400"> · opcional</span> : null}
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
            ))}
          </div>

          <div className="mt-3 rounded bg-slate-100 dark:bg-slate-800/60 px-3 py-2">
            <div className="text-xs font-medium text-slate-500 mb-0.5">Fórmula</div>
            <code className="text-xs text-slate-700 dark:text-slate-200 break-words">
              {calculadora.formula}
            </code>
          </div>
        </div>

        {/* Resultados */}
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
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
    </div>
  );
}
