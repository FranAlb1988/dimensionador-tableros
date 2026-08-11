import { ClimatizacionPanel } from '../components/ClimatizacionPanel';
import { DimensionSalaPanel } from '../components/DimensionSalaPanel';
import { HVAC, SALA_CLIMA_REFERENCIA as R } from '../logic/climatizacion';
import { fmtNumero } from '../util/format';

export function SalaPage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">Sala eléctrica</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Tamaño del recinto a partir de los equipos, y carga térmica según la
          metodología ASHRAE de la memoria de una sala real ({R.tag}).
        </p>
      </header>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Tamaño de la sala</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Lo que decide el tamaño no es la huella de los equipos sino las holguras.
            En la sala de referencia los tableros ocupan 69,5 m² de los 166,7 m² del
            recinto: el 58 % es espacio de trabajo y circulación.
          </p>
        </div>
        <DimensionSalaPanel />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Las holguras por defecto son las del NEC Art. 110.26(A)(1) para 151 a 600 V.
          Ese artículo es del Capítulo 1, que no está entre las tablas cargadas: van como
          valores editables, no como tabla consultada. Si el proyecto se rige por otra
          edición o por una especificación propia, se cambian arriba.
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Climatización</h2>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 text-sm space-y-2 mt-2">
            <p>
              <strong>La capacidad de placa no es la utilizable.</strong> Se parte de la
              capacidad <em>sensible</em> a la temperatura exterior de diseño — no de la total
              nominal —, se aplica el factor del proveedor ({HVAC.factorProveedor}) y recién
              ahí el derrateo por altura.
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              En la sala de referencia esa cadena lleva un equipo de{' '}
              {fmtNumero(150000)} BTU/hr nominales a {fmtNumero(98939)} utilizables: 34 % menos.
              Dimensionar con la placa dejaría la sala con la mitad del frío que necesita.
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              Se evalúan las dos estaciones y manda la peor. No es obvio cuál gana: en verano
              el recinto pide más, pero el equipo también rinde menos.
            </p>
          </div>
        </div>

        <ClimatizacionPanel />

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Catálogo {HVAC.serie}, etapa {HVAC.etapa}, aire de retorno {HVAC.retornoDbWbF} °F DB/WB.
          Coeficientes de envolvente, aporte de iluminación, radiación y presurización tomados
          de la sala de referencia y escalados por superficie; para un proyecto nuevo hay que
          recalcularlos con su propia envolvente.
        </p>
      </section>
    </div>
  );
}
