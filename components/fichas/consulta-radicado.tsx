"use client";

import { useState } from "react";
import { Eye, X, Loader2, AlertCircle, Scale, FileClock, SearchX } from "lucide-react";

type Actuacion = {
  fecha: string | null;
  actuacion: string | null;
  anotacion: string | null;
  fechaRegistro?: string | null;
};

type Proceso = {
  despacho: string | null;
  sujetos: string | null;
  fechaRadicacion: string | null;
  fechaUltimaActuacion: string | null;
};

function fmtFecha(f: string | null | undefined): string {
  if (!f) return "—";
  const d = new Date(f);
  if (Number.isNaN(d.getTime())) return String(f);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

export function ConsultaRadicado({ radicado }: { radicado: string }) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encontrado, setEncontrado] = useState<boolean | null>(null);
  const [actuaciones, setActuaciones] = useState<Actuacion[]>([]);
  const [proceso, setProceso] = useState<Proceso | null>(null);

  const radLimpio = (radicado ?? "").replace(/\D/g, "");

  async function abrir() {
    setAbierto(true);
    setError(null);
    setEncontrado(null);
    setActuaciones([]);
    setProceso(null);
    if (radLimpio.length < 20) {
      setError("Ingresa el radicado completo (23 dígitos) para consultar.");
      return;
    }
    setCargando(true);
    try {
      const res = await fetch(`/api/rama-judicial?radicado=${radLimpio}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo consultar el proceso.");
      setEncontrado(body.encontrado);
      setActuaciones(body.actuaciones ?? []);
      setProceso(body.proceso ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error consultando la Rama Judicial.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        title="Ver últimas actuaciones (Rama Judicial)"
        className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md border border-input text-muted-foreground hover:text-primary hover:border-primary transition-colors"
      >
        <Eye className="w-4 h-4" />
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setAbierto(false)}
        >
          <div
            className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Encabezado */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/30">
              <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Scale className="w-4 h-4 text-primary" />
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Últimas actuaciones del proceso</h3>
                <p className="text-[11px] text-muted-foreground font-mono truncate">{radLimpio || "—"}</p>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cuerpo */}
            <div className="px-5 py-4 overflow-y-auto">
              {cargando ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <p className="text-sm">Consultando la Rama Judicial…</p>
                </div>
              ) : error ? (
                <div className="flex items-start gap-2 text-sm text-destructive py-6">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              ) : encontrado === false ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center text-muted-foreground">
                  <SearchX className="w-8 h-8 opacity-40" />
                  <p className="text-sm font-medium">No se encontró el proceso</p>
                  <p className="text-xs text-muted-foreground/70">
                    Verifica el número de radicación (23 dígitos).
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Datos del proceso */}
                  {proceso && (proceso.despacho || proceso.sujetos) && (
                    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 space-y-1.5">
                      {proceso.despacho && (
                        <div className="text-[11px]">
                          <span className="text-muted-foreground">Despacho: </span>
                          <span className="text-foreground font-medium">{proceso.despacho}</span>
                        </div>
                      )}
                      {proceso.sujetos && (
                        <div className="text-[11px]">
                          <span className="text-muted-foreground">Sujetos: </span>
                          <span className="text-foreground">{proceso.sujetos}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lista de actuaciones */}
                  {actuaciones.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      El proceso no tiene actuaciones registradas.
                    </p>
                  ) : (
                    <ol className="space-y-3">
                      {actuaciones.map((a, i) => (
                        <li key={i} className="relative pl-6">
                          <span className="absolute left-0 top-1 w-3.5 h-3.5 rounded-full bg-primary/15 flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          </span>
                          <div className="flex items-center gap-2 mb-0.5">
                            <FileClock className="w-3 h-3 text-primary shrink-0" />
                            <span className="text-xs font-semibold text-foreground">{fmtFecha(a.fecha)}</span>
                          </div>
                          {a.actuacion && (
                            <p className="text-xs font-medium text-foreground">{a.actuacion}</p>
                          )}
                          {a.anotacion && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{a.anotacion}</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>

            {/* Pie */}
            <div className="px-5 py-2.5 border-t border-border bg-muted/20">
              <p className="text-[10px] text-muted-foreground/70 leading-snug">
                Fuente: Consulta de Procesos Nacional Unificada — Rama Judicial. Información de solo lectura;
                puede diferir del expediente. Se muestran las 3 actuaciones más recientes.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
