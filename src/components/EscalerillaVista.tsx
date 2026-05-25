import type { EntradasCalc, ResultadoCalc } from '../logic/calculos';
import { num } from '../logic/calculos';
import { fmtCantidad } from '../util/format';

interface Props {
  entradas: EntradasCalc;
  resultado: ResultadoCalc;
}

/**
 * Corte transversal de una escalerilla portaconductores, con los conductores
 * tendidos en una sola capa sobre la base. Las dimensiones de la escalerilla
 * se toman del resultado del cálculo (ancho sugerido o requerido).
 */
export function EscalerillaVista({ entradas, resultado }: Props) {
  const diametro = num(entradas, 'diametro');
  const cantidad = Math.round(num(entradas, 'cantidad'));
  const anchoReq = resultado.valores.anchoRequerido;
  const anchoSug = resultado.valores.anchoSugerido;
  const ancho = anchoSug ?? anchoReq;
  if (!(diametro > 0) || !(cantidad >= 1) || ancho == null || ancho <= 0) return null;

  const supera = anchoSug == null;

  // Geometría en mm (viewBox). Escala el SVG vía CSS.
  const margin = 14;
  const railW = 4;
  const railH = Math.max(diametro * 1.5, 50);
  const plateT = 4;
  const totalW = ancho + 2 * railW + 2 * margin;
  const totalH = margin + railH + plateT + 14; // espacio inferior para la cota

  const interiorLeftX = margin + railW;
  const interiorRightX = margin + railW + ancho;
  const bottomTopY = margin + railH;
  // Conductores centrados horizontalmente dentro del espacio interior.
  const offset = (ancho - cantidad * diametro) / 2;
  const startX = interiorLeftX + offset;
  const cy = bottomTopY - diametro / 2;

  const trayColor = supera ? '#fecaca' : '#cbd5e1';
  const trayStroke = supera ? '#b91c1c' : '#64748b';

  // Cota: línea con flechas y texto.
  const cotaY = bottomTopY + plateT + 5;

  return (
    <div className="space-y-2">
      <div className="text-sm text-slate-700 dark:text-slate-200">
        Corte transversal — <strong>{cantidad}</strong> × ⌀{fmtCantidad(diametro, 1)} mm
        {' sobre escalerilla de '}
        <strong>{ancho.toFixed(0)} mm</strong>
        {supera ? ' (excede catálogo)' : ''}
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
          {Array.from({ length: cantidad }).map((_, i) => {
            const cx = startX + diametro * (i + 0.5);
            return (
              <circle key={i} cx={cx} cy={cy} r={diametro / 2}
                fill="#fbbf24" stroke="#92400e" strokeWidth={0.4} />
            );
          })}
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
