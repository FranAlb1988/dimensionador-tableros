import type { ResultadoCcmMt } from '../logic/ccm-mt';
import { fmtAmp, fmtFactor, fmtMm, fmtNumero } from '../util/format';
import { useMetaStore } from '../store/proyecto-meta';

export function ResumenCcmMt({ resultado }: { resultado: ResultadoCcmMt }) {
  const t = resultado.tablero;
  const derrateo = useMetaStore((s) => s.derrateo);
  if (!t) return null;

  const conteoFrames = new Map<number, number>();
  for (const a of resultado.asignaciones) {
    conteoFrames.set(a.contactor.frameA, (conteoFrames.get(a.contactor.frameA) ?? 0) + 1);
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="text-sm font-medium text-slate-500 mb-2">Tablero y celdas principales</div>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-slate-500">Columnas (con entrada y medida)</dt>
          <dd className="font-medium tabular-nums">{t.columnas.length + 2}</dd>
          <dt className="text-slate-500">Interruptor de entrada</dt>
          <dd className="font-medium tabular-nums">{t.principal.frameA} A</dd>
          <dt className="text-slate-500">Barra principal</dt>
          <dd className="font-medium tabular-nums">{t.barraA} A</dd>
          <dt className="text-slate-500">Celda de medida</dt>
          <dd className="font-medium">{t.incluyeMedida ? 'PT / CT' : '—'}</dd>
          <dt className="text-slate-500">Alto</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.altoTotalMm)}</dd>
          <dt className="text-slate-500">Ancho</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.anchoTotalMm)}</dd>
          <dt className="text-slate-500">Profundidad</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.profundidadTotalMm)}</dd>
          <dt className="text-slate-500">FLA total</dt>
          <dd className="font-medium tabular-nums">{fmtAmp(t.corrienteTotalA)}</dd>
          {derrateo.activo && (
            <>
              <dt className="text-slate-500">Altitud</dt>
              <dd className="font-medium tabular-nums">{fmtNumero(derrateo.altitudM)} m.s.n.m.</dd>
              <dt className="text-slate-500">Factor F2 (MT)</dt>
              <dd className="font-medium tabular-nums">{fmtFactor(t.factorDerrateoAltura)}</dd>
              <dt className="text-slate-500">I selección equipo</dt>
              <dd className="font-medium tabular-nums">{fmtAmp(t.corrienteSeleccionBarraA)}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="text-sm font-medium text-slate-500 mb-2">Conteo de contactores</div>
        <ul className="space-y-1 text-sm">
          {[...conteoFrames.entries()].sort((a, b) => a[0] - b[0]).map(([frame, n]) => (
            <li key={frame} className="flex justify-between">
              <span>{frame} A (vacuum)</span>
              <span className="font-medium tabular-nums">{n}</span>
            </li>
          ))}
          <li className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1 mt-2">
            <span className="text-slate-500">Total asignaciones</span>
            <span className="font-semibold tabular-nums">{resultado.asignaciones.length}</span>
          </li>
        </ul>
      </div>

      {derrateo.activo && (
        <p className="sm:col-span-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Derrateo por altura (Tabla V — IEEE 37.20.2, media tensión). Contactores
          seleccionados contra I / F2 (F2 = {fmtFactor(t.factorDerrateoAltura)}).
        </p>
      )}
    </div>
  );
}
