import { forwardRef } from 'react';
import type { TableroCcmMt } from '../types';
import { ENVOLVENTE_CCM_MT } from '../logic/ccm-mt';

interface Props {
  tablero: TableroCcmMt;
}

/**
 * Vista frontal del CCM MT — celdas estándar de 915 × 2290 mm con los
 * contactores apilados en cada columna (1 o 2 por celda según frame).
 */
export const VistaFrontalCcmMtSvg = forwardRef<SVGSVGElement, Props>(({ tablero }, ref) => {
  const { columnas, anchoTotalMm, altoTotalMm } = tablero;
  const { anchoColumnaMm, espaciosVerticales } = ENVOLVENTE_CCM_MT;
  const margin = 30;
  const totalW = anchoTotalMm + 2 * margin;
  const totalH = altoTotalMm + 2 * margin + 50; // espacio inferior para anotaciones

  const slotH = altoTotalMm / espaciosVerticales;
  const colY = margin;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${totalW} ${totalH}`}
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Vista frontal del CCM MT"
    >
      {columnas.map((col, i) => {
        const x = margin + i * anchoColumnaMm;
        // Ubicar starters de abajo hacia arriba.
        const ordenados = [...col.asignaciones].sort((a, b) => b.espaciosV - a.espaciosV);
        let cursor = 0; // espacios consumidos desde el fondo
        return (
          <g key={col.indice}>
            {/* Celda completa */}
            <rect x={x} y={colY} width={anchoColumnaMm} height={altoTotalMm}
              fill="#f1f5f9" stroke="#475569" strokeWidth={2} />
            {/* Contactores */}
            {ordenados.map((a, j) => {
              const slots = a.espaciosV;
              const slotY = colY + altoTotalMm - (cursor + slots) * slotH;
              cursor += slots;
              return (
                <g key={j}>
                  <rect x={x + 20} y={slotY + 10} width={anchoColumnaMm - 40} height={slots * slotH - 20}
                    fill="#fef3c7" stroke="#92400e" strokeWidth={2} rx={6} />
                  <text x={x + anchoColumnaMm / 2} y={slotY + slots * slotH / 2 - 10}
                    textAnchor="middle" fontSize="40" fontWeight="600" fill="#451a03">
                    {a.contactor.frameA} A
                  </text>
                  <text x={x + anchoColumnaMm / 2} y={slotY + slots * slotH / 2 + 40}
                    textAnchor="middle" fontSize="28" fill="#78350f">
                    {a.carga.descripcion || a.carga.id}
                  </text>
                  <text x={x + anchoColumnaMm / 2} y={slotY + slots * slotH / 2 + 75}
                    textAnchor="middle" fontSize="26" fill="#92400e">
                    {(a.carga.tensionV / 1000).toLocaleString('es-CL', { maximumFractionDigits: 2 })} kV
                  </text>
                </g>
              );
            })}
            {/* Etiqueta de columna */}
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
