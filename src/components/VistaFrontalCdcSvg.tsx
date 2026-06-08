import { forwardRef } from 'react';
import type { Cofre, FilaDin, TableroCdc } from '../types';

interface Props {
  tablero: TableroCdc;
}

const ESCALA = 1.2; // mm → px (Pragma es chico, ampliamos)
const MOD_MM = 18; // ancho de 1 módulo DIN
const FILA_MM = 100; // alto reservado por fila en el SVG
const PADDING_COFRE = 12;
const HEADER_COFRE = 60;
const COFRE_GAP = 20;
const COFRE_MARGEN = 30;

const COLOR_ESTRUCTURA = '#475569';
const COLOR_FONDO = '#f8fafc';
const COLOR_MOD_BG = '#f1f5f9';
const COLOR_MOD_BORDE = '#94a3b8';
const COLOR_TEXTO = '#0f172a';
const COLOR_RESERVA = '#fde68a';
const COLOR_RESERVA_BORDE = '#b45309';
const COLOR_DIF_BG = '#dbeafe'; // blue-100
const COLOR_DIF_BORDE = '#1d4ed8'; // blue-700

export const VistaFrontalCdcSvg = forwardRef<SVGSVGElement, Props>(function VistaFrontalCdcSvg(
  { tablero }, ref,
) {
  if (tablero.cofres.length === 0) return null;

  // Cada cofre: ancho = (modulosPorFila × MOD_MM) + 2·padding
  // alto = HEADER_COFRE + filas × FILA_MM + padding
  const cofresLayout = tablero.cofres.map((c) => {
    const ancho = c.catalogo.modulosPorFila * MOD_MM + 2 * PADDING_COFRE;
    const alto = HEADER_COFRE + c.filas.length * FILA_MM + PADDING_COFRE;
    return { cofre: c, ancho, alto };
  });

  // Layout horizontal de cofres
  const altoMax = cofresLayout.reduce((m, c) => Math.max(m, c.alto), 0);
  const anchoTotal = cofresLayout.reduce((s, c, i) => s + c.ancho + (i > 0 ? COFRE_GAP : 0), 0);
  const anchoMm = anchoTotal + 2 * COFRE_MARGEN;
  const altoMm = altoMax + 2 * COFRE_MARGEN;

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
      {cofresLayout.map((layout, idx) => {
        const xPrev = cofresLayout.slice(0, idx).reduce((s, c) => s + c.ancho + COFRE_GAP, 0);
        const x0 = COFRE_MARGEN + xPrev;
        return <CofreSvg key={layout.cofre.indice} x0={x0} y0={COFRE_MARGEN} layout={layout} />;
      })}
    </svg>
  );
});

interface CofreSvgProps {
  x0: number; y0: number;
  layout: { cofre: Cofre; ancho: number; alto: number };
}

function CofreSvg({ x0, y0, layout }: CofreSvgProps) {
  const { cofre, ancho, alto } = layout;
  return (
    <g>
      <rect x={x0} y={y0} width={ancho} height={alto}
        fill={COLOR_FONDO} stroke={COLOR_ESTRUCTURA} strokeWidth={1.5} rx={4} />
      <text x={x0 + ancho / 2} y={y0 + 22}
        textAnchor="middle" fontSize={14} fontWeight={700} fill={COLOR_TEXTO}
        fontFamily="system-ui, sans-serif">
        Cofre {cofre.indice}
      </text>
      <text x={x0 + ancho / 2} y={y0 + 42}
        textAnchor="middle" fontSize={11} fill="#64748b"
        fontFamily="system-ui, sans-serif">
        {cofre.catalogo.referencia}
      </text>
      {cofre.filas.map((f, i) => (
        <FilaSvg key={f.indice}
          x0={x0 + PADDING_COFRE}
          y0={y0 + HEADER_COFRE + i * FILA_MM}
          ancho={ancho - 2 * PADDING_COFRE}
          alto={FILA_MM - 8}
          fila={f}
          modulosPorFila={cofre.catalogo.modulosPorFila}
        />
      ))}
    </g>
  );
}

interface FilaSvgProps {
  x0: number; y0: number;
  ancho: number; alto: number;
  fila: FilaDin;
  modulosPorFila: number;
}

