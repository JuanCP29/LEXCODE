"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Upload, Loader2, ChevronDown, CheckCircle2, Clock, RefreshCw,
  ListChecks, AlertCircle, UserCheck, Search, X, Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WORKFLOW_ESTADO } from "@/lib/ui/estado-badge";

type CasoCola = {
  id: string;
  radicado: string;
  radicado_bizagi: string | null;
  nombre_demandante: string;
  cedula_demandante: string | null;
  despacho: string | null;
  pretension: string | null;
  cola_estado: "pendiente" | "en_proceso" | "completado";
  cola_lote: string | null;
  asignado_a: string | null;
  devolucion_motivo: string | null;
};

type Resumen = { total: number; completados: number; enProceso: number; pendientes: number; progreso: number };
type Usuario = { id: string; nombre: string; rol: string; esYo: boolean };

// ── Parsing de la base (mismos nombres de columna que la importación Excel) ──
function str(v: unknown): string | null {
  if (v === null || v === undefined || v === "" || String(v) === "NULL") return null;
  return String(v).trim();
}
const PRETENSION_MAP: Record<string, string> = {
  "vejez": "vejez", "pensión de vejez": "vejez", "pension vejez": "vejez",
  "invalidez": "invalidez", "sobrevivientes": "sobrevivientes",
  "indemnización sustitutiva": "indemnizacion", "indemnizacion": "indemnizacion",
  "devolución de saldos": "devolucion", "devolucion": "devolucion",
};
function mapPretension(raw: string): string | null {
  if (!raw || raw === "NULL") return null;
  return PRETENSION_MAP[raw.toLowerCase().trim()] ?? null;
}
function mapJurisdiccion(tipo: string): "ordinaria" | "contencioso" | null {
  if (!tipo || tipo === "NULL") return null;
  return tipo.toLowerCase().includes("contencioso") || tipo.toLowerCase().includes("nulidad") ? "contencioso" : "ordinaria";
}
function parsearFila(row: Record<string, unknown>) {
  const radicado = str(row["DIGITOS_23"]) ?? str(row["ID PROCESO"]) ?? str(row["RADICADO"]);
  const nombre = str(row["NOMBRE_DEMANDANTE"]) ?? str(row["DEMANDANTE"]);
  if (!radicado || !nombre) return null;
  const despachoBase = str(row["DESPACHOACTUAL"]) ?? str(row["NOMBRE_DESPACHO_INICIAL"]) ?? str(row["DESPACHO"]) ?? "";
  const despacho = despachoBase.trim() || null;
  return {
    radicado,
    radicado_bizagi: str(row["NO_BIZAGI"]),
    nombre_demandante: nombre,
    cedula_demandante: str(row["IDENTIFICACION_DEMANDANTE"]) ?? str(row["CEDULA"]),
    expediente_pensional: str(row["NUMERO_RESOLUCION"]),
    despacho,
    pretension: mapPretension(String(row["PRETENSION_PRINCIPAL"] ?? "")),
    clase_pretension: str(row["CLASE_PRETENSION"]),
    jurisdiccion: mapJurisdiccion(String(row["TIPO_PROCESO"] ?? "")),
  };
}

// Acento de color por estado (riel + punto), consistente con Reparto.
const ACENTO: Record<string, string> = {
  pendiente: "#2563eb",  // azul
  en_proceso: "#d97706", // ámbar
  completado: "#16a34a", // verde
};

function EstadoBadge({ estado }: { estado: string }) {
  const est = WORKFLOW_ESTADO[estado] ?? WORKFLOW_ESTADO.pendiente;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap", est.clase)}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACENTO[estado] ?? "#94a3b8" }} />
      {est.label}
    </span>
  );
}

