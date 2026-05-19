import { useMemo, useRef, useState } from 'react';
import { TablaCargas } from '../components/TablaCargas';
import { ImportarCargasModal } from '../components/ImportarCargasModal';
import { AsignacionesPanel } from '../components/AsignacionesPanel';
import { VistaFrontalSvg } from '../components/VistaFrontalSvg';
import { Resumen } from '../components/Resumen';
import { ExportarPdfBoton } from '../components/ExportarPdfBoton';
import { AsignacionesPanelNema } from '../components/AsignacionesPanelNema';
import { VistaFrontalCcmNemaSvg } from '../components/VistaFrontalCcmNemaSvg';
import { ResumenCcmNema } from '../components/ResumenCcmNema';
import { ExportarPdfCcmNemaBoton } from '../components/ExportarPdfCcmNemaBoton';
import { useCcmCargas, useCcmNorma, useCcmStore } from '../store/ccm';
import { dimensionarCcm } from '../logic/tablero';
import { dimensionarCcmNema } from '../logic/ccm-nema';
import type { Norma } from '../types';
import { TableroSelector } from '../components/TableroSelector';

const NORMAS: readonly Norma[] = ['NEMA', 'IEC'];

export function CcmPage() {
  const cargas = useCcmCargas();
  const norma = useCcmNorma();
  const setNorma = useCcmStore((s) => s.setNorma);
  const tableros = useCcmStore((s) => s.tableros);
  const activoId = useCcmStore((s) => s.activoId);
  const setActivo = useCcmStore((s) => s.setActivo);
  const crearTablero = useCcmStore((s) => s.crearTablero);
  const renombrarTablero = useCcmStore((s) => s.renombrarTablero);
  const duplicarTablero = useCcmStore((s) => s.duplicarTablero);
  const eliminarTablero = useCcmStore((s) => s.eliminarTablero);
  const svgRefIec = useRef<SVGSVGElement | null>(null);
  const svgRefNema = useRef<SVGSVGElement | null>(null);
  const [importAbierto, setImportAbierto] = useState(false);

  const resultadoIec = useMemo(
    () => (norma === 'IEC' ? dimensionarCcm(cargas) : null),
    [cargas, norma],
  );
  const resultadoNema = useMemo(
    () => (norma === 'NEMA' ? dimensionarCcmNema(cargas) : null),
    [cargas, norma],
  );

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">CCM — Centro de control de motores</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {norma === 'NEMA'
              ? 'Convención NEMA · Contactores 1–9 · MCP · Frames ANSI · X = 6". Tabla del Excel del proyecto.'
              : 'Convención IEC · Schneider Compact NSX + TeSys · Gavetas Blokset.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="inline-flex border border-slate-300 dark:border-slate-700 rounded overflow-hidden"
            role="tablist"
            aria-label="Norma del catálogo"
          >
            {NORMAS.map((n) => {
              const activo = n === norma;
              return (
                <button
                  key={n}
                  onClick={() => setNorma(n)}
                  className={
                    'px-3 py-1.5 text-sm font-medium ' +
                    (activo
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800')
                  }
                >
                  {n}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setImportAbierto(true)}
            className="px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Importar lista de cargas desde Excel o CSV (p.ej. salida de DATAEXTRACTION en AutoCAD)"
          >
            ⤓ Importar Excel/CSV
          </button>
          {norma === 'IEC' && resultadoIec && (
            <ExportarPdfBoton svgRef={svgRefIec} resultado={resultadoIec} />
          )}
          {norma === 'NEMA' && resultadoNema && (
            <ExportarPdfCcmNemaBoton svgRef={svgRefNema} resultado={resultadoNema} />
          )}
        </div>
      </header>

      <TableroSelector
        etiqueta="CCM"
        tableros={tableros.map((t) => ({ id: t.id, nombre: t.nombre }))}
        activoId={activoId}
        setActivo={setActivo}
        opcionesCrear={[
          { etiqueta: '+ Nuevo CCM', sugerencia: `CCM ${tableros.length + 1}`, onCrear: (n) => crearTablero(n) },
        ]}
        onRenombrar={renombrarTablero}
        onDuplicar={(id) => { duplicarTablero(id); }}
        onEliminar={eliminarTablero}
      />

      <section>
        <TablaCargas />
      </section>

      {norma === 'IEC' && resultadoIec && resultadoIec.asignaciones.length > 0 && (
        <>
          <section>
            <AsignacionesPanel
              asignaciones={resultadoIec.asignaciones}
              cargasSinAsignar={resultadoIec.cargasSinAsignar}
            />
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Vista frontal (IEC / Blokset)</h2>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 overflow-x-auto bg-white">
              <VistaFrontalSvg ref={svgRefIec} tablero={resultadoIec.tablero} />
            </div>
          </section>
          <section><Resumen resultado={resultadoIec} /></section>
        </>
      )}

      {norma === 'NEMA' && resultadoNema && resultadoNema.tablero && (
        <>
          <section>
            <AsignacionesPanelNema
              asignaciones={resultadoNema.asignaciones}
              cargasSinAsignar={resultadoNema.cargasSinAsignar}
            />
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Vista frontal (NEMA · X = 6")</h2>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 overflow-x-auto bg-white">
              <VistaFrontalCcmNemaSvg ref={svgRefNema} tablero={resultadoNema.tablero} />
            </div>
          </section>
          <section><ResumenCcmNema resultado={resultadoNema} /></section>
        </>
      )}

      {norma === 'NEMA' && resultadoNema && !resultadoNema.tablero && resultadoNema.motivo && (
        <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm text-amber-900 dark:text-amber-100">
          {resultadoNema.motivo}
        </div>
      )}

      <ImportarCargasModal abierto={importAbierto} onCerrar={() => setImportAbierto(false)} />
    </div>
  );
}
