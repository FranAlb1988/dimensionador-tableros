import { useCdcStore } from '../store/cdc';
import { useCdcOpciones } from '../store/cdc';

/**
 * Casilla + tipo + sensibilidad para el diferencial de cabecera del TDG.
 * Exigido por el RIC N°06 (Chile) en todos los circuitos de servicio.
 * El control está pensado para mostrarse en la cabecera del TDG.
 */
export function DiferencialCdcControl() {
  const opciones = useCdcOpciones();
  const setOpciones = useCdcStore((s) => s.setOpciones);

  return (
    <div className="inline-flex items-center gap-2 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1">
      <label
        className="flex items-center gap-1.5 text-sm font-medium cursor-pointer select-none"
        title="Agrega un RCD (diferencial) de cabecera por fila DIN. Exigido por RIC N°06."
      >
        <input
          type="checkbox"
          checked={opciones.diferencialPorFila}
          onChange={(e) => setOpciones({ diferencialPorFila: e.target.checked })}
          className="accent-slate-900 dark:accent-slate-100"
        />
        Diferencial RIC
      </label>
      {opciones.diferencialPorFila && (
        <span className="flex items-center gap-1.5 text-sm">
          <select
            value={opciones.sensibilidadDiferencialMa}
            onChange={(e) =>
              setOpciones({ sensibilidadDiferencialMa: Number(e.target.value) })
            }
            aria-label="Sensibilidad del diferencial (mA)"
            className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
          >
            <option value={10}>10 mA</option>
            <option value={30}>30 mA</option>
            <option value={100}>100 mA</option>
            <option value={300}>300 mA (S)</option>
          </select>
          <select
            value={opciones.tipoDiferencial}
            onChange={(e) =>
              setOpciones({ tipoDiferencial: e.target.value as 'AC' | 'A' })
            }
            aria-label="Tipo de RCD"
            className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="AC">Tipo AC</option>
            <option value="A">Tipo A</option>
          </select>
        </span>
      )}
    </div>
  );
}
