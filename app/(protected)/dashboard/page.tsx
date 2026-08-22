import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FileText, FolderOpen, FilePlus, ListChecks } from "lucide-react";

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
    <div className="space-y-5 max-w-3xl">

      {/* Encabezado compacto */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Hola, {nombre.charAt(0).toUpperCase() + nombre.slice(1)}
        </h1>
        <p className="text-sm text-muted-foreground capitalize">{hoy}</p>
      </div>

      {/* Resumen condensado: KPIs inline + barra de progreso */}
      <div className="bg-card rounded-xl border border-border card-shadow p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
          <Stat label="Total" value={counts.total} />
          <Stat label="Pendientes" value={counts.pendiente} dot="#2563eb" />
          <Stat label="En proceso" value={counts.en_proceso} dot="#d97706" />
          <Stat label="Completados" value={counts.completado} dot="#16a34a" />
        </div>

        <div className="mt-5 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div style={{ width: `${pct(counts.completado)}%`, background: "#16a34a" }} />
          <div style={{ width: `${pct(counts.en_proceso)}%`, background: "#d97706" }} />
          <div style={{ width: `${pct(counts.pendiente)}%`, background: "#2563eb" }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
          <span><strong className="text-foreground">{pct(counts.completado)}%</strong> completado</span>
          <span>{totalFichas} fichas generadas</span>
        </div>
      </div>

      {/* Accesos rápidos como chips */}
      <div className="flex flex-wrap gap-2">
        <Chip href="/casos/nuevo" icon={FilePlus} label="Nuevo caso" />
        <Chip href="/casos" icon={FolderOpen} label="Reparto" />
        <Chip href="/cola-de-casos" icon={ListChecks} label="Asignaciones" />
        <Chip href="/documentos" icon={FileText} label="Historial" />
      </div>
    </div>
  );
}

function Stat({ label, value, dot }: { label: string; value: number; dot?: string }) {
  return (
    <div className="px-4 first:pl-0">
      <p className="text-2xl font-bold text-foreground tabular-nums leading-none">{value}</p>
      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
        {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />}
        {label}
      </p>
    </div>
  );
}

function Chip({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 h-10 px-3.5 rounded-lg border border-border bg-card card-shadow text-sm font-medium text-foreground hover:bg-muted active:scale-[0.98] transition-all"
    >
      <Icon className="w-4 h-4 text-primary" />
      {label}
    </Link>
  );
}
