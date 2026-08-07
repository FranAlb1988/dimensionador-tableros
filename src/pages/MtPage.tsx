import { useMemo, useRef } from 'react';
import { TablaSalidasMt } from '../components/TablaSalidasMt';
import { VistaFrontalMtSvg } from '../components/VistaFrontalMtSvg';
import { HojaPlano } from '../components/HojaPlano';
import { ResumenMt } from '../components/ResumenMt';
import { ExportarPdfMtBoton } from '../components/ExportarPdfMtBoton';
import { TableroSelector } from '../components/TableroSelector';
import {
  useMtClaseTension,
  useMtIcc,
  useMtSalidas,
  useMtStore,
} from '../store/mt';
import { dimensionarMt } from '../logic/mt';
import { DerrateoControl } from '../components/DerrateoControl';
import { useFactorDerrateo } from '../store/proyecto-meta';

export function MtPage() {
  const salidas = useMtSalidas();
  const kv = useMtClaseTension();
  const icc = useMtIcc();
  const tableros = useMtStore((s) => s.tableros);
  const activoId = useMtStore((s) => s.activoId);
  const setActivo = useMtStore((s) => s.setActivo);
  const crearTablero = useMtStore((s) => s.crearTablero);
  const renombrarTablero = useMtStore((s) => s.renombrarTablero);
  const duplicarTablero = useMtStore((s) => s.duplicarTablero);
  const eliminarTablero = useMtStore((s) => s.eliminarTablero);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const factorDerrateo = useFactorDerrateo('MT');
  const resultado = useMemo(
    () => dimensionarMt(salidas, kv, icc, factorDerrateo),
    [salidas, kv, icc, factorDerrateo],
  );

  const tablerosLite = tableros.map((t) => ({ id: t.id, nombre: t.nombre }));

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">MT — Switchgear de media tensión</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Celdas metal-clad (entrada / salida / acople / medida) por clase de tensión y
            corriente. Datos de referencia — ajustar con catálogo y especificación técnica del proyecto.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DerrateoControl nivel="MT" />
          {resultado.tablero && (
            <ExportarPdfMtBoton svgRef={svgRef} resultado={resultado} />
          )}
        </div>
      </header>

      <TableroSelector
        etiqueta="MT"
        tableros={tablerosLite}
        activoId={activoId}
        setActivo={setActivo}
        opcionesCrear={[
          { etiqueta: '+ Switchgear', sugerencia: `Switchgear ${tableros.length + 1}`, onCrear: (n) => crearTablero(n) },
        ]}
        onRenombrar={renombrarTablero}
        onDuplicar={(id) => { duplicarTablero(id); }}
        onEliminar={eliminarTablero}
      />

      <section>
        <TablaSalidasMt />
      </section>

      {resultado.tablero && (
        <>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Vista frontal</h2>
            <HojaPlano>
              <VistaFrontalMtSvg ref={svgRef} tablero={resultado.tablero} />
            </HojaPlano>
          </section>
          <section><ResumenMt resultado={resultado} /></section>
        </>
      )}

      {/* Con la tabla vacía no hay fallo que avisar: la tabla ya dice qué hacer. */}
      {salidas.length > 0 && !resultado.tablero && resultado.motivo && (
        <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded p-3 text-sm text-amber-900 dark:text-amber-100">
          {resultado.motivo}
        </div>
      )}
    </div>
  );
}
