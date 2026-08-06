import type { AsignacionCcmNema, Carga } from '../types';
import { ARRANQUE_LABEL } from '../types';
import { useCcmStore } from '../store/ccm';
import { fmtAmp, fmtKw, fmtNumero } from '../util/format';

interface Props {
  asignaciones: readonly AsignacionCcmNema[];
  cargasSinAsignar: readonly Carga[];
}

export function AsignacionesPanelNema({ asignaciones, cargasSinAsignar }: Props) {
  if (asignaciones.length === 0 && cargasSinAsignar.length === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Sugerencias por carga (NEMA)</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {asignaciones.map((a) => <Tarjeta key={a.carga.id} a={a} />)}
      </div>
      {cargasSinAsignar.length > 0 && (
        <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm">
          <div className="font-medium text-amber-800 dark:text-amber-200">Cargas sin asignar</div>
          <ul className="mt-1 list-disc list-inside text-amber-900 dark:text-amber-100">
            {cargasSinAsignar.map((c) => (
              <li key={c.id}>{c.descripcion || c.id} — verifica HP/corriente.</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Tarjeta({ a }: { a: AsignacionCcmNema }) {
  const { carga, motor, breaker, espaciosX, version, corrienteDisenoA } = a;
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm">
      <div className="flex justify-between items-start">
        <div className="font-medium">{carga.descripcion || carga.id}</div>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 tabular-nums">
          {`${espaciosX}X · ${version}`}
        </span>
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        {carga.tipo} · {carga.fases} {carga.tensionV}V · I diseño {fmtAmp(corrienteDisenoA)}
      </div>
      <hr className="my-2 border-slate-200 dark:border-slate-800" />
      <dl className="space-y-1">
        {motor && (
          <>
            <Linea label="Motor" value={`${motor.hp} HP / ${motor.kw.toFixed(2)} kW`} />
            {motor.flaA != null && <Linea label="FLA (400V)" value={fmtAmp(motor.flaA)} />}
            {carga.arranque && (
              <Linea label="Arranque" value={ARRANQUE_LABEL[carga.arranque]} />
            )}
            {motor.mcpFrameA != null && <Linea label="MCP frame" value={`${motor.mcpFrameA} A`} mono />}
            {motor.contactorSize != null && <Linea label="Contactor" value={`NEMA size ${motor.contactorSize}`} mono />}
            {motor.moduloOL && <Linea label="Sensor OL" value={motor.moduloOL} mono />}
          </>
        )}
        {breaker && (
          <>
            <Linea label="Breaker" value={`${breaker.frameAF}AF · ${breaker.rating}`} mono />
            <Linea label="Icu (kA)" value={breaker.icuRange} />
          </>
        )}
      </dl>
      {a.variador && <Variador cargaId={carga.id} v={a.variador} />}
      {a.notas && (
        <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
          ⚠ {a.notas}
        </div>
      )}
    </div>
  );
}

/** Opciones del selector de servicio: Auto delega en la deducción por equipo. */
const OPCIONES_SERVICIO: readonly { valor: 'ND' | 'HD' | undefined; label: string; title: string }[] = [
  { valor: undefined, label: 'Auto', title: 'Deducir del tipo de equipo (bombas/ventiladores → ND; chancado/correas → HD).' },
  { valor: 'ND', label: 'ND', title: 'Servicio normal: par cuadrático, sobrecarga 110–120%.' },
  { valor: 'HD', label: 'HD', title: 'Servicio pesado: par constante, sobrecarga 150%.' },
];

/**
 * Variador sugerido del catálogo Schneider. Antes esta salida solo mostraba una
 * nota diciendo que el drive real no estaba incluido; ahora se nombra el modelo
 * concreto con su corriente y tamaño. El selector Auto/ND/HD fija el servicio
 * por carga: al cambiarlo se re-sugiere el modelo al instante.
 */
function Variador({ cargaId, v }: { cargaId: string; v: NonNullable<AsignacionCcmNema['variador']> }) {
  const actualizar = useCcmStore((s) => s.actualizar);
  const dims = [v.anchoMm, v.altoMm, v.profundidadMm];
  const tieneDims = dims.every((d) => d != null);
  return (
    <div className="mt-2 border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 rounded p-2">
      <div className="flex justify-between items-start gap-2">
        <div>
          <span className="text-[11px] uppercase tracking-wide text-sky-700 dark:text-sky-300">
            Variador sugerido
          </span>
          <div className="font-mono text-xs">{v.referencia}</div>
        </div>
        <div
          className="flex rounded border border-sky-300 dark:border-sky-800 overflow-hidden shrink-0"
          role="group"
          aria-label="Servicio del variador"
        >
          {OPCIONES_SERVICIO.map(({ valor, label, title }) => {
            const activo = valor === undefined ? v.servicioDeducido : !v.servicioDeducido && v.servicio === valor;
            return (
              <button
                key={label}
                type="button"
                title={title}
                aria-pressed={activo}
                onClick={() => actualizar(cargaId, { servicioVariador: valor })}
                className={
                  'px-1.5 py-0.5 text-[11px] font-medium transition-colors '
                  + (activo
                    ? 'bg-sky-600 text-white dark:bg-sky-500 dark:text-sky-950'
                    : 'bg-white dark:bg-sky-950 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900')
                }
              >
                {valor === undefined && v.servicioDeducido ? `Auto (${v.servicio})` : label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 space-x-2">
        <span>{v.gama}</span>
        {v.potenciaKw != null && <span>· {fmtKw(v.potenciaKw)}</span>}
        {v.corrienteA != null && <span>· {fmtAmp(v.corrienteA)}</span>}
        {tieneDims && <span>· {dims.join('×')} mm</span>}
        {v.pesoKg != null && <span>· {fmtNumero(v.pesoKg)} kg</span>}
      </div>
    </div>
  );
}

function Linea({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex">
      <dt className="text-slate-500 dark:text-slate-400 w-24 shrink-0">{label}</dt>
      <dd className={mono ? 'font-mono text-xs' : ''}>{value}</dd>
    </div>
  );
}
