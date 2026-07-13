"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, FileDown, Trash2, RefreshCw, Loader2,
  CheckCircle2, AlertTriangle, Upload, Landmark, FileSearch, Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Documento = {
  id: string;
  tipo_documento: string;
  nombre_archivo: string;
  mime_type: string | null;
  estado_procesamiento: string;
  error_procesamiento: string | null;
  created_at: string;
};

const TIPOS: { value: string; label: string; Icon: React.ElementType; hint: string }[] = [
  { value: "traslado_demanda",    label: "Traslado de la demanda", Icon: FileSearch, hint: "Alimenta secciones 1-4, 7 y 8 de la ficha" },
  { value: "acto_administrativo", label: "Acto administrativo",    Icon: Landmark,   hint: "Resoluciones, certificaciones — se extraen datos estructurados" },
  { value: "historia_laboral",    label: "Historia laboral",       Icon: FileText,   hint: "Se extrae el texto para consulta" },
  { value: "anexo",               label: "Anexo",                  Icon: Paperclip,  hint: "Se almacena sin procesamiento" },
];

const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPOS.map((t) => [t.value, t.label]));

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === "ok")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-400">
        <CheckCircle2 className="w-3 h-3" /> Procesado
      </span>
    );
  if (estado === "error")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-400">
        <AlertTriangle className="w-3 h-3" /> Error
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400">
      <Loader2 className="w-3 h-3 animate-spin" /> Procesando
    </span>
  );
}

export function PanelDocumentosCaso({
  casoId,
  documentos: documentosIniciales,
}: {
  casoId: string;
  documentos: Documento[];
}) {
  const router = useRouter();
  const [documentos, setDocumentos] = useState<Documento[]>(documentosIniciales);
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string>("traslado_demanda");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advertencia, setAdvertencia] = useState<string | null>(null);
  const [reprocesando, setReprocesando] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function recargar() {
    const res = await fetch(`/api/documentos-caso?caso_id=${casoId}`);
    if (res.ok) {
      const { documentos: docs } = await res.json();
      setDocumentos(docs);
    }
    router.refresh();
  }

  async function handleUpload(file: File) {
    setSubiendo(true);
    setError(null);
    setAdvertencia(null);
    try {
      const fd = new FormData();
      fd.append("caso_id", casoId);
      fd.append("tipo_documento", tipoSeleccionado);
      fd.append("archivo", file);

      const res = await fetch("/api/documentos-caso", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al subir el documento");
      if (body.advertencia) setAdvertencia(body.advertencia);
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleReprocesar(docId: string) {
    setReprocesando(docId);
    try {
      await fetch(`/api/documentos-caso/${docId}/reprocesar`, { method: "POST" });
      await recargar();
    } finally {
      setReprocesando(null);
    }
  }

  async function handleEliminar(docId: string) {
    if (!confirm("¿Eliminar este documento?")) return;
    await fetch(`/api/documentos-caso/${docId}`, { method: "DELETE" });
    setDocumentos((prev) => prev.filter((d) => d.id !== docId));
    router.refresh();
  }

  async function handleDescargar(docId: string) {
    const res = await fetch(`/api/documentos-caso/${docId}`);
    if (!res.ok) return;
    const { url } = await res.json();
    window.open(url, "_blank");
  }

  const tipoActual = TIPOS.find((t) => t.value === tipoSeleccionado)!;
  const tieneTraslado = documentos.some(
    (d) => d.tipo_documento === "traslado_demanda" && d.estado_procesamiento === "ok"
  );

  return (
    <div className="bg-[#1a1d27] rounded-xl border border-[#2d3148]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#2d3148]">
        <h2 className="text-sm font-semibold text-white">Documentos fuente</h2>
        {!tieneTraslado && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-400">
            <AlertTriangle className="w-3 h-3" /> Falta traslado de la demanda
          </span>
        )}
      </div>

      {/* Uploader */}
      <div className="px-5 py-4 border-b border-[#2d3148] space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {TIPOS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipoSeleccionado(t.value)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border",
                tipoSeleccionado === t.value
                  ? "bg-[#6b7dff] border-[#6b7dff] text-white"
                  : "bg-transparent border-[#2d3148] text-gray-400 hover:text-white hover:border-[#3a3f5c]"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-gray-500">{tipoActual.hint}</p>

        <input
          ref={inputRef}
          type="file"
          accept={tipoSeleccionado === "anexo" ? undefined : "application/pdf"}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
        <button
          type="button"
          disabled={subiendo}
          onClick={() => inputRef.current?.click()}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-[#3a3f5c] text-gray-300 hover:text-white hover:border-[#6b7dff] transition-colors text-xs font-semibold disabled:opacity-60"
        >
          {subiendo
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Subiendo y procesando...</>
            : <><Upload className="w-3.5 h-3.5" /> Subir {tipoActual.label}{tipoSeleccionado !== "anexo" ? " (PDF)" : ""}</>
          }
        </button>

        {error && (
          <p className="text-[11px] text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">{error}</p>
        )}
        {advertencia && (
          <p className="text-[11px] text-orange-400 bg-orange-950/30 border border-orange-900/50 rounded-md px-3 py-2">{advertencia}</p>
        )}
      </div>

      {/* Lista */}
      {documentos.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <p className="text-sm text-gray-500">Sin documentos fuente cargados</p>
        </div>
      ) : (
        <ul className="divide-y divide-[#2d3148]">
          {documentos.map((d) => (
            <li key={d.id} className="px-5 py-3.5 space-y-1">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{d.nombre_archivo}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {TIPO_LABEL[d.tipo_documento] ?? d.tipo_documento}
                  </p>
                </div>
                <EstadoBadge estado={d.estado_procesamiento} />
                <div className="flex items-center gap-1 shrink-0">
                  {d.estado_procesamiento === "error" && (
                    <button
                      type="button"
                      title="Reintentar extracción"
                      disabled={reprocesando === d.id}
                      onClick={() => handleReprocesar(d.id)}
                      className="p-1.5 rounded-md hover:bg-[#2d3148] text-gray-400 hover:text-white transition-colors"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", reprocesando === d.id && "animate-spin")} />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Descargar"
                    onClick={() => handleDescargar(d.id)}
                    className="p-1.5 rounded-md hover:bg-[#2d3148] text-gray-400 hover:text-white transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Eliminar"
                    onClick={() => handleEliminar(d.id)}
                    className="p-1.5 rounded-md hover:bg-red-950/40 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {d.error_procesamiento && (
                <p className="text-[11px] text-orange-400/80 pl-7">{d.error_procesamiento}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
