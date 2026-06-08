import type { ResultadoTdg } from '../logic/tdg';
import { fmtAmp, fmtMm } from '../util/format';
import type { FamiliaProteccion } from '../types';
import { MedidaCard } from './MedidaCard';

const ORDEN_FAMILIA: readonly FamiliaProteccion[] = [
  'NSXm', 'NSX100', 'NSX160', 'NSX250', 'NSX400', 'NSX630',
  'MasterpactNT', 'MasterpactNW',
  'iC60N', 'iC60H',
  'TmaxXT2', 'TmaxXT4', 'TmaxT4', 'TmaxT5',
  'EmaxE1.2', 'EmaxE2.2', 'EmaxE4.2', 'EmaxE6.2',
  'NA1-2000', 'NA1-3200', 'NA1-4000', 'NA1-6300',
];

export function ResumenTdg({ resultado }: { resultado: ResultadoTdg }) {
  const t = resultado.tablero;
  if (!t) return null;

  const conteo = new Map<FamiliaProteccion, number>();
  for (const s of t.salidas) {
    conteo.set(s.proteccion.familia, (conteo.get(s.proteccion.familia) ?? 0) + 1);
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="text-sm font-medium text-slate-500 mb-2">Dimensiones del tablero</div>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-slate-500">Columnas Prisma</dt>
          <dd className="font-medium tabular-nums">{t.columnas}</dd>
          <dt className="text-slate-500">Alto</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.altoTotalMm)}</dd>
          <dt className="text-slate-500">Ancho</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.anchoTotalMm)}</dd>
          <dt className="text-slate-500">Profundidad</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.profundidadTotalMm)}</dd>
          <dt className="text-slate-500">I total</dt>
          <dd className="font-medium tabular-nums">{fmtAmp(t.corrienteTotalA)}</dd>
          <dt className="text-slate-500">Salidas</dt>
          <dd className="font-medium tabular-nums">{t.salidas.length}</dd>
        </dl>
      </div>

      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="text-sm font-medium text-slate-500 mb-2">Salidas por familia</div>
        <ul className="space-y-1 text-sm">
          {ORDEN_FAMILIA.filter((f) => conteo.has(f)).map((f) => (
            <li key={f} className="flex justify-between">
              <span>{f}</span>
              <span className="font-medium tabular-nums">{conteo.get(f)}</span>
            </li>
          ))}
          <li className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1 mt-2">
            <span className="text-slate-500">Total</span>
            <span className="font-semibold tabular-nums">{t.salidas.length}</span>
          </li>
        </ul>
      </div>

      <MedidaCard medida={t.medida} />
    </div>
  );
}
