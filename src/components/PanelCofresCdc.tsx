import type { Cofre, FilaDin } from '../types';
import { fmtAmp } from '../util/format';

interface Props {
  cofres: readonly Cofre[];
}

export function PanelCofresCdc({ cofres }: Props) {
  if (cofres.length === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Cofres Pragma</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cofres.map((c) => <TarjetaCofre key={c.indice} cofre={c} />)}
      </div>
    </div>
  );
}

function TarjetaCofre({ cofre }: { cofre: Cofre }) {
  const cat = cofre.catalogo;
  const totalUtil = cofre.filas.reduce((s, f) => s + (f.modulosTotales - f.reserva), 0);
  const usados = cofre.filas.reduce((s, f) => s + (f.modulosTotales - f.reserva - f.modulosLibres), 0);
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-medium">Cofre {cofre.indice} — {cat.referencia}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {cat.filas} filas × {cat.modulosPorFila} módulos · {cat.altoMm}×{cat.anchoMm}×{cat.profundidadMm} mm
          </div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 tabular-nums whitespace-nowrap">
          {usados}/{totalUtil} mód.
        </span>
      </div>
      <div className="space-y-1">
        {cofre.filas.map((f) => <FilaResumen key={f.indice} fila={f} />)}
      </div>
    </div>
  );
}

function FilaResumen({ fila }: { fila: FilaDin }) {
  const ocupados = fila.modulos.reduce((s, m) => s + m.modulosDin, 0);
  const totalUtil = fila.modulosTotales - fila.reserva;
  return (
    <div className="text-xs flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-1">
      <span className="font-mono text-slate-500 dark:text-slate-400 w-8 shrink-0">F{fila.indice}</span>
      <div className="flex-1 flex flex-wrap gap-1">
        {fila.reserva > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px]">
            Reserva {fila.reserva} mód.
          </span>
        )}
        {fila.modulos.map((m, i) => (
          <span
            key={i}
            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] whitespace-nowrap"
            title={`${m.carga.descripcion || m.carga.id} · ${fmtAmp(m.corrienteDisenoA)}`}
          >
            {m.proteccion.inA}A {m.proteccion.polos}P
          </span>
        ))}
        {fila.modulosLibres > 0 && (
          <span className="px-1.5 py-0.5 rounded border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 text-[10px]">
            Libre {fila.modulosLibres}
          </span>
        )}
      </div>
      <span className="text-slate-500 dark:text-slate-400 tabular-nums text-[10px] shrink-0">
        {ocupados}/{totalUtil}
      </span>
    </div>
  );
}
