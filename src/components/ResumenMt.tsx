import type { ResultadoMt } from '../logic/mt';
import { TIPO_CELDA_MT_LABEL } from '../types';
import { fmtAmp, fmtMm } from '../util/format';

interface Props {
  resultado: ResultadoMt;
}

export function ResumenMt({ resultado }: Props) {
  const t = resultado.tablero;
  if (!t) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Resumen</h2>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Dato etiqueta="Clase de tensión" valor={`${t.claseTensionKv} kV`} />
        <Dato etiqueta="Icc" valor={`${t.iccKa} kA`} />
        <Dato etiqueta="Barra principal" valor={fmtAmp(t.corrienteBarraA)} />
        <Dato etiqueta="Celdas" valor={String(t.celdas.length)} />
        <Dato etiqueta="Ancho total" valor={fmtMm(t.anchoTotalMm)} />
        <Dato etiqueta="Alto" valor={fmtMm(t.altoTotalMm)} />
        <Dato etiqueta="Fondo" valor={fmtMm(t.profundidadTotalMm)} />
        <Dato etiqueta="I requerida" valor={fmtAmp(t.corrienteRequeridaA)} />
      </div>

      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Descripción</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium text-right">I diseño</th>
              <th className="px-3 py-2 font-medium text-right">Ancho</th>
            </tr>
          </thead>
          <tbody>
            {t.celdas.map((c, idx) => (
              <tr key={c.salida.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="px-3 py-2">{idx + 1}</td>
                <td className="px-3 py-2">{c.salida.descripcion || c.salida.id}</td>
                <td className="px-3 py-2">{TIPO_CELDA_MT_LABEL[c.salida.tipoCelda]}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtAmp(c.corrienteA)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMm(c.anchoMm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resultado.salidasSinAsignar.length > 0 && (
        <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm">
          <div className="font-medium text-amber-800 dark:text-amber-200">Celdas sin asignar</div>
          <ul className="mt-1 list-disc list-inside text-amber-900 dark:text-amber-100">
            {resultado.salidasSinAsignar.map((s) => (
              <li key={s.id}>{s.descripcion || s.id} — tipo o clase de tensión sin entrada en catálogo.</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{etiqueta}</div>
      <div className="text-lg font-semibold mt-0.5 tabular-nums">{valor}</div>
    </div>
  );
}
