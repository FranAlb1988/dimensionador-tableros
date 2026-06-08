import { forwardRef } from 'react';
import type { TableroCcmMt } from '../types';
import { ENVOLVENTE_CCM_MT } from '../logic/ccm-mt';

interface Props {
  tablero: TableroCcmMt;
}

/**
 * Vista frontal del CCM MT — celda de entrada (interruptor general), celda de
 * medida (PT/CT) y las columnas de starters con sus contactores apilados.
 */
export const VistaFrontalCcmMtSvg = forwardRef<SVGSVGElement, Props>(({ tablero }, ref) => {
  const { columnas, altoTotalMm, principal } = tablero;
  const { anchoColumnaMm, espaciosVerticales } = ENVOLVENTE_CCM_MT;
  const margin = 30;
  const totalCols = columnas.length + 2; // entrada + medida + starters
  const totalW = totalCols * anchoColumnaMm + 2 * margin;
  const totalH = altoTotalMm + 2 * margin + 50;

  const slotH = altoTotalMm / espaciosVerticales;
  const colY = margin;

  /** Marco de una celda en la posición de columna `idx` (0-based). */
  const celdaX = (idx: number) => margin + idx * anchoColumnaMm;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${totalW} ${totalH}`}
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Vista frontal del CCM MT"
    >
      {/* Celda de entrada (interruptor general) */}
      <g>
        <rect x={celdaX(0)} y={colY} width={anchoColumnaMm} height={altoTotalMm}
          fill="#e2e8f0" stroke="#475569" strokeWidth={2} />
        <rect x={celdaX(0) + 20} y={colY + altoTotalMm / 2 - slotH / 2} width={anchoColumnaMm - 40} height={slotH - 20}
          fill="#dbeafe" stroke="#1e40af" strokeWidth={2} rx={6} />
        <text x={celdaX(0) + anchoColumnaMm / 2} y={colY + altoTotalMm / 2 - 5}
          textAnchor="middle" fontSize="36" fontWeight="600" fill="#1e3a8a">
          {principal.frameA} A
        </text>
        <text x={celdaX(0) + anchoColumnaMm / 2} y={colY + altoTotalMm / 2 + 35}
          textAnchor="middle" fontSize="26" fill="#1e40af">
          Interruptor
        </text>
        <text x={celdaX(0) + anchoColumnaMm / 2} y={colY + altoTotalMm + 35}
          textAnchor="middle" fontSize="32" fontWeight="600" fill="#334155">
          Entrada
        </text>
      </g>

      {/* Celda de medida (PT/CT) */}
      <g>
        <rect x={celdaX(1)} y={colY} width={anchoColumnaMm} height={altoTotalMm}
          fill="#e2e8f0" stroke="#475569" strokeWidth={2} />
        <rect x={celdaX(1) + 20} y={colY + altoTotalMm / 2 - slotH / 2} width={anchoColumnaMm - 40} height={slotH - 20}
          fill="#ede9fe" stroke="#5b21b6" strokeWidth={2} rx={6} />
        <text x={celdaX(1) + anchoColumnaMm / 2} y={colY + altoTotalMm / 2 + 5}
          textAnchor="middle" fontSize="34" fontWeight="600" fill="#4c1d95">
          PT / CT
        </text>
        <text x={celdaX(1) + anchoColumnaMm / 2} y={colY + altoTotalMm + 35}
          textAnchor="middle" fontSize="32" fontWeight="600" fill="#334155">
          Medida
        </text>
      </g>

      {/* Columnas de starters */}
      {columnas.map((col, i) => {
        const idx = i + 2; // tras entrada + medida
        const x = celdaX(idx);
        const ordenados = [...col.asignaciones].sort((a, b) => b.espaciosV - a.espaciosV);
        let cursor = 0;
        return (
          <g key={col.indice}>
            <rect x={x} y={colY} width={anchoColumnaMm} height={altoTotalMm}
              fill="#f1f5f9" stroke="#475569" strokeWidth={2} />
            {ordenados.map((a, j) => {
              const slots = a.espaciosV;
              const slotY = colY + altoTotalMm - (cursor + slots) * slotH;
              cursor += slots;
              const esReserva = a.esReserva === true;
              return (
                <g key={j}>
                  <rect
                    x={x + 20} y={slotY + 10}
                    width={anchoColumnaMm - 40} height={slots * slotH - 20}
                    fill={esReserva ? '#e2e8f0' : '#fef3c7'}
                    stroke={esReserva ? '#475569' : '#92400e'}
                    strokeWidth={2} rx={6}
                    strokeDasharray={esReserva ? '8 6' : undefined}
                  />
                  <text x={x + anchoColumnaMm / 2} y={slotY + slots * slotH / 2 - 10}
                    textAnchor="middle" fontSize="40" fontWeight="600"
                    fill={esReserva ? '#334155' : '#451a03'}>
                    {esReserva ? `Reserva ${a.contactor.frameA} A` : `${a.contactor.frameA} A`}
                  </text>
                  <text x={x + anchoColumnaMm / 2} y={slotY + slots * slotH / 2 + 40}
                    textAnchor="middle" fontSize="28"
                    fill={esReserva ? '#475569' : '#78350f'}>
                    {esReserva ? 'Vacancia · sin asignación' : (a.carga.descripcion || a.carga.id)}
                  </text>
                  {!esReserva && (
                    <text x={x + anchoColumnaMm / 2} y={slotY + slots * slotH / 2 + 75}
                      textAnchor="middle" fontSize="26" fill="#92400e">
                      {(a.carga.tensionV / 1000).toLocaleString('es-CL', { maximumFractionDigits: 2 })} kV
                    </text>
                  )}
                </g>
              );
            })}
            <text x={x + anchoColumnaMm / 2} y={colY + altoTotalMm + 35}
              textAnchor="middle" fontSize="32" fontWeight="600" fill="#334155">
              Col {col.indice}
            </text>
          </g>
        );
      })}
    </svg>
  );
});

VistaFrontalCcmMtSvg.displayName = 'VistaFrontalCcmMtSvg';
