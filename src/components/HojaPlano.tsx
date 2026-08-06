import type { ReactNode } from 'react';

/**
 * Marco de "hoja" para las vistas frontales.
 *
 * El plano se mantiene claro también en modo oscuro, y es a propósito: el PDF
 * se genera con svg2pdf leyendo este mismo SVG del DOM, así que pintarlo oscuro
 * en pantalla saldría oscuro también en el archivo, y un unilineal impreso
 * sobre fondo negro no es un entregable razonable. Manteniéndolo claro, lo que
 * se ve y lo que se exporta son la misma cosa.
 *
 * Se fija `text-slate-900` porque en modo oscuro el color heredado del body es
 * casi blanco: cualquier texto que no sea del SVG quedaría invisible sobre la
 * hoja.
 */
export function HojaPlano({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-lg p-4 overflow-x-auto bg-white text-slate-900
                 border border-slate-200 dark:border-slate-500"
    >
      {children}
    </div>
  );
}
