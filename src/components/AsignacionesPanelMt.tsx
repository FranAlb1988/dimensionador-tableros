import type { AsignacionCcmMt, Carga } from '../types';
import { fmtAmp } from '../util/format';

/** Descripción de las funciones ANSI usadas en la protección MT. */
const ANSI_DESC: Record<string, string> = {
  '27': 'Subtensión',
  '37': 'Subcorriente (pérdida de carga)',
  '46': 'Desbalance / pérdida de fase',
  '48': 'Arranque prolongado / rotor bloqueado',
  '49': 'Sobrecarga térmica',
  '50': 'Sobrecorriente instantánea',
  '50G': 'Falla a tierra instantánea',
  '50N': 'Falla a tierra (neutro) inst.',
  '51': 'Sobrecorriente temporizada',
  '51N': 'Falla a tierra (neutro) temp.',
  '59': 'Sobretensión',
  '66': 'Arranques por hora',
};

interface Props {
  asignaciones: readonly AsignacionCcmMt[];
  cargasSinAsignar: readonly Carga[];
}

export function AsignacionesPanelMt({ asignaciones, cargasSinAsignar }: Props) {
  if (asignaciones.length === 0 && cargasSinAsignar.length === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Sugerencias por carga (MT — CENTERLINE 2500)</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {asignaciones.map((a) => <Tarjeta key={a.carga.id} a={a} />)}
      </div>
      <LeyendaAnsi asignaciones={asignaciones} />
      {cargasSinAsignar.length > 0 && (
        <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm">
          <div className="font-medium text-amber-800 dark:text-amber-200">Cargas sin asignar</div>
          <ul className="mt-1 list-disc list-inside text-amber-900 dark:text-amber-100">
            {cargasSinAsignar.map((c) => (
              <li key={c.id}>
                {c.descripcion || c.id} —{' '}
                {c.tensionV <= 1000
                  ? 'BT (no aplica al CCM MT)'
                  : c.tipo !== 'motor'
                    ? 'no es motor — los CCM MT solo gestionan motores'
                    : 'FLA supera el contactor más grande del catálogo (720 A)'}.
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Tarjeta({ a }: { a: AsignacionCcmMt }) {
  const { carga, contactor, proteccion, espaciosV, corrienteDisenoA } = a;
  const tensionKv = (carga.tensionV / 1000).toLocaleString('es-CL', {
    minimumFractionDigits: carga.tensionV % 1000 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  });
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm">
      <div className="flex justify-between items-start">
        <div className="font-medium">{carga.descripcion || carga.id}</div>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 tabular-nums">
          {espaciosV === 1 ? 'half-height' : 'full-height'}
        </span>
      </div>
      <div className="text-xs text-slate-500 mt-0.5">
        {carga.tipo} · {carga.fases} {tensionKv} kV · FLA {fmtAmp(corrienteDisenoA)}
      </div>
      <hr className="my-2 border-slate-200 dark:border-slate-800" />
      <dl className="space-y-1">
        <Linea label="Contactor" value={contactor.modelo} mono />
        <Linea label="Frame" value={`${contactor.frameA} A continuos`} mono />
        <Linea label="Clase tensión" value={`${contactor.claseKv.join(' / ')} kV`} />
        <Linea label="Relé" value={proteccion.modelo} />
        <Linea label="ANSI" value={proteccion.ansi.join(' · ')} mono />
      </dl>
    </div>
  );
}

function LeyendaAnsi({ asignaciones }: { asignaciones: readonly AsignacionCcmMt[] }) {
  const codigos = new Set<string>();
  for (const a of asignaciones) for (const f of a.proteccion.ansi) codigos.add(f);
  const lista = [...codigos].filter((c) => ANSI_DESC[c]);
  if (lista.length === 0) return null;
  return (
    <div className="text-xs text-slate-500 dark:text-slate-400">
      <span className="font-medium">Funciones ANSI:</span>{' '}
      {lista.map((c, i) => (
        <span key={c}>
          {i > 0 ? ' · ' : ''}
          <span className="font-mono text-slate-600 dark:text-slate-300">{c}</span> {ANSI_DESC[c]}
        </span>
      ))}
    </div>
  );
}

function Linea({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex">
      <dt className="text-slate-500 w-28 shrink-0">{label}</dt>
      <dd className={mono ? 'font-mono text-xs' : ''}>{value}</dd>
    </div>
  );
}
