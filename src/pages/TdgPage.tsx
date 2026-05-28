import { useMemo, useRef } from 'react';
import { TablaSalidas } from '../components/TablaSalidas';
import { PanelPrincipalBarra } from '../components/PanelPrincipalBarra';
import { VistaFrontalTdgSvg } from '../components/VistaFrontalTdgSvg';
import { ResumenTdg } from '../components/ResumenTdg';
import { ExportarPdfTdgBoton } from '../components/ExportarPdfTdgBoton';
import { PanelPrincipalBarraNema } from '../components/PanelPrincipalBarraNema';
import { VistaFrontalTdgNemaSvg } from '../components/VistaFrontalTdgNemaSvg';
import { ResumenTdgNema } from '../components/ResumenTdgNema';
import { ExportarPdfTdgNemaBoton } from '../components/ExportarPdfTdgNemaBoton';
import { SUBTIPOS_TDG_LABEL, useTdgFactorSimultaneidad, useTdgMarca, useTdgNorma, useTdgSalidas, useTdgStore, useTdgSubtipo } from '../store/tdg';
import { dimensionarTdg } from '../logic/tdg';
import { dimensionarTdgNema } from '../logic/tdg-nema';
import { MARCAS_PRINCIPAL } from '../logic/principal';
import type { Norma } from '../types';
import { TableroSelector } from '../components/TableroSelector';

const NORMAS: readonly Norma[] = ['NEMA', 'IEC'];

export function TdgPage() {
  const salidas = useTdgSalidas();
  const fs = useTdgFactorSimultaneidad();
  const norma = useTdgNorma();
  const marca = useTdgMarca();
  const subtipo = useTdgSubtipo();
  const setNorma = useTdgStore((s) => s.setNorma);
  const setMarca = useTdgStore((s) => s.setMarca);
  const tableros = useTdgStore((s) => s.tableros);
  const activoId = useTdgStore((s) => s.activoId);
  const setActivo = useTdgStore((s) => s.setActivo);
  const crearTablero = useTdgStore((s) => s.crearTablero);
  const renombrarTablero = useTdgStore((s) => s.renombrarTablero);
  const duplicarTablero = useTdgStore((s) => s.duplicarTablero);
  const eliminarTablero = useTdgStore((s) => s.eliminarTablero);
  const svgRefIec = useRef<SVGSVGElement | null>(null);
  const svgRefNema = useRef<SVGSVGElement | null>(null);

  // Nota: este archivo se llama TdgPage por historia, pero se monta en la ruta /cdc
  // (centro de distribución de cargas — tablero principal BT de la sala eléctrica).
  const titulo = subtipo === 'fuerza'
    ? 'CDC — Centro de Distribución de Cargas (fuerza)'
    : 'CDC — Centro de Distribución de Cargas';

  const tablerosLite = tableros.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    ...(t.subtipo !== 'general' ? { badge: SUBTIPOS_TDG_LABEL[t.subtipo], badgeColor: 'sky' as const } : {}),
  }));

  const resultadoIec = useMemo(
    () => (norma === 'IEC' ? dimensionarTdg(salidas, fs, marca) : null),
    [salidas, fs, norma, marca],
  );
  const resultadoNema = useMemo(
    () => (norma === 'NEMA' ? dimensionarTdgNema(salidas, fs) : null),
    [salidas, fs, norma],
  );

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{titulo}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Nodo principal de distribución en baja tensión de la sala eléctrica: recibe del
            transformador y deriva hacia los CCMs y subcuadros.{' '}
            {norma === 'NEMA'
              ? 'Convención NEMA · Switchgear BT · Frames ANSI 800/2000/3200/4000/5000/6000AF.'
              : 'Convención IEC · NSX/Masterpact y barras Cu por corriente total.'}
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
          {norma === 'IEC' && (
            <label className="inline-flex items-center gap-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">Marca principal</span>
              <select
                value={marca}
                onChange={(e) => setMarca(e.target.value as typeof marca)}
                className="border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 bg-white dark:bg-slate-900 text-sm"
                aria-label="Marca del interruptor principal"
              >
                {MARCAS_PRINCIPAL.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          )}
          {norma === 'IEC' && resultadoIec && (
            <ExportarPdfTdgBoton svgRef={svgRefIec} resultado={resultadoIec} subtipo={subtipo} />
          )}
          {norma === 'NEMA' && resultadoNema && (
            <ExportarPdfTdgNemaBoton svgRef={svgRefNema} resultado={resultadoNema} subtipo={subtipo} />
          )}
        </div>
      </header>

      <TableroSelector
        etiqueta="CDC"
        tableros={tablerosLite}
        activoId={activoId}
        setActivo={setActivo}
        opcionesCrear={[
          { etiqueta: '+ CDC', sugerencia: `CDC ${tableros.length + 1}`, onCrear: (n) => crearTablero(n, 'general') },
          { etiqueta: '+ Fuerza', sugerencia: `Fuerza ${tableros.length + 1}`, onCrear: (n) => crearTablero(n, 'fuerza') },
        ]}
        onRenombrar={renombrarTablero}
        onDuplicar={(id) => { duplicarTablero(id); }}
        onEliminar={eliminarTablero}
      />

      <section>
        <TablaSalidas />
      </section>

      {norma === 'IEC' && resultadoIec?.tablero && (
        <>
          <section><PanelPrincipalBarra tablero={resultadoIec.tablero} /></section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Vista frontal (IEC / Prisma)</h2>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 overflow-x-auto bg-white">
              <VistaFrontalTdgSvg ref={svgRefIec} tablero={resultadoIec.tablero} />
            </div>
          </section>
          <section><ResumenTdg resultado={resultadoIec} /></section>
        </>
      )}

      {norma === 'NEMA' && resultadoNema?.tablero && (
        <>
          <section><PanelPrincipalBarraNema tablero={resultadoNema.tablero} /></section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Vista frontal (NEMA · ANSI)</h2>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 overflow-x-auto bg-white">
              <VistaFrontalTdgNemaSvg ref={svgRefNema} tablero={resultadoNema.tablero} />
            </div>
          </section>
          <section><ResumenTdgNema resultado={resultadoNema} /></section>
        </>
      )}

      {((norma === 'IEC' && resultadoIec && !resultadoIec.tablero && resultadoIec.motivo) ||
        (norma === 'NEMA' && resultadoNema && !resultadoNema.tablero && resultadoNema.motivo)) && (
        <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm text-amber-900 dark:text-amber-100">
          {(norma === 'IEC' ? resultadoIec?.motivo : resultadoNema?.motivo) ?? ''}
        </div>
      )}

      {((norma === 'IEC' && resultadoIec && resultadoIec.cargasSinAsignar.length > 0) ||
        (norma === 'NEMA' && resultadoNema && resultadoNema.cargasSinAsignar.length > 0)) && (
        <section>
          <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm">
            <div className="font-medium text-amber-800 dark:text-amber-200">Salidas sin asignar</div>
            <ul className="mt-1 list-disc list-inside text-amber-900 dark:text-amber-100">
              {(norma === 'IEC' ? resultadoIec?.cargasSinAsignar : resultadoNema?.cargasSinAsignar)?.map((c) => (
                <li key={c.id}>{c.descripcion || c.id} — verifica potencia/corriente.</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
