import { useMetaStore, useFactorDerrateo } from '../store/proyecto-meta';
import type { NivelTension } from '../logic/derrateo';
import { fmtFactor } from '../util/format';

/**
 * Casilla + campo de altitud para activar el derrateo por altura geográfica.
 * El dato es global del proyecto; el control se muestra en cada página de tablero.
 * `nivel` define la columna de la Tabla V usada para mostrar F2 (BT o MT).
 */
export function DerrateoControl({ nivel }: { nivel: NivelTension }) {
  const derrateo = useMetaStore((s) => s.derrateo);
  const setDerrateo = useMetaStore((s) => s.setDerrateo);
  const factor = useFactorDerrateo(nivel);

  return (
    <div className="inline-flex items-center gap-2 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1">
      <label
        className="flex items-center gap-1.5 text-sm font-medium cursor-pointer select-none"
        title="Aplica el derrateo por altura geográfica (F2 — Tabla V, IEEE C37.20.1) y por temperatura ambiente (F1 — sin corrección hasta 40 °C) al dimensionamiento"
      >
        <input
          type="checkbox"
          checked={derrateo.activo}
          onChange={(e) => setDerrateo({ activo: e.target.checked })}
          className="accent-slate-900 dark:accent-slate-100"
        />
        Derrateo
      </label>
      {derrateo.activo && (
        <span className="flex items-center gap-1.5 text-sm">
          <input
            type="number"
            min={0}
            step={100}
            value={derrateo.altitudM}
            onChange={(e) => setDerrateo({ altitudM: Number(e.target.value) || 0 })}
            aria-label="Altitud en metros sobre el nivel del mar"
            className="w-20 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
          />
          <span className="text-slate-500">m.s.n.m.</span>
          <input
            type="number"
            min={-10}
            max={99}
            step={1}
            value={derrateo.temperaturaC ?? 40}
            onChange={(e) => setDerrateo({ temperaturaC: Number(e.target.value) || 40 })}
            aria-label="Temperatura ambiente de diseño en grados Celsius"
            title="Temperatura ambiente de diseño (F1 — IEEE C37.20.1; sin corrección hasta 40 °C)"
            className="w-14 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
          />
          <span className="text-slate-500">°C</span>
          <span
            className="text-slate-600 dark:text-slate-300 tabular-nums"
            title={`Factor combinado F1(temperatura) × F2(altura, ${nivel === 'MT' ? 'media' : 'baja'} tensión)`}
          >
            F = {fmtFactor(factor)}
          </span>
        </span>
      )}
    </div>
  );
}
