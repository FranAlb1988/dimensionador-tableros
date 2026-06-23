import { useMemo, useState } from 'react';
import {
  calcularTransformador,
  POTENCIAS_NOMINALES_KVA,
  TENSIONES_PRIMARIAS_KV,
  TENSIONES_SECUNDARIAS_V,
  tensionPredominanteV,
} from '../logic/transformador';
import { fmtAmp } from '../util/format';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  /** Corriente total del CDC (A) — alimenta el secundario del trafo. */
  corrienteTotalA: number;
  /** Tensiones de las salidas del CDC; se usa la predominante como secundaria. */
  tensionesSalidas: readonly number[];
}

/**
 * Ventana modal para dimensionar el transformador MT/BT que alimenta el
 * CDC. La tensión secundaria se autodetecta de las cargas del tablero; el
 * usuario elige la tensión primaria y el margen de crecimiento.
 */
export function TransformadorAlimentadorModal({
  abierto, onCerrar, corrienteTotalA, tensionesSalidas,
}: Props) {
  const v2Predominante = tensionPredominanteV(tensionesSalidas);
  const [tensionSecundariaV, setTensionSecundariaV] = useState<number>(v2Predominante);
  const [tensionPrimariaKv, setTensionPrimariaKv] = useState<number>(13.8);
  const [margenPct, setMargenPct] = useState<number>(25);

  const resultado = useMemo(
    () => calcularTransformador({
      corrienteSecundarioA: corrienteTotalA,
      tensionSecundariaV,
      tensionPrimariaKv,
      margen: margenPct / 100,
    }),
    [corrienteTotalA, tensionSecundariaV, tensionPrimariaKv, margenPct],
  );

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trafo-titulo"
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h2 id="trafo-titulo" className="text-lg font-semibold">
            Transformador alimentador del CDC
          </h2>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 text-xl leading-none"
          >
            ×
          </button>
        </header>

        <div className="px-5 py-4 space-y-4">
          {/* Entradas */}
          <section className="grid grid-cols-2 gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-slate-500">Tensión primaria (MT)</span>
              <select
                value={tensionPrimariaKv}
                onChange={(e) => setTensionPrimariaKv(Number(e.target.value))}
                className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
              >
                {TENSIONES_PRIMARIAS_KV.map((kv) => (
                  <option key={kv} value={kv}>{kv} kV</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-slate-500">Tensión secundaria (BT)</span>
              <select
                value={tensionSecundariaV}
                onChange={(e) => setTensionSecundariaV(Number(e.target.value))}
                className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
              >
                {TENSIONES_SECUNDARIAS_V.map((v) => (
                  <option key={v} value={v}>{v} V</option>
                ))}
              </select>
              <span className="text-xs text-slate-500">
                Auto: {v2Predominante} V (predominante en el CDC)
              </span>
            </label>

            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-slate-500">Margen de crecimiento</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0} max={100} step={5}
                  value={margenPct}
                  onChange={(e) => setMargenPct(Number(e.target.value))}
                  className="flex-1 accent-slate-900 dark:accent-slate-100"
                />
                <span className="w-12 text-right tabular-nums font-medium">{margenPct} %</span>
              </div>
            </label>
          </section>

          {/* Resultado */}
          <section className="border-t border-slate-200 dark:border-slate-800 pt-3">
            <div className="text-sm font-medium text-slate-500 mb-2">
              Resultado — Transformador IEC 60076 / Dyn11
            </div>
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-slate-500">Carga del CDC</dt>
              <dd className="font-medium tabular-nums">{fmtAmp(corrienteTotalA)}</dd>

              <dt className="text-slate-500">Potencia requerida</dt>
              <dd className="font-medium tabular-nums">
                {resultado.kvaRequerido.toFixed(0)} kVA
              </dd>

              <dt className="text-slate-500">Potencia nominal sugerida</dt>
              <dd
                className={
                  'font-semibold tabular-nums ' +
                  (resultado.excede ? 'text-red-600 dark:text-red-400' : '')
                }
              >
                {resultado.kvaNominal} kVA
                {resultado.excede && ' (excede catálogo)'}
              </dd>

              <dt className="text-slate-500 col-span-2 text-xs uppercase tracking-wide pt-2 border-t border-slate-200 dark:border-slate-800 mt-2">
                Datos eléctricos
              </dt>

              <dt className="text-slate-500">Primario {tensionPrimariaKv} kV</dt>
              <dd className="font-medium tabular-nums">{fmtAmp(resultado.inPrimarioA)}</dd>

              <dt className="text-slate-500">Secundario {tensionSecundariaV} V</dt>
              <dd className="font-medium tabular-nums">{fmtAmp(resultado.inSecundarioA)}</dd>

              <dt className="text-slate-500">Grupo vectorial</dt>
              <dd className="font-medium">{resultado.grupoVectorial}</dd>

              <dt className="text-slate-500">Impedancia (Ucc)</dt>
              <dd className="font-medium tabular-nums">{resultado.uccPorcentaje} %</dd>
            </dl>

            <p className="mt-3 text-xs text-slate-500">
              Valores típicos según IEC 60076-1. Ucc y grupo vectorial deben confirmarse
              contra el catálogo del fabricante. Las potencias nominales son la escala
              estándar: {POTENCIAS_NOMINALES_KVA[0]}–{POTENCIAS_NOMINALES_KVA[POTENCIAS_NOMINALES_KVA.length - 1]} kVA.
            </p>
          </section>
        </div>

        <footer className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onCerrar}
            className="px-4 py-1.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
