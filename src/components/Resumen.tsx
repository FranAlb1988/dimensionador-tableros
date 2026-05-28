import type { ResultadoCcm } from '../logic/tablero';
import { fmtMm } from '../util/format';
import type { TamanoGaveta } from '../types';
import { altoUtilColumnaEnX, fmtX, tamanoEnX, tamanoEnXTexto } from '../util/x-blokset';
import { MedidaCard } from './MedidaCard';

const ORDEN_TAMANO: readonly TamanoGaveta[] = ['1/4', '1/2', '1', '1+1/2', '2'];

export function Resumen({ resultado }: { resultado: ResultadoCcm }) {
  const { tablero, asignaciones } = resultado;
  if (asignaciones.length === 0) return null;

  const conteo = new Map<TamanoGaveta, number>();
  for (const a of asignaciones) {
    conteo.set(a.gaveta.tamano, (conteo.get(a.gaveta.tamano) ?? 0) + 1);
  }
  const xUsadoTotal = asignaciones.reduce((acc, a) => acc + tamanoEnX(a.gaveta.tamano), 0);
  const xPorColumna = altoUtilColumnaEnX();
  const xTotalDisponible = xPorColumna * tablero.columnas.length;

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="text-sm font-medium text-slate-500 mb-2">Dimensiones del tablero</div>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-slate-500">Columnas</dt>
          <dd className="font-medium tabular-nums">{tablero.columnas.length}</dd>
          <dt className="text-slate-500">Alto</dt>
          <dd className="font-medium tabular-nums">{fmtMm(tablero.altoTotalMm)}</dd>
          <dt className="text-slate-500">Ancho</dt>
          <dd className="font-medium tabular-nums">{fmtMm(tablero.anchoTotalMm)}</dd>
          <dt className="text-slate-500">Profundidad</dt>
          <dd className="font-medium tabular-nums">{fmtMm(tablero.profundidadTotalMm)}</dd>
          <dt className="text-slate-500">Cabezal</dt>
          <dd className="tabular-nums text-slate-600">{fmtMm(tablero.reservaCabezalMm)}</dd>
          <dt className="text-slate-500">Zócalo</dt>
          <dd className="tabular-nums text-slate-600">{fmtMm(tablero.reservaZocaloMm)}</dd>
          <dt className="text-slate-500">X usado</dt>
          <dd className="font-medium tabular-nums">{fmtX(xUsadoTotal)} / {fmtX(xTotalDisponible)}</dd>
        </dl>
      </div>

      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="text-sm font-medium text-slate-500 mb-2">Conteo por tamaño de gaveta</div>
        <ul className="space-y-1 text-sm">
          {ORDEN_TAMANO.filter((t) => conteo.has(t)).map((t) => {
            const n = conteo.get(t) ?? 0;
            return (
              <li key={t} className="flex justify-between">
                <span>{tamanoEnXTexto(t)}</span>
                <span className="font-medium tabular-nums">
                  {n} <span className="text-slate-400">({fmtX(n * tamanoEnX(t))})</span>
                </span>
              </li>
            );
          })}
          <li className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1 mt-2">
            <span className="text-slate-500">Total</span>
            <span className="font-semibold tabular-nums">
              {asignaciones.length} <span className="text-slate-400">({fmtX(xUsadoTotal)})</span>
            </span>
          </li>
        </ul>
      </div>

      <MedidaCard medida={tablero.medida} />
    </div>
  );
}
