"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { subirArchivoStorage } from "@/lib/supabase/subir-storage";

type CamposExtraidos = {
  resolucion_prestacion?: string | null;
  semanas_cotizadas?: number | null;
  tasa_aplicada?: number | null;
  tasa_solicitada?: number | null;
  cuantia_tipo?: "determinada" | "indeterminada" | null;
  cuantia_valor?: number | null;
  hay_fallo?: boolean | null;
  sintesis_fallo?: string | null;
  pretende_intereses?: boolean | null;
  pretende_indexacion?: boolean | null;
};

interface PanelDocumentosExtraProps {
  onCamposExtraidos: (campos: CamposExtraidos) => void;
}

type Estado = "idle" | "analizando" | "listo" | "error";

const LABEL_CAMPO: Record<string, string> = {
  resolucion_prestacion: "N° Resolución",
  semanas_cotizadas:     "Semanas cotizadas",
  tasa_aplicada:         "Tasa aplicada",
  tasa_solicitada:       "Tasa solicitada",
  cuantia_tipo:          "Tipo cuantía",
  cuantia_valor:         "Valor cuantía",
  hay_fallo:             "Fallo 1ª instancia",
  sintesis_fallo:        "Síntesis del fallo",
  pretende_intereses:    "Intereses moratorios",
  pretende_indexacion:   "Indexación",
};

function valorLegible(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Sí" : "No";
  if (typeof val === "number") return val.toLocaleString("es-CO");
  return String(val);
}

export function PanelDocumentosExtra({ onCamposExtraidos }: PanelDocumentosExtraProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [estado, setEstado] = useState<Estado>("idle");
  const [camposExtraidos, setCamposExtraidos] = useState<CamposExtraidos | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const agregarArchivos = useCallback((nuevos: FileList | File[]) => {
    const lista = Array.from(nuevos).filter((f) => f.type === "application/pdf");
    setArchivos((prev) => {
      const nombres = new Set(prev.map((f) => f.name));
      const filtrados = lista.filter((f) => !nombres.has(f.name));
      return [...prev, ...filtrados].slice(0, 3);
    });
    setEstado("idle");
    setCamposExtraidos(null);
  }, []);

  function quitarArchivo(nombre: string) {
    setArchivos((prev) => prev.filter((f) => f.name !== nombre));
    setEstado("idle");
    setCamposExtraidos(null);
  }

  async function analizar() {
    if (archivos.length === 0) return;
    setEstado("analizando");
    setErrorMsg(null);
    setCamposExtraidos(null);

    try {
      // 1. Subir a Storage directo del navegador (sin límite de Vercel)
      const paths = await Promise.all(
        archivos.map(async (f) => {
          const { path } = await subirArchivoStorage(f, "tmp");
          return { path, nombre: f.name };
        })
      );

      // 2. Analizar en el servidor (solo viajan las rutas)
      const res = await fetch("/api/analizar-documentos-extra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });

      const json = await res.json().catch(() => ({ error: `Error del servidor (HTTP ${res.status})` }));
      if (!res.ok) throw new Error(json.error ?? "Error desconocido");

      const campos: CamposExtraidos = json.campos;
      setCamposExtraidos(campos);
      setEstado("listo");

      // Filtrar nulos antes de pasar al formulario
      const camposLimpios = Object.fromEntries(
        Object.entries(campos).filter(([, v]) => v !== null && v !== undefined)
      ) as CamposExtraidos;
      onCamposExtraidos(camposLimpios);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error al analizar");
      setEstado("error");
    }
  }

  const camposConValor = camposExtraidos
    ? Object.entries(camposExtraidos).filter(([, v]) => v !== null && v !== undefined)
    : [];

  return (
    <div className="hidden lg:block">
      <div className="sticky top-20 space-y-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-0.5">
          Prerrellenar desde PDFs
        </p>

        <div className="bg-card border border-border rounded-xl overflow-hidden card-shadow">

          {/* Zona drop */}
          <div
            className={cn(
              "relative m-3 rounded-lg border-2 border-dashed transition-colors cursor-pointer",
              dragging
                ? "border-[#1a4a8a] bg-[#1a4a8a]/5"
                : "border-border hover:border-[#1a4a8a]/50 hover:bg-muted/30"
            )}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              agregarArchivos(e.dataTransfer.files);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="sr-only"
              onChange={(e) => e.target.files && agregarArchivos(e.target.files)}
            />
            <div className="flex flex-col items-center gap-2 py-6 px-4 text-center pointer-events-none">
              <Upload className="w-7 h-7 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                Arrastra o haz clic
              </p>
              <p className="text-xs text-muted-foreground">
                Sentencia, AOE y/o SUB
              </p>
            </div>
          </div>

          {/* Lista de archivos */}
          {archivos.length > 0 && (
            <div className="px-3 pb-2 space-y-1.5">
              {archivos.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/40 text-xs"
                >
                  <FileText className="w-3.5 h-3.5 text-[#1a4a8a] shrink-0" />
                  <span className="flex-1 truncate text-foreground/80">{f.name}</span>
                  <button
                    onClick={() => quitarArchivo(f.name)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Botón analizar */}
              {estado !== "listo" && (
                <button
                  onClick={analizar}
                  disabled={estado === "analizando"}
                  className="w-full mt-1 py-2 rounded-md bg-[#1a4a8a] text-white text-xs font-semibold hover:bg-[#163d73] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {estado === "analizando" ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    "Analizar con IA"
                  )}
                </button>
              )}
            </div>
          )}

          {/* Resultado */}
          {estado === "listo" && camposConValor.length > 0 && (
            <div className="px-3 pb-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {camposConValor.length} campo{camposConValor.length !== 1 ? "s" : ""} detectado{camposConValor.length !== 1 ? "s" : ""}
              </div>
              <div className="space-y-1">
                {camposConValor.map(([key, val]) => (
                  <div key={key} className="flex items-start gap-1.5 text-[11px]">
                    <span className="text-muted-foreground shrink-0 min-w-0 w-[90px] truncate">
                      {LABEL_CAMPO[key] ?? key}
                    </span>
                    <span className="text-foreground font-medium truncate flex-1">
                      {valorLegible(val)}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={analizar}
                className="text-[11px] text-[#1a4a8a] hover:underline mt-1"
              >
                Re-analizar
              </button>
            </div>
          )}

          {estado === "listo" && camposConValor.length === 0 && (
            <div className="px-3 pb-3 text-xs text-muted-foreground">
              No se detectaron campos reconocibles en los documentos.
            </div>
          )}

          {estado === "error" && (
            <div className="px-3 pb-3 flex items-start gap-2 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {errorMsg}
            </div>
          )}

          {/* Nota */}
          <p className="px-3 pb-3 text-[10px] text-muted-foreground/60 leading-snug">
            Solo visible en escritorio. Los datos se revisan antes de guardar.
          </p>
        </div>
      </div>
    </div>
  );
}
