import { useId, useMemo, useState } from 'react';
import {
  cargaPisoSala, EQUIPOS_REFERENCIA, pesoEspecificoKgM2,
  SOBRECARGA_PISO_DISENO_KGM2, type TipoEquipoSala,
} from '../logic/carga-piso';
import {
  DISPOSICION_LABEL, dimensionarSala, dimensionesTipicas, holguraFrontalPorDefecto,
  type CriteriosSala, type Disposicion, type EquipoEnSala,
} from '../logic/sala';
import { fmtCantidad, fmtNumero } from '../util/format';
import { parsearNumero } from '../util/numero';
import { TablaDesplazable } from './TablaDesplazable';

const controlBase =
  'px-2 py-1 rounded border border-slate-300 dark:border-slate-700 '
  + 'bg-white dark:bg-slate-900 text-sm tabular-nums';
const controlCls = `w-full ${controlBase}`;
/** Cantidades: caben 3 dígitos y no deben estirarse. */
const contadorCls = `w-full text-right ${controlBase}`;
const etiquetaCls = 'text-sm text-slate-600 dark:text-slate-400';
const REJILLA = 'grid grid-cols-[minmax(0,1fr)_6rem_2.5rem] items-center gap-x-2 gap-y-2';

/** Tipos que apoyan en piso, en el orden en que se leen en un layout. */
const TIPOS: readonly { tipo: TipoEquipoSala; label: string; enMuro?: boolean }[] = [
  { tipo: 'switchgear', label: 'Switchgear MT' },
  { tipo: 'vdfMt', label: 'Variador MT' },
  { tipo: 'cdc', label: 'CDC' },
  { tipo: 'ccm', label: 'CCM' },
  { tipo: 'vdfBt', label: 'Variador BT' },
  { tipo: 'trafoSeco', label: 'Transformador seco' },
  { tipo: 'ups', label: 'UPS' },
  { tipo: 'cargador', label: 'Cargador de baterías' },
  { tipo: 'baterias', label: 'Banco de baterías' },
  { tipo: 'tablero', label: 'Tableros de distribución' },
  { tipo: 'gabinete', label: 'Gabinetes de control' },
  { tipo: 'presurizador', label: 'Presurizador' },
  { tipo: 'hvac', label: 'HVAC tipo mochila', enMuro: true },
];

/** Cuántos hay de cada tipo en la sala de referencia. */
function conteoReferencia(tipo: TipoEquipoSala): number {
  return EQUIPOS_REFERENCIA.filter((e) => e.tipo === tipo && e.anchoMm != null).length;
}

function Campo({ label, valor, onChange, unidad, paso = 1 }: {
  label: string; valor: number; onChange: (n: number) => void; unidad?: string; paso?: number;
}) {
  const id = useId();
  const [borrador, setBorrador] = useState<string | null>(null);
  return (
    <>
      <label htmlFor={id} className={etiquetaCls}>{label}</label>
      <input
        id={id} type="number" step={paso} value={borrador ?? valor}
        onChange={(e) => {
          const n = parsearNumero(e.target.value);
          if (n === undefined) setBorrador(e.target.value);
          else { setBorrador(null); onChange(n); }
        }}
        onBlur={() => setBorrador(null)}
        className={controlCls}
      />
      <span className="text-xs text-slate-500 dark:text-slate-400">{unidad}</span>
    </>
  );
}

/**
 * Estima largo y ancho de la sala a partir de los equipos que van dentro.
 *
 * Lo que decide el resultado son las holguras, no la huella: en la sala de
 * referencia los equipos ocupan el 42 % y el resto es espacio de trabajo y
 * circulación. Por eso están a la vista y son editables.
 */
