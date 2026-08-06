import type { ResultadoTdg } from '../logic/tdg';
import { fmtAmp, fmtMm } from '../util/format';
import { FAMILIAS_ORDEN, type FamiliaProteccion } from '../types';
import { MedidaCard } from './MedidaCard';
import { TransformadorCard } from './TransformadorCard';
import { useTdgTransformador } from '../store/tdg';

/**
 * Familias presentes en las salidas, en el orden de FAMILIAS_ORDEN y con las
 * desconocidas al final en orden alfabético. Se ordena la lista real en vez de
 * filtrar una lista fija: con un filtro, todo bastidor nuevo del catálogo
 * (NS1000, NSXm160…) desaparecía del resumen sin que el total lo delatara.
 */
function familiasOrdenadas(familias: Iterable<FamiliaProteccion>): FamiliaProteccion[] {
  const rango = (f: FamiliaProteccion) => {
    const i = FAMILIAS_ORDEN.indexOf(f);
    return i < 0 ? FAMILIAS_ORDEN.length : i;
  };
  return [...familias].sort((a, b) => rango(a) - rango(b) || a.localeCompare(b));
}

export function ResumenTdg({ resultado }: { resultado: ResultadoTdg }) {
  const t = resultado.tablero;
  const trafoConfig = useTdgTransformador();
  if (!t) return null;

  const conteo = new Map<FamiliaProteccion, number>();
  for (const s of t.salidas) {
    conteo.set(s.proteccion.familia, (conteo.get(s.proteccion.familia) ?? 0) + 1);
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Dimensiones del tablero</div>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-slate-500 dark:text-slate-400">Columnas Prisma</dt>
          <dd className="font-medium tabular-nums">{t.columnas}</dd>
          <dt className="text-slate-500 dark:text-slate-400">Alto</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.altoTotalMm)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">Ancho</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.anchoTotalMm)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">Profundidad</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.profundidadTotalMm)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">I total</dt>
          <dd className="font-medium tabular-nums">{fmtAmp(t.corrienteTotalA)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">Salidas</dt>
          <dd className="font-medium tabular-nums">{t.salidas.length}</dd>
        </dl>
      </div>

      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Salidas por familia</div>
        <ul className="space-y-1 text-sm">
          {familiasOrdenadas(conteo.keys()).map((f) => (
            <li key={f} className="flex justify-between">
              <span>{f}</span>
              <span className="font-medium tabular-nums">{conteo.get(f)}</span>
            </li>
          ))}
          <li className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1 mt-2">
            <span className="text-slate-500 dark:text-slate-400">Total</span>
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
