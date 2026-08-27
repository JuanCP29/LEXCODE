"use client";

import { useState, useRef, useMemo } from "react";
import {
  Plus, Trash2, FileText, Upload, Loader2,
  CheckCircle2, AlertCircle, Search, X, Power,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ── Configuración por tipo de documento (color de riel + pill) ──────────
const TIPO_CFG: Record<string, { label: string; color: string; badge: string }> = {
  directriz:   { label: "Directriz",   color: "#6366f1", badge: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900" },
  memorando:   { label: "Memorando",   color: "#f43f5e", badge: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900" },
  lineamiento: { label: "Lineamiento", color: "#10b981", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900" },
  otro:        { label: "Otro",        color: "#64748b", badge: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700" },
};
const TIPO_OPTS = Object.entries(TIPO_CFG).map(([value, c]) => ({ value, label: c.label }));
function tipoCfg(t: string | null | undefined) {
  return TIPO_CFG[t ?? "directriz"] ?? TIPO_CFG.otro;
}

type Directriz = {
  id: string;
  nombre: string;
  tipo_documento?: string | null;
  codigo?: string | null;
  fecha_directriz?: string | null;
  nombre_original: string | null;
  activo: boolean;
  created_at: string;
  // Campos legacy conservados en BD (ya no se editan desde el repositorio)
  pretension?: string;
  clase_pretension?: string | null;
};

interface DirectricesAdminProps {
  directrices: Directriz[];
}

export function DirectricesAdmin({ directrices: inicial }: DirectricesAdminProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [lista, setLista] = useState<Directriz[]>(inicial);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);

  // Form state
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("directriz");
  const [codigo, setCodigo] = useState("");
  const [fechaDocumento, setFechaDocumento] = useState("");

  const conteos = useMemo(() => {
    const c: Record<string, number> = { directriz: 0, memorando: 0, lineamiento: 0, otro: 0 };
    lista.forEach((d) => { const t = d.tipo_documento ?? "directriz"; if (t in c) c[t] += 1; });
    return c;
  }, [lista]);

  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return lista.filter((d) => {
      const t = d.tipo_documento ?? "directriz";
      if (filtroTipo && t !== filtroTipo) return false;
      if (q) {
        return (
          d.nombre?.toLowerCase().includes(q) ||
          d.codigo?.toLowerCase().includes(q) ||
          d.nombre_original?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [lista, filtroTipo, busqueda]);

  function setArchivoYNombre(f: File) {
    setArchivo(f);
    if (!nombre) setNombre(f.name.replace(/\.pdf$/i, "").replace(/_/g, " "));
  }

  async function handleSubir() {
    if (!archivo || !nombre.trim()) return;
    setSubiendo(true);
    setError(null);
    setExito(null);

    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      fd.append("nombre", nombre.trim());
      fd.append("tipo_documento", tipoDocumento);
      // 'pretension' se conserva en BD (columna requerida) pero ya no se
      // clasifica desde el repositorio: los documentos entran como 'general'.
      fd.append("pretension", "general");
      if (codigo.trim()) fd.append("codigo", codigo.trim());
      if (fechaDocumento) fd.append("fecha_directriz", fechaDocumento);

      const res = await fetch("/api/directrices", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al subir");

      setLista((prev) => [json.directriz, ...prev]);
      setExito(`Documento "${nombre}" cargado correctamente.`);
      setArchivo(null);
      setNombre("");
      setCodigo("");
      setFechaDocumento("");
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
      setLista((prev) => prev.map((d) => (d.id === id ? { ...d, activo: !activo } : d)));
    }
  }

  async function handleEliminar(id: string, nombre: string) {
    if (!confirm(`¿Eliminar el documento "${nombre}"? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/directrices/${id}`, { method: "DELETE" });
    if (res.ok) setLista((prev) => prev.filter((d) => d.id !== id));
  }

  const hayFiltro = !!filtroTipo || !!busqueda.trim();

  return (
    <div className="space-y-5">

      {/* ── Barra de acciones ─────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o código…"
            className="w-full rounded-lg border border-input bg-card pl-9 pr-8 py-2 text-sm card-shadow focus:outline-none focus:ring-2 focus:ring-ring/40 transition-shadow"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <Button
          onClick={() => setMostrarForm((v) => !v)}
          variant={mostrarForm ? "outline" : "default"}
          size="sm"
        >
          {mostrarForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {mostrarForm ? "Cerrar" : "Agregar documento"}
        </Button>
      </div>

      {/* ── Formulario de carga (colapsable) ──────────────────── */}
      {mostrarForm && (
        <div className="bg-card border border-border rounded-xl card-shadow overflow-hidden animate-fade-up">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/30">
            <Plus className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Agregar documento</h2>
          </div>
          <div className="px-5 py-5 space-y-4">

            {/* Drop zone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg cursor-pointer transition-colors text-center py-8",
                dragging
                  ? "border-primary bg-primary/5"
                  : archivo
                  ? "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-900/10"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
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
                  <FileText className="w-8 h-8 text-emerald-600" />
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{archivo.name}</p>
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

            {/* Tipo de documento */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Tipo de documento <span className="text-destructive">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {TIPO_OPTS.map((o) => {
                  const activo = tipoDocumento === o.value;
                  const cfg = TIPO_CFG[o.value];
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setTipoDocumento(o.value)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-[0.98]",
                        activo
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background text-muted-foreground border-input hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: activo ? "currentColor" : cfg.color }}
                      />
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nombre */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Nombre del documento <span className="text-destructive">*</span>
              </label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Memorando lineamiento probatorio vejez"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Código + Fecha */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Código <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ej: DIC-013"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Fecha del documento <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <input
                  type="date"
                  value={fechaDocumento}
                  onChange={(e) => setFechaDocumento(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            {/* Feedback */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            {exito && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-md px-3 py-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {exito}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={handleSubir} disabled={!archivo || !nombre.trim() || subiendo}>
                {subiendo ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Procesando PDF…</>
                ) : (
                  <><Upload className="w-4 h-4" /> Subir documento</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                El texto del PDF se extrae y queda disponible para consultas y análisis.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Repositorio (lista) ───────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl card-shadow overflow-hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-3.5 border-b border-border bg-muted/30">
          <h2 className="text-sm font-semibold">
            Documentos registrados
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({listaFiltrada.length}{hayFiltro ? ` de ${lista.length}` : ""})
            </span>
          </h2>
          <div className="flex flex-wrap gap-1.5">
            <FiltroChip label="Todos" activo={filtroTipo === ""} onClick={() => setFiltroTipo("")} count={lista.length} />
            {TIPO_OPTS.map((o) => (
              <FiltroChip
                key={o.value}
                label={o.label}
                color={TIPO_CFG[o.value].color}
                activo={filtroTipo === o.value}
                onClick={() => setFiltroTipo(o.value)}
                count={conteos[o.value] ?? 0}
              />
            ))}
          </div>
        </div>

        {listaFiltrada.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <FileText className="w-10 h-10 opacity-30" />
            <p className="text-sm">
              {lista.length === 0
                ? "No hay documentos en el repositorio aún"
                : "Ningún documento coincide con el filtro"}
            </p>
            {lista.length === 0 && !mostrarForm && (
              <Button size="sm" variant="outline" onClick={() => setMostrarForm(true)}>
                <Plus className="w-4 h-4" /> Agregar el primero
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto animate-fade-up">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted border-b border-border">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Documento</th>
                  <th className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Código</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((d) => {
                  const cfg = tipoCfg(d.tipo_documento);
                  const fecha = d.fecha_directriz ?? d.created_at;
                  return (
                    <tr
                      key={d.id}
                      className={cn(
                        "border-b border-border last:border-0 hover:bg-primary/5 transition-colors",
                        !d.activo && "opacity-55"
                      )}
                    >
                      {/* Documento (ancla) + riel de color por tipo */}
                      <td className="px-4 py-3 border-l-[3px] max-w-[420px]" style={{ borderLeftColor: cfg.color }}>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `${cfg.color}1a` }}
                          >
                            <FileText className="w-4 h-4" style={{ color: cfg.color }} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground leading-tight truncate">{d.nombre}</p>
                            {d.nombre_original && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{d.nombre_original}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Tipo */}
                      <td className="px-3 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap", cfg.badge)}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
                          {cfg.label}
                        </span>
                      </td>
                      {/* Código */}
                      <td className="px-4 py-3">
                        {d.codigo
                          ? <span className="font-mono text-xs text-foreground/70">{d.codigo}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      {/* Fecha */}
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                        {formatDate(fecha)}
                      </td>
                      {/* Estado */}
                      <td className="px-3 py-3">
                        {d.activo ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" /> Inactivo
                          </span>
                        )}
                      </td>
                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => toggleActivo(d.id, d.activo)}
                            title={d.activo ? "Desactivar" : "Activar"}
                            className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                              d.activo
                                ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEliminar(d.id, d.nombre)}
                            title="Eliminar documento"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chip de filtro con contador ──────────────────────────────────────────
function FiltroChip({
  label, activo, onClick, count, color,
}: {
  label: string;
  activo: boolean;
  onClick: () => void;
  count: number;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all active:scale-[0.98]",
        activo
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-background text-muted-foreground border-input hover:border-primary/40 hover:text-foreground"
      )}
    >
      {color && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: activo ? "currentColor" : color }}
        />
      )}
      {label}
      <span className={cn(
        "tabular-nums text-[10px] px-1.5 py-px rounded-full",
        activo ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
      )}>
        {count}
      </span>
    </button>
  );
}
