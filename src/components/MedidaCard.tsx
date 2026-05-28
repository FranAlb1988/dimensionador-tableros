import type { MedidaCcm } from '../types';

/** Tarjeta con los equipos del compartimento de medida del CCM. */
export function MedidaCard({ medida }: { medida: MedidaCcm }) {
  const items: { label: string; value: string }[] = [
    { label: 'Transformadores de tensión (PT)', value: String(medida.transformadoresTension) },
    { label: 'Transformadores de corriente (CT)', value: String(medida.transformadoresCorriente) },
    { label: 'Luces piloto', value: String(medida.lucesPiloto) },
    { label: 'Instrumento', value: medida.instrumento },
  ];
  return (
    <div className="sm:col-span-2 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
      <div className="text-sm font-medium text-slate-500 mb-2">Compartimento de medida</div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {items.map((it) => (
          <span key={it.label} className="text-slate-600 dark:text-slate-300">
            {it.label}:{' '}
            <strong className="text-slate-900 dark:text-slate-100 tabular-nums">{it.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
