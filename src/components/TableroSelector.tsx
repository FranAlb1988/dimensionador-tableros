import { useEffect, useRef, useState } from 'react';

interface TableroLite {
  id: string;
  nombre: string;
  /** Etiqueta corta para mostrar como badge si no es el subtipo "default". */
  badge?: string;
  /** Estilo de color del badge: amber por defecto. */
  badgeColor?: 'amber' | 'sky' | 'emerald' | 'rose';
}

export interface OpcionCrear {
  /** Texto del botón (p.ej. "+ Nuevo CDC"). */
  etiqueta: string;
  /** Sugerencia de nombre para el prompt. */
  sugerencia: string;
  /** Crea el tablero con el nombre dado. */
  onCrear: (nombre: string) => void;
}

interface Props {
  tableros: readonly TableroLite[];
  activoId: string | null;
  setActivo: (id: string) => void;
  /** Una o varias opciones de creación (por subtipo). */
  opcionesCrear: readonly OpcionCrear[];
  onRenombrar: (id: string, nombre: string) => void;
  onDuplicar: (id: string) => void;
  onEliminar: (id: string) => void;
  /** Etiqueta del tipo (CCM, CDC, TDG) para los prompts. */
  etiqueta: string;
}

const BADGE_COLOR_CLS: Record<NonNullable<TableroLite['badgeColor']>, string> = {
  amber: 'bg-amber-200/70 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  sky: 'bg-sky-200/70 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200',
  emerald: 'bg-emerald-200/70 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  rose: 'bg-rose-200/70 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200',
};

export function TableroSelector({
  tableros, activoId, setActivo,
  opcionesCrear,
  onRenombrar, onDuplicar, onEliminar,
  etiqueta,
}: Props) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAbierto) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuAbierto]);

  const activo = tableros.find((t) => t.id === activoId);

  function crear(opcion: OpcionCrear) {
    const nombre = window.prompt(`Nombre del nuevo tablero:`, opcion.sugerencia);
    if (nombre == null) return;
    const limpio = nombre.trim();
    if (!limpio) return;
    opcion.onCrear(limpio);
  }

  function renombrar() {
    if (!activo) return;
    const nombre = window.prompt(`Nuevo nombre para "${activo.nombre}":`, activo.nombre);
    if (nombre == null) return;
    const limpio = nombre.trim();
    if (!limpio || limpio === activo.nombre) return;
    onRenombrar(activo.id, limpio);
    setMenuAbierto(false);
  }

  function duplicar() {
    if (!activo) return;
    onDuplicar(activo.id);
    setMenuAbierto(false);
  }

  function eliminar() {
    if (!activo) return;
    const ok = window.confirm(`¿Eliminar "${activo.nombre}"? Sus cargas se perderán.`);
    if (!ok) return;
    onEliminar(activo.id);
    setMenuAbierto(false);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-900/50">
      <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 ml-1">
        {etiqueta} activo
      </span>

      <div className="flex gap-1 overflow-x-auto">
        {tableros.map((t) => {
          const esActivo = t.id === activoId;
          return (
            <button
              key={t.id}
              onClick={() => setActivo(t.id)}
              className={
                'px-3 py-1.5 text-sm font-medium rounded whitespace-nowrap transition-colors flex items-center gap-1.5 ' +
                (esActivo
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800')
              }
              title={`Cambiar a ${t.nombre}`}
            >
              <span>{t.nombre}</span>
              {t.badge && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${BADGE_COLOR_CLS[t.badgeColor ?? 'amber']}`}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {opcionesCrear.map((op) => (
        <button
          key={op.etiqueta}
          onClick={() => crear(op)}
          className="px-2 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          title={`Crear ${op.etiqueta}`}
        >
          {op.etiqueta}
        </button>
      ))}

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuAbierto((v) => !v)}
          disabled={!activo}
          className="px-2 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          title="Acciones del tablero activo"
          aria-haspopup="menu"
          aria-expanded={menuAbierto}
        >
          ⋯
        </button>
        {menuAbierto && (
          <div
            role="menu"
            className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded shadow-lg z-20"
          >
            <MenuItem label="Renombrar" onClick={renombrar} />
            <MenuItem label="Duplicar" onClick={duplicar} />
            <MenuItem label="Eliminar" onClick={eliminar} danger />
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={
        'block w-full text-left px-3 py-2 text-sm first:rounded-t last:rounded-b ' +
        (danger
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800')
      }
    >
      {label}
    </button>
  );
}
