import type { EntradasCalc, ResultadoCalc } from '../logic/calculos';
import { leerFilas } from '../logic/calculos';
import { fmtCantidad } from '../util/format';

interface Props {
  entradas: EntradasCalc;
  resultado: ResultadoCalc;
}

/** Colores por grupo (calibre). El estilo del trazo se deriva del fill. */
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
 * Corte transversal de una escalerilla portaconductores. Lee la lista de
 * grupos de la calculadora y dibuja los conductores con su diámetro real,
 * coloreados por grupo, tendidos en una sola capa sobre la base.
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
  const ancho = anchoSug ?? anchoReq;
  if (ancho == null || ancho <= 0) return null;

  const supera = anchoSug == null;
  const maxDia = Math.max(...conductores.map((c) => c.dia));

  // Geometría en mm (viewBox). El SVG escala vía CSS.
  const margin = 14;
  const railW = 4;
  const railH = Math.max(maxDia * 1.5, 50);
  const plateT = 4;
  const totalW = ancho + 2 * railW + 2 * margin;
  const totalH = margin + railH + plateT + 14; // espacio inferior para la cota

  const interiorLeftX = margin + railW;
  const interiorRightX = margin + railW + ancho;
  const bottomTopY = margin + railH;

  // Conductores centrados horizontalmente en el espacio interior.
  const totalAnchoConductores = conductores.reduce((s, c) => s + c.dia, 0);
  const offset = (ancho - totalAnchoConductores) / 2;
  let cursor = interiorLeftX + offset;
  const posiciones = conductores.map((c) => {
    const cx = cursor + c.dia / 2;
    cursor += c.dia;
    return { ...c, cx, cy: bottomTopY - c.dia / 2 };
  });

  const trayColor = supera ? '#fecaca' : '#cbd5e1';
  const trayStroke = supera ? '#b91c1c' : '#64748b';
  const cotaY = bottomTopY + plateT + 5;

  // Resumen por grupo para el caption superior.
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
        <span>Corte transversal — escalerilla de <strong>{ancho.toFixed(0)} mm</strong>{supera ? ' (excede catálogo)' : ''}:</span>
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
        </svg>
      </div>
    </div>
  );
}
