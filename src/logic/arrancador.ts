import tesysData from '../data/iec/tesys.json';
import type { Arrancador, Carga, TamanoGaveta, TipoArranque } from '../types';
import { ARRANQUE_LABEL } from '../types';

const ARRANCADORES: readonly Arrancador[] = (tesysData.arrancadores as Arrancador[]);

const ESCALA: readonly TamanoGaveta[] = ['1/4', '1/2', '1', '1+1/2', '2'];

function subirTamanoGaveta(t: TamanoGaveta): TamanoGaveta {
  const i = ESCALA.indexOf(t);
  if (i < 0 || i >= ESCALA.length - 1) return t;
  return ESCALA[i + 1]!;
}

/**
 * Sugiere el arrancador TeSys mínimo que cubre la potencia del motor.
 * Para MVP el catálogo solo trae DOL; otros tipos (YD, suave, variador)
 * caen al DOL equivalente con la gaveta subida un tamaño y la nota correspondiente.
 * Devuelve `undefined` si la carga no es motor, no tiene potencia, o no hay match.
 */
export function sugerirArrancador(carga: Carga): Arrancador | undefined {
  if (carga.tipo !== 'motor') return undefined;
  if (typeof carga.potenciaKw !== 'number' || carga.potenciaKw <= 0) return undefined;

  const tipo: TipoArranque = carga.arranque ?? 'DOL';
  const candidatosTipo = ARRANCADORES
    .filter((a) => a.tipo === tipo)
    .toSorted((x, y) => x.potenciaKw400V - y.potenciaKw400V);

  const match = candidatosTipo.find((a) => a.potenciaKw400V >= carga.potenciaKw!);
  if (match) return match;

  if (tipo === 'DOL') return undefined;

  const dol = ARRANCADORES
    .filter((a) => a.tipo === 'DOL')
    .toSorted((x, y) => x.potenciaKw400V - y.potenciaKw400V)
    .find((a) => a.potenciaKw400V >= carga.potenciaKw!);
  if (!dol) return undefined;

  const notas = `${dol.notas ?? ''} Modelado como Partida Directa equivalente con tamaño de gaveta elevado por arranque ${ARRANQUE_LABEL[tipo]}.`.trim();
  return {
    ...dol,
    tipo,
    tamanoGaveta: subirTamanoGaveta(dol.tamanoGaveta),
    placeholder: true,
    notas,
  };
}

export const ARRANCADORES_DISPONIBLES = ARRANCADORES;
