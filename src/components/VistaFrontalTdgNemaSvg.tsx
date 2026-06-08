import { forwardRef } from 'react';
import { ENVOLVENTE_TDG_NEMA, salidasPorColumnaNema } from '../logic/tdg-nema';
import type { SalidaAsignadaNema, TableroTdgNema } from '../types';

interface Props {
  tablero: TableroTdgNema;
}

const ESCALA = 0.25;
const COLOR_ESTRUCTURA = '#475569';
const COLOR_BARRA = '#fbbf24';
const COLOR_BARRA_BORDE = '#b45309';
const COLOR_PRINCIPAL_BG = '#fee2e2';
const COLOR_PRINCIPAL_BORDE = '#b91c1c';
const COLOR_CELDA_BG = '#f1f5f9';
const COLOR_CELDA_BORDE = '#94a3b8';
const COLOR_TEXTO = '#0f172a';
const COLOR_MEDIDA_BG = '#e0e7ff';
const COLOR_MEDIDA_BORDE = '#6366f1';

export const VistaFrontalTdgNemaSvg = forwardRef<SVGSVGElement, Props>(function VistaFrontalTdgNemaSvg(
  { tablero }, ref,
) {
  const env = ENVOLVENTE_TDG_NEMA;
  const margen = 50;
  const numCol = tablero.columnas;
  const colW = env.anchoColumnaMm;
  const altoMm = env.altoTotalMm + 2 * margen;
  const anchoMm = numCol * colW + 2 * margen;

  const yBarrasTop = margen;
  const yBarrasBot = yBarrasTop + env.reservaBarrasMm;
  const ySalidasTop = yBarrasBot;
  const ySalidasBot = ySalidasTop + env.altoUtilSalidasMm;
  const yZocaloTop = ySalidasBot;

  const porColumna = salidasPorColumnaNema();
  const grupos = chunk(tablero.salidas, porColumna);

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
      <rect
        x={margen} y={margen}
        width={anchoMm - 2 * margen} height={altoMm - 2 * margen}
        fill="white" stroke={COLOR_ESTRUCTURA} strokeWidth={4}
      />

      {/* Barras horizontales */}
      <rect
        x={margen} y={yBarrasTop}
        width={numCol * colW} height={env.reservaBarrasMm}
        fill={COLOR_BARRA} stroke={COLOR_BARRA_BORDE} strokeWidth={2}
      />
      <text
        x={margen + (numCol * colW) / 2} y={yBarrasTop + env.reservaBarrasMm / 2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={48} fontWeight={700} fill={COLOR_TEXTO}
        fontFamily="system-ui, sans-serif"
      >
        {`Barra ${tablero.barra.frameAF}AF`}
      </text>

      {Array.from({ length: numCol }).map((_, idx) => {
        const x0 = margen + idx * colW;
        const esColPrincipal = idx === 0;
        return (
          <g key={idx}>
            {idx > 0 && (
              <line x1={x0} y1={margen} x2={x0} y2={altoMm - margen}
                stroke={COLOR_ESTRUCTURA} strokeWidth={2} />
            )}
            <text
              x={x0 + colW / 2} y={margen - 14}
              textAnchor="middle" fontSize={36} fontWeight={700} fill={COLOR_TEXTO}
              fontFamily="system-ui, sans-serif"
            >
              {esColPrincipal ? 'Principal · Incoming' : `Salidas ${idx}`}
            </text>

            {esColPrincipal ? (
              <ColumnaPrincipal
                x0={x0} colW={colW}
                yTop={ySalidasTop} yBot={ySalidasBot}
                tablero={tablero}
              />
            ) : (
              <ColumnaSalidas
                x0={x0} colW={colW}
                yTop={ySalidasTop} yBot={ySalidasBot}
                salidas={grupos[idx - 1] ?? []}
                offsetIdx={(idx - 1) * porColumna}
              />
            )}

            {/* Zócalo */}
            <rect
              x={x0} y={yZocaloTop}
              width={colW} height={env.reservaZocaloMm}
              fill="#e2e8f0" stroke={COLOR_ESTRUCTURA} strokeWidth={2}
            />
          </g>
        );
      })}
    </svg>
  );
});

interface ColPrincipalProps {
  x0: number; colW: number;
  yTop: number; yBot: number;
  tablero: TableroTdgNema;
}