export function DimensionSalaPanel() {
  const [cantidades, setCantidades] = useState<Record<string, number>>(
    () => Object.fromEntries(TIPOS.map((t) => [t.tipo, conteoReferencia(t.tipo)])),
  );
  const [disposicion, setDisposicion] = useState<Disposicion>('dosFilasEnfrentadas');
  const [holguraFrontal, setHolguraFrontal] = useState(holguraFrontalPorDefecto('dosFilasEnfrentadas'));
  const [holguraPosterior, setHolguraPosterior] = useState(0);
  const [holguraLateral, setHolguraLateral] = useState(600);
  const idDisposicion = useId();
  const idEquipos = useId();

  const cambiarDisposicion = (d: Disposicion) => {
    setDisposicion(d);
    // La holgura por defecto cambia con la condición de trabajo; si el usuario
    // ya la ajustó a mano no se pisa.
    if (holguraFrontal === holguraFrontalPorDefecto(disposicion)) {
      setHolguraFrontal(holguraFrontalPorDefecto(d));
    }
  };

  const resultado = useMemo(() => {
    const equipos: EquipoEnSala[] = TIPOS.flatMap((t) => {
      const dim = dimensionesTipicas(t.tipo);
      const n = cantidades[t.tipo] ?? 0;
      if (!dim || n <= 0) return [];
      return [{
        nombre: t.label, anchoMm: dim.anchoMm, profundidadMm: dim.profundidadMm,
        cantidad: n, ...(t.enMuro ? { enMuro: true } : {}),
      }];
    });
    const criterios: CriteriosSala = {
      disposicion,
      holguraFrontalMm: holguraFrontal,
      holguraPosteriorMm: holguraPosterior,
      holguraLateralMm: holguraLateral,
    };
    return dimensionarSala(equipos, criterios);
  }, [cantidades, disposicion, holguraFrontal, holguraPosterior, holguraLateral]);

  const piso = useMemo(() => {
    if (!resultado) return undefined;
    const pesos = TIPOS.flatMap((t) => {
      const dim = dimensionesTipicas(t.tipo);
      const esp = pesoEspecificoKgM2(t.tipo);
      const n = cantidades[t.tipo] ?? 0;
      if (!dim || esp == null || n <= 0) return [];
      return Array.from({ length: n }, () => esp * (dim.anchoMm / 1000) * (dim.profundidadMm / 1000));
    });
    return cargaPisoSala(pesos, resultado.superficieM2);
  }, [resultado, cantidades]);

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        <section className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 lg:col-span-2">
          <h3 className="font-semibold text-sm">Equipos en la sala</h3>
          <div className="grid sm:grid-cols-2 gap-x-8">
            {TIPOS.map((t) => {
              const dim = dimensionesTipicas(t.tipo);
              const id = `${idEquipos}-${t.tipo}`;
              return (
                <div
                  key={t.tipo}
                  className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-x-3 py-1"
                >
                  <label htmlFor={id} className="min-w-0">
                    <span className={`block truncate ${etiquetaCls}`}>{t.label}</span>
                    {dim && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {fmtNumero(dim.anchoMm)} × {fmtNumero(dim.profundidadMm)} mm
                        {t.enMuro ? ' · en muro' : ''}
                      </span>
                    )}
                  </label>
                  <input
                    id={id}
                    type="number" min="0" step="1"
                    value={cantidades[t.tipo] ?? 0}
                    onChange={(e) => {
                      const n = parsearNumero(e.target.value);
                      if (n !== undefined) setCantidades((p) => ({ ...p, [t.tipo]: Math.max(0, Math.round(n)) }));
                    }}
                    className={contadorCls}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <section className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-sm">Disposición y holguras</h3>
          <label htmlFor={idDisposicion} className={`block ${etiquetaCls}`}>Disposición en planta</label>
          <select
            id={idDisposicion}
            value={disposicion}
            onChange={(e) => cambiarDisposicion(e.target.value as Disposicion)}
            className={controlCls}
          >
            {(Object.keys(DISPOSICION_LABEL) as Disposicion[]).map((d) => (
              <option key={d} value={d}>{DISPOSICION_LABEL[d]}</option>
            ))}
          </select>
          <div className={REJILLA}>
            <Campo label="Holgura frontal" valor={holguraFrontal} onChange={setHolguraFrontal} unidad="mm" paso={50} />
            <Campo label="Holgura posterior" valor={holguraPosterior} onChange={setHolguraPosterior} unidad="mm" paso={50} />
            <Campo label="Holgura lateral" valor={holguraLateral} onChange={setHolguraLateral} unidad="mm" paso={50} />
          </div>
          {resultado && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Condición {resultado.condicionNec} del NEC 110.26.
              {resultado.condicionNec === 3
                ? ' Partes vivas a ambos lados del pasillo: pide 1.200 mm.'
                : ' Partes vivas de un lado y superficie a tierra del otro: 1.000 mm.'}
            </p>
          )}
        </section>
      </div>

      {!resultado ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Agrega al menos un equipo que apoye en piso. Los de muro no definen la planta.
        </p>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Dimensiones estimadas</div>
              <div className="text-3xl font-semibold tabular-nums">
                {fmtCantidad(resultado.largoM, 2)} × {fmtCantidad(resultado.anchoM, 2)}
                <span className="text-base font-normal text-slate-500 dark:text-slate-400"> m</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {fmtCantidad(resultado.superficieM2, 1)} m² de planta
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Ocupación de los equipos</div>
              <div className="text-3xl font-semibold tabular-nums">
                {fmtCantidad(resultado.ocupacionPct, 0)}
                <span className="text-base font-normal text-slate-500 dark:text-slate-400"> %</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {fmtCantidad(resultado.huellaM2, 1)} m² de huella; el resto es trabajo y circulación
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Carga de piso</div>
              <div className="text-3xl font-semibold tabular-nums">
                {piso ? fmtCantidad(piso.promedioKgM2, 0) : '—'}
                <span className="text-base font-normal text-slate-500 dark:text-slate-400"> kgf/m²</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {piso ? `${fmtCantidad(piso.usoDisenoPct, 0)} % de los ${fmtNumero(SOBRECARGA_PISO_DISENO_KGM2)} kg/m² de diseño` : ''}
              </div>
            </div>
          </div>

          <TablaDesplazable etiqueta="Filas de la sala estimada">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-left">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th]:text-slate-600 dark:[&>th]:text-slate-400">
                  <th>Fila</th>
                  <th className="text-right">Frente</th>
                  <th className="text-right">Profundidad</th>
                  <th>Equipos</th>
                </tr>
              </thead>
              <tbody>
                {resultado.filas.map((f, i) => (
                  <tr key={i} className="border-t border-slate-200 dark:border-slate-800 tabular-nums [&>td]:px-3 [&>td]:py-2">
                    <td>{resultado.filas.length === 1 ? 'Única' : `Fila ${i + 1}`}</td>
                    <td className="text-right">{fmtCantidad(f.frenteMm / 1000, 2)} m</td>
                    <td className="text-right">{fmtNumero(f.profundidadMm)} mm</td>
                    <td className="text-xs text-slate-600 dark:text-slate-400">
                      {[...new Set(f.equipos)].join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaDesplazable>

          {resultado.frenteEnMuroMm > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hay {fmtCantidad(resultado.frenteEnMuroMm / 1000, 2)} m de frente montado en muro exterior
              que no consume planta. En la sala de referencia son los 9 equipos HVAC.
            </p>
          )}
        </>
      )}
    </div>
  );
}
