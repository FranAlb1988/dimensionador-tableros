import { useMemo } from 'react';
import {
  calcularTransformador,
  CONFIG_TRAFO_DEFAULT,
  POTENCIAS_NOMINALES_KVA,
  TENSIONES_PRIMARIAS_KV,
  TENSIONES_SECUNDARIAS_V,
  TIPO_TRAFO_LABEL,
  tensionPredominanteV,
  type ConfigTransformador,
  type TipoTransformador,
} from '../logic/transformador';
import { useTdgStore, useTdgTransformador } from '../store/tdg';
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
 * CDC. La configuración (tensiones, margen, tipo) se persiste en el store
 * por tablero. La tensión secundaria se autodetecta de las cargas la
 * primera vez que se abre el modal.
 */
export function TransformadorAlimentadorModal({
  abierto, onCerrar, corrienteTotalA, tensionesSalidas,
}: Props) {
  const cfgGuardada = useTdgTransformador();
  const setTransformador = useTdgStore((s) => s.setTransformador);

  const v2Predominante = tensionPredominanteV(tensionesSalidas);
  const cfg: ConfigTransformador = cfgGuardada ?? {
    ...CONFIG_TRAFO_DEFAULT,
    tensionSecundariaV: v2Predominante,
  };

  const setCfg = (parcial: Partial<ConfigTransformador>) => {
    setTransformador({ ...cfg, ...parcial });
  };

  const resultado = useMemo(
    () => calcularTransformador({
      corrienteSecundarioA: corrienteTotalA,
      tensionPrimariaKv: cfg.tensionPrimariaKv,
      tensionSecundariaV: cfg.tensionSecundariaV,
      margen: cfg.margen,
      tipo: cfg.tipo,
    }),
    [corrienteTotalA, cfg.tensionPrimariaKv, cfg.tensionSecundariaV, cfg.margen, cfg.tipo],
  );

  if (!abierto) return null;
  const margenPct = Math.round(cfg.margen * 100);

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
                value={cfg.tensionPrimariaKv}
                onChange={(e) => setCfg({ tensionPrimariaKv: Number(e.target.value) })}
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
                value={cfg.tensionSecundariaV}
                onChange={(e) => setCfg({ tensionSecundariaV: Number(e.target.value) })}
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
              <span className="text-slate-500">Tipo constructivo</span>
              <div
                className="inline-flex border border-slate-300 dark:border-slate-700 rounded overflow-hidden w-fit"
                role="tablist"
              >
                {(['aceite', 'seco'] as TipoTransformador[]).map((tipo) => {
                  const activo = cfg.tipo === tipo;
                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setCfg({ tipo })}
                      className={
                        'px-3 py-1.5 text-sm font-medium ' +
                        (activo
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800')
                      }
                    >
                      {TIPO_TRAFO_LABEL[tipo]}
                    </button>
                  );
                })}
              </div>
            </label>

            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-slate-500">Margen de crecimiento</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0} max={100} step={5}
                  value={margenPct}
                  onChange={(e) => setCfg({ margen: Number(e.target.value) / 100 })}
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
                {resultado.excede && ' (1 unidad excede catálogo)'}
              </dd>

              <dt className="text-slate-500 col-span-2 text-xs uppercase tracking-wide pt-2 border-t border-slate-200 dark:border-slate-800 mt-2">
                Datos eléctricos
              </dt>

              <dt className="text-slate-500">Primario {cfg.tensionPrimariaKv} kV</dt>
              <dd className="font-medium tabular-nums">{fmtAmp(resultado.inPrimarioA)}</dd>

              <dt className="text-slate-500">Secundario {cfg.tensionSecundariaV} V</dt>
              <dd className="font-medium tabular-nums">{fmtAmp(resultado.inSecundarioA)}</dd>

              <dt className="text-slate-500">Grupo vectorial</dt>
              <dd className="font-medium">{resultado.grupoVectorial}</dd>

              <dt className="text-slate-500">Impedancia (Ucc)</dt>
              <dd className="font-medium tabular-nums">{resultado.uccPorcentaje} %</dd>

              <dt className="text-slate-500">Icc secundario (red infinita)</dt>
              <dd className="font-medium tabular-nums">{resultado.iccSecundarioKa.toFixed(1)} kA</dd>

              <dt className="text-slate-500">Tipo</dt>
              <dd className="font-medium">{TIPO_TRAFO_LABEL[resultado.tipo]}</dd>

              <dt className="text-slate-500">Pérdidas en vacío (P₀)</dt>
              <dd className="font-medium tabular-nums">{resultado.perdidasVacioW} W</dd>

              <dt className="text-slate-500">Pérdidas en carga (Pk)</dt>
              <dd className="font-medium tabular-nums">{resultado.perdidasCargaW} W</dd>
            </dl>

            {resultado.paralelo && (
              <div className="mt-3 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm">
                <div className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                  ⚠ Sugerencia: {resultado.paralelo.cantidad} transformadores en paralelo
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                  Una sola unidad excede el mayor estándar IEC 60076
                  ({POTENCIAS_NOMINALES_KVA[POTENCIAS_NOMINALES_KVA.length - 1]} kVA).
                  Sugerimos repartir la carga en {resultado.paralelo.cantidad} trafos
                  iguales. Sus impedancias (Ucc%) deben coincidir para que la
                  carga se reparta proporcionalmente.
                </p>
                <dl className="grid grid-cols-2 gap-y-1 text-sm text-amber-900 dark:text-amber-100">
                  <dt>Cada uno</dt>
                  <dd className="font-semibold tabular-nums">
                    {resultado.paralelo.cadaUno.kvaNominal} kVA
                  </dd>
                  <dt>Primario / unidad</dt>
                  <dd className="tabular-nums">
                    {fmtAmp(resultado.paralelo.cadaUno.inPrimarioA)}
                  </dd>
                  <dt>Secundario / unidad</dt>
                  <dd className="tabular-nums">
                    {fmtAmp(resultado.paralelo.cadaUno.inSecundarioA)}
                  </dd>
                </dl>
              </div>
            )}

            <p className="mt-3 text-xs text-slate-500">
              Valores típicos según IEC 60076-1 / EU Reg. 548/2014 Tier 2.
              Ucc, pérdidas y grupo vectorial deben confirmarse contra el
              catálogo del fabricante (Schneider Minera/Trihal, ABB
              ResiBloc/EcoDry, etc.).
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
