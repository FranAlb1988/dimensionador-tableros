import type { TableroTdg } from '../types';
import { fmtAmp } from '../util/format';

interface Props {
  tablero: TableroTdg;
}

export function PanelPrincipalBarra({ tablero }: Props) {
  const { principal, barra, corrienteTotalA, factorSimultaneidad } = tablero;
  const placeholder = principal.placeholder || barra.placeholder;
  const marca = principal.marca ?? 'Schneider';

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Tarjeta titulo="Interruptor principal" badge={principal.familia}>
        <Linea label="Marca" value={marca} />
        <Linea label="Referencia" value={principal.referencia} mono />
        <Linea label="In nominal" value={fmtAmp(principal.inA)} />
        <Linea label="Icu" value={`${principal.icuKA} kA`} />
        <Linea label="Polos" value={String(principal.polos)} />
      </Tarjeta>
      <Tarjeta titulo="Barra de distribución" badge={barra.material}>
        <Linea label="Referencia" value={barra.referencia} mono />
        <Linea label="In nominal" value={fmtAmp(barra.inA)} />
        <Linea label="Sección" value={`${barra.seccionMm2} mm²`} />
        <Linea label="Dimensión" value={`${barra.dimensionMm} mm`} />
        {barra.dinLibreAireA != null && (
          <Linea label="DIN 43671" value={`${fmtAmp(barra.dinLibreAireA)} (libre aire)`} />
        )}
        {barra.dinLibreAireA != null && barra.inA / barra.dinLibreAireA > 0.9 && (
          <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
            ⚠ In al {Math.round((barra.inA / barra.dinLibreAireA) * 100)}% del valor DIN 43671
            libre aire — en envolvente requiere validación térmica del fabricante (IEC 61439-1).
          </div>
        )}
      </Tarjeta>
      <div className="sm:col-span-2 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
        <Stat label="I total de diseño" value={fmtAmp(corrienteTotalA)} />
        <Stat
          label="Factor de simultaneidad"
          value={`${(factorSimultaneidad * 100).toFixed(0)} %`}
        />
        {tablero.trafoInSecundarioA != null && (
          <Stat label="In secundario trafo" value={fmtAmp(tablero.trafoInSecundarioA)} />
        )}
        {tablero.iccBarraKa != null && (
          <Stat label="Icc barra (trafo)" value={`${tablero.iccBarraKa.toFixed(1)} kA`} />
        )}
        {tablero.factorDerrateoAltura < 1 && (
          <Stat
            label="Derrateo F2 (altura)"
            value={`${tablero.factorDerrateoAltura.toFixed(3)} → selección ${fmtAmp(tablero.corrienteSeleccionA)}`}
          />
        )}
        <Stat
          label="Margen del principal"
          value={`+${(((principal.inA / corrienteTotalA) - 1) * 100).toFixed(0)} %`}
        />
        <Stat
          label="Margen de la barra"
          value={`+${(((barra.inA / corrienteTotalA) - 1) * 100).toFixed(0)} %`}
        />
        {placeholder && (
          <span className="text-amber-700 dark:text-amber-300 ml-auto">
            ⚠ Datos placeholder — verificar SKU contra catálogo {marca} vigente.
          </span>
        )}
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
      <dt className="text-slate-500 dark:text-slate-400 w-24 shrink-0">{label}</dt>
      <dd className={mono ? 'font-mono text-xs' : ''}>{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500 dark:text-slate-400">{label}: </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
