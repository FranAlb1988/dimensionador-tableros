import { useMemo } from 'react';
import {
  concentracionKgM2, pesoEstimadoTablero, SALA_REFERENCIA, type TipoEquipoSala,
} from '../logic/carga-piso';
import { fmtCantidad, fmtNumero } from '../util/format';

interface Props {
  tipo: TipoEquipoSala;
  anchoTotalMm: number;
  profundidadTotalMm: number;
}

/**
 * Peso estimado del tablero y su carga sobre el piso.
 * Pesos específicos del listado de equipos de la sala 03300-SEL-001.
 */
export function CargaPisoPanel({ tipo, anchoTotalMm, profundidadTotalMm }: Props) {
  const est = useMemo(
    () => pesoEstimadoTablero(tipo, anchoTotalMm, profundidadTotalMm),
    [tipo, anchoTotalMm, profundidadTotalMm],
  );
  if (!est) return null;

  const concentracion = concentracionKgM2(est.pesoKg, anchoTotalMm, profundidadTotalMm)!;

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Peso y carga de piso</h2>
        <p className="text-sm text-slate-500">
          Estimación por peso específico, a partir del listado de equipos de una sala
          eléctrica real ({SALA_REFERENCIA.tag}, {SALA_REFERENCIA.proveedor}).
        </p>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-1 gap-x-4 text-sm">
        <dt className="text-slate-500">Peso estimado</dt>
        <dd className="font-medium tabular-nums">{fmtNumero(Math.round(est.pesoKg))} kg</dd>
        <dt className="text-slate-500">Huella</dt>
        <dd className="font-medium tabular-nums">{fmtCantidad(est.huellaM2, 2)} m²</dd>
        <dt className="text-slate-500">Peso específico usado</dt>
        <dd className="font-medium tabular-nums">
          {fmtNumero(Math.round(est.especificoKgM2))} kg/m²
        </dd>
        <dt className="text-slate-500">Sobre su huella</dt>
        <dd className="font-medium tabular-nums">
          {fmtNumero(Math.round(concentracion))} kgf/m²
        </dd>
      </dl>

      <div className="text-xs text-slate-500 space-y-1">
        <p>
          La sobrecarga de uso del chasis ({SALA_REFERENCIA.sobrecargaUsoDisenoKgM2} kg/m² en
          la sala de referencia) es un <strong>promedio sobre la superficie de la sala</strong>,
          no un límite por huella: esa sala promedia {SALA_REFERENCIA.cargaPromedioKgM2} kgf/m²
          con tableros que sobre su propia huella llegan a 2.300. Comparar una huella contra
          el promedio marcaría en rojo un diseño correcto.
        </p>
        <p>
          Es una estimación para carga de piso e izaje, no un dato de catálogo: dos tableros
          del mismo tipo difieren según cuán cargada esté la columna. Para una orden de compra,
          pedir el peso al fabricante.
        </p>
      </div>
    </div>
  );
}
