import { useMetaStore } from '../store/proyecto-meta';

/**
 * Casilla + campo % para la reserva (vacancia) automática del CCM.
 * Práctica de exigencia de cliente — no es normativa, pero estándar en
 * proyectos industriales/mineros (Codelco, BHP, AMSA, SQM…): 25% de
 * capacidad libre más al menos una protección de cada tipo usado.
 * El dato es global del proyecto.
 */
export function ReservaCcmControl() {
  const reserva = useMetaStore((s) => s.reservaCcm);
  const setReservaCcm = useMetaStore((s) => s.setReservaCcm);

  return (
    <div className="inline-flex items-center gap-2 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1">
      <label
        className="flex items-center gap-1.5 text-sm font-medium cursor-pointer select-none"
        title="Agrega gavetas/celdas de reserva al CCM: 1 de cada tipo usado y el % indicado sobre la capacidad de las salidas"
      >
        <input
          type="checkbox"
          checked={reserva.activo}
          onChange={(e) => setReservaCcm({ activo: e.target.checked })}
          className="accent-slate-900 dark:accent-slate-100"
        />
        Reserva CCM
      </label>
      {reserva.activo && (
        <span className="flex items-center gap-1.5 text-sm">
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={reserva.porcentaje}
            onChange={(e) =>
              setReservaCcm({ porcentaje: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
            }
            aria-label="Porcentaje mínimo de reserva sobre la capacidad usada"
            className="w-16 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
          />
          <span className="text-slate-500 dark:text-slate-400">%</span>
        </span>
      )}
    </div>
  );
}
