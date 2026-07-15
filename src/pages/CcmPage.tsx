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
import { AsignacionesPanelMt } from '../components/AsignacionesPanelMt';
import { VistaFrontalCcmMtSvg } from '../components/VistaFrontalCcmMtSvg';
import { ResumenCcmMt } from '../components/ResumenCcmMt';
import { useCcmCargas, useCcmMarca, useCcmNorma, useCcmStore } from '../store/ccm';
import { dimensionarCcm } from '../logic/tablero';
import { dimensionarCcmNema } from '../logic/ccm-nema';
import { dimensionarCcmMt, UMBRAL_MT_V } from '../logic/ccm-mt';
import { cargasContraincendio } from '../logic/advertencias-ccm';
import { MARCAS_FEEDER } from '../logic/proteccion';
import { DerrateoControl } from '../components/DerrateoControl';
import { ReservaCcmControl } from '../components/ReservaCcmControl';
import { useFactorDerrateo, useReservaCcm } from '../store/proyecto-meta';
import type { Norma } from '../types';
import { TableroSelector } from '../components/TableroSelector';

const NORMAS: readonly Norma[] = ['NEMA', 'IEC'];

export function CcmPage() {
  const cargas = useCcmCargas();
  const norma = useCcmNorma();
  const marca = useCcmMarca();
  const setNorma = useCcmStore((s) => s.setNorma);
  const setMarca = useCcmStore((s) => s.setMarca);
  const factorDerrateo = useFactorDerrateo('BT');
  const factorDerrateoMt = useFactorDerrateo('MT');
  const reservaCcm = useReservaCcm();
  const reservaPorcentaje = reservaCcm.activo ? Math.max(0, reservaCcm.porcentaje) : 0;
  // Detección automática del nivel de tensión del CCM.
  const tieneMt = cargas.some((c) => c.tensionV > UMBRAL_MT_V);
  const tieneBt = cargas.some((c) => c.tensionV > 0 && c.tensionV <= UMBRAL_MT_V);
  const esMt = tieneMt && !tieneBt;
  const mixto = tieneMt && tieneBt;
  const tableros = useCcmStore((s) => s.tableros);
  const activoId = useCcmStore((s) => s.activoId);
  const setActivo = useCcmStore((s) => s.setActivo);
  const crearTablero = useCcmStore((s) => s.crearTablero);
  const renombrarTablero = useCcmStore((s) => s.renombrarTablero);
  const duplicarTablero = useCcmStore((s) => s.duplicarTablero);
  const eliminarTablero = useCcmStore((s) => s.eliminarTablero);
  const desglosarTablero = useCcmStore((s) => s.desglosarTablero);
  const svgRefIec = useRef<SVGSVGElement | null>(null);
  const svgRefNema = useRef<SVGSVGElement | null>(null);
  const [importAbierto, setImportAbierto] = useState(false);

  const resultadoIec = useMemo(
    () => (norma === 'IEC' && !esMt ? dimensionarCcm(cargas, factorDerrateo, marca, reservaPorcentaje) : null),
    [cargas, norma, esMt, factorDerrateo, marca, reservaPorcentaje],
  );
  const resultadoNema = useMemo(
    () => (norma === 'NEMA' && !esMt ? dimensionarCcmNema(cargas, factorDerrateo, reservaPorcentaje) : null),
    [cargas, norma, factorDerrateo, esMt, reservaPorcentaje],
  );
  const resultadoMt = useMemo(
    () => (esMt ? dimensionarCcmMt(cargas, factorDerrateoMt, reservaPorcentaje) : null),
    [cargas, esMt, factorDerrateoMt, reservaPorcentaje],
  );

  const handleDesglosar = () => {
    if (!resultadoNema?.overflowBarra || !activoId) return;
    const { idsOverflow } = resultadoNema.overflowBarra;
    const nombreBase = tableros.find((t) => t.id === activoId)?.nombre ?? 'CCM';
    const nombresExistentes = new Set(tableros.map((t) => t.nombre));
    let sufijo = 2;
    let nombreNuevo = `${nombreBase} — ${sufijo}`;
    while (nombresExistentes.has(nombreNuevo)) {
      sufijo += 1;
      nombreNuevo = `${nombreBase} — ${sufijo}`;
    }
    desglosarTablero(activoId, idsOverflow, nombreNuevo);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">CCM — Centro de control de motores</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {esMt
              ? 'CCM MT · Allen-Bradley CENTERLINE 2500 · Contactores al vacío 200/400/720 A · Celdas 36" × 90".'
              : norma === 'NEMA'
                ? 'Convención NEMA · Contactores 1–9 · MCP · Frames ANSI · X = 6". Tabla del Excel del proyecto.'
                : `Convención IEC · ${marca === 'ABB' ? 'ABB Tmax' : 'Schneider Compact NSX'} + TeSys · Gavetas Blokset.`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DerrateoControl nivel={esMt ? 'MT' : 'BT'} />
          <ReservaCcmControl />
          {esMt ? (
            <span
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              title="Catálogo de media tensión: Allen-Bradley CENTERLINE 2500"
            >
              MT · CENTERLINE 2500
            </span>
          ) : (
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
          )}
          {!esMt && norma === 'IEC' && (
            <label className="inline-flex items-center gap-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Marca</span>
              <select
                value={marca === 'Chint' ? 'Schneider' : marca}
                onChange={(e) => setMarca(e.target.value as typeof marca)}
                className="border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 bg-white dark:bg-slate-900 text-sm"
                aria-label="Marca de los interruptores de alimentador"
              >
                {MARCAS_FEEDER.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          )}
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

      {mixto && (
        <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm text-amber-900 dark:text-amber-100">
          <strong>No se permite mezclar BT y MT en el mismo CCM.</strong> Los CCM se diseñan
          para un único nivel de tensión. Separa las cargas BT y MT en dos tableros distintos
          (usa el selector de tableros arriba).
        </div>
      )}

      {(() => {
        const cargasCi = cargasContraincendio(cargas);
        if (cargasCi.length === 0) return null;
        return (
          <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm text-amber-900 dark:text-amber-100">
            <strong>⚠ Bomba contraincendio en CCM de servicios generales.</strong>{' '}
            {cargasCi.map((c) => c.descripcion || c.id).join(', ')} — según NFPA 20, las
            bombas del sistema contraincendio deben alimentarse por un circuito dedicado e
            independiente, tomado aguas arriba de la protección general del servicio normal,
            de modo que una falla o desconexión de este CCM no las deje sin alimentación.
            Verifica la topología del proyecto antes de mantenerla aquí.
          </div>
        );
      })()}

      {esMt && resultadoMt && resultadoMt.tablero && (
        <>
          <section>
            <AsignacionesPanelMt
              asignaciones={resultadoMt.asignaciones}
              cargasSinAsignar={resultadoMt.cargasSinAsignar}
            />
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Vista frontal (MT · CENTERLINE 2500)</h2>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 overflow-x-auto bg-white">
              <VistaFrontalCcmMtSvg tablero={resultadoMt.tablero} />
            </div>
          </section>
          <section><ResumenCcmMt resultado={resultadoMt} /></section>
        </>
      )}

      {esMt && resultadoMt && !resultadoMt.tablero && resultadoMt.motivo && (
        <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm text-amber-900 dark:text-amber-100">
          {resultadoMt.motivo}
        </div>
      )}

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

      {norma === 'NEMA' && resultadoNema && !resultadoNema.tablero && (
        resultadoNema.overflowBarra && resultadoNema.overflowBarra.idsOverflow.length > 0
          && resultadoNema.overflowBarra.idsOverflow.length < resultadoNema.asignaciones.length
          ? (
            <div className="border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-red-500 text-lg leading-none mt-0.5" aria-hidden>⚠</span>
                <div>
                  <p className="font-semibold text-red-900 dark:text-red-200">
                    Corriente total supera la barra principal máxima disponible
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">
                    FLC total:{' '}
                    <strong>{resultadoNema.overflowBarra.corrienteTotalA.toFixed(0)} A</strong>
                    {' — '}
                    Barra máxima:{' '}
                    <strong>{resultadoNema.overflowBarra.maxFlcA} A</strong>
                  </p>
                </div>
              </div>
              <div className="pl-8 text-sm text-red-800 dark:text-red-200 space-y-1">
                <p className="font-medium">
                  {resultadoNema.overflowBarra.idsOverflow.length} carga(s) que se moverán al nuevo CCM:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-red-700 dark:text-red-300">
                  {cargas
                    .filter((c) => resultadoNema.overflowBarra!.idsOverflow.includes(c.id))
                    .map((c) => (
                      <li key={c.id}>{c.descripcion || '(sin descripción)'}</li>
                    ))}
                </ul>
              </div>
              <div className="pl-8">
                <button
                  onClick={handleDesglosar}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded text-sm font-medium transition-colors"
                >
                  Crear nuevo CCM con las cargas sobrantes
                </button>
              </div>
            </div>
          )
          : resultadoNema.motivo
            ? (
              <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm text-amber-900 dark:text-amber-100">
                {resultadoNema.motivo}
              </div>
            )
            : null
      )}

      <ImportarCargasModal abierto={importAbierto} onCerrar={() => setImportAbierto(false)} />
    </div>
  );
}
