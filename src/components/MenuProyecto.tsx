import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { cargarDesdeArchivo, descargarProyecto, nuevoProyecto } from '../store/proyecto';

export function MenuProyecto() {
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cierra al hacer click fuera.
  useEffect(() => {
    if (!abierto) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [abierto]);

  // Mensaje auto-desaparece a los 4s.
  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 4000);
    return () => clearTimeout(t);
  }, [mensaje]);

  function onNuevo() {
    setAbierto(false);
    const ok = window.confirm(
      'Esto descarta todas las cargas del CCM y las salidas del TDG actuales. ¿Continuar?',
    );
    if (!ok) return;
    nuevoProyecto();
    setMensaje({ tipo: 'ok', texto: 'Proyecto nuevo creado.' });
  }

  function onGuardar() {
    setAbierto(false);
    try {
      descargarProyecto();
      setMensaje({ tipo: 'ok', texto: 'Proyecto descargado.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err instanceof Error ? err.message : 'Error al guardar.' });
    }
  }

  function onCargar() {
    setAbierto(false);
    fileRef.current?.click();
  }

  async function onArchivoSeleccionado(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await cargarDesdeArchivo(file);
      setMensaje({ tipo: 'ok', texto: `Cargado: ${file.name}` });
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'Error al cargar el archivo.',
      });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-haspopup="menu"
        aria-expanded={abierto}
      >
        Proyecto ▾
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded shadow-lg z-20"
        >
          <Item label="Nuevo" hint="Limpia CCM y TDG" onClick={onNuevo} />
          <Item label="Guardar" hint="Descarga .json" onClick={onGuardar} />
          <Item label="Cargar" hint="Restaura desde .json" onClick={onCargar} />
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        onChange={onArchivoSeleccionado}
        className="hidden"
      />
      {mensaje && (
        <div
          role="status"
          className={
            'absolute right-0 mt-2 top-full whitespace-nowrap text-xs px-3 py-1.5 rounded shadow-md z-30 ' +
            (mensaje.tipo === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/70 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800')
          }
        >
          {mensaje.texto}
        </div>
      )}
    </div>
  );
}

function Item({
  label, hint, onClick,
}: { label: string; hint: string; onClick: () => void }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="block w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 first:rounded-t last:rounded-b"
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-slate-500">{hint}</div>
    </button>
  );
}
