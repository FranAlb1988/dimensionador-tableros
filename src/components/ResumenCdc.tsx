import type { ResultadoCdc } from '../logic/cdc';
import { fmtMm } from '../util/format';

export function ResumenCdc({ resultado }: { resultado: ResultadoCdc }) {
  const t = resultado.tablero;
  if (!t) return null;

  const conteoCofres = new Map<string, number>();
  for (const c of t.cofres) {
    const ref = c.catalogo.referencia;
    conteoCofres.set(ref, (conteoCofres.get(ref) ?? 0) + 1);
  }
  // Conteo de diferenciales de cabecera por (sensibilidad, tipo, polos).
  const conteoDif = new Map<string, { sens: number; tipo: 'AC' | 'A'; polos: 2 | 4; n: number }>();
  for (const c of t.cofres) {
    for (const f of c.filas) {
      if (!f.diferencial) continue;
      const d = f.diferencial;
      const k = `${d.sensibilidadMa}-${d.tipo}-${d.polos}`;
      const prev = conteoDif.get(k);
      if (prev) prev.n += 1;
      else conteoDif.set(k, { sens: d.sensibilidadMa, tipo: d.tipo, polos: d.polos, n: 1 });
    }
  }
  const totalDif = [...conteoDif.values()].reduce((s, x) => s + x.n, 0);
  const utilizacion = t.cofres.reduce((s, c) => {
    const totales = c.filas.reduce((x, f) => x + (f.modulosTotales - f.reserva), 0);
    const usados = c.filas.reduce((x, f) => x + (f.modulosTotales - f.reserva - f.modulosLibres), 0);
    return { totales: s.totales + totales, usados: s.usados + usados };
  }, { totales: 0, usados: 0 });
  const pct = utilizacion.totales > 0
    ? Math.round((utilizacion.usados / utilizacion.totales) * 100)
    : 0;

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="text-sm font-medium text-slate-500 mb-2">Dimensiones del tablero</div>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-slate-500">Cofres</dt>
          <dd className="font-medium tabular-nums">{t.cofres.length}</dd>
          <dt className="text-slate-500">Alto</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.altoTotalMm)}</dd>
          <dt className="text-slate-500">Ancho</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.anchoTotalMm)}</dd>
          <dt className="text-slate-500">Profundidad</dt>
          <dd className="font-medium tabular-nums">{fmtMm(t.profundidadTotalMm)}</dd>
          <dt className="text-slate-500">Circuitos</dt>
          <dd className="font-medium tabular-nums">{t.totalAsignaciones}</dd>
          <dt className="text-slate-500">Módulos DIN</dt>
          <dd className="font-medium tabular-nums">{t.totalModulos}</dd>
          <dt className="text-slate-500">Utilización</dt>
          <dd className="font-medium tabular-nums">
            {utilizacion.usados} / {utilizacion.totales} ({pct} %)
          </dd>
          {t.reservaPorFila > 0 && (
            <>
              <dt className="text-slate-500">Reserva / fila</dt>
              <dd className="text-slate-600 tabular-nums">{t.reservaPorFila} mód.</dd>
            </>
          )}
          {totalDif > 0 && (
            <>
              <dt className="text-slate-500">Diferenciales (RIC)</dt>
              <dd className="font-medium tabular-nums">{totalDif}</dd>
            </>
          )}
        </dl>
        {totalDif > 0 && (
          <div className="mt-2 text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-2">
            <div className="font-medium mb-1">Detalle RCDs (RIC N°06):</div>
            <ul className="space-y-0.5">
              {[...conteoDif.values()].map((d) => (
                <li key={`${d.sens}-${d.tipo}-${d.polos}`} className="flex justify-between">
                  <span>{`iD ${d.polos}P · ${d.sens} mA · Tipo ${d.tipo}`}</span>
                  <span className="tabular-nums">{d.n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="text-sm font-medium text-slate-500 mb-2">Conteo por cofre</div>
        <ul className="space-y-1 text-sm">
          {[...conteoCofres.entries()].map(([ref, n]) => (
            <li key={ref} className="flex justify-between">
              <span>{ref}</span>
              <span className="font-medium tabular-nums">{n}</span>
            </li>
          ))}
          <li className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1 mt-2">
            <span className="text-slate-500">Total cofres</span>
            <span className="font-semibold tabular-nums">{t.cofres.length}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
