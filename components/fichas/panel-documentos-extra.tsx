"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, FileText, Loader2, CheckCircle2, AlertCircle, Copy, Check, Sparkles, RefreshCw, Download, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { subirArchivoStorage } from "@/lib/supabase/subir-storage";

type Sugerencias = {
  sintesis_hechos?: string | null;
  pretensiones?: string | null;
  cuantia?: string | null;
  normas?: string | null;
  problema_juridico?: string | null;
  consideraciones?: string | null;
  evaluacion_riesgo?: string | null;
  recomendacion?: string | null;
  pretension?: string | null;
  clase_pretension?: string | null;
  causante_nombre?: string | null;
  causante_cedula?: string | null;
};

// Claves que NO son prosa: no se muestran como tarjetas de "Sugerencias redactadas".
const SUGERENCIAS_NO_PROSA = new Set(["pretension", "clase_pretension", "causante_nombre", "causante_cedula"]);

const LABEL_SUGERENCIA: Record<string, string> = {
  sintesis_hechos:   "Síntesis de hechos (sec. 1)",
  pretensiones:      "Pretensiones (sec. 2)",
  cuantia:           "Cuantía (sec. 3)",
  normas:            "Normas violadas (sec. 4)",
  problema_juridico: "Problema jurídico (sec. 7)",
  consideraciones:   "Consideraciones (sec. 16)",
  evaluacion_riesgo: "Evaluación del riesgo (sec. 17)",
  recomendacion:     "Recomendación (sec. 18)",
};

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

type DocumentoPrevio = {
  id: string;
  tipo: string | null;
  nombre: string;
  created_at: string;
  url: string | null;
};

interface PanelDocumentosExtraProps {
  despacho?: string | null;
  casoId?: string;
  documentos?: DocumentoPrevio[];
  onCamposExtraidos: (campos: CamposExtraidos) => void;
  onSugerencias?: (s: Sugerencias | null) => void;
}

function fmtFechaDoc(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return ""; }
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

