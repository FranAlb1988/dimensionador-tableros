import type { AsignacionCarga, Carga } from '../types';
import { fmtAmp } from '../util/format';
import { corrienteNominal } from '../logic/corriente';
import { tamanoEnXTexto } from '../util/x-blokset';
import { ARRANQUE_LABEL } from '../store/ccm';

interface Props {
  asignaciones: readonly AsignacionCarga[];
  cargasSinAsignar: readonly Carga[];
}

export function AsignacionesPanel({ asignaciones, cargasSinAsignar }: Props) {
  if (asignaciones.length === 0 && cargasSinAsignar.length === 0) {
    return null;
  }
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Sugerencias por carga</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {asignaciones.map((a) => (
          <Tarjeta key={a.carga.id} asignacion={a} />
        ))}
      </div>
      {cargasSinAsignar.length > 0 && (
        <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm">
          <div className="font-medium text-amber-800 dark:text-amber-200">
            Cargas sin asignar
          </div>
          <ul className="mt-1 list-disc list-inside text-amber-900 dark:text-amber-100">
            {cargasSinAsignar.map((c) => (
              <li key={c.id}>
                {c.descripcion || c.id} — verifica potencia/corriente y catálogo.
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Tarjeta({ asignacion }: { asignacion: AsignacionCarga }) {
  const { carga, proteccion, arrancador, gaveta } = asignacion;
  const I = corrienteNominal(carga);
  const placeholder = proteccion.placeholder || arrancador?.placeholder;

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm">
      <div className="flex justify-between items-start">
        <div className="font-medium">{carga.descripcion || carga.id}</div>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 tabular-nums">
          {tamanoEnXTexto(gaveta.tamano)}
        </span>
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        {carga.tipo} · {carga.fases} {carga.tensionV}V · I {I > 0 ? fmtAmp(I) : '—'}
      </div>
      <hr className="my-2 border-slate-200 dark:border-slate-800" />
      <dl className="space-y-1">
        <div className="flex">
          <dt className="text-slate-500 dark:text-slate-400 w-24 shrink-0">Protección</dt>
          <dd className="font-mono text-xs">{proteccion.referencia}</dd>
        </div>
        {arrancador && (
          <div className="flex">
            <dt className="text-slate-500 dark:text-slate-400 w-24 shrink-0">Arrancador</dt>
            <dd className="font-mono text-xs">
              {ARRANQUE_LABEL[arrancador.tipo]} · {arrancador.contactor}
              {arrancador.releTermico ? ` / ${arrancador.releTermico}` : ''}
            </dd>
          </div>
        )}
      </dl>
      {arrancador?.notas && (
        <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
          ⚠ {arrancador.notas}
        </div>
      )}
      {placeholder && (
        <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
          ⚠ Datos placeholder — verificar SKU contra catálogo Schneider vigente.
        </div>
      )}
    </div>
  );
}
