import { useMemo } from 'react';
import type { Carga } from '../types';
import { HORAS_DIA_DEFECTO, resumirDemanda, type Potencias } from '../logic/demanda';
import { fmtAmp, fmtCantidad, fmtNumero } from '../util/format';
import { TablaDesplazable } from './TablaDesplazable';

interface Props {
  cargas: readonly Carga[];
  /** Tensión de la barra donde se suman las cargas. */
  tensionBarraV: number;
}

const FILAS: readonly { clave: keyof Potencias; label: string; unidad: string }[] = [
  { clave: 'kva', label: 'Potencia aparente', unidad: 'kVA' },
  { clave: 'kw', label: 'Potencia activa', unidad: 'kW' },
  { clave: 'kvar', label: 'Potencia reactiva', unidad: 'kVAR' },
];

/**
 * Estudio de cargas: potencia conectada, demanda máxima y media, y consumo.
 * Metodología del documento 5201-ES-600-12000.
 */
export function EstudioCargasPanel({ cargas, tensionBarraV }: Props) {
  const r = useMemo(
    () => resumirDemanda(cargas, tensionBarraV),
    [cargas, tensionBarraV],
  );
  if (cargas.length === 0) return null;

  // Razones agregadas: son las que se comparan contra un estudio existente.
  const fdGlobal = r.conectada.kw > 0 ? r.maxima.kw / r.conectada.kw : 0;
  const fcGlobal = r.maxima.kw > 0 ? r.media.kw / r.maxima.kw : 0;
  const sinFactoresPropios = cargas.filter(
    (c) => c.factorDemanda == null && c.factorCarga == null && !c.standby,
  ).length;

  const columnas = [
    { titulo: 'Potencia conectada', p: r.conectada, destacar: false },
    { titulo: 'Demanda máxima', p: r.maxima, destacar: true },
    { titulo: 'Demanda media', p: r.media, destacar: false },
  ];

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Estudio de cargas</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Demanda y consumo según la metodología del estudio de cargas
          (FD = máxima/conectada, FC = media/máxima).
        </p>
      </div>

      <TablaDesplazable etiqueta="Tabla del estudio de cargas" borde={false}>
        <table className="min-w-max text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left font-semibold border-b border-slate-200 dark:border-slate-800" />
              {columnas.map((c) => (
                <th
                  key={c.titulo}
                  className={`px-3 py-2 text-right font-semibold border-b border-slate-200 dark:border-slate-800 min-w-[9rem]
                    ${c.destacar ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`}
                >
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FILAS.map((f) => (
              <tr key={f.clave}>
                <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  {f.label}
                </td>
                {columnas.map((c) => (
                  <td
                    key={c.titulo}
                    className={`px-3 py-1.5 text-right tabular-nums border-b border-slate-200 dark:border-slate-800
                      ${c.destacar ? 'bg-slate-50 dark:bg-slate-900/60 font-medium' : ''}`}
                  >
                    {fmtNumero(Math.round(c.p[f.clave]))} <span className="text-slate-500 dark:text-slate-400">{f.unidad}</span>
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                Corriente
              </td>
              {columnas.map((c) => (
                <td
                  key={c.titulo}
                  className={`px-3 py-1.5 text-right tabular-nums border-b border-slate-200 dark:border-slate-800
                    ${c.destacar ? 'bg-slate-50 dark:bg-slate-900/60 font-medium' : ''}`}
                >
                  {fmtAmp(c.p.corrienteA)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </TablaDesplazable>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-1 gap-x-4 text-sm">
        <dt className="text-slate-500 dark:text-slate-400">Factor de demanda</dt>
        <dd className="font-medium tabular-nums">{fmtCantidad(fdGlobal, 2)}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Factor de carga</dt>
        <dd className="font-medium tabular-nums">{fmtCantidad(fcGlobal, 2)}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Consumo diario</dt>
        <dd className="font-medium tabular-nums">{fmtNumero(Math.round(r.energiaDiariaKwh))} kWh</dd>
        <dt className="text-slate-500 dark:text-slate-400">Consumo anual</dt>
        <dd className="font-medium tabular-nums">
          {fmtNumero(Math.round(r.energiaAnualKwh / 1000))} MWh
        </dd>
      </dl>

      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
        {sinFactoresPropios > 0 && (
          <p>
            {sinFactoresPropios} de {r.cargas} cargas usan el factor típico de su tipo de
            equipo. El estudio los afina por carga según el régimen real de operación.
          </p>
        )}
        {r.standby > 0 && (
          <p>
            {r.standby} carga(s) stand-by: suman a la potencia conectada, no a la demanda.
          </p>
        )}
        <p>
          El consumo asume {HORAS_DIA_DEFECTO} h/día en las cargas que no declaran horas
          de operación.
        </p>
      </div>
    </div>
  );
}
