import { useMemo, useRef, useState } from 'react';
import { TablaCargas } from '../components/TablaCargas';
import { EstudioCargasPanel } from '../components/EstudioCargasPanel';
import { CargaPisoPanel } from '../components/CargaPisoPanel';
import { ImportarCargasModal } from '../components/ImportarCargasModal';
import { AsignacionesPanel } from '../components/AsignacionesPanel';
import { VistaFrontalSvg } from '../components/VistaFrontalSvg';
import { HojaPlano } from '../components/HojaPlano';
import { Resumen } from '../components/Resumen';
import { ExportarPdfBoton } from '../components/ExportarPdfBoton';
import { AsignacionesPanelNema } from '../components/AsignacionesPanelNema';
import { VistaFrontalCcmNemaSvg } from '../components/VistaFrontalCcmNemaSvg';
import { ResumenCcmNema } from '../components/ResumenCcmNema';
import { ExportarPdfCcmNemaBoton } from '../components/ExportarPdfCcmNemaBoton';
import { AsignacionesPanelMt } from '../components/AsignacionesPanelMt';
import { VistaFrontalCcmMtSvg } from '../components/VistaFrontalCcmMtSvg';
import { ResumenCcmMt } from '../components/ResumenCcmMt';
import { useCcmCargas, useCcmIccBarra, useCcmInterruptorGeneral, useCcmMarca, useCcmNorma, useCcmStore } from '../store/ccm';
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
  const iccBarraKa = useCcmIccBarra();
  const interruptorGeneral = useCcmInterruptorGeneral();
  const setInterruptorGeneral = useCcmStore((s) => s.setInterruptorGeneral);
  const setNorma = useCcmStore((s) => s.setNorma);
  const setMarca = useCcmStore((s) => s.setMarca);
  const setIccBarra = useCcmStore((s) => s.setIccBarra);
  const factorDerrateo = useFactorDerrateo('BT');
  const factorDerrateoMt = useFactorDerrateo('MT');
  const reservaCcm = useReservaCcm();
  const reservaPorcentaje = reservaCcm.activo ? Math.max(0, reservaCcm.porcentaje) : 0;
  // Detección automática del nivel de tensión del CCM.
  // Tensión del punto de suma: la más frecuente entre las cargas del tablero.
  const tensionBarraV = useMemo(() => {
    const cuenta = new Map<number, number>();
    for (const c of cargas) {
      if (c.tensionV > 0) cuenta.set(c.tensionV, (cuenta.get(c.tensionV) ?? 0) + 1);
    }
    let mejor = 400;
    let max = 0;
    for (const [v, n] of cuenta) if (n > max) { mejor = v; max = n; }
    return mejor;
  }, [cargas]);

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
    () => (norma === 'IEC' && !esMt
      ? dimensionarCcm(cargas, factorDerrateo, marca, reservaPorcentaje, iccBarraKa, interruptorGeneral)
      : null),
    [cargas, norma, esMt, factorDerrateo, marca, reservaPorcentaje, iccBarraKa, interruptorGeneral],
  );
  const resultadoNema = useMemo(
    () => (norma === 'NEMA' && !esMt
      ? dimensionarCcmNema(cargas, factorDerrateo, reservaPorcentaje, iccBarraKa, interruptorGeneral)
      : null),
    [cargas, norma, factorDerrateo, esMt, reservaPorcentaje, iccBarraKa, interruptorGeneral],
  );
  const resultadoMt = useMemo(
    () => (esMt ? dimensionarCcmMt(cargas, factorDerrateoMt, reservaPorcentaje) : null),
    [cargas, esMt, factorDerrateoMt, reservaPorcentaje],
  );

  /**
   * Hay overflow de barra y se puede resolver moviendo parte de las cargas a
   * otro CCM. Si sobran TODAS, desglosar no arregla nada y corresponde
   * explicar en vez de ofrecer un botón que deja el tablero igual.
   */
  const puedeDesglosarNema =
    resultadoNema?.overflowBarra != null
    && resultadoNema.overflowBarra.idsOverflow.length > 0
    && resultadoNema.overflowBarra.idsOverflow.length < resultadoNema.asignaciones.length;

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
          {!esMt && (
            <label
              className="inline-flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-sm"
              title="Icc trifásica de la barra (estudio de cortocircuito o trafo/CDC aguas arriba). Define la prestación F/N/H del aparellaje (IEC 61439-2 / RIC N°02). Vacío: sin verificación."
            >
              <span className="font-medium">Icc barra</span>
              <input
                type="number"
                min={0}
                step={1}
                value={iccBarraKa > 0 ? iccBarraKa : ''}
                onChange={(e) => setIccBarra(e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder="—"
                aria-label="Icc de barra en kA"
                className="w-16 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
              />
              <span className="text-slate-500 dark:text-slate-400">kA</span>
            </label>
          )}
          {!esMt && (
            <label
              className="inline-flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-sm font-medium cursor-pointer select-none"
              title="Incluye un interruptor general (main breaker) en el incoming — medio de seccionamiento propio del tablero (RIC N°02). Desactivado: main lugs, protección aguas arriba en el CDC."
            >
              <input
                type="checkbox"
                checked={interruptorGeneral}
                onChange={(e) => setInterruptorGeneral(e.target.checked)}
                className="accent-slate-900 dark:accent-slate-100"
              />
              Int. general
            </label>
          )}
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

      <section>
        <EstudioCargasPanel cargas={cargas} tensionBarraV={tensionBarraV} />
      </section>

      {mixto && (
        <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm text-amber-900 dark:text-amber-100">
          <strong>No se permite mezclar BT y MT en el mismo CCM.</strong> Los CCM se diseñan
          para un único nivel de tensión. Separa las cargas BT y MT en dos tableros distintos
          (usa el selector de tableros arriba).
        </div>
      )}

      {(() => {
        const advertencias = norma === 'IEC'
          ? resultadoIec?.advertenciasIcu
          : resultadoNema?.advertenciasIcu;
        if (!advertencias || advertencias.length === 0) return null;
        return (
          <div className="border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 rounded p-3 text-sm">
            <div className="font-medium text-red-800 dark:text-red-200">
              ⚠ Poder de corte insuficiente (Icc de barra declarada)
            </div>
            <ul className="mt-1 list-disc list-inside text-red-900 dark:text-red-100">
              {advertencias.map((a) => <li key={a}>{a}</li>)}
            </ul>
            <p className="mt-1 text-xs text-red-700 dark:text-red-300">
              La prestación mayor disponible no cubre la Icc: especificar filiación/limitación
              certificada con la protección aguas arriba (IEC 61439-2 · RIC N°02).
            </p>
          </div>
        );
      })()}

      {(() => {
        const avisos = norma === 'NEMA'
          ? resultadoNema?.advertenciasBarraVertical
          : resultadoIec?.advertenciasBarraVertical;
        if (!avisos || avisos.length === 0) return null;
        return (
          <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm">
            <div className="font-medium text-amber-800 dark:text-amber-200">
              ⚠ Barra vertical de columna
            </div>
            <ul className="mt-1 list-disc list-inside text-amber-900 dark:text-amber-100">
              {avisos.map((a) => <li key={a}>{a}</li>)}
            </ul>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {norma === 'NEMA'
                ? 'La barra vertical de CENTERLINE 2100 se declara por capacidad efectiva '
                  + 'repartida en mitades — 600 A efectivos son 300 A arriba y 300 A abajo — '
                  + 'y cada unidad plug-in se conecta por stabs de 225 A.'
                : 'BlokSeT publica el arreglo de barras de la columna Mw2 con su resistencia '
                  + 'al cortocircuito y la separación de soportes que exige, no su corriente '
                  + 'de régimen: lo que se verifica es la Icw contra la Icc de barra.'}
            </p>
          </div>
        );
      })()}

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
            <HojaPlano>
              <VistaFrontalCcmMtSvg tablero={resultadoMt.tablero} />
            </HojaPlano>
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
            <HojaPlano>
              <VistaFrontalSvg ref={svgRefIec} tablero={resultadoIec.tablero} />
            </HojaPlano>
          </section>
          <section><Resumen resultado={resultadoIec} /></section>
          {resultadoIec.tablero && (
            <section>
              <CargaPisoPanel
                tipo="ccm"
                anchoTotalMm={resultadoIec.tablero.anchoTotalMm}
                profundidadTotalMm={resultadoIec.tablero.profundidadTotalMm}
              />
            </section>
          )}
        </>
      )}

      {/*
        Cuando el dimensionamiento no llega a un tablero (p. ej. la barra
        requerida se sale del catálogo), hay que decir por qué. Antes la página
        simplemente no mostraba nada y parecía que la app no calculaba.

        Un solo bloque para los dos desenlaces posibles. Antes eran dos
        condiciones separadas que podían cumplirse a la vez, y el mismo motivo
        aparecía repetido en dos cajas.

        Con la tabla vacía no se muestra nada: no haber agregado cargas todavía
        no es un fallo de dimensionamiento, y la tabla ya dice qué hacer. La
        página recibía al usuario con dos avisos de error antes de que tocara
        nada.
      */}
      {norma === 'NEMA' && resultadoNema && !resultadoNema.tablero && cargas.length > 0 && (
        puedeDesglosarNema ? (
          <div className="border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-red-500 text-lg leading-none mt-0.5" aria-hidden>⚠</span>
              <div>
                <p className="font-semibold text-red-900 dark:text-red-200">
                  Corriente total supera la barra principal máxima disponible
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">
                  FLC total:{' '}
                  <strong>{resultadoNema.overflowBarra!.corrienteTotalA.toFixed(0)} A</strong>
                  {' — '}
                  Barra máxima:{' '}
                  <strong>{resultadoNema.overflowBarra!.maxFlcA} A</strong>
                </p>
              </div>
            </div>
            <div className="pl-8 text-sm text-red-800 dark:text-red-200 space-y-1">
              <p className="font-medium">
                {resultadoNema.overflowBarra!.idsOverflow.length} carga(s) que se moverán al nuevo CCM:
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
        ) : (
          <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm text-amber-900 dark:text-amber-100">
            <p className="font-medium">No se pudo dimensionar el CCM.</p>
            {resultadoNema.motivo && <p>{resultadoNema.motivo}</p>}
            <p className="mt-1 text-amber-800 dark:text-amber-200">
              Pruebe con menos reserva, reparta las cargas en más de un CCM o use la convención IEC.
            </p>
          </div>
        )
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
            <HojaPlano>
              <VistaFrontalCcmNemaSvg ref={svgRefNema} tablero={resultadoNema.tablero} />
            </HojaPlano>
          </section>
          <section><ResumenCcmNema resultado={resultadoNema} /></section>
        </>
      )}

      <ImportarCargasModal abierto={importAbierto} onCerrar={() => setImportAbierto(false)} />
    </div>
  );
}
