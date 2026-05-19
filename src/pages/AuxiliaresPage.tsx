import { useState } from 'react';
import { CATEGORIAS, CATEGORIAS_DESCRIPCION, CATEGORIAS_LABEL, useAuxiliaresStore } from '../store/auxiliares';
import { TablaAuxiliares } from '../components/TablaAuxiliares';
import { ExportarPdfAuxiliaresBoton } from '../components/ExportarPdfAuxiliaresBoton';
import type { CategoriaAuxiliar } from '../types';

export function AuxiliaresPage() {
  const [categoria, setCategoria] = useState<CategoriaAuxiliar>('instrumentacion');
  const equiposTotales = useAuxiliaresStore((s) => s.equipos);

  const conteoPorCat: Record<CategoriaAuxiliar, number> = {
    instrumentacion: 0,
    ups: 0,
    baterias: 0,
    cargador: 0,
  };
  for (const e of equiposTotales) conteoPorCat[e.categoria] += 1;

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Equipos auxiliares</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Inventario de equipos que viven en la sala eléctrica pero no se dimensionan aquí: instrumentación, UPS, banco de baterías y cargador.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportarPdfAuxiliaresBoton soloCategoria={categoria} />
          <ExportarPdfAuxiliaresBoton />
        </div>
      </header>

      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap gap-1">
        {CATEGORIAS.map((c) => {
          const activo = c === categoria;
          return (
            <button
              key={c}
              onClick={() => setCategoria(c)}
              className={
                'px-3 py-1.5 text-sm font-medium rounded whitespace-nowrap transition-colors flex items-center gap-1.5 ' +
                (activo
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800')
              }
            >
              <span>{CATEGORIAS_LABEL[c]}</span>
              <span
                className={
                  'px-1.5 py-0.5 rounded text-[10px] tabular-nums font-semibold ' +
                  (activo
                    ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')
                }
              >
                {conteoPorCat[c]}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
        {CATEGORIAS_DESCRIPCION[categoria]}
      </p>

      <section>
        <TablaAuxiliares categoria={categoria} />
      </section>
    </div>
  );
}
