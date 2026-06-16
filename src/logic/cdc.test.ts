import { describe, expect, it } from 'vitest';
import { dimensionarCdc, OPCIONES_CDC_DEFAULT } from './cdc';
import type { Carga } from '../types';

function ilum(id: string, kW: number, fases: '1F' | '3F' = '1F'): Carga {
  return {
    id, descripcion: `Ilum-${id}`, tipo: 'iluminacion',
    potenciaKw: kW, unidadPotencia: 'kW',
    tensionV: fases === '1F' ? 230 : 400, fases, factorServicio: 1,
  };
}

/** Opciones sin diferencial — para tests que no quieren el RCD obligatorio. */
const OPC_SIN_DIF = { ...OPCIONES_CDC_DEFAULT, diferencialPorCircuito: false };

describe('dimensionarCdc', () => {
  it('dimensiona 5 circuitos en un solo cofre Pragma 18×1', () => {
    const r = dimensionarCdc(
      [ilum('1', 1.5), ilum('2', 1.5), ilum('3', 1.5), ilum('4', 1.5), ilum('5', 2)],
      { ...OPC_SIN_DIF, modulosPorFila: 18, reservaPorFila: 0 },
    );
    expect(r.tablero).toBeDefined();
    const t = r.tablero!;
    expect(t.cofres).toHaveLength(1);
    expect(t.totalAsignaciones).toBe(5);
    expect(t.cofres[0]!.filas).toHaveLength(1);
    expect(t.cofres[0]!.catalogo.modulosPorFila).toBe(18);
  });

  it('un circuito 3F ocupa 3 módulos (sin diferencial)', () => {
    const r = dimensionarCdc([ilum('1', 5, '3F')], OPC_SIN_DIF);
    const fila = r.tablero!.cofres[0]!.filas[0]!;
    expect(fila.modulos[0]!.modulosDin).toBe(3);
    expect(fila.modulosLibres).toBe(18 - 3);
  });

  it('20 circuitos 1F llenan 2 filas (1 cofre 18×2)', () => {
    const cargas = Array.from({ length: 20 }, (_, i) => ilum(String(i + 1), 1.5));
    const r = dimensionarCdc(cargas, { ...OPC_SIN_DIF, modulosPorFila: 18, reservaPorFila: 0 });
    expect(r.tablero!.cofres).toHaveLength(1);
    expect(r.tablero!.cofres[0]!.filas).toHaveLength(2);
  });

  it('reserva por fila reduce la capacidad efectiva', () => {
    // 18 módulos/fila − 2 reserva = 16 útiles. 17 circuitos → 2 filas.
    const cargas = Array.from({ length: 17 }, (_, i) => ilum(String(i + 1), 1.5));
    const r = dimensionarCdc(cargas, { ...OPC_SIN_DIF, modulosPorFila: 18, reservaPorFila: 2 });
    expect(r.tablero!.cofres[0]!.filas).toHaveLength(2);
    expect(r.tablero!.cofres[0]!.filas[0]!.reserva).toBe(2);
  });

  it('reserva excesiva (≥ módulos por fila) devuelve motivo de error', () => {
    const r = dimensionarCdc([ilum('1', 1.5)], { ...OPC_SIN_DIF, modulosPorFila: 12, reservaPorFila: 12 });
    expect(r.tablero).toBeUndefined();
    expect(r.motivo).toBeTruthy();
  });

  it('carga sin potencia ni corriente queda sin asignar', () => {
    const c: Carga = {
      id: 'x', descripcion: 'x', tipo: 'iluminacion',
      tensionV: 230, fases: '1F', factorServicio: 1,
    };
    const r = dimensionarCdc([c], OPCIONES_CDC_DEFAULT);
    expect(r.cargasSinAsignar).toHaveLength(1);
  });

  it('utiliza varios cofres cuando una sola sección no alcanza', () => {
    // Pragma 18 max 5 filas. 18×5 = 90 módulos útiles. 100 circuitos 1F → necesita 2 cofres.
    const cargas = Array.from({ length: 100 }, (_, i) => ilum(String(i + 1), 1.5));
    const r = dimensionarCdc(cargas, { ...OPC_SIN_DIF, modulosPorFila: 18, reservaPorFila: 0 });
    expect(r.tablero!.cofres.length).toBeGreaterThanOrEqual(2);
  });

  it('diferencial por circuito (RIC): cada circuito lleva su RCD único', () => {
    const cargas = Array.from({ length: 3 }, (_, i) => ilum(String(i + 1), 1.5));
    const r = dimensionarCdc(cargas, OPCIONES_CDC_DEFAULT);
    // Cada AsignacionCdc tiene su propio diferencial.
    expect(r.asignaciones).toHaveLength(3);
    expect(r.asignaciones.every((a) => a.diferencial != null)).toBe(true);
    expect(r.asignaciones[0]!.diferencial!.sensibilidadMa).toBe(30);
    expect(r.asignaciones[0]!.diferencial!.tipo).toBe('AC');
  });

  it('el bloque Vigi suma 2 módulos a cada circuito (1F → 3 mód., 3F → 5 mód.)', () => {
    const r = dimensionarCdc([ilum('1', 1.5, '1F'), ilum('2', 5, '3F')], OPCIONES_CDC_DEFAULT);
    const por1F = r.asignaciones.find((a) => a.proteccion.polos === 1)!;
    const por3F = r.asignaciones.find((a) => a.proteccion.polos === 3)!;
    expect(por1F.modulosDin).toBe(3); // 1 breaker + 2 Vigi
    expect(por3F.modulosDin).toBe(5); // 3 breaker + 2 Vigi
    expect(por1F.diferencial!.modulosExtra).toBe(2);
  });

  it('sin diferencial, el circuito ocupa solo los módulos del breaker', () => {
    const r = dimensionarCdc([ilum('1', 1.5, '1F'), ilum('2', 5, '3F')], OPC_SIN_DIF);
    const por1F = r.asignaciones.find((a) => a.proteccion.polos === 1)!;
    const por3F = r.asignaciones.find((a) => a.proteccion.polos === 3)!;
    expect(por1F.modulosDin).toBe(1);
    expect(por3F.modulosDin).toBe(3);
    expect(por1F.diferencial).toBeUndefined();
  });
});
