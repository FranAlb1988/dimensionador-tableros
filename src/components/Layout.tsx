import { NavLink, Outlet } from 'react-router-dom';
import { MenuProyecto } from './MenuProyecto';
import { TemaToggle } from './TemaToggle';

const linkBase =
  'px-3 py-2 rounded-md text-sm font-medium transition-colors';
const linkInactive =
  'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800';
const linkActive =
  'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900';

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
          <NavLink to="/" className="font-semibold text-slate-900 dark:text-slate-100">
            Dimensionador de tableros
          </NavLink>
          <nav className="flex gap-1">
            <NavLink to="/ccm" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
              CCM
            </NavLink>
            <NavLink to="/cdc" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
              CDC
            </NavLink>
            <NavLink to="/tdg" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
              TDG
            </NavLink>
            <NavLink to="/mt" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
              MT
            </NavLink>
            <NavLink to="/auxiliares" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
              Auxiliares
            </NavLink>
            <NavLink to="/sala" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
              Sala
            </NavLink>
            <NavLink to="/calculos" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
              Cálculos
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
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
