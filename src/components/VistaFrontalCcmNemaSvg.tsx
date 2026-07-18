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
const COLOR_MEDIDA_BG = '#e0e7ff';
const COLOR_MEDIDA_BORDE = '#6366f1';

export const VistaFrontalCcmNemaSvg = forwardRef<SVGSVGElement, Props>(function VistaFrontalCcmNemaSvg(
  { tablero }, ref,
) {
  const { columnas, xMm, altoTotalMm, anchoTotalMm } = tablero;
  if (columnas.length === 0) return null;

  // El compartimento de medida va arriba: en la columna de incoming si existe,
  // si no, en la columna con más espacios libres. Ocupa 2X (X = xMm).
  const idxIncoming = columnas.findIndex((c) => c.esIncoming);
  const idxMedida = idxIncoming >= 0
    ? idxIncoming
    : columnas.reduce(
        (best, c, i, arr) => (c.espaciosLibres > (arr[best]?.espaciosLibres ?? -1) ? i : best),
        0,
      );
  const medidaAltoMm = 2 * xMm;

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
        const conMedida = idx === idxMedida && col.espaciosLibres >= 2;
        const offsetMedidaMm = conMedida ? medidaAltoMm : 0;

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
              {col.esIncoming
                ? `Col ${col.indice} · Incoming`
                : `Col ${col.indice} · ${col.espaciosUsados}X / ${col.altoUtilXEspacios}X`}
            </text>

            {/* Compartimento de medida (arriba, bajo la barra) */}
            {conMedida && (() => {
              const m = tablero.medida;
              return (
                <g>
                  <rect
                    x={x0 + 12} y={yTopColumna}
                    width={anchoCol - 24} height={medidaAltoMm}
                    fill={COLOR_MEDIDA_BG} stroke={COLOR_MEDIDA_BORDE} strokeWidth={2}
                  />
                  <text
                    x={x0 + anchoCol / 2} y={yTopColumna + 44}
                    textAnchor="middle" fontSize={34} fontWeight={700} fill={COLOR_TEXTO}
                    fontFamily="system-ui, sans-serif"
                  >
                    Compartimento de medida · 2X
                  </text>
                  <text
                    x={x0 + anchoCol / 2} y={yTopColumna + 90}
                    textAnchor="middle" fontSize={28} fill="#475569"
                    fontFamily="system-ui, sans-serif"
                  >
                    {`${m.transformadoresTension} PT · ${m.transformadoresCorriente} CT · ${m.lucesPiloto} luces piloto`}
                  </text>
                  <text
                    x={x0 + anchoCol / 2} y={yTopColumna + 128}
                    textAnchor="middle" fontSize={26} fill="#64748b"
                    fontFamily="system-ui, sans-serif"
                  >
                    {truncate(m.instrumento, 30)}
                  </text>
                </g>
              );
            })()}

            {(() => {
              let yCursor = yTopColumna + offsetMedidaMm;
              return col.asignaciones.map((a) => {
                const altoCelda = a.espaciosX * xMm;
                const y = yCursor;
                yCursor += altoCelda;
                const esReserva = a.esReserva === true;
                const desc = esReserva ? 'Vacancia · sin asignación' : (a.carga.descripcion || a.carga.id);
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
                      fill={esReserva ? '#e2e8f0' : COLOR_GAVETA_BG}
                      stroke={COLOR_GAVETA_BORDE} strokeWidth={2}
                      strokeDasharray={esReserva ? '8 6' : undefined}
                    />
                    <text
                      x={x0 + anchoCol / 2} y={y + 36}
                      textAnchor="middle" fontSize={36} fontWeight={600} fill={COLOR_TEXTO}
                      fontFamily="system-ui, sans-serif"
                    >
                      {esReserva ? `Reserva ${a.espaciosX}X` : `${a.espaciosX}X · ${a.version}`}
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

            {(() => {
              const libreH = col.espaciosLibres * xMm - offsetMedidaMm;
              if (libreH <= 0) return null;
              const yLibreTop = yTopColumna + offsetMedidaMm + col.espaciosUsados * xMm;
              if (col.esIncoming) {
                return (
                  <g>
                    <rect
                      x={x0 + 12} y={yLibreTop}
                      width={anchoCol - 24} height={libreH}
                      fill="#fef3c7" stroke="#b45309" strokeWidth={2}
                    />
                    <text
                      x={x0 + anchoCol / 2} y={yLibreTop + 44}
                      textAnchor="middle" fontSize={36} fontWeight={700} fill={COLOR_TEXTO}
                      fontFamily="system-ui, sans-serif"
                    >
                      Acometida
                    </text>
                    <text
                      x={x0 + anchoCol / 2} y={yLibreTop + 92}
                      textAnchor="middle" fontSize={28} fill="#475569"
                      fontFamily="system-ui, sans-serif"
                    >
                      {tablero.principal
                        ? `INTERRUPTOR GENERAL · ${tablero.principal.frameAF}AF · ${tablero.principal.rating}`
                        : 'Entrada de cables · lugs'}
                    </text>
                    <text
                      x={x0 + anchoCol / 2} y={yLibreTop + 128}
                      textAnchor="middle" fontSize={28} fill="#64748b"
                      fontFamily="system-ui, sans-serif"
                    >
                      {tablero.principal
                        ? `In ${tablero.principal.ratingA} A · SPD`
                        : 'Conexión a barras · SPD'}
                    </text>
                  </g>
                );
              }
              return (
                <g>
                  <rect
                    x={x0 + 12} y={yLibreTop}
                    width={anchoCol - 24} height={libreH}
                    fill="#f8fafc" stroke={COLOR_GAVETA_BORDE} strokeDasharray="6 6" strokeWidth={2}
                  />
                  <text
                    x={x0 + anchoCol / 2}
                    y={yLibreTop + libreH / 2}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={32} fill="#94a3b8"
                    fontFamily="system-ui, sans-serif"
                  >
                    {`Libre · ${col.espaciosLibres - (conMedida ? 2 : 0)}X`}
                  </text>
                </g>
              );
            })()}
          </g>
        );
      })}
    </svg>
  );
});

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
