import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Tema visual de la app.
 *
 * Toda la interfaz venía escrita con variantes `dark:` de Tailwind, pero el
 * proyecto declara `@variant dark (&:where(.dark, .dark *))` y nadie ponía
 * nunca esa clase: el modo oscuro no se activaba de ninguna forma. Este store
 * es lo que faltaba.
 *
 * `sistema` sigue la preferencia del sistema operativo y reacciona si cambia
 * en caliente; `claro` y `oscuro` la fuerzan.
 */
export type Tema = 'sistema' | 'claro' | 'oscuro';

export const TEMAS: readonly { valor: Tema; etiqueta: string; icono: string }[] = [
  { valor: 'claro', etiqueta: 'Claro', icono: '☀' },
  { valor: 'oscuro', etiqueta: 'Oscuro', icono: '☾' },
  { valor: 'sistema', etiqueta: 'Sistema', icono: '◐' },
];

/** Clave de localStorage. La usa también el script anti-parpadeo de index.html. */
export const CLAVE_TEMA = 'dimensionador-tema';

function consultaOscuro(): MediaQueryList | undefined {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
  return window.matchMedia('(prefers-color-scheme: dark)');
}

/** Resuelve si un tema se ve oscuro, consultando al sistema cuando corresponde. */
export function esOscuro(tema: Tema): boolean {
  if (tema === 'claro') return false;
  if (tema === 'oscuro') return true;
  return consultaOscuro()?.matches ?? false;
}

/**
 * Aplica el tema al documento.
 *
 * `color-scheme` se fija en un valor concreto y no en el par `light dark` que
 * tenía el CSS: con el par, el navegador pinta los controles nativos y las
 * barras de scroll según la preferencia del SISTEMA, así que al forzar un tema
 * quedaban al revés que la página — controles oscuros sobre fondo blanco.
 */
export function aplicarTema(tema: Tema): void {
  if (typeof document === 'undefined') return;
  const oscuro = esOscuro(tema);
  const raiz = document.documentElement;
  raiz.classList.toggle('dark', oscuro);
  raiz.style.colorScheme = oscuro ? 'dark' : 'light';
}

interface EstadoTema {
  tema: Tema;
  setTema: (t: Tema) => void;
}

export const useTema = create<EstadoTema>()(
  persist(
    (set) => ({
      tema: 'sistema',
      setTema: (tema) => {
        aplicarTema(tema);
        set({ tema });
      },
    }),
    {
      name: CLAVE_TEMA,
      onRehydrateStorage: () => (estado) => aplicarTema(estado?.tema ?? 'sistema'),
    },
  ),
);

// Al cargar el módulo, por si el script de index.html no corrió (tests, SSR).
aplicarTema(useTema.getState().tema);

// Mientras el tema sea `sistema`, seguir los cambios del sistema en caliente.
consultaOscuro()?.addEventListener('change', () => {
  if (useTema.getState().tema === 'sistema') aplicarTema('sistema');
});
