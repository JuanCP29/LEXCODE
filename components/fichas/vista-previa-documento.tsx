"use client";

import { useEffect, useState } from "react";
import { Eye, X, Loader2, AlertCircle, Download } from "lucide-react";

interface VistaPreviaDocumentoProps {
  endpoint: string;   // ruta POST que devuelve el PDF
  casoId: string;
  titulo: string;     // p. ej. "Poder de Sustitución"
  filename: string;   // nombre al descargar
}

export function VistaPreviaDocumento({ endpoint, casoId, titulo, filename }: VistaPreviaDocumentoProps) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  // Liberar el object URL al desmontar
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function abrir() {
    setAbierto(true);
    setError(null);
    if (url) return; // ya generado en esta sesión
    setCargando(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caso_id: casoId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "No se pudo generar la vista previa.");
      }
      const blob = await res.blob();
      setUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar la vista previa.");
    } finally {
      setCargando(false);
    }
  }

  function descargar() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        title={`Previsualizar ${titulo}`}
        className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md border border-input text-muted-foreground hover:text-primary hover:border-primary transition-colors"
      >
        <Eye className="w-4 h-4" />
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setAbierto(false)}
        >
          <div
            className="bg-card rounded-xl border border-border shadow-xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Encabezado */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground flex-1 truncate">
                Vista previa — {titulo}
              </h3>
              {url && (
                <button
                  type="button"
                  onClick={descargar}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar
                </button>
              )}
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Documento */}
            <div className="flex-1 bg-muted/20">
              {cargando ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <p className="text-sm">Generando vista previa…</p>
                </div>
              ) : error ? (
                <div className="h-full flex items-center justify-center px-6">
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                </div>
              ) : url ? (
                <iframe src={url} title={`Vista previa ${titulo}`} className="w-full h-full border-0" />
              ) : null}
            </div>

            {/* Pie */}
            <div className="px-5 py-2 border-t border-border bg-muted/20">
              <p className="text-[10px] text-muted-foreground/70">
                Vista previa generada con los datos actuales del caso. Descárgala para guardar la versión final.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
