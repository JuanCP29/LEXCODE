"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, X, FileSpreadsheet, Loader2,
  CheckCircle2, AlertCircle, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CasoPreview = {
  radicado: string;
  radicado_bizagi: string | null;
  nombre_demandante: string;
  cedula_demandante: string | null;
  despacho: string | null;
  pretension: string | null;
  clase_pretension: string | null;
  jurisdiccion: string | null;
  expediente_pensional: string | null;
};

const PRETENSION_MAP: Record<string, string> = {
  "vejez": "vejez", "pension vejez": "vejez", "pensión de vejez": "vejez",
  "invalidez": "invalidez", "pension invalidez": "invalidez",
  "pensión de invalidez": "invalidez",
  "sobrevivientes": "sobrevivientes", "pension sobrevivientes": "sobrevivientes",
  "indemnizacion sustitutiva": "indemnizacion",
  "indemnización sustitutiva": "indemnizacion", "indemnizacion": "indemnizacion",
  "devolucion de saldos": "devolucion", "devolución de saldos": "devolucion",
  "devolucion": "devolucion",
};

function mapPretension(raw: string): string | null {
  if (!raw || raw === "NULL" || raw === "Por establecer") return null;
  return PRETENSION_MAP[raw.toLowerCase().trim()] ?? null;
}

function mapJurisdiccion(tipo: string): "ordinaria" | "contencioso" | null {
  if (!tipo || tipo === "NULL") return null;
  const l = tipo.toLowerCase();
  if (l.includes("contencioso") || l.includes("nulidad")) return "contencioso";
  return "ordinaria";
}

function str(v: unknown): string | null {
  if (v === null || v === undefined || v === "" || String(v) === "NULL") return null;
  return String(v).trim();
}

function parsearFila(row: Record<string, unknown>): CasoPreview | null {
  const radicado = str(row["DIGITOS_23"]) ?? str(row["ID PROCESO"]);
  const nombre   = str(row["NOMBRE_DEMANDANTE"]);
  if (!radicado || !nombre) return null;

  const municipio    = str(row["MUNICIPIO"])?.replace(/_/g, " ") ?? "";
  const departamento = str(row["DEPARTAMENTO"])?.replace(/_/g, " ") ?? "";
  const despachoBase = str(row["DESPACHOACTUAL"]) ?? str(row["NOMBRE_DESPACHO_INICIAL"]) ?? "";
  const despacho     = [despachoBase, municipio, departamento].filter(Boolean).join(" — ") || null;

  return {
    radicado,
    radicado_bizagi:      str(row["NO_BIZAGI"]),
    nombre_demandante:    nombre,
    cedula_demandante:    str(row["IDENTIFICACION_DEMANDANTE"]),
    expediente_pensional: str(row["NUMERO_RESOLUCION"]),
    despacho,
    pretension:    mapPretension(String(row["PRETENSION_PRINCIPAL"] ?? "")),
    clase_pretension: str(row["CLASE_PRETENSION"]),
    jurisdiccion:  mapJurisdiccion(String(row["TIPO_PROCESO"] ?? "")),
  };
}

const PRETENSION_BADGE: Record<string, string> = {
  vejez:          "bg-blue-100 text-blue-700",
  invalidez:      "bg-purple-100 text-purple-700",
  sobrevivientes: "bg-amber-100 text-amber-700",
  indemnizacion:  "bg-orange-100 text-orange-700",
  devolucion:     "bg-teal-100 text-teal-700",
};

interface ImportarExcelModalProps { onClose: () => void; }
type Paso = "upload" | "preview" | "importando" | "resultado";

