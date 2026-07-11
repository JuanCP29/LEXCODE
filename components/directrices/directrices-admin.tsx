"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, FileText, Upload, Loader2,
  CheckCircle2, AlertCircle, ToggleLeft, ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRETENSION_OPTS = [
  { value: "vejez",          label: "Vejez" },
  { value: "invalidez",      label: "Invalidez" },
  { value: "sobrevivientes", label: "Sobrevivientes" },
  { value: "indemnizacion",  label: "Indemnización sustitutiva" },
  { value: "devolucion",     label: "Devolución de saldos" },
  { value: "general",        label: "General (todas las pretensiones)" },
];

const PRETENSION_BADGE: Record<string, string> = {
  vejez:          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  invalidez:      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  sobrevivientes: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  indemnizacion:  "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  devolucion:     "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  general:        "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

type Directriz = {
  id: string;
  nombre: string;
  pretension: string;
  clase_pretension: string | null;
  nombre_original: string | null;
  activo: boolean;
  created_at: string;
};

interface DirectricesAdminProps {
  directrices: Directriz[];
}

export function DirectricesAdmin({ directrices: inicial }: DirectricesAdminProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lista, setLista] = useState<Directriz[]>(inicial);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Form state
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");
  const [pretension, setPretension] = useState("vejez");
  const [clase, setClase] = useState("");

  function setArchivoYNombre(f: File) {
    setArchivo(f);
    if (!nombre) setNombre(f.name.replace(/\.pdf$/i, "").replace(/_/g, " "));
  }

  async function handleSubir() {
    if (!archivo || !nombre.trim() || !pretension) return;
    setSubiendo(true);
    setError(null);
    setExito(null);

    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      fd.append("nombre", nombre.trim());
      fd.append("pretension", pretension);
      if (clase.trim()) fd.append("clase_pretension", clase.trim());

      const res = await fetch("/api/directrices", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al subir");

      setLista((prev) => [json.directriz, ...prev]);
      setExito(`Directriz "${nombre}" cargada correctamente.`);
      setArchivo(null);
      setNombre("");
      setClase("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setSubiendo(false);
    }
  }

  async function toggleActivo(id: string, activo: boolean) {
    const res = await fetch(`/api/directrices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !activo }),
    });
    if (res.ok) {
      setLista((prev) =>
        prev.map((d) => (d.id === id ? { ...d, activo: !activo } : d))
      );
    }
  }

  async function handleEliminar(id: string, nombre: string) {
    if (!confirm(`¿Eliminar la directriz "${nombre}"? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/directrices/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLista((prev) => prev.filter((d) => d.id !== id));
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Formulario de carga ───────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl card-shadow overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/30">
          <Plus className="w-4 h-4 text-[#1a4a8a]" />
          <h2 className="text-sm font-semibold">Agregar nueva directriz</h2>
        </div>
        <div className="px-5 py-5 space-y-4">

          {/* Drop zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg cursor-pointer transition-colors text-center py-8",
              dragging
                ? "border-[#1a4a8a] bg-[#1a4a8a]/5"
                : archivo
                ? "border-green-400 bg-green-50 dark:bg-green-900/10"
                : "border-border hover:border-[#1a4a8a]/50 hover:bg-muted/30"
            )}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f?.type === "application/pdf") setArchivoYNombre(f);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setArchivoYNombre(f);
              }}
            />
            {archivo ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="w-8 h-8 text-green-600" />
                <p className="text-sm font-medium text-green-700 dark:text-green-400">{archivo.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(archivo.size / 1024).toFixed(0)} KB · Haz clic para cambiar
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">Arrastra el PDF o haz clic</p>
                <p className="text-xs text-muted-foreground">Solo archivos PDF</p>
              </div>
            )}
          </div>

          {/* Campos de texto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Nombre de la directriz <span className="text-destructive">*</span>
              </label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Directriz Vejez Régimen de Prima Media"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Pretensión <span className="text-destructive">*</span>
              </label>
              <select
                value={pretension}
                onChange={(e) => setPretension(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {PRETENSION_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Clase de pretensión{" "}
              <span className="text-muted-foreground font-normal">(opcional — deja vacío si aplica a toda la pretensión)</span>
            </label>
            <input
              value={clase}
              onChange={(e) => setClase(e.target.value)}
              placeholder="Ej: Régimen de Prima Media con Prestación Definida"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Feedback */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          {exito && (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {exito}
            </div>
          )}

          <button
            onClick={handleSubir}
            disabled={!archivo || !nombre.trim() || subiendo}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1a4a8a] text-white text-sm font-semibold hover:bg-[#163d73] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {subiendo ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Procesando PDF...</>
            ) : (
              <><Upload className="w-4 h-4" /> Subir directriz</>
            )}
          </button>
          <p className="text-xs text-muted-foreground mt-1">
            El texto del PDF se extrae automáticamente para ser usado en la generación de fichas.
          </p>
        </div>
      </div>

      {/* ── Lista de directrices ──────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl card-shadow overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
          <h2 className="text-sm font-semibold">
            Directrices registradas
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({lista.length})
            </span>
          </h2>
        </div>

        {lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <FileText className="w-10 h-10 opacity-30" />
            <p className="text-sm">No hay directrices cargadas aún</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {lista.map((d) => (
              <div key={d.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-lg bg-[#1a4a8a]/10 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-[#1a4a8a]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{d.nombre}</p>
                    <span className={cn("text-[11px] px-2 py-0.5 rounded font-semibold", PRETENSION_BADGE[d.pretension] ?? "bg-gray-100 text-gray-600")}>
                      {PRETENSION_OPTS.find((o) => o.value === d.pretension)?.label ?? d.pretension}
                    </span>
                    {d.clase_pretension && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {d.clase_pretension}
                      </span>
                    )}
                    {!d.activo && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        Inactiva
                      </span>
                    )}
                  </div>
                  {d.nombre_original && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{d.nombre_original}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActivo(d.id, d.activo)}
                    title={d.activo ? "Desactivar" : "Activar"}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {d.activo
                      ? <ToggleRight className="w-5 h-5 text-green-600" />
                      : <ToggleLeft className="w-5 h-5" />
                    }
                  </button>
                  <button
                    onClick={() => handleEliminar(d.id, d.nombre)}
                    title="Eliminar directriz"
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
