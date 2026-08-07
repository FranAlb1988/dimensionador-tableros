import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Contenedor de tabla ancha con señal de que hay más contenido al costado.
 *
 * Las tablas se desplazan en horizontal desde siempre, pero sin ningún indicio:
 * en un teléfono la tabla del CCM esconde el 79 % de su ancho y la barra de
 * desplazamiento mide 1 px, así que las columnas simplemente no existen para
 * quien no adivine que hay que arrastrar. Se agrega un degradado en el borde
 * que aparece solo del lado donde queda contenido.
 *
 * El degradado va detrás de un `pointer-events-none` para no robar el arrastre,
 * y no tapa la barra de desplazamiento.
 */
export function TablaDesplazable({
  children,
  etiqueta,
  borde = true,
  className = '',
}: {
  children: ReactNode;
  /** Nombre de la región, para cuando el contenido no es enfocable. */
  etiqueta: string;
  /** false cuando la tabla ya va dentro de una tarjeta con su propio borde. */
  borde?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hayIzquierda, setHayIzquierda] = useState(false);
  const [hayDerecha, setHayDerecha] = useState(false);
  // Si dentro hay campos, el teclado ya llega al contenido oculto tabulando y
  // el navegador desplaza solo. Un tabindex acá sería una parada de más en cada
  // tabla. Cuando la tabla es de solo lectura, en cambio, es la única forma de
  // llegar al contenido con el teclado.
  const [necesitaFoco, setNecesitaFoco] = useState(false);

  const revisar = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const maximo = el.scrollWidth - el.clientWidth;
    setHayIzquierda(el.scrollLeft > 1);
    setHayDerecha(maximo > 1 && el.scrollLeft < maximo - 1);
    setNecesitaFoco(
      maximo > 1 && el.querySelector('a[href], button, input, select, textarea') === null,
    );
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    revisar();
    el.addEventListener('scroll', revisar, { passive: true });
    const ro = new ResizeObserver(revisar);
    ro.observe(el);
    // El ancho de la tabla cambia al agregar o quitar filas.
    const mo = new MutationObserver(revisar);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener('scroll', revisar);
      ro.disconnect();
      mo.disconnect();
    };
  }, [revisar]);

  const velo = 'pointer-events-none absolute top-0 bottom-0 w-8 transition-opacity';

  return (
    <div
      className={
        'relative rounded-lg '
        + (borde ? 'border border-slate-200 dark:border-slate-800 ' : '')
        + className
      }
    >
      <div
        ref={ref}
        className="overflow-x-auto rounded-lg"
        {...(necesitaFoco ? { tabIndex: 0, role: 'region', 'aria-label': etiqueta } : {})}
      >
        {children}
      </div>
      {hayIzquierda && (
        <div className={`${velo} left-0 bg-gradient-to-r from-slate-300/70 dark:from-slate-700/70 to-transparent rounded-l-lg`} />
      )}
      {hayDerecha && (
        <div className={`${velo} right-0 bg-gradient-to-l from-slate-300/70 dark:from-slate-700/70 to-transparent rounded-r-lg`} />
      )}
    </div>
  );
}