function FilaSvg({ x0, y0, ancho, alto, fila, modulosPorFila }: FilaSvgProps) {
  const modW = ancho / modulosPorFila;

  let modCursor = 0;
  const elementos: React.ReactNode[] = [];

  // Etiqueta de fila
  elementos.push(
    <text key="lbl" x={x0 - 6} y={y0 + alto / 2} textAnchor="end" dominantBaseline="middle"
      fontSize={11} fontWeight={600} fill="#64748b" fontFamily="system-ui, sans-serif">
      F{fila.indice}
    </text>,
  );

  // Reserva al inicio (si la hay)
  if (fila.reserva > 0) {
    const w = fila.reserva * modW;
    elementos.push(
      <g key="reserva">
        <rect x={x0 + modCursor * modW} y={y0} width={w} height={alto}
          fill={COLOR_RESERVA} stroke={COLOR_RESERVA_BORDE} strokeWidth={1} />
        <text x={x0 + modCursor * modW + w / 2} y={y0 + alto / 2}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={10} fontWeight={600} fill={COLOR_TEXTO}
          fontFamily="system-ui, sans-serif">
          Reserva
        </text>
      </g>,
    );
    modCursor += fila.reserva;
  }

  // Cada protección como bloque de N módulos. Si lleva diferencial, los
  // últimos `modulosExtra` módulos se rotulan como Vigi (RCD).
  fila.modulos.forEach((a, i) => {
    const tieneVigi = a.diferencial != null;
    const modBreaker = tieneVigi
      ? Math.max(1, a.modulosDin - a.diferencial!.modulosExtra)
      : a.modulosDin;
    const modVigi = tieneVigi ? a.diferencial!.modulosExtra : 0;
    const wBreaker = modBreaker * modW;
    const wVigi = modVigi * modW;
    const xBreaker = x0 + modCursor * modW;
    const xVigi = xBreaker + wBreaker;
    elementos.push(
      <g key={`m-${i}`}>
        {/* Bloque del breaker */}
        <rect x={xBreaker} y={y0} width={wBreaker} height={alto}
          fill={COLOR_MOD_BG} stroke={COLOR_MOD_BORDE} strokeWidth={1} />
        {Array.from({ length: modBreaker - 1 }).map((_, k) => (
          <line key={`b-${k}`}
            x1={xBreaker + (k + 1) * modW} y1={y0}
            x2={xBreaker + (k + 1) * modW} y2={y0 + alto}
            stroke={COLOR_MOD_BORDE} strokeDasharray="2 2" strokeWidth={0.5} />
        ))}
        <text x={xBreaker + wBreaker / 2} y={y0 + 18}
          textAnchor="middle" fontSize={11} fontWeight={700} fill={COLOR_TEXTO}
          fontFamily="system-ui, sans-serif">
          {`${a.proteccion.inA}A`}
        </text>
        <text x={xBreaker + wBreaker / 2} y={y0 + 36}
          textAnchor="middle" fontSize={9} fill="#475569"
          fontFamily="system-ui, sans-serif">
          {a.proteccion.polos}P · C
        </text>
        <text x={xBreaker + wBreaker / 2} y={y0 + alto - 8}
          textAnchor="middle" fontSize={9} fill="#64748b"
          fontFamily="system-ui, sans-serif">
          {truncate(a.carga.descripcion || a.carga.id, Math.max(8, 14 * modBreaker))}
        </text>

        {/* Bloque del Vigi (RCD) — si aplica */}
        {tieneVigi && (
          <g>
            <rect x={xVigi} y={y0} width={wVigi} height={alto}
              fill={COLOR_DIF_BG} stroke={COLOR_DIF_BORDE} strokeWidth={1} />
            <text x={xVigi + wVigi / 2} y={y0 + 16}
              textAnchor="middle" fontSize={8} fontWeight={700} fill={COLOR_DIF_BORDE}
              fontFamily="system-ui, sans-serif">
              Vigi
            </text>
            <text x={xVigi + wVigi / 2} y={y0 + 30}
              textAnchor="middle" fontSize={8} fontWeight={600} fill={COLOR_DIF_BORDE}
              fontFamily="system-ui, sans-serif">
              {`${a.diferencial!.sensibilidadMa}mA`}
            </text>
            <text x={xVigi + wVigi / 2} y={y0 + 44}
              textAnchor="middle" fontSize={8} fill="#1e3a8a"
              fontFamily="system-ui, sans-serif">
              {a.diferencial!.tipo}
            </text>
            <text x={xVigi + wVigi / 2} y={y0 + alto - 8}
              textAnchor="middle" fontSize={7} fill="#1e3a8a"
              fontFamily="system-ui, sans-serif">
              RCD
            </text>
          </g>
        )}
      </g>,
    );
    modCursor += a.modulosDin;
  });

  // Espacio libre al final
  if (fila.modulosLibres > 0) {
    const w = fila.modulosLibres * modW;
    elementos.push(
      <g key="libre">
        <rect x={x0 + modCursor * modW} y={y0} width={w} height={alto}
          fill="white" stroke={COLOR_MOD_BORDE} strokeDasharray="3 3" strokeWidth={1} />
        <text x={x0 + modCursor * modW + w / 2} y={y0 + alto / 2}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={10} fill="#94a3b8" fontFamily="system-ui, sans-serif">
          {`Libre ${fila.modulosLibres}`}
        </text>
      </g>,
    );
  }

  return <>{elementos}</>;
}

function truncate(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  return `${s.slice(0, Math.max(2, maxChars - 1))}…`;
}
