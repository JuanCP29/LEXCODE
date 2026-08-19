"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, Loader2, Play, CheckCircle2, Clock, RefreshCw,
  ListChecks, AlertCircle, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WORKFLOW_ESTADO } from "@/lib/ui/estado-badge";

type CasoCola = {
  id: string;
  radicado: string;
  nombre_demandante: string;
  cedula_demandante: string | null;
  despacho: string | null;
  pretension: string | null;
  cola_estado: "pendiente" | "en_proceso" | "completado";
  cola_lote: string | null;
  asignado_a: string | null;
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

function EstadoBadge({ estado }: { estado: string }) {
  const iconos: Record<string, React.ElementType> = {
    pendiente:  Clock,
    en_proceso: RefreshCw,
    completado: CheckCircle2,
  };
  const est = WORKFLOW_ESTADO[estado] ?? WORKFLOW_ESTADO.pendiente;
  const Icon = iconos[estado] ?? Clock;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", est.clase)}>
      <Icon className="w-2.5 h-2.5" /> {est.label}
    </span>
  );
}

export function ColaCasos() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [casos, setCasos] = useState<CasoCola[]>([]);
  const [resumen, setResumen] = useState<Resumen>({ total: 0, completados: 0, enProceso: 0, pendientes: 0, progreso: 0 });
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [scope, setScope] = useState<"mios" | "todos">("mios");
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function asignar(casoId: string, usuarioId: string) {
    await fetch(`/api/cola/${casoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asignado_a: usuarioId || null }),
    });
    setCasos((prev) => prev.map((c) => (c.id === casoId ? { ...c, asignado_a: usuarioId || null } : c)));
  }

  async function iniciar(caso: CasoCola) {
    await fetch(`/api/cola/${caso.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cola_estado: "en_proceso" }),
    });
    router.push(`/generador/${caso.id}/params`);
  }

  const nombreUsuario = (id: string | null) => {
    if (!id) return "";
    const u = usuarios.find((x) => x.id === id);
    return u ? (u.esYo ? "Yo" : u.nombre) : "";
  };

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header + progreso */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Cola de casos</h1>
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
        <div className="flex items-center gap-1 px-4 py-3 border-b border-border bg-muted/20">
          {(["mios", "todos"] as const).map((s) => (
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
        ) : (
          <div className="divide-y divide-border">
            {casos.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{c.nombre_demandante}</p>
                  <p className="text-[11px] font-mono text-muted-foreground truncate">
                    {c.radicado}{c.despacho ? ` · ${c.despacho}` : ""}
                  </p>
                </div>
                <EstadoBadge estado={c.cola_estado} />
                {scope === "todos" && (
                  <select
                    value={c.asignado_a ?? ""}
                    onChange={(e) => asignar(c.id, e.target.value)}
                    className="text-[11px] rounded-md border border-input bg-background px-1.5 py-1 max-w-[130px] focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Asignar a…</option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id}>{u.esYo ? "Yo" : u.nombre}</option>
                    ))}
                  </select>
                )}
                {scope === "mios" && c.asignado_a && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <UserCheck className="w-3 h-3" /> {nombreUsuario(c.asignado_a)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => iniciar(c)}
                  disabled={c.cola_estado === "completado"}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-primary text-primary text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <Play className="w-3 h-3" /> {c.cola_estado === "completado" ? "Hecho" : "Iniciar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
