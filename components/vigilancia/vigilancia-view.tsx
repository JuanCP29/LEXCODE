"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  ScanEye, RefreshCw, Plus, ChevronDown, ChevronRight, Trash2,
  BellDot, CircleAlert, Loader2, CheckCheck, Scale, Upload, FileText, FileSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENT = "#35b9db"; // acento cian de FoQs (mismo del sidebar)

export type ProcesoVigilado = {
  id: string;
  radicado: string;
  despacho: string | null;
  sujetos: string | null;
  ciudad: string | null;
  estado: string;
  ultimo_movimiento: string | null;
  backfill_completo: boolean;
  created_at: string;
  caso_id: string | null;
  novedades: number;
  documento_url: string | null;
  documento_nombre: string | null;
  documento_tipo: string | null;
};

type Actuacion = {
  id: string;
  fecha_rama: string | null;
  actuacion: string | null;
  anotacion: string | null;
  fecha_registro: string | null;
};
type Novedad = { id: string; resumen: string | null; nivel: string; atendida: boolean; created_at: string };

function fmtFecha(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "2-digit" });
}

function fmtRadicado(r: string): string {
  return r.length === 23 ? `${r.slice(0, 5)}-${r.slice(5, 7)}-${r.slice(7, 9)}-${r.slice(9, 12)}-${r.slice(12)}` : r;
}

