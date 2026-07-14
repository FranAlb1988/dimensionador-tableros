import type { TableroTdgNema } from '../types';
import { fmtAmp } from '../util/format';

interface Props {
  tablero: TableroTdgNema;
}

export function PanelPrincipalBarraNema({ tablero }: Props) {
  const { principal, barra, corrienteTotalA, factorSimultaneidad } = tablero;
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Tarjeta titulo="Interruptor principal" badge={`${principal.frameAF}AF`}>
        <Linea label="Frame ANSI" value={`${principal.frameAF}AF`} mono />
        <Linea label="Rating" value={principal.rating} mono />
        <Linea label="In nominal" value={fmtAmp(principal.ratingA)} />
        <Linea label="Rango FLC" value={`${principal.flcMin}–${principal.flcMax} A`} />
      </Tarjeta>
      <Tarjeta titulo="Barra principal" badge={`${barra.frameAF}AF`}>
        <Linea label="Frame ANSI" value={`${barra.frameAF}AF`} mono />
        <Linea label="Rango FLC" value={`${barra.flcMin}–${barra.flcMax} A`} />
        <Linea label="Capacidad" value={`${barra.frameAF} A nominal`} />
      </Tarjeta>
      <div className="sm:col-span-2 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
        <Stat label="FLC total" value={fmtAmp(corrienteTotalA)} />
        <Stat label="Factor de simultaneidad" value={`${(factorSimultaneidad * 100).toFixed(0)} %`} />
        {tablero.trafoInSecundarioA != null && (
          <Stat label="In secundario trafo" value={fmtAmp(tablero.trafoInSecundarioA)} />
        )}
        {tablero.iccBarraKa != null && (
          <Stat label="Icc barra (trafo)" value={`${tablero.iccBarraKa.toFixed(1)} kA`} />
        )}
        <Stat label="Margen del principal" value={`+${(((principal.ratingA / corrienteTotalA) - 1) * 100).toFixed(0)} %`} />
        <Stat label="Margen de la barra" value={`+${(((barra.frameAF / corrienteTotalA) - 1) * 100).toFixed(0)} %`} />
      </div>
    </div>
  );
}

function Tarjeta({ titulo, badge, children }: { titulo: string; badge: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm">
      <div className="flex justify-between items-start mb-2">
        <div className="font-medium">{titulo}</div>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">{badge}</span>
      </div>
      <dl className="space-y-1">{children}</dl>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500">{label}: </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
