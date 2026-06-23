import type { ResultadoTdgNema } from '../logic/tdg-nema';
import { fmtAmp, fmtMm } from '../util/format';
import { MedidaCard } from './MedidaCard';
import { TransformadorCard } from './TransformadorCard';
import { useTdgTransformador } from '../store/tdg';

export function ResumenTdgNema({ resultado }: { resultado: ResultadoTdgNema }) {
  const t = resultado.tablero;
  const trafoConfig = useTdgTransformador();
  if (!t) return null;

  const conteo = new Map<number, number>();
  for (const s of t.salidas) {
    conteo.set(s.breaker.frameAF, (conteo.get(s.breaker.frameAF) ?? 0) + 1);
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="text-sm font-medium text-slate-500 mb-2">Dimensiones del tablero</div>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-slate-500">Columnas</dt>
          <dd className="font-medium tabular-nums">{t.columnas}</dd>
          <dt className="text-slate-500">Alto</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.altoTotalMm)}</dd>
          <dt className="text-slate-500">Ancho</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.anchoTotalMm)}</dd>
          <dt className="text-slate-500">Profundidad</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.profundidadTotalMm)}</dd>
          <dt className="text-slate-500">FLC total</dt>
          <dd className="font-medium tabular-nums">{fmtAmp(t.corrienteTotalA)}</dd>
          <dt className="text-slate-500">Salidas</dt>
          <dd className="font-medium tabular-nums">{t.salidas.length}</dd>
        </dl>
      </div>

      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="text-sm font-medium text-slate-500 mb-2">Salidas por frame ANSI</div>
        <ul className="space-y-1 text-sm">
          {[...conteo.entries()].sort((a, b) => a[0] - b[0]).map(([f, n]) => (
            <li key={f} className="flex justify-between">
              <span>{f}AF</span>
              <span className="font-medium tabular-nums">{n}</span>
            </li>
          ))}
          <li className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1 mt-2">
            <span className="text-slate-500">Total</span>
            <span className="font-semibold tabular-nums">{t.salidas.length}</span>
          </li>
        </ul>
      </div>

      <MedidaCard medida={t.medida} />

      {trafoConfig && (
        <TransformadorCard config={trafoConfig} corrienteTotalA={t.corrienteTotalA} />
      )}
    </div>
  );
}
