import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { MenuProyecto } from './MenuProyecto';
import { TemaToggle } from './TemaToggle';

const linkBase =
  'px-3 py-2 rounded-md text-sm font-medium transition-colors shrink-0';
const linkInactive =
  'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800';
const linkActive =
  'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900';

const SECCIONES = [
  { to: '/ccm', label: 'CCM' },
  { to: '/cdc', label: 'CDC' },
  { to: '/tdg', label: 'TDG' },
  { to: '/mt', label: 'MT' },
  { to: '/auxiliares', label: 'Auxiliares' },
  { to: '/sala', label: 'Sala' },
  { to: '/calculos', label: 'Cálculos' },
] as const;

/**
 * La barra superior no cabe en un teléfono: solo el `nav` mide 437 px contra
 * 375 de pantalla, y la página terminaba desplazándose en horizontal completa.
 *
 * En vez de esconder la navegación tras un menú, se parte en dos filas bajo
 * `lg`: marca y acciones arriba, secciones abajo en una tira que se desplaza
 * sola. Son siete destinos en una app de escritorio a la que a veces se entra
 * desde el teléfono; dejarlos a la vista cuesta una fila y evita un menú que
 * habría que abrir en cada salto.
 *
 * El corte va en `lg` y no en `md` porque entre 768 y 1024 px las tres piezas
 * suman más de lo que hay: la fila se partía igual, pero dejando las acciones
 * solas abajo en vez de la navegación.
 */
export function Layout() {
  const navRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // Con la tira desplazable, la sección activa puede quedar fuera de vista y
  // entonces no se ve dónde está uno parado. Se la trae al centro en cada
  // cambio de ruta; sin animación, que aquí sería ruido.
  useEffect(() => {
    const activo = navRef.current?.querySelector('[aria-current="page"]');
    activo?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-2 lg:py-3 flex flex-wrap items-center gap-x-4 lg:gap-x-6 gap-y-1">
          <NavLink
            to="/"
            className="order-1 font-semibold text-slate-900 dark:text-slate-100 truncate"
          >
            <span className="sm:hidden">Dimensionador</span>
            <span className="hidden sm:inline">Dimensionador de tableros</span>
          </NavLink>

          {/* Fila propia y desplazable bajo md; en línea desde md. */}
          <nav
            ref={navRef}
            className="order-3 lg:order-2 w-full lg:w-auto flex gap-1
                       overflow-x-auto lg:overflow-visible
                       -mx-4 px-4 lg:mx-0 lg:px-0 pb-1 lg:pb-0"
          >
            {SECCIONES.map((s) => (
              <NavLink
                key={s.to}
                to={s.to}
                className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
              >
                {s.label}
              </NavLink>
            ))}
          </nav>

          <div className="order-2 lg:order-3 ml-auto flex items-center gap-2 lg:gap-3 shrink-0">
            <span className="hidden xl:inline text-xs text-slate-500 dark:text-slate-400">
              Schneider Electric — placeholders verificables
            </span>
            <TemaToggle />
            <MenuProyecto />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 px-4 py-3 text-xs text-slate-500 dark:text-slate-400 text-center">
        Dimensionador de tableros — CCM · CDC · TDG · MT · Auxiliares · Sala · Cálculos.
      </footer>
    </div>
  );
}
