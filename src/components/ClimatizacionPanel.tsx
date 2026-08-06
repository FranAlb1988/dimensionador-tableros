import { useMemo, useState } from 'react';
import {
  capacidadEfectiva,
  cargaPresurizacionKcalH,
  dimensionarClimatizacion,
  factorAltura,
  FACTOR_CRECIMIENTO,
  HVAC,
  modeloHvac,
  SALA_CLIMA_REFERENCIA as R,
  type CondicionEstacion,
  type Envolvente,
} from '../logic/climatizacion';
import { fmtCantidad, fmtNumero } from '../util/format';

const inputCls =
  'w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 ' +
  'bg-white dark:bg-slate-900 text-sm tabular-nums';

interface CampoProps {
  label: string;
  valor: number;
  onChange: (n: number) => void;
  unidad?: string;
  paso?: number;
}

function Campo({ label, valor, onChange, unidad, paso = 1 }: CampoProps) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span className="flex items-center gap-1.5 shrink-0">
        <input
          type="number"
          step={paso}
          value={valor}
          onChange={(e) => onChange(Number(e.target.value))}
          className={inputCls}
        />
        {unidad && <span className="text-xs text-slate-500 dark:text-slate-400 w-10">{unidad}</span>}
      </span>
    </label>
  );
}

/**
 * Carga térmica de la sala y cantidad de equipos de climatización.
 * Metodología de la memoria DOC-0014 del proyecto Rajo Inca (ASHRAE).
 */
