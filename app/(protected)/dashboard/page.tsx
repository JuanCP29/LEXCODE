import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  FileText, FolderOpen, TrendingUp, CheckCircle,
  Users, ChevronRight, FilePlus, ArrowRight,
} from "lucide-react";
import { estadoBadgeClases } from "@/lib/ui/estado-badge";
import { formatDate } from "@/lib/utils";
import { CollegiaLogo } from "@/components/ui/collegia-logo";

// ── Queries ───────────────────────────────────────────────────────────────────
async function getDashboardData(userId: string) {
  const supabase = createClient();

  const [casosRes, fichasRes, actividadCasosRes, actividadFichasRes] =
    await Promise.all([
      supabase.from("casos").select("estado", { count: "exact" }).eq("abogado_id", userId),
      supabase.from("fichas_conciliacion").select("estado", { count: "exact" }).eq("creado_por", userId),
      supabase.from("casos")
        .select("id, radicado, nombre_demandante, pretension, estado, created_at")
        .eq("abogado_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("fichas_conciliacion")
        .select("id, caso_id, estado, created_at, casos(radicado, nombre_demandante)")
        .eq("creado_por", userId)
        .order("created_at", { ascending: false })
        .limit(5),
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
    ultimosCasos:  actividadCasosRes.data  ?? [],
    ultimasFichas: actividadFichasRes.data ?? [],
  };
}

type CasoRow  = { id: string; radicado: string; nombre_demandante: string; pretension: string | null; estado: string; created_at: string };
type FichaRow = { id: string; caso_id: string; estado: string; created_at: string; casos: { radicado: string; nombre_demandante: string } | { radicado: string; nombre_demandante: string }[] | null };

// ── Página ────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { stats, ultimosCasos, ultimasFichas } = user
    ? await getDashboardData(user.id)
    : { stats: { totalCasos: 0, casosActivos: 0, totalFichas: 0, fichasListas: 0 }, ultimosCasos: [], ultimasFichas: [] };

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
          <StatCard label="Documentos"    value={stats.totalFichas}  icon={FileText}   color="#1a4a8a" />
          <StatCard label="Casos activos" value={stats.casosActivos} icon={TrendingUp}  color="#059669" />
          <StatCard label="Total casos"   value={stats.totalCasos}   icon={FolderOpen}  color="#7c3aed" />
          <StatCard label="Fichas listas" value={stats.fichasListas} icon={CheckCircle} color="#d97706" />
        </div>
      </div>

      {/* ── Fila principal ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Casos recientes — 3 cols */}
        <div className="lg:col-span-3 bg-card rounded-xl border border-border card-shadow">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Casos recientes</h2>
            <Link href="/casos" className="text-xs text-primary hover:underline flex items-center gap-0.5 font-medium">
              Ver todos <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {ultimosCasos.length === 0 ? (
            <Empty icon={FolderOpen} texto="No hay casos aún" link={{ href: "/casos/nuevo", label: "Crear primer caso" }} />
          ) : (
            <ul className="divide-y divide-border">
              {(ultimosCasos as CasoRow[]).map((c) => (
                <li key={c.id}>
                  <Link href={`/casos/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-primary-subtle flex items-center justify-center shrink-0">
                      <FolderOpen className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {c.nombre_demandante}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{c.radicado}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${estadoBadgeClases(c.estado)}`}>
                        {c.estado}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{formatDate(c.created_at)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Columna derecha — 2 cols */}
        <div className="lg:col-span-2 space-y-4">

          {/* Acciones rápidas */}
          <div className="bg-card rounded-xl border border-border card-shadow p-1">
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

          {/* Fichas recientes */}
          <div className="bg-card rounded-xl border border-border card-shadow">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Fichas recientes</h2>
              <Link href="/documentos" className="text-xs text-primary hover:underline font-medium">
                Ver todas
              </Link>
            </div>
            {ultimasFichas.length === 0 ? (
              <Empty icon={FileText} texto="Sin fichas generadas" />
            ) : (
              <ul className="divide-y divide-border">
                {(ultimasFichas as FichaRow[]).map((f) => {
                  const caso = Array.isArray(f.casos) ? f.casos[0] : f.casos;
                  return (
                    <li key={f.id}>
                      <Link href={`/generador/${f.caso_id}/ficha?ficha_id=${f.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {caso?.nombre_demandante ?? "—"}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(f.created_at)}</p>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${estadoBadgeClases(f.estado)}`}>
                          {f.estado.replace("_", " ")}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
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

function Empty({ icon: Icon, texto, link }: {
  icon: React.ElementType; texto: string; link?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <Icon className="w-7 h-7 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{texto}</p>
      {link && <Link href={link.href} className="text-xs text-primary hover:underline">{link.label}</Link>}
    </div>
  );
}
