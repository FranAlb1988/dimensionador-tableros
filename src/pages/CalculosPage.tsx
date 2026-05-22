import { useState } from 'react';
import { CalculadoraPanel } from '../components/CalculadoraPanel';
import { CALCULADORAS, GRUPOS_CALCULADORAS, GRUPO_LABEL, calculadoraPorId } from '../logic/calculos';

export function CalculosPage() {
  const [activaId, setActivaId] = useState<string>(CALCULADORAS[0]!.id);
  const activa = calculadoraPorId(activaId) ?? CALCULADORAS[0]!;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Cálculos eléctricos</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Calculadoras de ingeniería eléctrica, de la Ley de Ohm a la malla de puesta a tierra.
          Cada cálculo muestra su fórmula y norma, y se exporta como memoria de cálculo en PDF.
        </p>
      </header>

      <div className="grid lg:grid-cols-[250px_1fr] gap-6">
        <nav className="space-y-4">
          {GRUPOS_CALCULADORAS.map(({ grupo, calculadoras }) => (
            <div key={grupo}>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 px-1">
                {GRUPO_LABEL[grupo]}
              </div>
              <ul className="space-y-0.5">
                {calculadoras.map((c) => {
                  const activo = c.id === activaId;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => setActivaId(c.id)}
                        className={
                          'w-full text-left px-2.5 py-1.5 rounded text-sm transition-colors ' +
                          (activo
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800')
                        }
                      >
                        {c.nombre}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div>
          <CalculadoraPanel key={activa.id} calculadora={activa} />
        </div>
      </div>
    </div>
  );
}
