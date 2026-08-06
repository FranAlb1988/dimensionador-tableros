import { useMemo } from 'react';
import {
  calcularTransformador,
  TIPO_TRAFO_LABEL,
  type ConfigTransformador,
} from '../logic/transformador';
import { fmtAmp } from '../util/format';

interface Props {
  /** Configuración del trafo guardada en el tablero (puede ser undefined). */
  config: ConfigTransformador | undefined;
  /** Corriente total del CDC (A). */
  corrienteTotalA: number;
}

/**
 * Tarjeta resumen del transformador alimentador. Se muestra debajo del
 * resumen del CDC cuando el usuario ya configuró el trafo en el modal.
 */
export function TransformadorCard({ config, corrienteTotalA }: Props) {
  const r = useMemo(() => {
    if (!config) return null;
    return calcularTransformador({
      corrienteSecundarioA: corrienteTotalA,
      tensionPrimariaKv: config.tensionPrimariaKv,
      tensionSecundariaV: config.tensionSecundariaV,
      margen: config.margen,
      tipo: config.tipo,
    });
  }, [config, corrienteTotalA]);

  if (!config || !r) return null;

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
      <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
        Transformador alimentador
      </div>
      <dl className="grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-slate-500 dark:text-slate-400">Potencia nominal</dt>
        <dd
          className={
            'font-semibold tabular-nums ' +
            (r.excede ? 'text-red-600 dark:text-red-400' : '')
          }
        >
          {r.kvaNominal} kVA{r.paralelo ? ` × ${r.paralelo.cantidad}` : ''}
        </dd>

        <dt className="text-slate-500 dark:text-slate-400">Tensión</dt>
        <dd className="font-medium tabular-nums">
          {config.tensionPrimariaKv} kV / {config.tensionSecundariaV} V
        </dd>

        <dt className="text-slate-500 dark:text-slate-400">Tipo</dt>
        <dd className="font-medium">{TIPO_TRAFO_LABEL[r.tipo]}</dd>

        <dt className="text-slate-500 dark:text-slate-400">Grupo vectorial</dt>
        <dd className="font-medium">{r.grupoVectorial}</dd>

        <dt className="text-slate-500 dark:text-slate-400">Ucc</dt>
        <dd className="font-medium tabular-nums">{r.uccPorcentaje} %</dd>

        <dt className="text-slate-500 dark:text-slate-400">Primario</dt>
        <dd className="font-medium tabular-nums">{fmtAmp(r.inPrimarioA)}</dd>

        <dt className="text-slate-500 dark:text-slate-400">Secundario</dt>
        <dd className="font-medium tabular-nums">{fmtAmp(r.inSecundarioA)}</dd>

        <dt className="text-slate-500 dark:text-slate-400">P₀ / Pk</dt>
        <dd className="font-medium tabular-nums">
          {r.perdidasVacioW} / {r.perdidasCargaW} W
        </dd>

        {r.paralelo && (
          <>
            <dt className="text-slate-500 dark:text-slate-400 col-span-2 text-xs uppercase tracking-wide pt-2 border-t border-slate-200 dark:border-slate-800 mt-2">
              En paralelo
            </dt>
            <dt className="text-slate-500 dark:text-slate-400">{r.paralelo.cantidad} unidades de</dt>
            <dd className="font-medium tabular-nums">
              {r.paralelo.cadaUno.kvaNominal} kVA c/u
            </dd>
            <dt className="text-slate-500 dark:text-slate-400">I sec. / unidad</dt>
            <dd className="font-medium tabular-nums">
              {fmtAmp(r.paralelo.cadaUno.inSecundarioA)}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}