export function ImportarExcelModal({ onClose }: ImportarExcelModalProps) {
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging]     = useState(false);
  const [paso, setPaso]             = useState<Paso>("upload");
  const [casos, setCasos]           = useState<CasoPreview[]>([]);
  const [insertados, setInsertados] = useState(0);
  const [error, setError]           = useState<string | null>(null);
  const [cargando, setCargando]     = useState(false);

  const parsearExcel = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError("Solo se aceptan archivos Excel (.xlsx o .xls)");
      return;
    }
    setCargando(true);
    setError(null);
    try {
      // Parsear en el cliente con SheetJS
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb    = XLSX.read(buffer, { type: "array" });
      const ws    = wb.Sheets[wb.SheetNames[0]];
      const rows  = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      const parsed = rows
        .map(parsearFila)
        .filter((c): c is CasoPreview => c !== null);

      if (parsed.length === 0) {
        setError("No se encontraron filas válidas (requiere columnas DIGITOS_23 y NOMBRE_DEMANDANTE).");
        return;
      }

      setCasos(parsed);
      setPaso("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al leer el archivo");
    } finally {
      setCargando(false);
    }
  }, []);

  async function confirmarImportacion() {
    if (casos.length === 0) return;
    setPaso("importando");
    setError(null);
    try {
      const res = await fetch("/api/casos/importar-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ casos }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al importar");
      setInsertados(json.insertados);
      setPaso("resultado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setPaso("preview");
    }
  }

  const preview = casos.slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Importar desde Excel</h2>
              <p className="text-xs text-muted-foreground">Carga masiva de casos — Modelo Reparto</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Paso 1: Upload */}
          {paso === "upload" && (
            <div className="space-y-4">
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl cursor-pointer transition-colors",
                  dragging ? "border-green-500 bg-green-50 dark:bg-green-900/10"
                           : "border-border hover:border-green-400 hover:bg-muted/30"
                )}
                onClick={() => !cargando && fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) parsearExcel(f);
                }}
              >
                <input
                  ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) parsearExcel(f); }}
                />
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  {cargando
                    ? <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
                    : <FileSpreadsheet className="w-10 h-10 text-muted-foreground/40" />
                  }
                  <p className="text-sm font-medium text-foreground">
                    {cargando ? "Leyendo archivo..." : "Arrastra el Excel o haz clic"}
                  </p>
                  <p className="text-xs text-muted-foreground">Formato: Modelo Reparto (.xlsx / .xls)</p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              <div className="bg-muted/40 rounded-lg px-4 py-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Columnas que se importan:</p>
                <p>DIGITOS_23 · NO_BIZAGI · NOMBRE_DEMANDANTE · IDENTIFICACION_DEMANDANTE</p>
                <p>NOMBRE_DESPACHO_INICIAL · MUNICIPIO · DEPARTAMENTO · TIPO_PROCESO</p>
                <p>PRETENSION_PRINCIPAL · CLASE_PRETENSION · NUMERO_RESOLUCION</p>
              </div>
            </div>
          )}

          {/* Paso 2: Preview */}
          {paso === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-foreground">
                  <span className="font-bold text-[#1a4a8a]">{casos.length} casos</span> listos para importar.
                  {casos.length > 10 && ` Mostrando los primeros ${preview.length}.`}
                </p>
                <button
                  onClick={() => { setPaso("upload"); setCasos([]); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cambiar archivo
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Radicado</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Demandante</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Cédula</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Pretensión</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Despacho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((c, i) => (
                      <tr key={i} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                        <td className="px-3 py-2 font-mono text-[10px] text-foreground/70 max-w-[140px] truncate">{c.radicado}</td>
                        <td className="px-3 py-2 font-medium text-foreground max-w-[160px] truncate">{c.nombre_demandante}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.cedula_demandante ?? "—"}</td>
                        <td className="px-3 py-2">
                          {c.pretension ? (
                            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold", PRETENSION_BADGE[c.pretension] ?? "bg-gray-100 text-gray-600")}>
                              {c.pretension}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate">{c.despacho ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {casos.length > 10 && (
                <p className="text-xs text-muted-foreground text-center">
                  ... y {casos.length - 10} casos más que se importarán también.
                </p>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
            </div>
          )}

          {/* Paso 3: Importando */}
          {paso === "importando" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-12 h-12 text-[#1a4a8a] animate-spin" />
              <p className="text-sm font-medium text-foreground">Importando {casos.length} casos...</p>
              <p className="text-xs text-muted-foreground">Esto puede tardar unos segundos.</p>
            </div>
          )}

          {/* Paso 4: Resultado */}
          {paso === "resultado" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{insertados} casos importados</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ya aparecen en la cola con los botones F. Conciliación y Demanda.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0 bg-muted/20">
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {paso === "resultado" ? "Cerrar" : "Cancelar"}
          </button>

          {paso === "preview" && (
            <button
              onClick={confirmarImportacion}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1a4a8a] text-white text-sm font-semibold hover:bg-[#163d73] transition-colors"
            >
              Importar {casos.length} casos <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {paso === "resultado" && (
            <button
              onClick={() => { onClose(); router.refresh(); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1a4a8a] text-white text-sm font-semibold hover:bg-[#163d73] transition-colors"
            >
              Ver cola de casos <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
