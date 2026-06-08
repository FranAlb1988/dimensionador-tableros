// Lógica de reserva (vacancia) automática para CCM.
//
// No hay cláusula normativa universal que exija un % específico, pero la
// práctica de exigencia de cliente — universal en proyectos industriales y
// mineros — es 25% de capacidad libre + al menos una protección de cada
// tipo usado. Esta función es genérica y aplica a NEMA, IEC y MT.

export interface ReservaResult<T> {
  /** Unidades de reserva agregadas, en el orden generado. */
  reservas: T[];
  /** Suma de tamaños (X) de las reservas. */
  tamanoReserva: number;
  /** Suma de tamaños (X) de las salidas reales. */
  tamanoSalidas: number;
}

/**
 * Calcula las unidades de reserva para un conjunto de salidas, según el
 * algoritmo: "1 de cada tipo único usado, más unidades adicionales del
 * tipo predominante (mayor tamaño) hasta cubrir el porcentaje mínimo
 * sobre la capacidad usada por las salidas reales".
 *
 * - `salidas`: lista de asignaciones reales.
 * - `getKey`: clasifica las salidas en "tipos" únicos.
 * - `getSize`: tamaño (X o mm) de cada salida.
 * - `crearReserva`: fabrica una unidad de reserva a partir de una salida modelo.
 * - `porcentaje`: % mínimo a reservar (sobre Σ tamaños de salidas).
 *
 * Determinista: los tipos se procesan en el orden de primera aparición; la
 * unidad de reserva adicional se replica del tipo de mayor tamaño usado.
 */
export function calcularReservas<T>(
  salidas: readonly T[],
  getKey: (item: T) => string,
  getSize: (item: T) => number,
  crearReserva: (modelo: T, indice: number) => T,
  porcentaje: number,
): ReservaResult<T> {
  if (salidas.length === 0 || porcentaje <= 0) {
    return { reservas: [], tamanoReserva: 0, tamanoSalidas: 0 };
  }

  const tamanoSalidas = salidas.reduce((acc, s) => acc + getSize(s), 0);
  const tamanoMinimo = tamanoSalidas * (porcentaje / 100);

  // Modelo único por tipo, en orden de primera aparición.
  const vistos = new Set<string>();
  const modelos: T[] = [];
  for (const s of salidas) {
    const k = getKey(s);
    if (!vistos.has(k)) {
      vistos.add(k);
      modelos.push(s);
    }
  }

  // 1 reserva de cada tipo usado.
  const reservas: T[] = modelos.map((m, i) => crearReserva(m, i));
  let tamanoReserva = reservas.reduce((acc, r) => acc + getSize(r), 0);

  // Si no alcanza el porcentaje, agregar reservas del tipo más grande usado.
  if (tamanoReserva < tamanoMinimo) {
    const masGrande = modelos.reduce(
      (max, m) => (getSize(m) > getSize(max) ? m : max),
    );
    let idx = reservas.length;
    while (tamanoReserva < tamanoMinimo) {
      reservas.push(crearReserva(masGrande, idx));
      tamanoReserva += getSize(masGrande);
      idx += 1;
    }
  }

  return { reservas, tamanoReserva, tamanoSalidas };
}
