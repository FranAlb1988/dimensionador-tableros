import { describe, expect, it } from 'vitest';
import {
  ajusteMagneticoSugerido,
  arquitecturasMcp,
  capacidadMcpKa,
  cubreCorriente,
  esAjustable,
  familiasMcp,
  MCP_DISPONIBLES,
  notaMcp,
  sugerirMcp,
  toleranciaMagnetica,
} from './mcp';

describe('catálogo MCP', () => {
  it('trae las 203 referencias y sus 9 familias', () => {
    expect(MCP_DISPONIBLES.length).toBe(203);
    const f = familiasMcp();
    expect(f).toContain('TeSys Deca GV2L');
    expect(f).toContain('TeSys Deca GV4LE');
    expect(f).toContain('PowerPacT H/J Electronic MCP');
    expect(f.length).toBe(9);
  });

  it('ninguna referencia trae sobrecarga integrada', () => {
    // Es la definición de MCP: solo cortocircuito, relé térmico aparte.
    for (const m of MCP_DISPONIBLES) {
      expect(m.unidadDisparo, m.referencia).not.toMatch(/térmic|TM-D/i);
    }
  });

  it('la herencia grupo→modelo reconstruye una referencia conocida', () => {
    const m = MCP_DISPONIBLES.find((x) => x.referencia === 'GV2L22')!;
    expect(m.familia).toBe('TeSys Deca GV2L');
    expect(m.bastidor).toBe('Frame 2');
    expect(m.inA).toBe(25);
    expect(m.iSeleccionMaxA).toBe(25);
    // Heredados del grupo:
    expect(m.anchoMm).toBe(45);
    expect(m.polos).toBe(3);
    expect(m.tecnologia).toBe('Magnética');
  });

  it('separa el alcance IEC del UL/NEMA', () => {
    const iec = MCP_DISPONIBLES.filter((m) => m.alcance === 'IEC');
    const ul = MCP_DISPONIBLES.filter((m) => m.alcance === 'UL');
    expect(iec.length).toBe(172);
    expect(ul.length).toBe(31);
    // Las UL declaran SCCR, no Icu.
    expect(ul.every((m) => m.sccr480Ka != null)).toBe(true);
  });

  it('trae las arquitecturas de protección y las notas', () => {
    expect(arquitecturasMcp().length).toBeGreaterThanOrEqual(2);
    const m = MCP_DISPONIBLES.find((x) => x.releRecomendado != null)!;
    expect(notaMcp(m.releRecomendado)).toBeTruthy();
  });
});

describe('cubreCorriente', () => {
  it('usa la ventana de selección, más estricta que el calibre', () => {
    const m = MCP_DISPONIBLES.find((x) => x.referencia === 'GV2L22')!;
    expect(cubreCorriente(m, 25)).toBe(true);
    expect(cubreCorriente(m, 25.5)).toBe(false);
  });
});

describe('sugerirMcp', () => {
  it('prefiere el equipo más angosto entre los que sirven', () => {
    // A 20 A sirven un GV2L (45 mm) y un NSX MA (105 mm): gana el compacto.
    const m = sugerirMcp(20)!;
    expect(m.anchoMm).toBe(45);
    expect(m.familia).toMatch(/GV2L/);
  });

  it('escala de bastidor con la corriente', () => {
    expect(sugerirMcp(8)!.anchoMm).toBe(45);
    expect(sugerirMcp(45)!.anchoMm).toBe(55);
    expect(sugerirMcp(100)!.anchoMm).toBe(81);
    expect(sugerirMcp(200)!.anchoMm).toBeGreaterThanOrEqual(105);
  });

  it('respeta la Icc pedida a la tensión de servicio', () => {
    const m = sugerirMcp(20, { iccKa: 100, tensionV: 400 })!;
    expect(capacidadMcpKa(m, 400)!).toBeGreaterThanOrEqual(100);
  });

  it('el alcance UL devuelve referencias norteamericanas con SCCR', () => {
    const m = sugerirMcp(100, { alcance: 'UL' })!;
    expect(m.alcance).toBe('UL');
    expect(m.sccr480Ka).toBeGreaterThan(0);
  });

  it('no mezcla alcances: por defecto solo IEC', () => {
    expect(sugerirMcp(100)!.alcance).toBe('IEC');
  });

  it('puede excluir las variantes con terminales para barras', () => {
    const m = sugerirMcp(60, { soloReferenciaCompleta: true })!;
    expect(m.variante).toBe('Referencia completa');
  });

  it('devuelve undefined fuera de catálogo', () => {
    expect(sugerirMcp(900)).toBeUndefined();
    expect(sugerirMcp(20, { iccKa: 500 })).toBeUndefined();
    expect(sugerirMcp(0)).toBeUndefined();
  });
});

describe('ajusteMagneticoSugerido', () => {
  it('apunta a 8 × In del motor dentro del rango de la referencia', () => {
    const m = MCP_DISPONIBLES.find((x) => x.referencia === 'GV2L22')!;
    const a = ajusteMagneticoSugerido(m, 20)!;
    expect(a).toBeGreaterThanOrEqual(m.ajusteScMinA!);
    expect(a).toBeLessThanOrEqual(m.ajusteScMaxA!);
  });

  it('recorta al rango cuando 8 × In se sale por abajo o por arriba', () => {
    const m = MCP_DISPONIBLES.find((x) => x.referencia === 'GV2L22')!;
    expect(ajusteMagneticoSugerido(m, 0.1)).toBe(m.ajusteScMinA);
    expect(ajusteMagneticoSugerido(m, 9999)).toBe(m.ajusteScMaxA);
  });

  it('una unidad de umbral fijo devuelve ese único valor', () => {
    const fijo = MCP_DISPONIBLES.find((x) => x.ajusteScMinA === x.ajusteScMaxA)!;
    expect(esAjustable(fijo)).toBe(false);
    expect(ajusteMagneticoSugerido(fijo, 50)).toBe(fijo.ajusteScMinA);
  });

  it('distingue las gamas ajustables de las de umbral fijo', () => {
    const gv2l = MCP_DISPONIBLES.find((x) => x.referencia === 'GV2L08')!;
    const gv4l = MCP_DISPONIBLES.find((x) => x.referencia === 'GV4L115B')!;
    expect(esAjustable(gv2l)).toBe(false);
    expect(esAjustable(gv4l)).toBe(true);
  });

  it('rescata la tolerancia declarada del umbral fijo', () => {
    // Un umbral fijo con ±20 % tiene una banda real de disparo que el estudio
    // de coordinación necesita; sin esto solo se vería el valor nominal.
    const gv2l = MCP_DISPONIBLES.find((x) => x.referencia === 'GV2L08')!;
    expect(toleranciaMagnetica(gv2l)).toBe('±20 %');
  });
});
