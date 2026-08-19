import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  FileText, FolderOpen, TrendingUp, CheckCircle,
  FilePlus, ArrowRight,
} from "lucide-react";
import { CollegiaLogo } from "@/components/ui/collegia-logo";

// ── Queries ───────────────────────────────────────────────────────────────────
async function getDashboardData(userId: string) {
  const supabase = createClient();

  const [casosRes, fichasRes] =
    await Promise.all([
      supabase.from("casos").select("estado", { count: "exact" }).eq("abogado_id", userId),
      supabase.from("fichas_conciliacion").select("estado", { count: "exact" }).eq("creado_por", userId),
    ]);

  const casos  = casosRes.data  ?? [];
  const fichas = fichasRes.data ?? [];

  return {
    stats: {
      totalCasos:   casosRes.count  ?? 0,
      casosActivos: casos.filter((c) => c.estado === "activo").length,
      totalFichas:  fichasRes.count ?? 0,
      fichasListas: fichas.filter((f) => f.estado === "listo").length,
    },
  };
}

// ── Página ────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { stats } = user
    ? await getDashboardData(user.id)
    : { stats: { totalCasos: 0, casosActivos: 0, totalFichas: 0, fichasListas: 0 } };

  const nombre = user?.email?.split("@")[0] ?? "abogado";

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── Encabezado ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Bienvenido, {nombre.charAt(0).toUpperCase() + nombre.slice(1)}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Actividad de Collegia Abogados y tu actividad personal.
          </p>
        </div>
        {/* Logo Collegia */}
        <div className="hidden sm:flex items-center gap-3 px-4 py-2.5 bg-card rounded-xl border border-border card-shadow">
          <CollegiaLogo size="sm" />
        </div>
      </div>

      {/* ── Sección empresa ──────────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Mi actividad
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Documentos"    value={stats.totalFichas}  icon={FileText}   color="#71717a" />
          <StatCard label="Casos activos" value={stats.casosActivos} icon={TrendingUp}  color="#059669" />
          <StatCard label="Total casos"   value={stats.totalCasos}   icon={FolderOpen}  color="#7c3aed" />
          <StatCard label="Fichas listas" value={stats.fichasListas} icon={CheckCircle} color="#d97706" />
        </div>
      </div>

      {/* ── Accesos rápidos ──────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border card-shadow p-1 max-w-md">
        <QuickAction
          href="/casos/nuevo"
          icon={FilePlus}
          label="Nueva pretensión"
          desc="Registrar un nuevo caso"
        />
        <QuickAction
          href="/documentos"
          icon={FileText}
          label="Historial"
          desc="Ver todos los documentos generados"
        />
        <QuickAction
          href="/casos"
          icon={FolderOpen}
          label="Cola de casos"
          desc="Gestionar casos activos"
        />
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border card-shadow px-5 py-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold text-foreground mt-1 tabular-nums">{value}</p>
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}15` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, desc }: {
  href: string; icon: React.ElementType; label: string; desc: string;
}) {
  return (
    <Link href={href}
      className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors group">
      <div className="w-9 h-9 rounded-lg bg-primary-subtle flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{desc}</p>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors shrink-0">
        Abrir <ArrowRight className="w-3.5 h-3.5" />
      </div>
    </Link>
  );
}
