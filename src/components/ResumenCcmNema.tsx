import type { ResultadoCcmNema } from '../logic/ccm-nema';
import { fmtAmp, fmtMm } from '../util/format';

export function ResumenCcmNema({ resultado }: { resultado: ResultadoCcmNema }) {
  const t = resultado.tablero;
  if (!t) return null;

  const conteoSize = new Map<number, number>();
  const conteoFrame = new Map<number, number>();
  let totalX = 0;
  for (const a of resultado.asignaciones) {
    totalX += a.espaciosX;
    if (a.motor?.contactorSize != null) {
      conteoSize.set(a.motor.contactorSize, (conteoSize.get(a.motor.contactorSize) ?? 0) + 1);
    }
    if (a.breaker) {
      conteoFrame.set(a.breaker.frameAF, (conteoFrame.get(a.breaker.frameAF) ?? 0) + 1);
    }
  }
  const xPorColumna = t.columnas[0]?.altoUtilXEspacios ?? 0;
  const xTotalDisponible = xPorColumna * t.columnas.length;

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="text-sm font-medium text-slate-500 mb-2">Dimensiones del tablero</div>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-slate-500">Columnas</dt>
          <dd className="font-medium tabular-nums">{t.columnas.length}</dd>
          <dt className="text-slate-500">Alto</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.altoTotalMm)}</dd>
          <dt className="text-slate-500">Ancho</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.anchoTotalMm)}</dd>
          <dt className="text-slate-500">Profundidad</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.profundidadTotalMm)}</dd>
          <dt className="text-slate-500">X por columna</dt>
          <dd className="font-medium tabular-nums">{xPorColumna}X (X = {fmtMm(t.xMm)})</dd>
          <dt className="text-slate-500">X usados</dt>
          <dd className="font-medium tabular-nums">{totalX}X / {xTotalDisponible}X</dd>
          <dt className="text-slate-500">FLC total</dt>
          <dd className="font-medium tabular-nums">{fmtAmp(t.corrienteTotalA)}</dd>
          <dt className="text-slate-500">Barra principal</dt>
          <dd className="font-medium tabular-nums">{t.barra.capacidadA} A</dd>
        </dl>
      </div>

      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="text-sm font-medium text-slate-500 mb-2">Conteo</div>
        {conteoSize.size > 0 && (
          <>
            <div className="text-xs text-slate-500 mb-1">Contactores NEMA</div>
            <ul className="space-y-1 text-sm mb-3">
              {[...conteoSize.entries()].sort((a, b) => a[0] - b[0]).map(([s, n]) => (
                <li key={s} className="flex justify-between">
                  <span>NEMA size {s}</span>
                  <span className="font-medium tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {conteoFrame.size > 0 && (
          <>
            <div className="text-xs text-slate-500 mb-1">Breakers (alimentadores)</div>
            <ul className="space-y-1 text-sm">
              {[...conteoFrame.entries()].sort((a, b) => a[0] - b[0]).map(([f, n]) => (
                <li key={f} className="flex justify-between">
                  <span>{f}AF</span>
                  <span className="font-medium tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1 mt-2 text-sm">
          <span className="text-slate-500">Total asignaciones</span>
          <span className="font-semibold tabular-nums">{resultado.asignaciones.length}</span>
        </div>
      </div>
    </div>
  );
}
