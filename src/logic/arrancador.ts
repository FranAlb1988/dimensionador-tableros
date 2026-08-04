import type { Arrancador, Carga, TamanoGaveta, TipoArranque } from '../types';
import { ARRANQUE_LABEL } from '../types';
import { corrienteNominal } from './corriente';
import { sugerirParejaArrancador, type ParejaArrancador } from './tesys';

/**
 * Tamaño de gaveta que pide el arrancador, por el ancho del contactor.
 *
 * Es una heurística, no catálogo: las gavetas Blokset siguen siendo datos
 * ficticios (gavetas-blokset.json). Al menos ahora arranca de un ancho real
 * en vez de un tamaño inventado por entrada.
 */
function tamanoPorAnchoContactor(anchoMm: number | undefined): TamanoGaveta {
  if (anchoMm == null) return '1/2';
  if (anchoMm <= 45) return '1/4';
  if (anchoMm <= 55) return '1/2';
  if (anchoMm <= 105) return '1';
  if (anchoMm <= 155) return '1+1/2';
  return '2';
}

/** Arma el Arrancador del tablero a partir de la pareja real del catálogo. */
function desdePareja(pareja: ParejaArrancador, tipo: TipoArranque): Arrancador {
  const { contactor, rele } = pareja;
  const avisos: string[] = [];
  if (!rele) {
    avisos.push('Sin relé de sobrecarga en catálogo para esta corriente: verificar '
      + 'protección térmica del motor.');
  } else if (!pareja.acopleDirecto) {
    avisos.push(`El relé ${rele.referencia} no monta directo sobre el contactor `
      + `(catálogo: ${rele.montaDirectoCon ?? 'no declarado'}): requiere kit de montaje separado.`);
  }
  avisos.push('La referencia del contactor se completa con el código de bobina '
    + 'según la tensión de mando.');
  return {
    id: contactor.referencia.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    contactor: contactor.referencia,
    ...(rele ? { releTermico: rele.referencia } : {}),
    tipo,
    potenciaKw400V: contactor.kw400V ?? 0,
    tamanoGaveta: tamanoPorAnchoContactor(contactor.anchoMm),
    notas: avisos.join(' '),
  };
}

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

  // El contactor se elige por corriente en AC-3e, que es lo que declara el
  // catálogo para maniobra de motor. La corriente de placa del usuario manda
  // sobre la calculada, igual que en el resto de la app.
  const corriente = carga.corrienteA ?? corrienteNominal(carga);
  if (!(corriente > 0)) return undefined;

  const tipo: TipoArranque = carga.arranque ?? 'DOL';
  const pareja = sugerirParejaArrancador(corriente);
  if (!pareja) return undefined;

  const dol = desdePareja(pareja, 'DOL');
  if (tipo === 'DOL') return dol;

  // Detalle del equipamiento real que la simplificación DOL-equivalente NO
  // incluye — debe quedar visible para que el conteo de materiales del PDF
  // no se tome como completo.
  const DETALLE_FALTANTE: Record<Exclude<TipoArranque, 'DOL'>, string> = {
    YD: 'El arranque estrella-triángulo real usa 2 contactores de línea/triángulo '
      + '+ 1 contactor de estrella + temporizador, no incluidos en el conteo.',
    suave: 'El partidor suave real (ATS480 o equivalente) no está incluido en el conteo.',
    variador: 'El variador de frecuencia real (ATV o equivalente) no está incluido en el '
      + 'conteo; el cajón puede requerir más espacio y ventilación.',
  };
  const notas = `${dol.notas ?? ''} Modelado como Partida Directa equivalente con tamaño de gaveta elevado por arranque ${ARRANQUE_LABEL[tipo]}. ${DETALLE_FALTANTE[tipo]}`.trim();
  return {
    ...dol,
    tipo,
    tamanoGaveta: subirTamanoGaveta(dol.tamanoGaveta),
    placeholder: true,
    notas,
  };
}