// "NOMBRE APELLIDO" → "Nombre Apellido" (conectores en minúscula)
const MIN_COLA = new Set(["de", "del", "la", "las", "los", "y", "e", "el", "en", "a"]);
function aTitulo(t: string | null | undefined): string {
  if (!t) return "—";
  return t.toLowerCase().split(/\s+/).map((p, i) => (i > 0 && MIN_COLA.has(p)) || /\d/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

export function ColaCasos() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [casos, setCasos] = useState<CasoCola[]>([]);
  const [resumen, setResumen] = useState<Resumen>({ total: 0, completados: 0, enProceso: 0, pendientes: 0, progreso: 0 });
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [scope, setScope] = useState<"mios" | "todos">("todos");
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [asignarA, setAsignarA] = useState("");
  const [asignando, setAsignando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/cola?scope=${scope}`);
      const body = await res.json();
      setCasos(body.casos ?? []);
      if (body.resumen) setResumen(body.resumen);
      if (body.migracion_pendiente) setError("Ejecuta la migración cola_casos_migration.sql en Supabase.");
    } finally {
      setCargando(false);
    }
  }, [scope]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    fetch("/api/usuarios").then((r) => r.json()).then((b) => setUsuarios(b.usuarios ?? [])).catch(() => {});
  }, []);

  async function handleArchivo(file: File) {
    setSubiendo(true);
    setError(null);
    setMsg(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      // raw:false → los números (radicados de 23 dígitos) llegan como texto formateado,
      // evitando la notación científica.
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: false });
      const parsed = rows.map(parsearFila).filter((c): c is NonNullable<typeof c> => c !== null);
      if (parsed.length === 0) {
        setError("No se encontraron casos válidos (revisa que existan columnas de radicado y demandante).");
        return;
      }
      const res = await fetch("/api/cola/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ casos: parsed, lote: file.name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al importar");
      setMsg(`${body.creados} creados, ${body.actualizados} actualizados en la cola.`);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al procesar el archivo");
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  // Filtro por nombre de despacho
  const casosFiltrados = casos.filter((c) =>
    !busqueda.trim() || (c.despacho ?? "").toLowerCase().includes(busqueda.toLowerCase())
  );

  const todosSeleccionados = casosFiltrados.length > 0 && casosFiltrados.every((c) => seleccion.has(c.id));

  function toggleTodos() {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (todosSeleccionados) casosFiltrados.forEach((c) => next.delete(c.id));
      else casosFiltrados.forEach((c) => next.add(c.id));
      return next;
    });
  }
  function toggleUno(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function asignarLote() {
    if (seleccion.size === 0 || !asignarA) return;
    setAsignando(true);
    setError(null);
    setMsg(null);
    try {
      const ids = Array.from(seleccion);
      const res = await fetch("/api/cola/asignar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caso_ids: ids, asignado_a: asignarA }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al asignar");
      setCasos((prev) => prev.map((c) => (seleccion.has(c.id) ? { ...c, asignado_a: asignarA } : c)));
      setMsg(`${ids.length} caso${ids.length !== 1 ? "s" : ""} asignado${ids.length !== 1 ? "s" : ""} a ${nombreUsuario(asignarA)}.`);
      setSeleccion(new Set());
      setAsignarA("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al asignar");
    } finally {
      setAsignando(false);
    }
  }

  // Asignación individual (opción alterna al lote): asigna un solo caso.
  async function asignarUno(casoId: string, userId: string) {
    if (!userId) return;
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/cola/asignar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caso_ids: [casoId], asignado_a: userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al asignar");
      setCasos((prev) => prev.map((c) => (c.id === casoId ? { ...c, asignado_a: userId } : c)));
      setMsg(`Caso asignado a ${nombreUsuario(userId)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al asignar");
    }
  }

  const nombreUsuario = (id: string | null) => {
    if (!id) return "";
    const u = usuarios.find((x) => x.id === id);
    return u ? (u.esYo ? "Yo" : u.nombre) : "";
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header + progreso */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Asignaciones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sube una base (CSV/Excel), asigna casos al equipo y trabaja tu cola.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleArchivo(f); }}
        />
        <button
          type="button"
          disabled={subiendo}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {subiendo ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</> : <><Upload className="w-4 h-4" /> Subir CSV / Excel</>}
        </button>
      </div>

      {/* Barra de progreso */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {resumen.completados} de {resumen.total} casos completados
          </span>
          <span className="text-sm font-bold text-foreground">{resumen.progreso}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${resumen.progreso}%` }} />
        </div>
        <div className="flex gap-4 mt-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3 text-amber-500" /> {resumen.pendientes} pendientes</span>
          <span className="inline-flex items-center gap-1"><RefreshCw className="w-3 h-3 text-blue-500" /> {resumen.enProceso} en proceso</span>
          <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> {resumen.completados} completados</span>
        </div>
      </div>

      {(msg || error) && (
        <div className={cn("rounded-lg px-4 py-2.5 text-sm flex items-center gap-2",
          error ? "bg-destructive/10 border border-destructive/30 text-destructive" : "bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/20 dark:text-green-400")}>
          {error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {error ?? msg}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20 flex-wrap">
          <div className="flex items-center gap-1">
            {(["todos", "mios"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  scope === s ? "bg-card border border-border text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {s === "mios" ? "Mis casos" : "Todos (empresa)"}
              </button>
            ))}
          </div>

          {/* Búsqueda por despacho */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por despacho…"
              className="w-full rounded-md border border-input bg-background pl-8 pr-8 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {busqueda && (
              <button type="button" onClick={() => setBusqueda("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {casosFiltrados.length} de {casos.length}
          </span>
        </div>

        {/* Barra de asignación masiva */}
        {seleccion.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-primary/5 flex-wrap">
            <span className="text-xs font-semibold text-foreground">
              {seleccion.size} seleccionado{seleccion.size !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <select
                value={asignarA}
                onChange={(e) => setAsignarA(e.target.value)}
                className="text-xs rounded-md border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Asignar a…</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.esYo ? "Yo" : u.nombre}{u.rol ? ` · ${u.rol}` : ""}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={asignarLote}
                disabled={!asignarA || asignando}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {asignando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                Asignar
              </button>
              <button type="button" onClick={() => setSeleccion(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground">
                Limpiar
              </button>
            </div>
          </div>
        )}

        {cargando ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando cola...
          </div>
        ) : casos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <ListChecks className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">La cola está vacía</p>
            <p className="text-xs text-muted-foreground/60">Sube una base CSV/Excel para empezar</p>
          </div>
        ) : casosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Search className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">Ningún despacho coincide con “{busqueda}”</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-360px)] min-h-[200px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted [&>th]:bg-muted">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={todosSeleccionados} onChange={toggleTodos}
                      title={`Seleccionar ${busqueda ? "filtrados" : "todos"}`}
                      className="w-4 h-4 rounded border-input accent-[color:var(--primary)] cursor-pointer align-middle" />
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Demandante</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Radicado</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Despacho</th>
                  <th className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Asignado</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Acción</th>
                </tr>
              </thead>
              <tbody>
                {casosFiltrados.map((c) => (
                  <tr key={c.id}
                    className={cn("border-b border-border last:border-0 transition-colors",
                      seleccion.has(c.id) ? "bg-primary/5" : "hover:bg-muted/30")}
                  >
                    {/* Selección + riel de color por estado */}
                    <td className="px-4 py-3 border-l-[3px]" style={{ borderLeftColor: ACENTO[c.cola_estado] ?? "#94a3b8" }}>
                      <input type="checkbox" checked={seleccion.has(c.id)} onChange={() => toggleUno(c.id)}
                        className="w-4 h-4 rounded border-input accent-[color:var(--primary)] cursor-pointer align-middle" />
                    </td>
                    {/* Demandante (ancla) */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground text-sm leading-tight">{aTitulo(c.nombre_demandante)}</p>
                      {c.cedula_demandante && (
                        <p className="text-xs text-muted-foreground tabular-nums mt-0.5">C.C. {c.cedula_demandante}</p>
                      )}
                      {c.devolucion_motivo && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1 max-w-[240px] truncate" title={c.devolucion_motivo}>
                          <Undo2 className="w-3 h-3 shrink-0" /> Devuelto: {c.devolucion_motivo}
                        </p>
                      )}
                    </td>
                    {/* Radicado + bizagi */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-foreground/70 tabular-nums">{c.radicado}</span>
                      {c.radicado_bizagi && (
                        <p className="font-mono text-[10px] text-muted-foreground mt-0.5 tabular-nums">{c.radicado_bizagi}</p>
                      )}
                    </td>
                    {/* Despacho */}
                    <td className="px-4 py-3 text-sm text-muted-foreground min-w-[220px]">{c.despacho ? aTitulo(c.despacho) : "—"}</td>
                    {/* Estado */}
                    <td className="px-3 py-3"><EstadoBadge estado={c.cola_estado} /></td>
                    {/* Asignado */}
                    <td className="px-4 py-3">
                      {c.asignado_a ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground max-w-[140px] truncate">
                          <UserCheck className="w-3 h-3 shrink-0" /> {nombreUsuario(c.asignado_a)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/50 italic">Sin asignar</span>
                      )}
                    </td>
                    {/* Acción — asignación individual (alterna al lote) */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex justify-end">
                        <div className="relative">
                          <UserCheck className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <select
                            value=""
                            onChange={(e) => { if (e.target.value) asignarUno(c.id, e.target.value); }}
                            aria-label="Asignar caso"
                            className="appearance-none text-xs font-semibold rounded-md border border-primary text-primary bg-card pl-7 pr-6 py-1.5 cursor-pointer hover:bg-primary/5 focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                          >
                            <option value="">Asignar</option>
                            {usuarios.map((u) => (
                              <option key={u.id} value={u.id}>{u.esYo ? "Yo" : u.nombre}{u.rol ? ` · ${u.rol}` : ""}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/70" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
