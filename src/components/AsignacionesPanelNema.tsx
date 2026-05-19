import type { AsignacionCcmNema, Carga } from '../types';
import { fmtAmp } from '../util/format';

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
      <div className="text-xs text-slate-500 mt-0.5">
        {carga.tipo} · {carga.fases} {carga.tensionV}V · I diseño {fmtAmp(corrienteDisenoA)}
      </div>
      <hr className="my-2 border-slate-200 dark:border-slate-800" />
      <dl className="space-y-1">
        {motor && (
          <>
            <Linea label="Motor" value={`${motor.hp} HP / ${motor.kw.toFixed(2)} kW`} />
            {motor.flaA != null && <Linea label="FLA (400V)" value={fmtAmp(motor.flaA)} />}
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
    </div>
  );
}

function Linea({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex">
      <dt className="text-slate-500 w-24 shrink-0">{label}</dt>
      <dd className={mono ? 'font-mono text-xs' : ''}>{value}</dd>
    </div>
  );
}
