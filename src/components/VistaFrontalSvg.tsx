import { forwardRef } from 'react';
import type { Tablero } from '../types';
import { fmtMm } from '../util/format';
import { altoUtilColumnaEnX, fmtX, tamanoEnX, tamanoEnXTexto } from '../util/x-blokset';
import { altoDeGaveta } from '../logic/gaveta';

interface Props {
  tablero: Tablero;
}

const ESCALA = 0.25; // mm → px (4 px = 1 mm a 1:4)
const COLOR_ESTRUCTURA = '#475569'; // slate-600
const COLOR_GAVETA_BG = '#f1f5f9'; // slate-100
const COLOR_GAVETA_BORDE = '#94a3b8'; // slate-400
const COLOR_TEXTO = '#0f172a'; // slate-900
const COLOR_RESERVA = '#fde68a'; // amber-200
const COLOR_MEDIDA_BG = '#e0e7ff'; // indigo-100
const COLOR_MEDIDA_BORDE = '#6366f1'; // indigo-500
// El compartimento de medida ocupa 2X (1X = alto de la gaveta tamaño "1").
const MEDIDA_ALTO_MM = 2 * altoDeGaveta('1');

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

  // Columna donde se dibuja el compartimento de medida: la de incoming si
  // existe; en su defecto, la de mayor espacio libre.
  const idxIncoming = columnas.findIndex((c) => c.esIncoming);
  const idxMedida = idxIncoming >= 0
    ? idxIncoming
    : columnas.reduce(
        (best, c, i, arr) => (c.espacioRemanenteMm > (arr[best]?.espacioRemanenteMm ?? -1) ? i : best),
        0,
      );

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
        // El compartimento de medida va arriba (bajo el cabezal), en la columna
        // con más espacio libre. Las gavetas de esa columna bajan ese alto.
        const conMedida = idx === idxMedida && col.espacioRemanenteMm >= MEDIDA_ALTO_MM + 100;
        const offsetMedidaMm = conMedida ? MEDIDA_ALTO_MM : 0;

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

            {/* Compartimento de medida (arriba, bajo el cabezal) */}
            {conMedida && (() => {
              const m = tablero.medida;
              return (
                <g>
                  <rect
                    x={x0 + 10}
                    y={yGavetasTop}
                    width={anchoCol - 20}
                    height={MEDIDA_ALTO_MM}
                    fill={COLOR_MEDIDA_BG}
                    stroke={COLOR_MEDIDA_BORDE}
                    strokeWidth={2}
                  />
                  <text
                    x={x0 + anchoCol / 2}
                    y={yGavetasTop + 44}
                    textAnchor="middle"
                    fontSize={34}
                    fontWeight={700}
                    fill={COLOR_TEXTO}
                    fontFamily="system-ui, sans-serif"
                  >
                    Compartimento de medida · 2X
                  </text>
                  <text
                    x={x0 + anchoCol / 2}
                    y={yGavetasTop + 90}
                    textAnchor="middle"
                    fontSize={28}
                    fill="#475569"
                    fontFamily="system-ui, sans-serif"
                  >
                    {`${m.transformadoresTension} PT · ${m.transformadoresCorriente} CT · ${m.lucesPiloto} luces piloto`}
                  </text>
                  <text
                    x={x0 + anchoCol / 2}
                    y={yGavetasTop + 128}
                    textAnchor="middle"
                    fontSize={26}
                    fill="#64748b"
                    fontFamily="system-ui, sans-serif"
                  >
                    {truncate(m.instrumento, 32)}
                  </text>
                </g>
              );
            })()}

            {/* Gavetas, apiladas desde el tope hacia abajo (bajo la medida si aplica) */}
            {(() => {
              let yCursor = yGavetasTop + offsetMedidaMm;
              return col.gavetas.map((g) => {
                const y = yCursor;
                yCursor += g.altoMm;
                const esReserva = g.esReserva === true;
                return (
                  <g key={g.id}>
                    <rect
                      x={x0 + 10}
                      y={y}
                      width={anchoCol - 20}
                      height={g.altoMm}
                      fill={esReserva ? '#e2e8f0' : COLOR_GAVETA_BG}
                      stroke={COLOR_GAVETA_BORDE}
                      strokeWidth={2}
                      strokeDasharray={esReserva ? '8 6' : undefined}
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
                      {esReserva ? `Reserva ${tamanoEnXTexto(g.tamano)}` : `Gaveta ${tamanoEnXTexto(g.tamano)}`}
                    </text>
                    <text
                      x={x0 + anchoCol / 2}
                      y={y + 70}
                      textAnchor="middle"
                      fontSize={28}
                      fill="#64748b"
                      fontFamily="system-ui, sans-serif"
                    >
                      {esReserva ? 'Vacancia · sin asignación' : truncate(g.contenido, 38)}
                    </text>
                    {!esReserva && g.protecciones[0] && (
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

            {/* Bloque de acometida (incoming) o espacio libre al pie */}
            {(() => {
              const libreH = col.espacioRemanenteMm - offsetMedidaMm;
              if (libreH <= 0) return null;
              const yLibreTop = yZocaloTop - libreH;
              if (col.esIncoming) {
                return (
                  <g>
                    <rect
                      x={x0 + 10} y={yLibreTop}
                      width={anchoCol - 20} height={libreH}
                      fill="#fef3c7" stroke="#b45309" strokeWidth={2}
                    />
                    <text
                      x={x0 + anchoCol / 2} y={yLibreTop + 44}
                      textAnchor="middle" fontSize={34} fontWeight={700}
                      fill={COLOR_TEXTO} fontFamily="system-ui, sans-serif"
                    >
                      Acometida
                    </text>
                    <text
                      x={x0 + anchoCol / 2} y={yLibreTop + 88}
                      textAnchor="middle" fontSize={26} fill="#475569"
                      fontFamily="system-ui, sans-serif"
                    >
                      {tablero.principal
                        ? `INTERRUPTOR GENERAL · ${tablero.principal.referencia}`
                        : 'Entrada de cables · lugs'}
                    </text>
                    <text
                      x={x0 + anchoCol / 2} y={yLibreTop + 122}
                      textAnchor="middle" fontSize={26} fill="#64748b"
                      fontFamily="system-ui, sans-serif"
                    >
                      {tablero.principal
                        ? `In ${tablero.principal.inA} A · Icu ${tablero.principal.icuKA} kA · SPD`
                        : 'Conexión a barras · SPD'}
                    </text>
                  </g>
                );
              }
              return (
                <g>
                  <rect
                    x={x0 + 10}
                    y={yLibreTop}
                    width={anchoCol - 20}
                    height={libreH}
                    fill="#f8fafc"
                    stroke={COLOR_GAVETA_BORDE}
                    strokeDasharray="6 6"
                    strokeWidth={2}
                  />
                  <text
                    x={x0 + anchoCol / 2}
                    y={yLibreTop + libreH / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={32}
                    fill="#94a3b8"
                    fontFamily="system-ui, sans-serif"
                  >
                    {`Libre · ${fmtMm(libreH)} · ${fmtX(Math.max(0, xLibreCol - (conMedida ? 2 : 0)))}`}
                  </text>
                </g>
              );
            })()}

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
              {col.esIncoming
                ? `Col ${idx + 1} · Incoming`
                : `Col ${idx + 1} · ${fmtX(xUsadoCol)} / ${fmtX(xTotalCol)}`}
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
