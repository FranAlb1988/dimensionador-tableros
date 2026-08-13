// Rastreo de datos placeholder en un resultado de dimensionamiento.
//
// Seis catálogos del proyecto traen 66 entradas marcadas `placeholder: true`:
// referencias que no se verificaron contra el catálogo del fabricante, o
// dimensiones aproximadas. El modelo ya llevaba la marca, pero solo dos
// paneles la mostraban y ningún PDF la arrastraba — se podía exportar una
// memoria con SKU inventados sin que nada lo dijera.
//
// El recolector recorre el resultado en vez de enumerar campos: así funciona
// igual para CCM IEC, CCM NEMA, CDC y TDG, y sigue funcionando si mañana se
// agrega otro tipo de equipo con la misma marca.

export interface ItemPlaceholder {
  /** Referencia comercial, dimensión o tamaño que identifica al ítem. */
  referencia: string;
  /** Cuántas veces aparece en el resultado. */
  veces: number;
  /** Nota del catálogo, si la trae. */
  notas?: string;
}

/**
 * Campos de los que sacar un nombre legible, en orden de preferencia.
 *
 * `contactor` está porque el arrancador no tiene `referencia`: identifica al
 * conjunto por el contactor. Sin él, los arrancadores placeholder salían
 * listados como "(sin referencia)" y no se podía saber cuál verificar.
 */
const CLAVES_NOMBRE = [
  'referencia', 'contactor', 'dimensionMm', 'tamano', 'modelo', 'familia',
] as const;

function nombreDe(o: Record<string, unknown>): string {
  for (const k of CLAVES_NOMBRE) {
    const v = o[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return '(sin referencia)';
}

/**
 * Recorre un resultado de dimensionamiento y junta todo lo marcado como
 * placeholder, agrupado por referencia.
 *
 * Recorre en profundidad con control de ciclos: los resultados enlazan cargas
 * y asignaciones en las dos direcciones y sin esto se colgaría.
 */
export function recolectarPlaceholders(raiz: unknown): ItemPlaceholder[] {
  const porReferencia = new Map<string, ItemPlaceholder>();
  const vistos = new WeakSet<object>();

  const visitar = (nodo: unknown): void => {
    if (nodo == null || typeof nodo !== 'object') return;
    if (vistos.has(nodo)) return;
    vistos.add(nodo);

    if (Array.isArray(nodo)) {
      for (const x of nodo) visitar(x);
      return;
    }

    const o = nodo as Record<string, unknown>;
    if (o['placeholder'] === true) {
      const referencia = nombreDe(o);
      const previo = porReferencia.get(referencia);
      if (previo) previo.veces += 1;
      else {
        const notas = typeof o['notas'] === 'string' ? o['notas'] : undefined;
        porReferencia.set(referencia, { referencia, veces: 1, ...(notas ? { notas } : {}) });
      }
    }
    for (const v of Object.values(o)) visitar(v);
  };

  visitar(raiz);
  return [...porReferencia.values()].sort((a, b) => a.referencia.localeCompare(b.referencia));
}

/** Total de ítems placeholder, contando repeticiones. */
export function totalPlaceholders(items: readonly ItemPlaceholder[]): number {
  return items.reduce((s, i) => s + i.veces, 0);
}

/**
 * Línea para la memoria PDF. Se devuelve `undefined` cuando no hay nada que
 * advertir, para no ensuciar una memoria que sí está toda verificada.
 */
export function lineaCriterioPlaceholders(
  items: readonly ItemPlaceholder[],
): string | undefined {
  if (items.length === 0) return undefined;
  const total = totalPlaceholders(items);
  const lista = items.map((i) => (i.veces > 1 ? `${i.referencia} (x${i.veces})` : i.referencia));
  return `ATENCION - ${total} seleccion(es) usan datos placeholder: no se verificaron contra el `
    + 'catalogo vigente del fabricante y no deben llevarse a plano ni a orden de compra sin '
    + `confirmar. Afecta a: ${lista.join(', ')}.`;
}
