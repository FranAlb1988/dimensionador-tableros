import type { ChangeEvent } from 'react';
import { COLUMNAS_POR_CATEGORIA, useAuxiliaresPorCategoria, useAuxiliaresStore, type ColumnaAuxiliar } from '../store/auxiliares';
import type { CategoriaAuxiliar, EquipoAuxiliar } from '../types';
import { nombreDeFila, rotuloDeCampo } from '../util/rotulos';

const inputCls =
  'w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded ' +
  'px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 text-sm';

const btnPrimary =
  'px-3 py-1.5 text-sm font-medium rounded bg-slate-900 text-white hover:bg-slate-700 ' +
  'dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white';
const btnSecondary =
  'px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 ' +
  'hover:bg-slate-100 dark:hover:bg-slate-800';
const btnDanger =
  'px-3 py-1.5 text-sm font-medium rounded text-red-700 dark:text-red-300 hover:bg-red-50 ' +
  'dark:text-red-400 dark:hover:bg-red-950';

interface Props {
  categoria: CategoriaAuxiliar;
}

export function TablaAuxiliares({ categoria }: Props) {
  const equipos = useAuxiliaresPorCategoria(categoria);
  const equiposTotales = useAuxiliaresStore((s) => s.equipos);
  const agregar = useAuxiliaresStore((s) => s.agregar);
  const duplicar = useAuxiliaresStore((s) => s.duplicar);
  const eliminar = useAuxiliaresStore((s) => s.eliminar);
  const actualizar = useAuxiliaresStore((s) => s.actualizar);
  const cargarEjemplo = useAuxiliaresStore((s) => s.cargarEjemplo);
  const limpiarCategoria = useAuxiliaresStore((s) => s.limpiar);

  const cols = COLUMNAS_POR_CATEGORIA[categoria];

  const limpiar = () => {
    if (equipos.length === 0) return;
    const ok = window.confirm(`¿Eliminar los ${equipos.length} equipos de esta categoría? No se puede deshacer.`);
    if (ok) limpiarCategoria(categoria);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => agregar(categoria)} className={btnPrimary}>+ Agregar equipo</button>
        {equiposTotales.length === 0 && (
          <button onClick={cargarEjemplo} className={btnSecondary}>Cargar ejemplo</button>
        )}
        {equipos.length > 0 && (
          <button onClick={limpiar} className={`${btnDanger} ml-auto`}>Limpiar categoría</button>
        )}
      </div>

      {equipos.length === 0 ? (
        <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center text-slate-500 dark:text-slate-400">
          Sin equipos en esta categoría. Agrega uno o carga el ejemplo.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200">
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.campo}
                    className={`px-3 py-2.5 text-left font-semibold border-b border-slate-200 dark:border-slate-800 ${c.ancho ?? ''} ${c.tipo === 'number' ? 'text-right' : ''}`}
                    title={c.title}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {equipos.map((e, i) => (
                <Fila
                  key={e.id}
                  equipo={e}
                  indice={i}
                  cols={cols}
                  zebra={i % 2 === 1}
                  onChange={(p) => actualizar(e.id, p)}
                  onDuplicar={() => duplicar(e.id)}
                  onEliminar={() => eliminar(e.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface FilaProps {
  equipo: EquipoAuxiliar;
  indice: number;
  cols: readonly ColumnaAuxiliar[];
  zebra: boolean;
  onChange: (p: Partial<EquipoAuxiliar>) => void;
  onDuplicar: () => void;
  onEliminar: () => void;
}

function Fila({ equipo, indice, cols, zebra, onChange, onDuplicar, onEliminar }: FilaProps) {
  // El tag identifica el equipo mejor que la descripción; si aún no lo tiene,
  // se cae a la descripción y por último al número de fila.
  const nombre = nombreDeFila(equipo.tag || equipo.descripcion, indice, 'equipo');

  const trCls = zebra ? 'bg-slate-50/60 dark:bg-slate-900/40' : 'bg-white dark:bg-slate-950';
  const cellCls = 'px-3 py-1.5 border-b border-slate-200 dark:border-slate-800';

  const onCambio = (campo: keyof EquipoAuxiliar, tipo: 'text' | 'number') =>
    (e: ChangeEvent<HTMLInputElement>) => {
      if (tipo === 'number') {
        const v = e.target.value.replace(',', '.');
        const n = v === '' ? undefined : Number(v);
        if (n !== undefined && Number.isNaN(n)) return;
        onChange({ [campo]: n } as Partial<EquipoAuxiliar>);
      } else {
        onChange({ [campo]: e.target.value } as Partial<EquipoAuxiliar>);
      }
    };

  return (
    <tr className={`${trCls} hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors`}>
      {cols.map((c) => {
        const raw = equipo[c.campo];
        const valor = raw == null ? '' : String(raw);
        return (
          <td key={c.campo} className={cellCls}>
            <input
              type={c.tipo === 'number' ? 'number' : 'text'}
              step={c.tipo === 'number' ? '0.1' : undefined}
              className={`${inputCls} ${c.tipo === 'number' ? 'text-right tabular-nums' : ''}`}
              value={valor}
              placeholder={c.placeholder}
              onChange={onCambio(c.campo, c.tipo)}
              aria-label={rotuloDeCampo(c.label, nombre)}
            />
          </td>
        );
      })}
      <td className={`${cellCls} text-right whitespace-nowrap`}>
        <button
          onClick={onDuplicar}
          className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 px-1.5 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
          title="Duplicar"
          aria-label={`Duplicar ${nombre}`}
        >⎘</button>
        <button
          onClick={onEliminar}
          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950 ml-1"
          title="Eliminar"
          aria-label={`Eliminar ${nombre}`}
        >✕</button>
      </td>
    </tr>
  );
}
