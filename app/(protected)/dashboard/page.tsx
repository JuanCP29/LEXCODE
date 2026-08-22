import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  FileText, FolderOpen, Clock, Loader2, CheckCircle2,
  FilePlus, ArrowRight, ListChecks,
} from "lucide-react";

type ClaveEstado = "completado" | "en_proceso" | "pendiente";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function claveEstado(caso: any): ClaveEstado {
  const fichas = Array.isArray(caso.fichas_conciliacion) ? caso.fichas_conciliacion : [];
  if (fichas.some((f: { estado: string }) => f.estado === "listo")) return "completado";
  if (fichas.length > 0) return "en_proceso";
  return "pendiente";
}

async function getData() {
  const supabase = createClient();
  const [{ data: casos }, { count: totalFichas }] = await Promise.all([
    supabase.from("casos").select("fichas_conciliacion(id, estado)"),
    supabase.from("fichas_conciliacion").select("id", { count: "exact", head: true }),
  ]);
  const lista = casos ?? [];
  const counts = { total: lista.length, pendiente: 0, en_proceso: 0, completado: 0 };
  for (const c of lista) counts[claveEstado(c)]++;
  return { counts, totalFichas: totalFichas ?? 0 };
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { counts, totalFichas } = await getData();

  const nombre = user?.email?.split("@")[0] ?? "abogado";
  const hoy = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  const pct = (n: number) => (counts.total ? Math.round((n / counts.total) * 100) : 0);

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Encabezado compacto */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Hola, {nombre.charAt(0).toUpperCase() + nombre.slice(1)}
        </h1>
        <p className="text-sm text-muted-foreground capitalize">{hoy}</p>
      </div>

      {/* KPIs del reparto (clicables) */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Mi actividad</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total de procesos" value={counts.total} icon={FolderOpen} tint="#1f2a3b" href="/casos" />
          <StatCard label="Pendientes" value={counts.pendiente} icon={Clock} tint="#2563eb" sub={`${pct(counts.pendiente)}%`} href="/casos" />
          <StatCard label="En proceso" value={counts.en_proceso} icon={Loader2} tint="#d97706" sub={`${pct(counts.en_proceso)}%`} href="/casos" />
          <StatCard label="Completados" value={counts.completado} icon={CheckCircle2} tint="#16a34a" sub={`${pct(counts.completado)}%`} href="/casos" />
        </div>
      </div>

      {/* Accesos rápidos + resumen documentos */}
      <div className="bg-card rounded-xl border border-border card-shadow p-2">
        <QuickAction href="/casos/nuevo" icon={FilePlus} label="Nuevo caso" desc="Registrar un proceso" />
        <QuickAction href="/casos" icon={FolderOpen} label="Reparto" desc="Ver y gestionar casos" />
        <QuickAction href="/cola-de-casos" icon={ListChecks} label="Asignaciones" desc="Asignar casos al equipo" />
        <QuickAction href="/documentos" icon={FileText} label="Historial" desc={`${totalFichas} documentos generados`} />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tint, sub, href }: {
  label: string; value: number; icon: React.ElementType; tint: string; sub?: string; href: string;
}) {
  return (
    <Link href={href} className="bg-card rounded-xl border border-border card-shadow px-5 py-4 block transition-all hover:card-shadow-md hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-3xl font-bold text-foreground mt-1 tabular-nums">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">{sub} del total</p>}
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${tint}15` }}>
          <Icon className="w-4 h-4" style={{ color: tint }} />
        </div>
      </div>
    </Link>
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
      <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-all shrink-0">
        Abrir <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}
