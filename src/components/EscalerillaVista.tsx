import type { EntradasCalc, ResultadoCalc } from '../logic/calculos';
import { leerFilas, num } from '../logic/calculos';
import {
  anchoDeCapa, distribuirEnCapas, maxCapasEnEscalerilla, type ModoTendido,
  PROFUNDIDAD_ESCALERILLA_MM, SEPARACION_MONOPOLAR_DIAMETROS,
} from '../logic/calculos/canalizaciones-catalogo';
import { fmtCantidad } from '../util/format';

interface Props {
  entradas: EntradasCalc;
  resultado: ResultadoCalc;
}

/** Colores por grupo (calibre). */
const COLORES = [
  { fill: '#fbbf24', stroke: '#92400e' }, // ámbar
  { fill: '#4ade80', stroke: '#166534' }, // verde
  { fill: '#60a5fa', stroke: '#1e40af' }, // azul
  { fill: '#f87171', stroke: '#991b1b' }, // rojo
  { fill: '#a78bfa', stroke: '#5b21b6' }, // violeta
  { fill: '#fb923c', stroke: '#9a3412' }, // naranja
  { fill: '#22d3ee', stroke: '#155e75' }, // cyan
  { fill: '#facc15', stroke: '#854d0e' }, // dorado
  { fill: '#34d399', stroke: '#065f46' }, // esmeralda
  { fill: '#818cf8', stroke: '#3730a3' }, // índigo
];

interface Conductor {
  dia: number;
  fill: string;
  stroke: string;
  grupo: number;
}

/**
 * Corte transversal de la escalerilla. Distribuye los conductores en las
 * capas indicadas con el mismo bin-packing que la calculadora, y los dibuja
 * apilados con su diámetro real, coloreados por grupo.
 */
