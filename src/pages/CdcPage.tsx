import { useMemo, useRef } from 'react';
import { TablaCargasCdc } from '../components/TablaCargasCdc';
import { PanelCofresCdc } from '../components/PanelCofresCdc';
import { VistaFrontalCdcSvg } from '../components/VistaFrontalCdcSvg';
import { HojaPlano } from '../components/HojaPlano';
import { ResumenCdc } from '../components/ResumenCdc';
import { ExportarPdfCdcBoton } from '../components/ExportarPdfCdcBoton';
import { SUBTIPOS_CDC_LABEL, useCdcCargas, useCdcOpciones, useCdcStore, useCdcSubtipo } from '../store/cdc';
import { dimensionarCdc } from '../logic/cdc';
import { TableroSelector } from '../components/TableroSelector';
import { DerrateoControl } from '../components/DerrateoControl';
import { DiferencialCdcControl } from '../components/DiferencialCdcControl';
import { useFactorDerrateo } from '../store/proyecto-meta';

export function CdcPage() {
  const cargas = useCdcCargas();
  const opciones = useCdcOpciones();
  const subtipo = useCdcSubtipo();
  const tableros = useCdcStore((s) => s.tableros);
  const activoId = useCdcStore((s) => s.activoId);
  const setActivo = useCdcStore((s) => s.setActivo);
  const crearTablero = useCdcStore((s) => s.crearTablero);
  const renombrarTablero = useCdcStore((s) => s.renombrarTablero);
  const duplicarTablero = useCdcStore((s) => s.duplicarTablero);
  const eliminarTablero = useCdcStore((s) => s.eliminarTablero);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Nota: este archivo se llama CdcPage por historia, pero se monta en la ruta /tdg
  // (Tablero General de servicios aguas abajo del CDC).
  const titulo = subtipo === 'alumbrado'
    ? 'TDG — Tablero de alumbrado'
    : 'TDG — Tablero General de servicios';
  const descripcion = subtipo === 'alumbrado'
    ? 'Tablero de alumbrado aguas abajo del CDC. Pragma · iC60 sobre riel DIN. Circuitos de iluminación 1F / 230 V.'
    : 'Tablero General de servicios (alumbrado, tomas, cargas menores) aguas abajo del CDC. Pragma · iC60 sobre riel DIN — módulos de 18 mm, bin-packing en filas y cofres.';

  const tablerosLite = tableros.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    ...(t.subtipo !== 'general' ? { badge: SUBTIPOS_CDC_LABEL[t.subtipo], badgeColor: 'amber' as const } : {}),
  }));

  const factorDerrateo = useFactorDerrateo('BT');
  const resultado = useMemo(
    () => dimensionarCdc(cargas, opciones, factorDerrateo),
    [cargas, opciones, factorDerrateo],
  );

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{titulo}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{descripcion}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DerrateoControl nivel="BT" />
          <DiferencialCdcControl />
          <ExportarPdfCdcBoton svgRef={svgRef} resultado={resultado} subtipo={subtipo} />
        </div>
      </header>

      <TableroSelector
        etiqueta="TDG"
        tableros={tablerosLite}
        activoId={activoId}
        setActivo={setActivo}
        opcionesCrear={[
          { etiqueta: '+ TDG', sugerencia: `TDG ${tableros.length + 1}`, onCrear: (n) => crearTablero(n, 'general') },
          { etiqueta: '+ Alumbrado', sugerencia: `Alumbrado ${tableros.length + 1}`, onCrear: (n) => crearTablero(n, 'alumbrado') },
        ]}
        onRenombrar={renombrarTablero}
        onDuplicar={(id) => { duplicarTablero(id); }}
        onEliminar={eliminarTablero}
      />

      <section>
        <TablaCargasCdc />
      </section>

      {resultado.tablero && resultado.asignaciones.length > 0 && (
        <>
          <section>
            <PanelCofresCdc cofres={resultado.tablero.cofres} />
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Vista frontal</h2>
            <HojaPlano>
              <VistaFrontalCdcSvg ref={svgRef} tablero={resultado.tablero} />
            </HojaPlano>
          </section>

          <section>
            <ResumenCdc resultado={resultado} />
          </section>

          {resultado.cargasSinAsignar.length > 0 && (
            <section>
              <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm">
                <div className="font-medium text-amber-800 dark:text-amber-200">Circuitos sin asignar</div>
                <ul className="mt-1 list-disc list-inside text-amber-900 dark:text-amber-100">
                  {resultado.cargasSinAsignar.map((c) => (
                    <li key={c.id}>{c.descripcion || c.id} — verifica potencia/corriente/tensión.</li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </>
      )}

      {/* Con la tabla vacía no hay fallo que avisar: la tabla ya dice qué hacer. */}
      {cargas.length > 0 && !resultado.tablero && resultado.motivo && (
        <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm text-amber-900 dark:text-amber-100">
          {resultado.motivo}
        </div>
      )}
    </div>
  );
}
