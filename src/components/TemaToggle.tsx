import { TEMAS, useTema } from '../store/tema';

/**
 * Selector de tema claro / oscuro / sistema.
 * Grupo de radios con apariencia de segmentos: son opciones excluyentes y así
 * el teclado las recorre con las flechas, como corresponde.
 */
export function TemaToggle() {
  const tema = useTema((s) => s.tema);
  const setTema = useTema((s) => s.setTema);

  return (
    <fieldset
      className="flex items-center rounded-md border border-slate-300 dark:border-slate-700 p-0.5"
      aria-label="Tema de la interfaz"
    >
      {TEMAS.map((t) => {
        const activo = t.valor === tema;
        return (
          <label
            key={t.valor}
            title={t.etiqueta}
            className={
              'px-2 py-1 rounded text-sm leading-none cursor-pointer transition-colors ' +
              'focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 ' +
              'focus-within:outline-sky-600 dark:focus-within:outline-sky-400 ' +
              (activo
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
            }
          >
            <input
              type="radio"
              name="tema"
              value={t.valor}
              checked={activo}
              onChange={() => setTema(t.valor)}
              className="sr-only"
            />
            <span aria-hidden="true">{t.icono}</span>
            <span className="sr-only">{t.etiqueta}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