export function EscalerillaVista({ entradas, resultado }: Props) {
  const filas = leerFilas(entradas, 'grupos', ['conductor', 'diametro', 'cantidad']);
  const conductores: Conductor[] = [];
  for (let gi = 0; gi < filas.length; gi += 1) {
    const f = filas[gi]!;
    const d = Number((f.diametro ?? '').replace(',', '.'));
    const n = Math.round(Number((f.cantidad ?? '').replace(',', '.')));
    if (Number.isFinite(d) && d > 0 && Number.isFinite(n) && n >= 1) {
      const c = COLORES[gi % COLORES.length]!;
      for (let i = 0; i < n; i += 1) {
        conductores.push({ dia: d, fill: c.fill, stroke: c.stroke, grupo: gi + 1 });
      }
    }
  }
  if (conductores.length === 0) return null;

  const anchoReq = resultado.valores.anchoRequerido;
  const anchoSug = resultado.valores.anchoSugerido;
  const ocupacionNec = resultado.valores.ocupacionNec;
  const ocupacionAltura = resultado.valores.ocupacionAltura;
  const ancho = anchoSug ?? anchoReq;
  if (ancho == null || ancho <= 0) return null;

  const supera = anchoSug == null;
  const maxDia = Math.max(...conductores.map((c) => c.dia));
  // Tope efectivo: el mínimo entre el geométrico (alto/Ø) y el normativo (2 capas).
  const maxCapasEfectivo = Math.max(1, maxCapasEnEscalerilla(maxDia));
  const capasPedidas = Math.max(1, Math.round(num(entradas, 'capas') || 1));
  const capasUsadas = Math.min(capasPedidas, maxCapasEfectivo, conductores.length);

  // Mismo criterio que la calculadora: los alimentadores monopolares van
  // separados un diámetro, así que el dibujo tiene que mostrarlos separados —
  // si no, se vería una bandeja holgada donde en realidad la separación es la
  // que fija el ancho.
  const modo: ModoTendido = (entradas['modo'] ?? 'alimentadores') === 'circuitos'
    ? 'circuitos' : 'alimentadores';
  const sepDiametros = modo === 'alimentadores' ? SEPARACION_MONOPOLAR_DIAMETROS : 0;
  const capas = distribuirEnCapas(conductores, (c) => c.dia * (1 + sepDiametros), capasUsadas);
  const alturasCapa = capas.map((capa) => Math.max(...capa.map((c) => c.dia), 0));

  // Geometría en mm (viewBox). El alto de la bandeja es fijo (100 mm).
  const margin = 14;
  const railW = 4;
  const railH = PROFUNDIDAD_ESCALERILLA_MM;
  const plateT = 4;
  const totalW = ancho + 2 * railW + 2 * margin + 18; // +18 mm para la cota vertical del alto
  const totalH = margin + railH + plateT + 14; // 14: cota inferior

  const interiorLeftX = margin + railW;
  const interiorRightX = margin + railW + ancho;
  const bottomTopY = margin + railH;

  // Posicionar los conductores: capa 0 abajo (sobre la base), apilando hacia arriba.
  type Pos = Conductor & { cx: number; cy: number };
  const posiciones: Pos[] = [];
  let yBase = bottomTopY;
  for (let r = 0; r < capas.length; r += 1) {
    const capa = capas[r]!;
    // Se dibuja de mayor a menor, igual que anchoDeCapa mide los huecos.
    const orden = [...capa].sort((a, b) => b.dia - a.dia);
    const anchoCapa = anchoDeCapa(orden.map((c) => c.dia), sepDiametros);
    let cursor = interiorLeftX + (ancho - anchoCapa) / 2;
    for (let i = 0; i < orden.length; i += 1) {
      const c = orden[i]!;
      posiciones.push({ ...c, cx: cursor + c.dia / 2, cy: yBase - c.dia / 2 });
      cursor += c.dia;
      const siguiente = orden[i + 1];
      if (siguiente) cursor += Math.max(c.dia, siguiente.dia) * sepDiametros;
    }
    yBase -= alturasCapa[r]!;
  }

  const trayColor = supera ? '#fecaca' : '#cbd5e1';
  const trayStroke = supera ? '#b91c1c' : '#64748b';
  const cotaY = bottomTopY + plateT + 5;
  // Cota vertical del alto a la derecha de la bandeja.
  const cotaXAlto = interiorRightX + railW + 5;

  // Leyenda por grupo.
  const resumenGrupos = filas
    .map((f, gi) => {
      const d = Number((f.diametro ?? '').replace(',', '.'));
      const n = Math.round(Number((f.cantidad ?? '').replace(',', '.')));
      if (!(d > 0 && n >= 1)) return null;
      const c = COLORES[gi % COLORES.length]!;
      return { d, n, color: c.fill };
    })
    .filter((g): g is { d: number; n: number; color: string } => g !== null);

  return (
    <div className="space-y-2">
      <div className="text-sm text-slate-700 dark:text-slate-200 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          Corte transversal — <strong>{capasUsadas}</strong> {capasUsadas === 1 ? 'capa' : 'capas'} en
          escalerilla de <strong>{ancho.toFixed(0)} × {PROFUNDIDAD_ESCALERILLA_MM} mm</strong>
          {ocupacionNec != null ? <> · área {fmtCantidad(ocupacionNec, 1)}%</> : null}
          {ocupacionAltura != null ? <> · alto {fmtCantidad(ocupacionAltura, 1)}%</> : null}
          {supera ? ' (excede catálogo)' : ''}:
        </span>
        {resumenGrupos.map((g, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-full border"
              style={{ background: g.color, borderColor: 'rgba(0,0,0,0.2)' }}
              aria-hidden
            />
            {g.n} × ⌀{fmtCantidad(g.d, 1)} mm
          </span>
        ))}
      </div>
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded p-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${totalW} ${totalH}`}
          className="w-full max-w-2xl"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Corte transversal de la escalerilla con los conductores"
        >
          {/* Riel izquierdo */}
          <rect x={margin} y={margin} width={railW} height={railH}
            fill={trayColor} stroke={trayStroke} strokeWidth={0.4} />
          {/* Riel derecho */}
          <rect x={interiorRightX} y={margin} width={railW} height={railH}
            fill={trayColor} stroke={trayStroke} strokeWidth={0.4} />
          {/* Piso de la bandeja */}
          <rect x={margin} y={bottomTopY} width={ancho + 2 * railW} height={plateT}
            fill={trayColor} stroke={trayStroke} strokeWidth={0.4} />
          {/* Conductores */}
          {posiciones.map((c, i) => (
            <circle key={i} cx={c.cx} cy={c.cy} r={c.dia / 2}
              fill={c.fill} stroke={c.stroke} strokeWidth={0.4}>
              <title>{`Grupo ${c.grupo} · ⌀${fmtCantidad(c.dia, 1)} mm`}</title>
            </circle>
          ))}
          {/* Cota del ancho interior */}
          <line x1={interiorLeftX} y1={cotaY} x2={interiorRightX} y2={cotaY}
            stroke="#475569" strokeWidth={0.5} />
          <line x1={interiorLeftX} y1={cotaY - 1.5} x2={interiorLeftX} y2={cotaY + 1.5}
            stroke="#475569" strokeWidth={0.5} />
          <line x1={interiorRightX} y1={cotaY - 1.5} x2={interiorRightX} y2={cotaY + 1.5}
            stroke="#475569" strokeWidth={0.5} />
          <text x={totalW / 2} y={cotaY + 5} textAnchor="middle"
            fontSize="5" fill="#334155">
            {ancho.toFixed(0)} mm
          </text>
          {/* Cota vertical del alto de la bandeja */}
          <line x1={cotaXAlto} y1={margin} x2={cotaXAlto} y2={bottomTopY}
            stroke="#475569" strokeWidth={0.5} />
          <line x1={cotaXAlto - 1.5} y1={margin} x2={cotaXAlto + 1.5} y2={margin}
            stroke="#475569" strokeWidth={0.5} />
          <line x1={cotaXAlto - 1.5} y1={bottomTopY} x2={cotaXAlto + 1.5} y2={bottomTopY}
            stroke="#475569" strokeWidth={0.5} />
          <text x={cotaXAlto + 2} y={margin + railH / 2 + 1.5} textAnchor="start"
            fontSize="5" fill="#334155">
            {PROFUNDIDAD_ESCALERILLA_MM} mm
          </text>
        </svg>
      </div>
    </div>
  );
}
