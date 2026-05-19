import { forwardRef } from 'react';
import type { TableroCcmNema } from '../types';

interface Props {
  tablero: TableroCcmNema;
}

const ESCALA = 0.25;
const COLOR_ESTRUCTURA = '#475569';
const COLOR_BARRA = '#fbbf24';
const COLOR_BARRA_BORDE = '#b45309';
const COLOR_GAVETA_BG = '#f1f5f9';
const COLOR_GAVETA_BORDE = '#94a3b8';
const COLOR_TEXTO = '#0f172a';

export const VistaFrontalCcmNemaSvg = forwardRef<SVGSVGElement, Props>(function VistaFrontalCcmNemaSvg(
  { tablero }, ref,
) {
  const { columnas, xMm, altoTotalMm, anchoTotalMm } = tablero;
  if (columnas.length === 0) return null;

  const margen = 50;
  const anchoCol = anchoTotalMm / columnas.length;
  const reservaCabezalMm = 200;
  const altoMm = altoTotalMm + 2 * margen;
  const anchoMm = anchoTotalMm + 2 * margen;

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
      {/* Marco exterior */}
      <rect
        x={margen} y={margen}
        width={anchoTotalMm} height={altoTotalMm}
        fill="white" stroke={COLOR_ESTRUCTURA} strokeWidth={4}
      />

      {/* Barra horizontal en cabezal */}
      <rect
        x={margen} y={margen}
        width={anchoTotalMm} height={reservaCabezalMm}
        fill={COLOR_BARRA} stroke={COLOR_BARRA_BORDE} strokeWidth={2}
      />
      <text
        x={margen + anchoTotalMm / 2} y={margen + reservaCabezalMm / 2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={48} fontWeight={700} fill={COLOR_TEXTO}
        fontFamily="system-ui, sans-serif"
      >
        {`Barra principal — ${tablero.barra.capacidadA} A`}
      </text>

      {columnas.map((col, idx) => {
        const x0 = margen + idx * anchoCol;
        const yTopColumna = margen + reservaCabezalMm;

        return (
          <g key={col.indice}>
            {idx > 0 && (
              <line x1={x0} y1={margen} x2={x0} y2={margen + altoTotalMm}
                stroke={COLOR_ESTRUCTURA} strokeWidth={2} />
            )}
            <text
              x={x0 + anchoCol / 2} y={margen - 14}
              textAnchor="middle" fontSize={36} fontWeight={700} fill={COLOR_TEXTO}
              fontFamily="system-ui, sans-serif"
            >
              {`Col ${col.indice} · ${col.espaciosUsados}X / ${col.altoUtilXEspacios}X`}
            </text>

            {(() => {
              let yCursor = yTopColumna;
              return col.asignaciones.map((a) => {
                const altoCelda = a.espaciosX * xMm;
                const y = yCursor;
                yCursor += altoCelda;
                const desc = a.carga.descripcion || a.carga.id;
                const ref = a.motor
                  ? `NEMA ${a.motor.contactorSize ?? '—'} · MCP ${a.motor.mcpFrameA ?? '—'}A`
                  : a.breaker
                  ? `${a.breaker.frameAF}AF · ${a.breaker.rating}`
                  : '';
                return (
                  <g key={a.carga.id}>
                    <rect
                      x={x0 + 12} y={y}
                      width={anchoCol - 24} height={altoCelda}
                      fill={COLOR_GAVETA_BG} stroke={COLOR_GAVETA_BORDE} strokeWidth={2}
                    />
                    <text
                      x={x0 + anchoCol / 2} y={y + 36}
                      textAnchor="middle" fontSize={36} fontWeight={600} fill={COLOR_TEXTO}
                      fontFamily="system-ui, sans-serif"
                    >
                      {`${a.espaciosX}X · ${a.version}`}
                    </text>
                    <text
                      x={x0 + anchoCol / 2} y={y + 78}
                      textAnchor="middle" fontSize={30} fill="#64748b"
                      fontFamily="system-ui, sans-serif"
                    >
                      {truncate(desc, 28)}
                    </text>
                    <text
                      x={x0 + anchoCol / 2} y={y + altoCelda - 22}
                      textAnchor="middle" fontSize={28} fill="#475569"
                      fontFamily="ui-monospace, monospace"
                    >
                      {ref}
                    </text>
                  </g>
                );
              });
            })()}

            {col.espaciosLibres > 0 && (
              <g>
                <rect
                  x={x0 + 12} y={yTopColumna + col.espaciosUsados * xMm}
                  width={anchoCol - 24} height={col.espaciosLibres * xMm}
                  fill="#f8fafc" stroke={COLOR_GAVETA_BORDE} strokeDasharray="6 6" strokeWidth={2}
                />
                <text
                  x={x0 + anchoCol / 2}
                  y={yTopColumna + (col.espaciosUsados + col.espaciosLibres / 2) * xMm}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={32} fill="#94a3b8"
                  fontFamily="system-ui, sans-serif"
                >
                  {`Libre · ${col.espaciosLibres}X`}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
});

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
