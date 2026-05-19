import { forwardRef } from 'react';
import type { Tablero } from '../types';
import { fmtMm } from '../util/format';
import { altoUtilColumnaEnX, fmtX, tamanoEnX, tamanoEnXTexto } from '../util/x-blokset';

interface Props {
  tablero: Tablero;
}

const ESCALA = 0.25; // mm → px (4 px = 1 mm a 1:4)
const COLOR_ESTRUCTURA = '#475569'; // slate-600
const COLOR_GAVETA_BG = '#f1f5f9'; // slate-100
const COLOR_GAVETA_BORDE = '#94a3b8'; // slate-400
const COLOR_TEXTO = '#0f172a'; // slate-900
const COLOR_RESERVA = '#fde68a'; // amber-200

/**
 * Vista frontal del tablero CCM — cada columna como rectángulo dividido en
 * cabezal, gavetas (apiladas desde arriba abajo) y zócalo.
 * Renderiza con `ref` para capturar a PDF con svg2pdf.js.
 */
export const VistaFrontalSvg = forwardRef<SVGSVGElement, Props>(function VistaFrontalSvg(
  { tablero },
  ref,
) {
  const { columnas, altoTotalMm, reservaCabezalMm, reservaZocaloMm } = tablero;
  if (columnas.length === 0) return null;

  const anchoCol = columnas[0]?.anchoMm ?? 600;
  const margen = 40; // mm de margen total
  const espacioEntre = 0; // columnas pegadas

  const anchoMm = columnas.length * anchoCol + columnas.length * espacioEntre + 2 * margen;
  const altoMm = altoTotalMm + 2 * margen;

  const width = anchoMm * ESCALA;
  const height = altoMm * ESCALA;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${anchoMm} ${altoMm}`}
      width={width}
      height={height}
      className="block max-w-full h-auto"
      style={{ background: '#ffffff' }}
    >
      {/* Marco exterior */}
      <rect
        x={margen}
        y={margen}
        width={anchoMm - 2 * margen}
        height={altoMm - 2 * margen}
        fill="white"
        stroke={COLOR_ESTRUCTURA}
        strokeWidth={4}
      />
      {columnas.map((col, idx) => {
        const x0 = margen + idx * (anchoCol + espacioEntre);
        const yCabezalTop = margen;
        const yGavetasTop = yCabezalTop + reservaCabezalMm;
        const altoUtil = col.altoUtilMm;
        const yZocaloTop = yGavetasTop + altoUtil;
        const xTotalCol = altoUtilColumnaEnX();
        const xUsadoCol = col.gavetas.reduce((acc, g) => acc + tamanoEnX(g.tamano), 0);
        const xLibreCol = Math.max(0, xTotalCol - xUsadoCol);

        return (
          <g key={col.id}>
            {/* Cabezal de barras */}
            <rect
              x={x0}
              y={yCabezalTop}
              width={anchoCol}
              height={reservaCabezalMm}
              fill={COLOR_RESERVA}
              stroke={COLOR_ESTRUCTURA}
              strokeWidth={2}
            />
            <text
              x={x0 + anchoCol / 2}
              y={yCabezalTop + reservaCabezalMm / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={40}
              fill={COLOR_TEXTO}
              fontFamily="system-ui, sans-serif"
            >
              Cabezal de barras
            </text>

            {/* Gavetas, apiladas desde el tope hacia abajo */}
            {(() => {
              let yCursor = yGavetasTop;
              return col.gavetas.map((g) => {
                const y = yCursor;
                yCursor += g.altoMm;
                return (
                  <g key={g.id}>
                    <rect
                      x={x0 + 10}
                      y={y}
                      width={anchoCol - 20}
                      height={g.altoMm}
                      fill={COLOR_GAVETA_BG}
                      stroke={COLOR_GAVETA_BORDE}
                      strokeWidth={2}
                    />
                    <text
                      x={x0 + anchoCol / 2}
                      y={y + 30}
                      textAnchor="middle"
                      fontSize={36}
                      fontWeight={600}
                      fill={COLOR_TEXTO}
                      fontFamily="system-ui, sans-serif"
                    >
                      {`Gaveta ${tamanoEnXTexto(g.tamano)}`}
                    </text>
                    <text
                      x={x0 + anchoCol / 2}
                      y={y + 70}
                      textAnchor="middle"
                      fontSize={28}
                      fill="#64748b"
                      fontFamily="system-ui, sans-serif"
                    >
                      {truncate(g.contenido, 38)}
                    </text>
                    {g.protecciones[0] && (
                      <text
                        x={x0 + anchoCol / 2}
                        y={y + g.altoMm - 16}
                        textAnchor="middle"
                        fontSize={26}
                        fill="#475569"
                        fontFamily="ui-monospace, monospace"
                      >
                        {g.protecciones[0].referencia}
                      </text>
                    )}
                  </g>
                );
              });
            })()}

            {/* Espacio remanente en la columna */}
            {col.espacioRemanenteMm > 0 && (
              <g>
                <rect
                  x={x0 + 10}
                  y={yZocaloTop - col.espacioRemanenteMm}
                  width={anchoCol - 20}
                  height={col.espacioRemanenteMm}
                  fill="#f8fafc"
                  stroke={COLOR_GAVETA_BORDE}
                  strokeDasharray="6 6"
                  strokeWidth={2}
                />
                <text
                  x={x0 + anchoCol / 2}
                  y={yZocaloTop - col.espacioRemanenteMm / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={32}
                  fill="#94a3b8"
                  fontFamily="system-ui, sans-serif"
                >
                  {`Libre · ${fmtMm(col.espacioRemanenteMm)} · ${fmtX(xLibreCol)}`}
                </text>
              </g>
            )}

            {/* Zócalo */}
            {reservaZocaloMm > 0 && (
              <>
                <rect
                  x={x0}
                  y={yZocaloTop}
                  width={anchoCol}
                  height={reservaZocaloMm}
                  fill="#e2e8f0"
                  stroke={COLOR_ESTRUCTURA}
                  strokeWidth={2}
                />
                <text
                  x={x0 + anchoCol / 2}
                  y={yZocaloTop + reservaZocaloMm / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={32}
                  fill={COLOR_TEXTO}
                  fontFamily="system-ui, sans-serif"
                >
                  Zócalo
                </text>
              </>
            )}

            {/* Etiqueta de columna con uso de X */}
            <text
              x={x0 + anchoCol / 2}
              y={margen - 10}
              textAnchor="middle"
              fontSize={36}
              fontWeight={700}
              fill={COLOR_TEXTO}
              fontFamily="system-ui, sans-serif"
            >
              {`Col ${idx + 1} · ${fmtX(xUsadoCol)} / ${fmtX(xTotalCol)}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
});

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