export function PanelDocumentosExtra({ onCamposExtraidos, onSugerencias, despacho, casoId, documentos }: PanelDocumentosExtraProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [estado, setEstado] = useState<Estado>("idle");
  const [camposExtraidos, setCamposExtraidos] = useState<CamposExtraidos | null>(null);
  const [sugerencias, setSugerencias] = useState<Sugerencias | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sinTexto, setSinTexto] = useState(false);
  const [escaneado, setEscaneado] = useState(false);

  async function copiarSugerencia(key: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(key);
      setTimeout(() => setCopiado(null), 1800);
    } catch { /* clipboard no disponible */ }
  }

  const agregarArchivos = useCallback((nuevos: FileList | File[]) => {
    const lista = Array.from(nuevos).filter((f) => f.type === "application/pdf");
    setArchivos((prev) => {
      const nombres = new Set(prev.map((f) => f.name));
      const filtrados = lista.filter((f) => !nombres.has(f.name));
      return [...prev, ...filtrados].slice(0, 3);
    });
    setEstado("idle");
    setCamposExtraidos(null);
    setSugerencias(null);
    setSinTexto(false);
    setEscaneado(false);
  }, []);

  function quitarArchivo(nombre: string) {
    setArchivos((prev) => prev.filter((f) => f.name !== nombre));
    setEstado("idle");
    setCamposExtraidos(null);
    setSugerencias(null);
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
        body: JSON.stringify({ paths, despacho: despacho ?? null }),
      });

      const json = await res.json().catch(() => ({ error: `Error del servidor (HTTP ${res.status})` }));
      if (!res.ok) throw new Error(json.error ?? "Error desconocido");

      const campos: CamposExtraidos = json.campos;
      setCamposExtraidos(campos);
      setSugerencias(json.suggestions ?? null);
      onSugerencias?.(json.suggestions ?? null);
      setSinTexto((json.caracteres_extraidos ?? 0) < 200);
      setEscaneado(!!json.escaneado);
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
  const haySugerencias = !!sugerencias && Object.entries(sugerencias).some(([k, v]) => !SUGERENCIAS_NO_PROSA.has(k) && v && String(v).trim());
  // Detección de la clasificación (pretensión + clase) para el aviso del panel.
  const pretensionDetectada = sugerencias?.pretension && String(sugerencias.pretension).trim() ? String(sugerencias.pretension).trim() : null;

  return (
    <div className="hidden lg:block">
      <div className="sticky top-20 space-y-5">

        <div className="bg-card border border-border rounded-xl overflow-hidden card-shadow">

          {/* Encabezado del panel con estado */}
          <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Ingesta y procesamiento</h3>
            {estado === "listo" ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900">
                <CheckCircle2 className="w-3 h-3" /> Procesado
              </span>
            ) : estado === "analizando" ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                <Loader2 className="w-3 h-3 animate-spin" /> Procesando
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                Pendiente
              </span>
            )}
          </div>

          {/* Zona drop */}
          <div
            className={cn(
              "relative m-4 rounded-xl border-2 border-dashed transition-colors cursor-pointer",
              dragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
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
            <div className="flex flex-col items-center gap-2 py-7 px-4 text-center pointer-events-none">
              <Upload className="w-7 h-7 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                Arrastra y suelta o haz clic para cargar archivos
              </p>
              <p className="text-xs text-muted-foreground">
                Traslado, Sentencia, AOE y/o SUB · PDF · hasta 3 archivos
              </p>
            </div>
          </div>

          {/* Lista de archivos */}
          {archivos.length > 0 && (
            <div className="px-3 pb-2 space-y-1.5">
              {archivos.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/40 text-xs"
                >
                  <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
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
                  className="w-full mt-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
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
              <p className="text-[11px] text-muted-foreground leading-snug">
                Los archivos se analizan automáticamente para completar la información del proceso.
              </p>
              <button
                onClick={analizar}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline mt-1"
              >
                <RefreshCw className="w-3 h-3" /> Volver a procesar
              </button>
            </div>
          )}

          {estado === "listo" && escaneado && haySugerencias && (
            <div className="px-3 pb-3">
              <div className="flex items-start gap-2 text-xs text-green-700 dark:text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Documento escaneado leído con IA (visión). La síntesis de hechos se cargó en el paso 2 «Síntesis de los hechos».</span>
              </div>
            </div>
          )}

          {estado === "listo" && camposConValor.length === 0 && !haySugerencias && (
            <div className="px-3 pb-3 space-y-2">
              {sinTexto ? (
                <div className="flex items-start gap-2 text-xs text-orange-600 dark:text-orange-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>No se pudo leer el documento (escaneado ilegible o sin la sección HECHOS). Revisa el archivo o diligencia la síntesis manualmente.</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No se detectaron campos reconocibles en los documentos. Verifica que el traslado incluya las secciones de Pretensiones y Fundamentos, o revisa los datos manualmente.
                </p>
              )}
            </div>
          )}

          {/* Clasificación detectada (pretensión + clase) — alimenta la sugerencia de riesgo (sec. 12) */}
          {estado === "listo" && pretensionDetectada && (
            <div className="px-3 pb-3">
              <div className="flex items-start gap-2 text-xs text-primary/80">
                <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Pretensión detectada: <strong>{pretensionDetectada}</strong>
                  {sugerencias?.clase_pretension ? <> — {String(sugerencias.clase_pretension)}</> : null}.
                  Se cargó en «Información del proceso» (paso 1) y alimenta la sugerencia de riesgo.
                </span>
              </div>
            </div>
          )}

          {/* Sugerencias redactadas — copiar y pegar en las secciones */}
          {estado === "listo" && haySugerencias && (
            <div className="px-3 pb-3 space-y-2 border-t border-border pt-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                Sugerencias redactadas
              </div>
              {Object.entries(sugerencias)
                .filter(([k, v]) => !SUGERENCIAS_NO_PROSA.has(k) && v && String(v).trim())
                .map(([key, texto]) => (
                  <div key={key} className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {LABEL_SUGERENCIA[key] ?? key}
                      </span>
                      <button
                        onClick={() => copiarSugerencia(key, String(texto))}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline shrink-0"
                      >
                        {copiado === key
                          ? <><Check className="w-2.5 h-2.5 text-green-600" /> Copiado</>
                          : <><Copy className="w-2.5 h-2.5" /> Copiar</>}
                      </button>
                    </div>
                    <p className="text-[11px] text-foreground/80 leading-snug line-clamp-4">{String(texto)}</p>
                  </div>
                ))}
              <p className="text-[10px] text-muted-foreground/70 leading-snug">
                Revisa antes de pegar. Generado por IA con base en los documentos; puede contener errores.
              </p>
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

        {/* ── Documentos previos del caso ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden card-shadow">
          <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Documentos previos</h3>
            {documentos && documentos.length > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                {documentos.length}
              </span>
            )}
          </div>
          <div className="p-4 space-y-1">
            {documentos && documentos.length > 0 ? (
              documentos.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{d.nombre}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {d.tipo ? `${d.tipo} · ` : ""}{fmtFechaDoc(d.created_at)}
                    </p>
                  </div>
                  {d.url && (
                    <a href={d.url} target="_blank" rel="noopener noreferrer" title="Descargar"
                       className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))
            ) : (
              <p className="px-2.5 py-4 text-center text-xs text-muted-foreground">
                Sin documentos cargados en el caso.
              </p>
            )}
          </div>
          {casoId && (
            <div className="px-5 py-3 border-t border-border">
              <a href={`/casos/${casoId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                Ver todos los documentos <ChevronRight className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
