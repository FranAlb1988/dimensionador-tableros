import { useMemo } from 'react';
import { recolectarPlaceholders, totalPlaceholders } from '../logic/placeholders';

/**
 * Aviso de que el dimensionamiento usa referencias sin verificar.
 *
 * Va arriba del resultado y no dentro de cada tarjeta: el aviso por tarjeta
 * existía pero solo en el panel IEC, así que en la rama NEMA no aparecía en
 * ningún lado y en el PDF tampoco. Esto es lo que separa una memoria que se
 * puede llevar a plano de una que no.
 */
export function AvisoPlaceholders({ resultado }: { resultado: unknown }) {
  const items = useMemo(() => recolectarPlaceholders(resultado), [resultado]);
  if (items.length === 0) return null;

  const total = totalPlaceholders(items);
  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
      <p className="font-medium">
        {total === 1
          ? '1 selección usa datos placeholder.'
          : `${total} selecciones usan datos placeholder.`}
      </p>
      <p className="mt-0.5">
        No se verificaron contra el catálogo vigente del fabricante. Sirven para dimensionar
        espacio y corriente, pero no deben llevarse a plano ni a orden de compra sin confirmar
        la referencia.
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
        {items.map((i) => (
          <li key={i.referencia} className="whitespace-nowrap">
            {i.referencia}
            {i.veces > 1 && <span className="font-sans"> ×{i.veces}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
