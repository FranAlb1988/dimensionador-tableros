import { forwardRef } from 'react';
import { ENVOLVENTE_MT } from '../logic/mt';
import { TIPO_CELDA_MT_LABEL, type TableroMt } from '../types';

interface Props {
  tablero: TableroMt;
}

const ESCALA = 0.18;
const COLOR_ESTRUCTURA = '#475569';
const COLOR_BARRA = '#fbbf24';
const COLOR_BARRA_BORDE = '#b45309';
const COLOR_ALTA_BG = '#e0f2fe';
const COLOR_ALTA_BORDE = '#0369a1';
const COLOR_CONTROL_BG = '#f1f5f9';
const COLOR_CONTROL_BORDE = '#94a3b8';
const COLOR_TEXTO = '#0f172a';

const FILL_TIPO: Record<string, string> = {
  entrada: '#dcfce7',
  salida: '#e0f2fe',
  acople: '#fef9c3',
  medida: '#ede9fe',
};

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export const VistaFrontalMtSvg = forwardRef<SVGSVGElement, Props>(function VistaFrontalMtSvg(
  { tablero }, ref,
) {
  const env = ENVOLVENTE_MT;
  const margen = 120;
  const alturaBarra = 140;
  const anchoMm = tablero.anchoTotalMm + 2 * margen;
  const altoMm = env.altoTotalMm + 2 * margen + alturaBarra;

  const yBarra = margen;
  const yCeldaTop = yBarra + alturaBarra;
  const yAltaTop = yCeldaTop;
  const yAltaBot = yAltaTop + env.altoCompartimentoAltaMm;
  const yControlTop = yAltaBot;
  const yControlBot = yControlTop + env.altoCompartimentoControlMm;
  const yZocaloTop = yControlBot;

  let xCursor = margen;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${anchoMm} ${altoMm}`}
      width={anchoMm * ESCALA}
      height={altoMm * ESCALA}
      className="block max-w-full h-auto"
      style={{ background: '#ffffff' }}
    >
      {/* Barra principal */}
      <rect
        x={margen} y={yBarra}
        width={tablero.anchoTotalMm} height={alturaBarra}
        fill={COLOR_BARRA} stroke={COLOR_BARRA_BORDE} strokeWidth={3}
      />
      <text
        x={margen + tablero.anchoTotalMm / 2} y={yBarra + alturaBarra / 2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={64} fontWeight={700} fill={COLOR_TEXTO}
        fontFamily="system-ui, sans-serif"
      >
        {`Barra principal ${tablero.corrienteBarraA} A · ${tablero.claseTensionKv} kV · ${tablero.iccKa} kA`}
      </text>

      {tablero.celdas.map((c, idx) => {
        const x0 = xCursor;
        xCursor += c.anchoMm;
        const cx = x0 + c.anchoMm / 2;
        const fill = FILL_TIPO[c.salida.tipoCelda] ?? COLOR_ALTA_BG;
        return (
          <g key={c.salida.id}>
            {/* Marco celda */}
            <rect
              x={x0} y={yCeldaTop}
              width={c.anchoMm} height={env.altoTotalMm}
              fill="white" stroke={COLOR_ESTRUCTURA} strokeWidth={4}
            />
            {/* Compartimento alta tensión */}
            <rect
              x={x0 + 14} y={yAltaTop + 14}
              width={c.anchoMm - 28} height={env.altoCompartimentoAltaMm - 28}
              fill={fill} stroke={COLOR_ALTA_BORDE} strokeWidth={3}
            />
            <text x={cx} y={yAltaTop + 70} textAnchor="middle" fontSize={44} fontWeight={700} fill={COLOR_TEXTO} fontFamily="system-ui, sans-serif">
              {`C${idx + 1}`}
            </text>
            <text x={cx} y={yAltaTop + 130} textAnchor="middle" fontSize={38} fill={COLOR_TEXTO} fontFamily="system-ui, sans-serif">
              {TIPO_CELDA_MT_LABEL[c.salida.tipoCelda]}
            </text>
            <text x={cx} y={(yAltaTop + yAltaBot) / 2 + 30} textAnchor="middle" fontSize={34} fill="#475569" fontFamily="ui-monospace, monospace">
              {`${c.corrienteA.toFixed(0)} A`}
            </text>
            {/* Compartimento de control */}
            <rect
              x={x0 + 14} y={yControlTop + 14}
              width={c.anchoMm - 28} height={env.altoCompartimentoControlMm - 28}
              fill={COLOR_CONTROL_BG} stroke={COLOR_CONTROL_BORDE} strokeWidth={3}
            />
            <text x={cx} y={yControlTop + 70} textAnchor="middle" fontSize={32} fontWeight={700} fill="#64748b" fontFamily="system-ui, sans-serif">
              CONTROL / BT
            </text>
            <text x={cx} y={(yControlTop + yControlBot) / 2 + 30} textAnchor="middle" fontSize={30} fill={COLOR_TEXTO} fontFamily="system-ui, sans-serif">
              {truncate(c.salida.descripcion || c.salida.id, 22)}
            </text>
            {/* Zócalo */}
            <rect
              x={x0} y={yZocaloTop}
              width={c.anchoMm} height={env.zocaloMm}
              fill="#e2e8f0" stroke={COLOR_ESTRUCTURA} strokeWidth={2}
            />
            {/* Cota de ancho */}
            <text x={cx} y={yZocaloTop + env.zocaloMm + 70} textAnchor="middle" fontSize={32} fill="#64748b" fontFamily="ui-monospace, monospace">
              {`${c.anchoMm} mm`}
            </text>
          </g>
        );
      })}

      {/* Cota ancho total */}
      <text
        x={margen + tablero.anchoTotalMm / 2} y={altoMm - margen / 2}
        textAnchor="middle" fontSize={40} fontWeight={700} fill={COLOR_TEXTO}
        fontFamily="ui-monospace, monospace"
      >
        {`Ancho total ${tablero.anchoTotalMm} mm · Alto ${tablero.altoTotalMm} mm · Fondo ${tablero.profundidadTotalMm} mm`}
      </text>
    </svg>
  );
});