export function ClimatizacionPanel() {
  const [largoM, setLargoM] = useState(R.profundidadM);
  const [anchoM, setAnchoM] = useState(R.frenteM);
  const [altoM, setAltoM] = useState(R.altoM);
  const [altitud, setAltitud] = useState(R.altitudMsnm);
  const [extVerano, setExtVerano] = useState(R.extVeranoC);
  const [extInvierno, setExtInvierno] = useState(R.extInviernoMaxC);
  const [intPromedio, setIntPromedio] = useState(R.intPromedioC);
  const [equiposW, setEquiposW] = useState(R.disipacionEquiposW);
  const [cablesW, setCablesW] = useState(R.cablesW);
  const [personas, setPersonas] = useState(R.personas);
  const [modeloNombre, setModeloNombre] = useState(R.modeloHvac);
  const [crecimiento, setCrecimiento] = useState(FACTOR_CRECIMIENTO);

  const modelo = modeloHvac(modeloNombre) ?? HVAC.modelos[HVAC.modelos.length - 1]!;

  const resultado = useMemo(() => {
    const areaPiso = largoM * anchoM;
    const areaMuros = 2 * (largoM + anchoM) * altoM;
    const envolvente: Envolvente = {
      areaMurosM2: areaMuros,
      areaTechoM2: areaPiso,
      areaPisoM2: areaPiso,
      uMuroTechoKcalHM2C: R.uMuroTechoKcalHM2C,
      uPisoKcalHM2C: R.uPisoKcalHM2C,
    };
    const presurizacionKcalH = cargaPresurizacionKcalH(
      R.caudalPresurizacionM3H, R.densidadAireKgM3, R.cpAireKcalKgC, R.presurizacionDeltaTC,
    );
    const base = {
      equiposW, cablesW, personas,
      iluminacionKcalH: areaPiso * (R.iluminacionKcalH / R.areaPisoM2),
      presurizacionKcalH,
    };
    const estaciones: CondicionEstacion[] = [
      { nombre: 'Invierno', extC: extInvierno, intC: intPromedio, internos: { ...base, radiacionKcalH: 0 } },
      {
        nombre: 'Verano',
        extC: extVerano,
        intC: intPromedio,
        internos: { ...base, radiacionKcalH: areaPiso * (R.radiacionVeranoKcalH / R.areaPisoM2) },
      },
    ];
    return dimensionarClimatizacion(modelo, envolvente, estaciones, altitud, crecimiento);
  }, [largoM, anchoM, altoM, altitud, extVerano, extInvierno, intPromedio,
      equiposW, cablesW, personas, modelo, crecimiento]);

  const nominal = capacidadEfectiva(modelo, extVerano, altitud);

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        <section className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">Recinto</h3>
          <Campo label="Largo" valor={largoM} onChange={setLargoM} unidad="m" paso={0.01} />
          <Campo label="Ancho" valor={anchoM} onChange={setAnchoM} unidad="m" paso={0.01} />
          <Campo label="Alto" valor={altoM} onChange={setAltoM} unidad="m" paso={0.01} />
          <Campo label="Personas" valor={personas} onChange={setPersonas} />
        </section>

        <section className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">Sitio</h3>
          <Campo label="Altitud" valor={altitud} onChange={setAltitud} unidad="msnm" paso={50} />
          <Campo label="Ext. verano" valor={extVerano} onChange={setExtVerano} unidad="°C" paso={0.1} />
          <Campo label="Ext. invierno máx." valor={extInvierno} onChange={setExtInvierno} unidad="°C" paso={0.1} />
          <Campo label="Interior promedio" valor={intPromedio} onChange={setIntPromedio} unidad="°C" paso={0.1} />
          <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
            Factor por altura: <strong className="tabular-nums">{fmtCantidad(factorAltura(altitud), 3)}</strong>
            {' — '}el equipo rinde eso de lo que dice el catálogo.
          </p>
        </section>

        <section className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">Carga interna y equipo</h3>
          <Campo label="Disipación equipos" valor={equiposW} onChange={setEquiposW} unidad="W" paso={100} />
          <Campo label="Cables" valor={cablesW} onChange={setCablesW} unidad="W" paso={100} />
          <Campo label="F. crecimiento" valor={crecimiento} onChange={setCrecimiento} paso={0.01} />
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-600 dark:text-slate-400">Modelo HVAC</span>
            <select
              value={modelo.modelo}
              onChange={(e) => setModeloNombre(e.target.value)}
              className={inputCls}
            >
              {HVAC.modelos.map((m) => (
                <option key={m.modelo} value={m.modelo}>
                  {m.modelo} · {fmtCantidad(m.toneladas, 1)} t
                </option>
              ))}
            </select>
          </label>
        </section>
      </div>

      {resultado && (
        <>
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900 text-left">
                  <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th]:text-slate-600 dark:[&>th]:text-slate-400">
                    <th>Condición</th>
                    <th className="text-right">Ext.</th>
                    <th className="text-right">Ganancia</th>
                    <th className="text-right">Sensible de tabla</th>
                    <th className="text-right">Capacidad efectiva</th>
                    <th className="text-right">Unidades</th>
                    <th className="text-right">Instalar</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.estaciones.map((e) => {
                    const critica = e.nombre === resultado.critica.nombre;
                    return (
                      <tr
                        key={e.nombre}
                        className={
                          'border-t border-slate-200 dark:border-slate-800 tabular-nums ' +
                          '[&>td]:px-3 [&>td]:py-2 ' +
                          (critica ? 'bg-amber-50 dark:bg-amber-950/30 font-medium' : '')
                        }
                      >
                        <td>
                          {e.nombre}
                          {critica && <span className="ml-2 text-xs text-amber-700 dark:text-amber-500">manda</span>}
                        </td>
                        <td className="text-right">{fmtCantidad(e.extC, 1)} °C</td>
                        <td className="text-right">{fmtNumero(Math.round(e.ganancia.totalKw))} kW</td>
                        <td className="text-right">{fmtNumero(Math.round(e.capacidad.sensibleTablaBtuH))}</td>
                        <td className="text-right">{fmtNumero(Math.round(e.capacidad.efectivaBtuH))}</td>
                        <td className="text-right">{fmtCantidad(e.unidadesExactas, 2)}</td>
                        <td className="text-right">{e.unidades}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Equipos a instalar</div>
              <div className="text-3xl font-semibold tabular-nums">{resultado.unidades}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {modelo.modelo} · manda {resultado.critica.nombre.toLowerCase()}
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Capacidad útil por equipo</div>
              <div className="text-3xl font-semibold tabular-nums">
                {fmtCantidad(nominal.efectivaKw, 1)} <span className="text-lg font-normal">kW</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {fmtCantidad(nominal.fraccionDeNominal * 100, 0)} % de los{' '}
                {fmtNumero(modelo.nominalBtuH)} BTU/hr de placa
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Carga térmica ({resultado.critica.nombre.toLowerCase()})</div>
              <div className="text-3xl font-semibold tabular-nums">
                {fmtNumero(Math.round(resultado.critica.ganancia.totalKw))} <span className="text-lg font-normal">kW</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {fmtNumero(Math.round(resultado.critica.ganancia.totalBtuH))} BTU/hr
              </div>
            </div>
          </div>

          {resultado.fueraDeTabla && (
            <p className="text-sm rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300">
              La temperatura de diseño queda fuera del rango publicado por el catálogo
              (75 a 125 °F). La capacidad mostrada satura en el extremo de la tabla y no
              está respaldada: hay que pedir la curva al fabricante.
            </p>
          )}

          <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-2">
              Desglose de la ganancia — {resultado.critica.nombre.toLowerCase()}
            </h3>
            <table className="w-full text-sm max-w-lg">
              <tbody>
                {resultado.critica.ganancia.aportes.map((a) => {
                  const pct = (a.kcalH / resultado.critica.ganancia.totalKcalH) * 100;
                  return (
                    <tr key={a.concepto} className="border-t border-slate-100 dark:border-slate-800/60">
                      <td className="py-1 text-slate-600 dark:text-slate-400">{a.concepto}</td>
                      <td className="py-1 text-right tabular-nums">{fmtNumero(Math.round(a.kcalH))} kcal/hr</td>
                      <td className="py-1 text-right tabular-nums text-slate-500 dark:text-slate-400 w-16">
                        {fmtCantidad(pct, 1)} %
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