function ColumnaPrincipal({ x0, colW, yTop, yBot, tablero }: ColPrincipalProps) {
  const altoBloque = ENVOLVENTE_TDG_NEMA.reservaPrincipalMm;
  const yPB = yTop;
  const yPBfin = yPB + altoBloque;
  // Compartimento de medida ocupa ~55% del libre; el resto es acometida.
  const totalLibre = yBot - yPBfin;
  const yMedidaTop = yPBfin;
  const medidaH = Math.max(0, totalLibre * 0.55);
  const yMedidaBot = yMedidaTop + medidaH;
  const yAcometidaTop = yMedidaBot;
  const acometidaH = yBot - yAcometidaTop;
  const m = tablero.medida;
  return (
    <>
      {/* Interruptor principal */}
      <rect
        x={x0 + 12} y={yPB}
        width={colW - 24} height={altoBloque}
        fill={COLOR_PRINCIPAL_BG} stroke={COLOR_PRINCIPAL_BORDE} strokeWidth={3}
      />
      <text x={x0 + colW / 2} y={yPB + 60} textAnchor="middle" fontSize={42} fontWeight={700} fill={COLOR_TEXTO} fontFamily="system-ui, sans-serif">
        INTERRUPTOR PRINCIPAL
      </text>
      <text x={x0 + colW / 2} y={yPB + 120} textAnchor="middle" fontSize={36} fill={COLOR_TEXTO} fontFamily="ui-monospace, monospace">
        {`${tablero.principal.frameAF}AF`}
      </text>
      <text x={x0 + colW / 2} y={yPB + 170} textAnchor="middle" fontSize={36} fontWeight={700} fill={COLOR_TEXTO} fontFamily="system-ui, sans-serif">
        {tablero.principal.rating}
      </text>
      <text x={x0 + colW / 2} y={yPB + 220} textAnchor="middle" fontSize={28} fill="#64748b" fontFamily="system-ui, sans-serif">
        {`FLC total ≈ ${tablero.corrienteTotalA.toFixed(0)} A`}
      </text>

      {/* Compartimento de medida */}
      {medidaH > 100 && (
        <>
          <rect
            x={x0 + 12} y={yMedidaTop}
            width={colW - 24} height={medidaH}
            fill={COLOR_MEDIDA_BG} stroke={COLOR_MEDIDA_BORDE} strokeWidth={2}
          />
          <text x={x0 + colW / 2} y={yMedidaTop + 50} textAnchor="middle" fontSize={36} fontWeight={700} fill={COLOR_TEXTO} fontFamily="system-ui, sans-serif">
            Compartimento de medida
          </text>
          <text x={x0 + colW / 2} y={yMedidaTop + 100} textAnchor="middle" fontSize={28} fill="#475569" fontFamily="system-ui, sans-serif">
            {`${m.transformadoresTension} PT · ${m.transformadoresCorriente} CT · ${m.lucesPiloto} luces piloto`}
          </text>
          <text x={x0 + colW / 2} y={yMedidaTop + 138} textAnchor="middle" fontSize={26} fill="#64748b" fontFamily="system-ui, sans-serif">
            {m.instrumento}
          </text>
        </>
      )}

      {/* Bloque de acometida */}
      {acometidaH > 100 && (
        <>
          <rect
            x={x0 + 12} y={yAcometidaTop}
            width={colW - 24} height={acometidaH}
            fill="#fef3c7" stroke="#b45309" strokeWidth={2}
          />
          <text x={x0 + colW / 2} y={yAcometidaTop + 50} textAnchor="middle" fontSize={36} fontWeight={700} fill={COLOR_TEXTO} fontFamily="system-ui, sans-serif">
            Acometida
          </text>
          <text x={x0 + colW / 2} y={yAcometidaTop + 90} textAnchor="middle" fontSize={26} fill="#475569" fontFamily="system-ui, sans-serif">
            Entrada de cables · SPD
          </text>
          <text x={x0 + colW / 2} y={yAcometidaTop + 124} textAnchor="middle" fontSize={26} fill="#64748b" fontFamily="system-ui, sans-serif">
            Trafo de control · regletería
          </text>
        </>
      )}
    </>
  );
}

interface ColSalidasProps {
  x0: number; colW: number;
  yTop: number; yBot: number;
  salidas: readonly SalidaAsignadaNema[];
  offsetIdx: number;
}

function ColumnaSalidas({ x0, colW, yTop, yBot, salidas, offsetIdx }: ColSalidasProps) {
  const cellH = ENVOLVENTE_TDG_NEMA.altoCeldaSalidaMm;
  const elementos = salidas.map((s, i) => {
    const y = yTop + i * cellH;
    if (y + cellH > yBot) return null;
    const numero = offsetIdx + i + 1;
    return (
      <g key={s.carga.id}>
        <rect
          x={x0 + 12} y={y}
          width={colW - 24} height={cellH}
          fill={COLOR_CELDA_BG} stroke={COLOR_CELDA_BORDE} strokeWidth={2}
        />
        <text x={x0 + 22} y={y + 36} fontSize={32} fontWeight={700} fill={COLOR_TEXTO} fontFamily="system-ui, sans-serif">
          {`S${numero}`}
        </text>
        <text x={x0 + 90} y={y + 36} fontSize={28} fill={COLOR_TEXTO} fontFamily="system-ui, sans-serif">
          {truncate(s.carga.descripcion || s.carga.id, 22)}
        </text>
        <text x={x0 + colW / 2} y={y + 92} textAnchor="middle" fontSize={28} fill="#475569" fontFamily="ui-monospace, monospace">
          {`${s.breaker.frameAF}AF · ${s.breaker.rating}`}
        </text>
        <text x={x0 + colW - 22} y={y + cellH - 18} textAnchor="end" fontSize={26} fill="#64748b" fontFamily="system-ui, sans-serif">
          {`I ${s.corrienteDisenoA.toFixed(0)} A`}
        </text>
      </g>
    );
  });

  const usado = salidas.length * cellH;
  const sobrante = Math.max(0, yBot - yTop - usado);
  const yLibre = yTop + usado;
  const libreEl = sobrante > 0 ? (
    <g>
      <rect
        x={x0 + 12} y={yLibre}
        width={colW - 24} height={sobrante}
        fill="#f8fafc" stroke={COLOR_CELDA_BORDE} strokeDasharray="6 6" strokeWidth={2}
      />
      <text x={x0 + colW / 2} y={yLibre + sobrante / 2} textAnchor="middle" dominantBaseline="middle" fontSize={28} fill="#94a3b8" fontFamily="system-ui, sans-serif">
        {`Libre · ${Math.round(sobrante)} mm`}
      </text>
    </g>
  ) : null;

  return <>{elementos}{libreEl}</>;
}

function chunk<T>(xs: readonly T[], n: number): T[][] {
  if (n <= 0) return [Array.from(xs)];
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
