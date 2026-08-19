"use client";

import { SECCIONES } from "@/lib/ia/secciones";
import { X } from "lucide-react";

interface VistaPreviaFichaProps {
  abierto: boolean;
  onClose: () => void;
  secciones: Record<string, string>;
  encabezado: {
    fecha_diligencia?: string | null;
    radicado_bizagi?: string | null;
    radicado?: string | null;
    nombre_demandante?: string | null;
    causante_afiliado?: string | null;
    demandado?: string | null;
    despacho?: string | null;
    juez?: string | null;
    caducidad?: string | null;
    reconsideracion?: string | null;
  };
}

const DEMANDADO_DEFAULT = "Administradora Colombiana de Pensiones — COLPENSIONES. NIT 900.336.004-7";

function FilaEnc({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <tr>
      <td className="border border-gray-400 bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700 w-1/3 align-top">
        {label}
      </td>
      <td className="border border-gray-400 px-2 py-1 text-[11px] text-gray-900">
        {valor && valor.trim() ? valor : <span className="text-gray-400">—</span>}
      </td>
    </tr>
  );
}

export function VistaPreviaFicha({ abierto, onClose, secciones, encabezado }: VistaPreviaFichaProps) {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superior del modal */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50 shrink-0">
          <p className="text-sm font-semibold text-gray-800">Vista previa — Ficha de Conciliación</p>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Documento */}
        <div className="overflow-y-auto px-8 py-6 bg-white text-gray-900" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
          {/* Encabezado oficial */}
          <div className="text-center mb-4">
            <p className="text-[13px] font-bold uppercase tracking-wide">Ficha de Conciliación Judicial</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Código GDJ-GPO-FMT-005 · Versión 3</p>
          </div>

          <table className="w-full border-collapse mb-6">
            <tbody>
              <FilaEnc label="Fecha de la diligencia" valor={encabezado.fecha_diligencia} />
              <FilaEnc label="Radicado de demanda en Bizagi" valor={encabezado.radicado_bizagi} />
              <FilaEnc label="Radicado del proceso (23 dígitos)" valor={encabezado.radicado} />
              <FilaEnc label="Nombre e identificación demandante" valor={encabezado.nombre_demandante} />
              <FilaEnc label="Nombre e identificación causante y/o afiliado" valor={encabezado.causante_afiliado} />
              <FilaEnc label="Nombre e identificación demandado" valor={encabezado.demandado || DEMANDADO_DEFAULT} />
              <FilaEnc
                label="Autoridad que realiza la citación"
                valor={[encabezado.despacho, encabezado.juez].filter(Boolean).join(" — ")}
              />
              <FilaEnc label="Caducidad" valor={encabezado.caducidad} />
              <FilaEnc label="Reconsideración" valor={encabezado.reconsideracion} />
            </tbody>
          </table>

          {/* 19 secciones */}
          <div className="space-y-4">
            {SECCIONES.map((s) => {
              const contenido = s.textoFijo ?? (secciones[s.key] ?? "");
              return (
                <div key={s.key}>
                  <p className="text-[11px] font-bold text-gray-800 uppercase mb-1">
                    {s.numero}. {s.label}
                  </p>
                  <p className={`text-[11px] leading-relaxed text-gray-800 whitespace-pre-wrap${s.centrado ? " text-center" : ""}`}>
                    {contenido.trim() ? contenido : <span className="text-gray-400 italic">N/A</span>}
                  </p>
                </div>
              );
            })}
          </div>

          <p className="text-[9px] text-gray-400 mt-8 text-center border-t border-gray-200 pt-2">
            Vista previa aproximada. El documento final conserva el formato oficial del template al exportar.
          </p>
        </div>
      </div>
    </div>
  );
}
