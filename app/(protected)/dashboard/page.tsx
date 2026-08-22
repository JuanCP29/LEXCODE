import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { limpiarDespacho } from "@/lib/utils";
import {
  FileText, FolderOpen, Clock, Loader2, CheckCircle2,
  FilePlus, ArrowRight, Building2, ListChecks,
} from "lucide-react";

type ClaveEstado = "completado" | "en_proceso" | "pendiente";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function claveEstado(caso: any): ClaveEstado {
  const fichas = Array.isArray(caso.fichas_conciliacion) ? caso.fichas_conciliacion : [];
  if (fichas.some((f: { estado: string }) => f.estado === "listo")) return "completado";
  if (fichas.length > 0) return "en_proceso";
  return "pendiente";
}

// ── Queries (nivel firma: todos los casos de Collegia) ──────────────────────────
async function getData() {
  const supabase = createClient();
  const [{ data: casos }, { count: totalFichas }] = await Promise.all([
    supabase.from("casos").select("despacho, created_at, fichas_conciliacion(id, estado)").order("created_at", { ascending: false }),
    supabase.from("fichas_conciliacion").select("id", { count: "exact", head: true }),
  ]);

  const lista = casos ?? [];
  const counts = { total: lista.length, pendiente: 0, en_proceso: 0, completado: 0 };
  const despachos = new Map<string, number>();
  for (const c of lista) {
    counts[claveEstado(c)]++;
    const d = limpiarDespacho(c.despacho) || "Sin despacho";
    despachos.set(d, (despachos.get(d) ?? 0) + 1);
  }
  const topDespachos = Array.from(despachos.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return { counts, topDespachos, totalFichas: totalFichas ?? 0 };
}

// ── Página ──────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { counts, topDespachos, totalFichas } = await getData();

  const nombre = user?.email?.split("@")[0] ?? "abogado";
  const hoy = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const pct = (n: number) => (counts.total ? Math.round((n / counts.total) * 100) : 0);
  const maxDesp = Math.max(1, ...topDespachos.map(([, n]) => n));

  return (
    <div className="space-y-6 max-w-[1400px]">

      {/* ── Encabezado ── */}
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Hola, {nombre.charAt(0).toUpperCase() + nombre.slice(1)}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 capitalize">{hoy}</p>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de procesos" value={counts.total} icon={FolderOpen} tint="#1f2a3b" href="/casos" />
        <StatCard label="Pendientes" value={counts.pendiente} icon={Clock} tint="#2563eb" sub={`${pct(counts.pendiente)}% del total`} href="/casos" />
        <StatCard label="En proceso" value={counts.en_proceso} icon={Loader2} tint="#d97706" sub={`${pct(counts.en_proceso)}% del total`} href="/casos" />
        <StatCard label="Completados" value={counts.completado} icon={CheckCircle2} tint="#16a34a" sub={`${pct(counts.completado)}% del total`} href="/casos" />
      </div>

      {/* ── Progreso + Accesos rápidos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Progreso del reparto */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border card-shadow p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Progreso del reparto</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Distribución de los {counts.total} procesos por estado</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-foreground tabular-nums leading-none">{pct(counts.completado)}%</p>
              <p className="text-[11px] text-muted-foreground mt-1">completado</p>
            </div>
          </div>

          {/* Barra apilada */}
          <div className="mt-5 flex h-3 w-full overflow-hidden rounded-full bg-muted">
            <div style={{ width: `${pct(counts.completado)}%`, background: "#16a34a" }} />
            <div style={{ width: `${pct(counts.en_proceso)}%`, background: "#d97706" }} />
            <div style={{ width: `${pct(counts.pendiente)}%`, background: "#2563eb" }} />
          </div>

          {/* Leyenda */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Leyenda color="#16a34a" label="Completados" value={counts.completado} />
            <Leyenda color="#d97706" label="En proceso" value={counts.en_proceso} />
            <Leyenda color="#2563eb" label="Pendientes" value={counts.pendiente} />
          </div>

          <div className="mt-5 pt-4 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="w-3.5 h-3.5" />
            <span><strong className="text-foreground tabular-nums">{totalFichas}</strong> fichas de conciliación generadas en total</span>
          </div>
        </div>

        {/* Accesos rápidos */}
        <div className="bg-card rounded-xl border border-border card-shadow p-2">
          <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Accesos rápidos</p>
          <QuickAction href="/casos/nuevo" icon={FilePlus} label="Nuevo caso" desc="Registrar un proceso" />
          <QuickAction href="/casos" icon={FolderOpen} label="Reparto" desc="Ver y gestionar casos" />
          <QuickAction href="/cola-de-casos" icon={ListChecks} label="Asignaciones" desc="Asignar casos al equipo" />
          <QuickAction href="/documentos" icon={FileText} label="Historial" desc="Documentos generados" />
        </div>
      </div>

      {/* ── Top despachos ── */}
      <div className="bg-card rounded-xl border border-border card-shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Despachos con más procesos</h2>
        </div>
        {topDespachos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay procesos registrados.</p>
        ) : (
          <div className="space-y-3">
            {topDespachos.map(([nombre, n]) => (
              <div key={nombre} className="flex items-center gap-3">
                <span className="text-xs text-foreground/80 w-64 shrink-0 truncate" title={nombre}>{nombre}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(n / maxDesp) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-foreground tabular-nums w-8 text-right">{n}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-componentes ─────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, tint, sub, href }: {
  label: string; value: number; icon: React.ElementType; tint: string; sub?: string; href: string;
}) {
  return (
    <Link href={href} className="bg-card rounded-xl border border-border card-shadow px-5 py-4 transition-all hover:card-shadow-md hover:-translate-y-0.5 block">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-3xl font-bold text-foreground mt-1 tabular-nums">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">{sub}</p>}
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${tint}15` }}>
          <Icon className="w-4 h-4" style={{ color: tint }} />
        </div>
      </div>
    </Link>
  );
}

function Leyenda({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground tabular-nums leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, desc }: {
  href: string; icon: React.ElementType; label: string; desc: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors group">
      <div className="w-9 h-9 rounded-lg bg-primary-subtle flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
    </Link>
  );
}
