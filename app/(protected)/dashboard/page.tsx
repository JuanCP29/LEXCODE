import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  FileText, FolderOpen, Clock, Loader2, CheckCircle2,
  FilePlus, ArrowRight, ChevronRight, Activity, Users, CalendarDays,
} from "lucide-react";

type ClaveEstado = "completado" | "en_proceso" | "pendiente";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FICHA_FINAL = new Set(["listo", "aprobada", "exportada", "exportado"]);
function claveEstado(caso: any): ClaveEstado {
  const fichas = Array.isArray(caso.fichas_conciliacion) ? caso.fichas_conciliacion : [];
  if (fichas.some((f: { estado: string }) => FICHA_FINAL.has(f.estado))) return "completado";
  if (fichas.length > 0) return "en_proceso";
  return "pendiente";
}

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  listo: "Listo",
  en_proceso: "En proceso",
};

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
  const [{ data: casos }, { count: totalFichas }, { data: draft }, { data: recFichas }, { data: recCasos }] =
    await Promise.all([
      supabase.from("casos").select("fichas_conciliacion(id, estado)"),
      supabase.from("fichas_conciliacion").select("id", { count: "exact", head: true }),
      // Último borrador/en revisión para "Continuar trabajando"
      supabase
        .from("fichas_conciliacion")
        .select("id, estado, created_at, caso_id, casos(nombre_demandante, radicado)")
        .neq("estado", "listo")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
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

  return { counts, totalFichas: totalFichas ?? 0, draft, eventos };
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
  const { data: perfil } = await supabase.from("perfiles").select("nombre_completo").eq("id", user!.id).single();
  const { counts, totalFichas, draft, eventos } = await getData();

  const nombreCompleto = (perfil?.nombre_completo ?? "").trim();
  const nombre = nombreCompleto ? nombreMostrar(nombreCompleto) : (user?.email?.split("@")[0] ?? "abogado");
  const hoy = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  const pct = (n: number) => (counts.total ? Math.round((n / counts.total) * 100) : 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const draftAny = draft as any;
  const draftNombre = draftAny ? (unoDe(draftAny.casos)?.nombre_demandante ?? "Ficha sin demandante") : null;
  const draftRadicado = draftAny ? (unoDe(draftAny.casos)?.radicado ?? null) : null;

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

        {/* ── Continuar trabajando ── */}
        <section className="bg-card rounded-xl border border-border card-shadow-md p-5 sm:p-6">
          <SeccionHeader icon={FileText} titulo="Continuar trabajando" />

          {draftAny ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="w-10 h-10 rounded-lg bg-brand-subtle text-brand-ink flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{draftNombre}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    Ficha de conciliación{draftRadicado ? ` · ${draftRadicado}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-brand-subtle text-brand-ink border border-brand/20">
                  {ESTADO_LABEL[draftAny.estado] ?? draftAny.estado}
                </span>
                <Link
                  href={`/generador/${draftAny.caso_id}/params`}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all"
                >
                  Continuar <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-5 text-center">
              <p className="text-sm text-muted-foreground">No tienes borradores en curso.</p>
              <Link href="/casos/nuevo" className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-brand-ink hover:underline">
                Registrar un caso <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Accesos rápidos */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Acciones rápidas</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <AccesoMini href="/casos/nuevo" icon={FilePlus} label="Nuevo caso" />
              <AccesoMini href="/casos" icon={FolderOpen} label="Reparto" />
              <AccesoMini href="/documentos" icon={FileText} label="Historial" />
            </div>
          </div>
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

      <p className="text-[11px] text-muted-foreground/70">{totalFichas} documentos generados en total.</p>
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

function AccesoMini({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 transition-all hover:border-brand/30 hover:-translate-y-0.5 group">
      <span className="w-7 h-7 rounded-lg bg-brand-subtle text-brand-ink flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </span>
      <span className="text-sm font-medium text-foreground whitespace-nowrap">{label}</span>
      <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-brand-ink group-hover:translate-x-0.5 transition-all shrink-0" />
    </Link>
  );
}
