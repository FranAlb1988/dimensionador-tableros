import { useMetaStore, type MetadatosProyecto } from '../store/proyecto-meta';

const inputCls =
  'w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded ' +
  'px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 text-sm';

interface Campo {
  key: keyof MetadatosProyecto;
  label: string;
  placeholder?: string;
  ancho?: 'col-span-1' | 'col-span-2' | 'col-span-3';
  tipo?: 'text' | 'date';
}

const CAMPOS: readonly Campo[] = [
  { key: 'nombre',         label: 'Nombre del proyecto',  placeholder: 'Descripción del proyecto',            ancho: 'col-span-3' },
  { key: 'cliente',        label: 'Cliente',              placeholder: 'Nombre del cliente',                   ancho: 'col-span-1' },
  { key: 'planta',         label: 'Planta / Área',        placeholder: 'Planta / Área de proceso',             ancho: 'col-span-2' },
  { key: 'codigoHqr',      label: 'Código de plano interno', placeholder: 'XXXX-PL-000-00000',                 ancho: 'col-span-1' },
  { key: 'codigoCliente',  label: 'Código de plano cliente', placeholder: 'XXXX-PL-E-00000',                   ancho: 'col-span-1' },
  { key: 'revision',       label: 'Revisión',             placeholder: 'B',                                    ancho: 'col-span-1' },
  { key: 'fecha',          label: 'Fecha',                                                                     ancho: 'col-span-1', tipo: 'date' },
  { key: 'proyecto',       label: 'Proyectó',             placeholder: 'Iniciales o nombre',                   ancho: 'col-span-1' },
  { key: 'reviso',         label: 'Revisó',                                                                   ancho: 'col-span-1' },
  { key: 'aprobo',         label: 'Aprobó (interno)',                                                         ancho: 'col-span-1' },
  { key: 'aproboCliente',  label: 'Aprobó cliente',                                                           ancho: 'col-span-1' },
  { key: 'notas',          label: 'Notas',                placeholder: 'Comentarios libres',                   ancho: 'col-span-3' },
];

export function PanelMetadatosProyecto() {
  const metadatos = useMetaStore((s) => s.metadatos);
  const setMetadato = useMetaStore((s) => s.setMetadato);

  return (
    <details className="border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-900/30" open>
      <summary className="cursor-pointer px-4 py-3 font-medium select-none flex items-center justify-between gap-2 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 rounded-t-lg">
        <span>Datos del proyecto</span>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
          Aparecen en el cajetín de los PDFs y se guardan con el proyecto.
        </span>
      </summary>
      <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CAMPOS.map((c) => (
          <label key={c.key} className={`block ${c.ancho ?? 'col-span-1'}`}>
            <span className="text-xs text-slate-600 dark:text-slate-300 mb-1 inline-block">{c.label}</span>
            <input
              className={inputCls}
              type={c.tipo === 'date' ? 'date' : 'text'}
              value={metadatos[c.key]}
              onChange={(e) => setMetadato(c.key, e.target.value)}
              placeholder={c.placeholder}
            />
          </label>
        ))}
      </div>
    </details>
  );
}