export function VigilanciaView({ iniciales }: { iniciales: ProcesoVigilado[] }) {
  const [procesos, setProcesos] = useState<ProcesoVigilado[]>(iniciales);
  const [radicado, setRadicado] = useState("");
  const [incluyendo, setIncluyendo] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  async function refetchLista() {
    const r = await fetch("/api/vigilancia/procesos", { cache: "no-store" });
    if (r.ok) setProcesos((await r.json()).procesos ?? []);
  }
  async function refrescar() {
    await refetchLista();
    router.refresh(); // actualiza el conteo del encabezado (render del servidor)
  }

  async function incluir() {
    const rad = radicado.replace(/\D/g, "");
    if (rad.length < 20) {
      setAviso({ tipo: "error", texto: "Ingresa el radicado completo (23 dígitos)." });
      return;
    }
    setIncluyendo(true);
    setAviso(null);
    try {
      const r = await fetch("/api/vigilancia/procesos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ radicado: rad }),
      });
      const d = await r.json();
      if (!r.ok) {
        setAviso({ tipo: "error", texto: d?.error ?? "No se pudo incluir el proceso." });
      } else if (!d.encontrado) {
        setAviso({ tipo: "error", texto: d?.mensaje ?? "La Rama Judicial no devolvió datos." });
        await refrescar();
      } else {
        setAviso({ tipo: "ok", texto: `Proceso incluido · ${d.nuevas} actuación(es) en el historial.` });
        setRadicado("");
        await refrescar();
      }
    } catch {
      setAviso({ tipo: "error", texto: "Error de red al incluir el proceso." });
    } finally {
      setIncluyendo(false);
    }
  }

  // Sincroniza en lotes y AUTO-CONTINÚA hasta agotar la cola (el servidor pausa entre procesos
  // y respeta el rate-limit de la Rama). Muestra el avance para no hacer clic repetidas veces.
  async function sincronizarTodo() {
    setSincronizando(true);
    setAviso(null);
    let totalNov = 0;
    let procesados = 0;
    try {
      for (;;) {
        const r = await fetch("/api/vigilancia/sincronizar", { method: "POST" });
        const d = await r.json();
        if (!r.ok) { setAviso({ tipo: "error", texto: d?.error ?? "No se pudo sincronizar." }); break; }
        totalNov += d.novedades ?? 0;
        procesados += d.sincronizados ?? 0;
        await refetchLista();
        if (d.restantes > 0) {
          setAviso({ tipo: "ok", texto: `Sincronizando… ${procesados} revisados, quedan ${d.restantes}${totalNov > 0 ? ` · ${totalNov} novedad(es)` : ""}.` });
          continue;
        }
        setAviso({ tipo: "ok", texto: totalNov > 0 ? `Listo · ${totalNov} novedad(es) nueva(s) en ${procesados} proceso(s).` : `Listo · sin cambios (${procesados} revisados).` });
        break;
      }
      router.refresh();
    } catch {
      setAviso({ tipo: "error", texto: "Error de red al sincronizar." });
    } finally {
      setSincronizando(false);
    }
  }

  // Carga masiva: lee un Excel/CSV, extrae los radicados (23 díg.) de cualquier columna y los
  // registra. El historial se trae después con "Sincronizar todo".
  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setAviso({ tipo: "error", texto: "Formato admitido: .xlsx, .xls o .csv" });
      return;
    }
    setImportando(true);
    setAviso(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const radicados = new Set<string>();
      const agrega = (v: unknown) => {
        const dig = String(v ?? "").replace(/\D/g, "");
        if (dig.length >= 20 && dig.length <= 23) radicados.add(dig);
      };
      // Preferimos una columna "Radicado"; solo si ninguna hoja la tiene, escaneamos todas las celdas.
      let hallada = false;
      for (const name of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: "" });
        if (!rows.length) continue;
        const key = Object.keys(rows[0]).find((k) => /radicad/i.test(k));
        if (!key) continue;
        hallada = true;
        for (const row of rows) agrega(row[key]);
      }
      if (!hallada) {
        for (const name of wb.SheetNames) {
          const filas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "" });
          for (const fila of filas) for (const celda of fila as unknown[]) agrega(celda);
        }
      }
      if (!radicados.size) {
        setAviso({ tipo: "error", texto: "No se encontraron radicados (23 dígitos) en el archivo." });
        return;
      }
      const res = await fetch("/api/vigilancia/procesos/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ radicados: Array.from(radicados) }),
      });
      const d = await res.json();
      if (!res.ok) { setAviso({ tipo: "error", texto: d?.error ?? "No se pudo importar." }); return; }
      setAviso({
        tipo: "ok",
        texto: `Cargados ${d.insertados} proceso(s)${d.duplicados ? ` · ${d.duplicados} ya estaban` : ""}${d.invalidos ? ` · ${d.invalidos} inválidos` : ""}. Usa “Sincronizar todo” para traer el historial.`,
      });
      await refrescar();
    } catch {
      setAviso({ tipo: "error", texto: "No se pudo leer el archivo." });
    } finally {
      setImportando(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("¿Excluir este proceso de la vigilancia? Se conserva el historial.")) return;
    const r = await fetch(`/api/vigilancia/procesos/${id}`, { method: "DELETE" });
    if (r.ok) {
      setProcesos((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    }
  }

  return (
    <div className="space-y-5">
      {/* Incluir proceso */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Plus className="h-4 w-4 text-primary" />
            Incluir proceso
          </div>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <Input
              value={radicado}
              onChange={(e) => setRadicado(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !incluyendo && incluir()}
              placeholder="Radicado (23 dígitos)"
              inputMode="numeric"
              className="sm:max-w-xs"
            />
            <Button onClick={incluir} disabled={incluyendo}>
              {incluyendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanEye className="h-4 w-4" />}
              {incluyendo ? "Consultando…" : "Vigilar"}
            </Button>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onArchivo} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importando}>
            {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importando ? "Cargando…" : "Carga masiva"}
          </Button>
          <Button variant="outline" onClick={sincronizarTodo} disabled={sincronizando || procesos.length === 0}>
            <RefreshCw className={cn("h-4 w-4", sincronizando && "animate-spin")} />
            {sincronizando ? "Sincronizando…" : "Sincronizar todo"}
          </Button>
        </CardContent>
      </Card>

      {aviso && (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            aviso.tipo === "ok"
              ? "border-primary/30 bg-primary/5 text-foreground"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          )}
        >
          {aviso.texto}
        </div>
      )}

      {/* Lista de procesos */}
      {procesos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <ScanEye className="h-8 w-8 opacity-40" />
            <p className="text-sm">Aún no vigilas ningún proceso. Incluye uno por su radicado para empezar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {procesos.map((p) => (
            <ProcesoCard
              key={p.id}
              proceso={p}
              abierto={expandido === p.id}
              onToggle={() => setExpandido(expandido === p.id ? null : p.id)}
              onExcluir={() => excluir(p.id)}
              onAtendido={() =>
                setProcesos((prev) => prev.map((x) => (x.id === p.id ? { ...x, novedades: 0 } : x)))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { txt: string; cls: string }> = {
    activo: { txt: "Activo", cls: "bg-primary/10 text-primary" },
    privado: { txt: "Proceso privado", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    no_encontrado: { txt: "Sin datos", cls: "bg-muted text-muted-foreground" },
  };
  const it = map[estado] ?? map.no_encontrado;
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", it.cls)}>{it.txt}</span>;
}

function ProcesoCard({
  proceso, abierto, onToggle, onExcluir, onAtendido,
}: {
  proceso: ProcesoVigilado;
  abierto: boolean;
  onToggle: () => void;
  onExcluir: () => void;
  onAtendido: () => void;
}) {
  const [detalle, setDetalle] = useState<{ actuaciones: Actuacion[]; novedades: Novedad[] } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [doc, setDoc] = useState<{ url: string | null; nombre: string | null; tipo: string | null }>({
    url: proceso.documento_url, nombre: proceso.documento_nombre, tipo: proceso.documento_tipo,
  });
  const [buscandoDoc, setBuscandoDoc] = useState(false);

  // Busca el documento de la última actuación en Publicaciones (F2) vía sync individual.
  async function buscarDocumento() {
    setBuscandoDoc(true);
    try {
      const r = await fetch("/api/vigilancia/sincronizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proceso_id: proceso.id }),
      });
      if (r.ok) {
        const lr = await fetch("/api/vigilancia/procesos", { cache: "no-store" });
        if (lr.ok) {
          const p = ((await lr.json()).procesos ?? []).find((x: ProcesoVigilado) => x.id === proceso.id);
          if (p) setDoc({ url: p.documento_url, nombre: p.documento_nombre, tipo: p.documento_tipo });
        }
      }
    } finally {
      setBuscandoDoc(false);
    }
  }

  async function abrir() {
    onToggle();
    if (!detalle && !abierto) {
      setCargando(true);
      const r = await fetch(`/api/vigilancia/procesos/${proceso.id}`, { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setDetalle({ actuaciones: d.actuaciones ?? [], novedades: d.novedades ?? [] });
      }
      setCargando(false);
    }
  }

  async function marcarAtendidas() {
    const r = await fetch(`/api/vigilancia/procesos/${proceso.id}`, { method: "PATCH" });
    if (r.ok) {
      onAtendido();
      setDetalle((prev) => prev ? { ...prev, novedades: prev.novedades.map((n) => ({ ...n, atendida: true })) } : prev);
    }
  }

  return (
    <Card className="overflow-hidden">
      <button
        onClick={abrir}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/50"
      >
        {abierto ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">{fmtRadicado(proceso.radicado)}</span>
            <EstadoBadge estado={proceso.estado} />
            {proceso.caso_id && (
              <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                <Scale className="h-3 w-3" /> Ligado a caso
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {proceso.sujetos ?? proceso.despacho ?? "Sin partes registradas"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {proceso.despacho ? `${proceso.despacho} · ` : ""}Último movimiento: {fmtFecha(proceso.ultimo_movimiento)}
          </p>
        </div>
        {proceso.novedades > 0 && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: ACCENT }}
          >
            <BellDot className="h-3.5 w-3.5" />
            {proceso.novedades}
          </span>
        )}
      </button>

      {abierto && (
        <div className="border-t bg-secondary/30 p-4">
          {cargando ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando historial…
            </div>
          ) : (
            <>
              {/* Documento de la última actuación (F2 Publicaciones) */}
              <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5">
                {doc.url ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{doc.nombre ?? "Ver documento"}</span>
                    {doc.tipo === "estado" && (
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">estado</span>
                    )}
                  </a>
                ) : (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4 shrink-0 opacity-50" /> Sin documento de la última actuación
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={buscarDocumento} disabled={buscandoDoc}>
                  {buscandoDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5" />}
                  {buscandoDoc ? "Buscando…" : doc.url ? "Actualizar" : "Buscar documento"}
                </Button>
              </div>

              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {detalle && detalle.actuaciones.length > 5
                    ? `Últimas 5 actuaciones (de ${detalle.actuaciones.length})`
                    : `Actuaciones${detalle?.actuaciones.length ? ` (${detalle.actuaciones.length})` : ""}`}
                </span>
                <div className="flex gap-2">
                  {proceso.novedades > 0 && (
                    <Button variant="outline" size="sm" onClick={marcarAtendidas}>
                      <CheckCheck className="h-3.5 w-3.5" /> Marcar atendidas
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={onExcluir} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </Button>
                </div>
              </div>

              {!detalle?.actuaciones.length ? (
                <p className="py-2 text-sm text-muted-foreground">Sin actuaciones registradas.</p>
              ) : (
                <ol className="space-y-2">
                  {detalle.actuaciones.slice(0, 5).map((a) => {
                    const esAccion = detalle.novedades.some(
                      (n) => !n.atendida && n.nivel === "accion" && (n.resumen ?? "").includes((a.actuacion ?? "").trim())
                    );
                    return (
                      <li key={a.id} className="rounded-lg border bg-card p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">{fmtFecha(a.fecha_rama)}</span>
                          {esAccion && (
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                              <CircleAlert className="h-3 w-3" /> Acción
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-medium text-foreground">{a.actuacion ?? "Actuación"}</p>
                        {a.anotacion && <p className="mt-0.5 text-sm text-muted-foreground">{a.anotacion}</p>}
                      </li>
                    );
                  })}
                </ol>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
