import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  FileText, FolderOpen, Clock, Loader2, CheckCircle2,
  ArrowRight, ChevronRight, Activity, Users, CalendarDays,
} from "lucide-react";
import { ROL } from "@/lib/auth/roles";
import { DashboardPropietario } from "@/components/dashboard/dashboard-propietario";
import { DashboardCoordinador } from "@/components/dashboard/dashboard-coordinador";

type ClaveEstado = "completado" | "en_proceso" | "pendiente";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FICHA_FINAL = new Set(["listo", "aprobada", "exportada", "exportado"]);
function claveEstado(caso: any): ClaveEstado {
  const fichas = Array.isArray(caso.fichas_conciliacion) ? caso.fichas_conciliacion : [];
  if (fichas.some((f: { estado: string }) => FICHA_FINAL.has(f.estado))) return "completado";
  if (fichas.length > 0) return "en_proceso";
  return "pendiente";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unoDe(rel: any) {
  return Array.isArray(rel) ? rel[0] : rel;
}

// "Hoy, 10:42 a. m." / "Ayer, 9:31 a. m." / "24 de ago, 12:47 a. m."
function formatEvento(iso: string): string {
  const d = new Date(iso);
  const ahora = new Date();
  const hora = d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", hour12: true });
  const dias = Math.floor((+new Date(ahora.toDateString()) - +new Date(d.toDateString())) / 86_400_000);
  if (dias <= 0) return `Hoy, ${hora}`;
  if (dias === 1) return `Ayer, ${hora}`;
  const dia = d.getDate();
  const mes = d.toLocaleDateString("es-CO", { month: "short" }).replace(".", "");
  return `${dia} de ${mes}, ${hora}`;
}

type Evento = { tipo: "documento" | "caso"; titulo: string; desc: string; fecha: string };

async function getData() {
  const supabase = createClient();
  const ahoraISO = new Date().toISOString();
  const [{ data: casos }, { data: recFichas }, { data: recCasos }, audienciasRes] =
    await Promise.all([
      supabase.from("casos").select("fichas_conciliacion(id, estado)"),
      // Actividad: fichas generadas
      supabase
        .from("fichas_conciliacion")
        .select("id, created_at, casos(nombre_demandante)")
        .order("created_at", { ascending: false })
        .limit(5),
      // Actividad: casos registrados
      supabase
        .from("casos")
        .select("id, nombre_demandante, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      // Audiencias programadas (hoy en adelante) para el visor del dashboard
      supabase
        .from("audiencias_vigilancia")
        .select("id, fecha, tipo, despacho, procesos_vigilados(radicado)", { count: "exact" })
        .gte("fecha", ahoraISO)
        .neq("estado", "cancelada")
        .order("fecha", { ascending: true })
        .limit(4),
    ]);

  const lista = casos ?? [];
  const counts = { total: lista.length, pendiente: 0, en_proceso: 0, completado: 0 };
  for (const c of lista) counts[claveEstado(c)]++;

  const eventos: Evento[] = [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((recFichas ?? []) as any[]).map((f) => ({
      tipo: "documento" as const,
      titulo: "Documento generado",
      desc: `Ficha de conciliación — ${unoDe(f.casos)?.nombre_demandante ?? "Sin demandante"}`,
      fecha: f.created_at as string,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((recCasos ?? []) as any[]).map((c) => ({
      tipo: "caso" as const,
      titulo: "Caso registrado",
      desc: (c.nombre_demandante as string | null) ?? "Sin demandante",
      fecha: c.created_at as string,
    })),
  ]
    .sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha))
    .slice(0, 4);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audiencias: Audiencia[] = ((audienciasRes.data ?? []) as any[]).map((a) => ({
    id: a.id,
    fecha: a.fecha,
    tipo: a.tipo,
    despacho: a.despacho,
    radicado: unoDe(a.procesos_vigilados)?.radicado ?? "",
  }));

  return {
    counts, eventos,
    audiencias, totalAudiencias: audienciasRes.count ?? audiencias.length,
  };
}

type Audiencia = { id: string; fecha: string; tipo: string | null; despacho: string | null; radicado: string };

// Formatea en zona horaria de Colombia (el server puede correr en UTC).
const BOGOTA = "America/Bogota";
function fechaChip(iso: string): { dia: string; mes: string } {
  const d = new Date(iso);
  return {
    dia: d.toLocaleDateString("es-CO", { timeZone: BOGOTA, day: "2-digit" }),
    mes: d.toLocaleDateString("es-CO", { timeZone: BOGOTA, month: "short" }).replace(".", ""),
  };
}
function horaBogota(iso: string): string {
  const d = new Date(iso);
  const h = d.toLocaleTimeString("es-CO", { timeZone: BOGOTA, hour: "numeric", minute: "2-digit", hour12: true });
  const cero = d.toLocaleTimeString("es-CO", { timeZone: BOGOTA, hour: "2-digit", minute: "2-digit", hour12: false });
  return cero === "00:00" ? "" : h;
}
function fmtRadicado(r: string): string {
  return r.length === 23 ? `${r.slice(0, 5)}-${r.slice(5, 7)}-${r.slice(7, 9)}-${r.slice(9, 12)}-${r.slice(12)}` : r;
}

// "NOMBRE APELLIDO" / "nombre apellido" → "Nombre Apellido".
// Si el nombre ya trae mayúsculas y minúsculas mezcladas (p. ej. "FoQs"), se respeta tal cual.
const MIN_SALUDO = new Set(["de", "del", "la", "las", "los", "y", "e", "el", "en", "a"]);
function nombreMostrar(t: string): string {
  const s = t.trim();
  const tieneMin = /[a-zà-ÿ]/.test(s);
  const tieneMay = /[A-ZÀ-Ÿ]/.test(s);
  if (tieneMin && tieneMay) return s; // ya tiene casing intencional
  return s.toLowerCase().split(/\s+/).map((p, i) => (i > 0 && MIN_SALUDO.has(p)) || /\d/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfiles").select("nombre_completo, rol").eq("id", user!.id).single();

  const nombreCompleto = (perfil?.nombre_completo ?? "").trim();
  const nombre = nombreCompleto ? nombreMostrar(nombreCompleto) : (user?.email?.split("@")[0] ?? "abogado");

  // Dashboard por rol
  if (perfil?.rol === ROL.SUPERADMIN) return <DashboardPropietario nombre={nombre} />;
  if (perfil?.rol === ROL.COORDINADOR) return <DashboardCoordinador nombre={nombre} userId={user!.id} />;

  // Sustanciador (y roles restantes): dashboard actual
  const { counts, eventos, audiencias, totalAudiencias } = await getData();
  const hoy = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  const pct = (n: number) => (counts.total ? Math.round((n / counts.total) * 100) : 0);

  return (
    <div className="relative space-y-6 max-w-5xl overflow-x-clip">
      {/* Glow de marca muy tenue (atmósfera, guiño a la antesala) */}
      <div
        className="pointer-events-none absolute -top-20 left-0 w-[26rem] h-[26rem] rounded-full bg-brand/10 blur-3xl -z-10"
        aria-hidden
      />

      {/* Encabezado */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          Hola, {nombre.charAt(0).toUpperCase() + nombre.slice(1)}
        </h1>
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="w-4 h-4 shrink-0" />
          <span className="capitalize">{hoy}</span>
        </p>
      </div>

      {/* KPIs del reparto (clicables) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de procesos" value={counts.total} icon={FolderOpen} tint="#35b9db" href="/casos" />
        <StatCard label="Pendientes" value={counts.pendiente} icon={Clock} tint="#2563eb" sub={`${pct(counts.pendiente)}% del total`} href="/casos" />
        <StatCard label="En proceso" value={counts.en_proceso} icon={Loader2} tint="#d97706" sub={`${pct(counts.en_proceso)}% del total`} href="/casos" />
        <StatCard label="Completados" value={counts.completado} icon={CheckCircle2} tint="#16a34a" sub={`${pct(counts.completado)}% del total`} href="/casos" />
      </div>

      {/* Continuar trabajando + Actividad reciente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* ── Audiencias programadas (visor del calendario) ── */}
        <section className="bg-card rounded-xl border border-border card-shadow-md p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <CalendarDays className="w-5 h-5 text-brand-ink" />
              <h2 className="text-base font-semibold text-foreground">Audiencias programadas</h2>
            </div>
            <Link href="/audiencias" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-brand-ink transition-colors">
              Ver calendario <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-4xl font-bold text-foreground tabular-nums leading-none">{totalAudiencias}</span>
            <span className="text-sm text-muted-foreground">próxima{totalAudiencias !== 1 ? "s" : ""} en el calendario</span>
          </div>

          {audiencias.length ? (
            <ol className="space-y-2">
              {audiencias.map((a) => {
                const chip = fechaChip(a.fecha);
                const hora = horaBogota(a.fecha);
                return (
                  <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-2.5">
                    <span className="flex w-11 h-11 flex-col items-center justify-center rounded-lg bg-brand-subtle text-brand-ink shrink-0 leading-none">
                      <span className="text-base font-bold tabular-nums">{chip.dia}</span>
                      <span className="text-[10px] font-semibold uppercase">{chip.mes}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{a.tipo ?? "Audiencia"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {hora ? `${hora} · ` : ""}{a.despacho ? a.despacho.trim() : fmtRadicado(a.radicado)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-5 text-center">
              <p className="text-sm text-muted-foreground">No hay audiencias programadas.</p>
              <Link href="/vigilancia" className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-brand-ink hover:underline">
                Ir a Vigilancia <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </section>

        {/* ── Actividad reciente ── */}
        <section className="bg-card rounded-xl border border-border card-shadow-md p-5 sm:p-6">
          <SeccionHeader icon={Activity} titulo="Actividad reciente" />

          {eventos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sin actividad reciente.</p>
          ) : (
            <ol className="space-y-1">
              {eventos.map((e, i) => {
                const doc = e.tipo === "documento";
                const Icono = doc ? FileText : Users;
                const ultimo = i === eventos.length - 1;
                return (
                  <li key={i} className="flex gap-3">
                    {/* Rail con punto y línea */}
                    <div className="flex flex-col items-center pt-1.5">
                      <span className={cnDot(doc)} />
                      {!ultimo && <span className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    <div className="flex items-start gap-3 flex-1 min-w-0 pb-4">
                      <span className={doc
                        ? "w-9 h-9 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0"
                        : "w-9 h-9 rounded-lg bg-brand-subtle text-brand-ink flex items-center justify-center shrink-0"}>
                        <Icono className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{e.titulo}</p>
                        <p className="text-xs text-muted-foreground truncate">{e.desc}</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{formatEvento(e.fecha)}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <Link href="/documentos" className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-muted-foreground hover:text-brand-ink transition-colors">
            Ver todo el historial <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </section>
      </div>
    </div>
  );
}

function cnDot(doc: boolean) {
  return doc
    ? "w-2.5 h-2.5 rounded-full bg-green-500 shrink-0"
    : "w-2.5 h-2.5 rounded-full bg-brand shrink-0";
}

function SeccionHeader({ icon: Icon, titulo }: { icon: React.ElementType; titulo: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <Icon className="w-5 h-5 text-brand-ink" />
      <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tint, sub, href }: {
  label: string; value: number; icon: React.ElementType; tint: string; sub?: string; href: string;
}) {
  return (
    <Link href={href} className="bg-card rounded-xl border border-border card-shadow-md px-5 py-5 flex items-center gap-4 transition-all hover:-translate-y-0.5 hover:border-brand/30">
      <span className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: `${tint}1f` }}>
        <Icon className="w-5 h-5" style={{ color: tint }} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{sub}</p>}
      </div>
    </Link>
  );
}
