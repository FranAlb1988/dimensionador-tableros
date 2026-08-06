import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aplicarTema, esOscuro, TEMAS, useTema } from './tema';

/** jsdom no implementa matchMedia; se simula la preferencia del sistema. */
function sistemaPrefiere(oscuro: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta.includes('dark') ? oscuro : !oscuro,
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.className = '';
  document.documentElement.style.colorScheme = '';
});

describe('catálogo de temas', () => {
  it('ofrece claro, oscuro y sistema', () => {
    expect(TEMAS.map((t) => t.valor)).toEqual(['claro', 'oscuro', 'sistema']);
  });
});

describe('esOscuro', () => {
  it('claro y oscuro no consultan al sistema', () => {
    sistemaPrefiere(true);
    expect(esOscuro('claro')).toBe(false);
    sistemaPrefiere(false);
    expect(esOscuro('oscuro')).toBe(true);
  });

  it('sistema sigue la preferencia del sistema operativo', () => {
    sistemaPrefiere(true);
    expect(esOscuro('sistema')).toBe(true);
    sistemaPrefiere(false);
    expect(esOscuro('sistema')).toBe(false);
  });

  it('sin matchMedia asume claro en vez de reventar', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(esOscuro('sistema')).toBe(false);
  });
});

describe('aplicarTema', () => {
  it('pone y saca la clase que activa las variantes dark:', () => {
    // Es la pieza que faltaba: el CSS declara
    // `@variant dark (&:where(.dark, .dark *))` y nadie ponía nunca esa clase,
    // así que el modo oscuro no se activaba de ninguna forma.
    aplicarTema('oscuro');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    aplicarTema('claro');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('fija un color-scheme concreto, nunca el par light dark', () => {
    // Con `light dark` el navegador pinta los controles nativos según el
    // sistema y no según el tema elegido: al forzar uno quedaban al revés que
    // la página.
    aplicarTema('oscuro');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    aplicarTema('claro');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('el tema forzado gana sobre la preferencia del sistema', () => {
    sistemaPrefiere(false);
    aplicarTema('oscuro');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    sistemaPrefiere(true);
    aplicarTema('claro');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

describe('store', () => {
  it('setTema guarda y aplica en el mismo paso', () => {
    useTema.getState().setTema('oscuro');
    expect(useTema.getState().tema).toBe('oscuro');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    useTema.getState().setTema('claro');
    expect(useTema.getState().tema).toBe('claro');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
