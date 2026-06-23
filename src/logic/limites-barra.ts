// Topes de la barra principal según el tipo de tablero. Reflejan la práctica
// de la línea de productos:
//  - El CCM (Blokset / NEMA) está pensado para distribuir a motores; la barra
//    principal de fábrica se topa en 3200 A.
//  - El CDC (Prisma / Switchgear BT) es el tablero principal de la sala
//    eléctrica y puede llegar a 6000 A para alimentar varios CCMs y CDCs
//    aguas abajo.

/** Capacidad máxima de la barra principal de un CCM (A). */
export const MAX_BARRA_CCM_A = 3200;

/** Capacidad máxima de la barra principal de un CDC (A). */
export const MAX_BARRA_CDC_A = 6000;
