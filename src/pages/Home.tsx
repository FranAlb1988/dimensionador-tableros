import { Link } from 'react-router-dom';
import { PanelMetadatosProyecto } from '../components/PanelMetadatosProyecto';

const cards = [
  {
    to: '/ccm',
    titulo: 'CCM',
    sub: 'Centro de control de motores',
    desc: 'Blokset con gavetas extraíbles. NSX + TeSys. Disponible en este MVP.',
    activo: true,
  },
  {
    to: '/cdc',
    titulo: 'CDC',
    sub: 'Centro de Distribución de Cargas',
    desc: 'Tablero principal BT de la sala eléctrica — Prisma con NSX/Masterpact y barras Cu. Alimenta CCMs y subcuadros.',
    activo: true,
  },
  {
    to: '/tdg',
    titulo: 'TDG',
    sub: 'Tablero General de servicios',
    desc: 'Aguas abajo del CDC — Pragma con módulos DIN e iC60 para alumbrado, tomas y cargas menores.',
    activo: true,
  },
  {
    to: '/mt',
    titulo: 'MT',
    sub: 'Switchgear de media tensión',
    desc: 'Celdas metal-clad (entrada / salida / acople / medida) por clase de tensión y corriente.',
    activo: true,
  },
  {
    to: '/auxiliares',
    titulo: 'Auxiliares',
    sub: 'Inventario de equipos de la sala eléctrica',
    desc: 'Instrumentación, UPS, banco de baterías y cargador de baterías. Documentación, no se dimensiona.',
    activo: true,
  },
] as const;

export function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dimensionador de tableros eléctricos</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Catálogo Schneider — calcula gavetas, columnas y dimensiones para CCM, CDC y TDG.
        </p>
      </div>
      <PanelMetadatosProyecto />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className={`block border rounded-lg p-4 transition-colors ${
              c.activo
                ? 'border-slate-300 hover:border-slate-900 dark:border-slate-700 dark:hover:border-slate-300'
                : 'border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed pointer-events-none'
            }`}
          >
            <div className="text-xl font-semibold">{c.titulo}</div>
            <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-0.5">
              {c.sub}
            </div>
            <p className="text-sm mt-2 text-slate-700 dark:text-slate-300">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
