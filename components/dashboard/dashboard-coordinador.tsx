import { Users, FolderOpen, Undo2, CheckCircle2, FileText, Scale, Shield, BarChart3 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Saludo, StatCard, SeccionCard, BarraDato } from "@/components/dashboard/kit";

const FICHA_FINAL = new Set(["listo", "aprobada", "exportada", "exportado"]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const esFinal = (c: any) => (Array.isArray(c.fichas_conciliacion) ? c.fichas_conciliacion : []).some((f: { estado: string }) => FICHA_FINAL.has(f.estado));
const MIN = new Set(["de", "del", "la", "las", "los", "y", "e", "el", "en", "a"]);
const titulo = (t: string | null) => !t ? "—" : t.toLowerCase().split(/\s+/).map((p, i) => (i > 0 && MIN.has(p)) || /\d/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
const esCoord = (rol: string) => rol === "coordinador" || rol === "admin" || rol === "superadmin";

export async function DashboardCoordinador({ nombre, userId }: { nombre: string; userId: string }) {
  const admin = createAdminClient();

  const { data: yo } = await admin.from("perfiles").select("org_id").eq("id", userId).single();
  const orgId = yo?.org_id as string | undefined;

  const [{ data: equipo }, { data: casos }, { data: fichas }] = await Promise.all([
    orgId ? admin.from("perfiles").select("id, nombre_completo, rol").eq("org_id", orgId) : Promise.resolve({ data: [] }),
    orgId ? admin.from("casos").select("id, nombre_demandante, devolucion_motivo, fichas_conciliacion(estado)").eq("org_id", orgId).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    orgId ? admin.from("fichas_conciliacion").select("id, creado_por, casos!inner(org_id)").eq("casos.org_id", orgId) : Promise.resolve({ data: [] }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lista = (casos ?? []) as any[];
  const totalCasos = lista.length;
  const completados = lista.filter(esFinal).length;
  const devoluciones = lista.filter((c) => c.devolucion_motivo);

  const sustanciadores = (equipo ?? []).filter((u) => !esCoord(u.rol));
  const nombrePorId = new Map<string, string>();
  for (const u of equipo ?? []) nombrePorId.set(u.id, titulo(u.nombre_completo));

  const docsPorAbogado = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const f of (fichas ?? []) as any[]) if (f.creado_por) docsPorAbogado.set(f.creado_por, (docsPorAbogado.get(f.creado_por) ?? 0) + 1);
  const abogadoDocs = Array.from(docsPorAbogado.entries())
    .map(([id, docs]) => ({ id, nombre: nombrePorId.get(id) ?? "Otro", docs }))
    .sort((a, b) => b.docs - a.docs);
  const maxDocs = Math.max(1, ...abogadoDocs.map((a) => a.docs));

  return (
    <div className="relative space-y-6 max-w-5xl overflow-x-clip">
      <div className="pointer-events-none absolute -top-20 left-0 w-[26rem] h-[26rem] rounded-full bg-brand/10 blur-3xl -z-10" aria-hidden />
      <Saludo nombre={nombre} />

      {/* KPIs de la organización */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Abogados sustanciadores" value={sustanciadores.length} icon={Users} tint="#35b9db" href="/equipo" />
        <StatCard label="Total de procesos" value={totalCasos} icon={FolderOpen} tint="#2563eb" href="/casos" />
        <StatCard label="Devoluciones" value={devoluciones.length} icon={Undo2} tint="#d97706" href="/devoluciones" />
        <StatCard label="Completados" value={completados} icon={CheckCircle2} tint="#16a34a" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Equipo */}
        <SeccionCard icon={Users} titulo="Abogados sustanciadores" href="/equipo" hrefLabel="Gestionar">
          {sustanciadores.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Aún no hay sustanciadores. Da de alta a tu equipo en Equipo.</p>
          ) : (
            <ul className="divide-y divide-border">
              {sustanciadores.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-9 h-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0"><Scale className="w-4 h-4" /></span>
                  <p className="text-sm font-semibold text-foreground truncate flex-1">{titulo(u.nombre_completo)}</p>
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{docsPorAbogado.get(u.id) ?? 0} doc{(docsPorAbogado.get(u.id) ?? 0) !== 1 ? "s" : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </SeccionCard>

        {/* Devoluciones */}
        <SeccionCard icon={Undo2} titulo="Devoluciones" href="/devoluciones" hrefLabel="Ver módulo">
          {devoluciones.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No hay casos devueltos pendientes de reasignar. 👌</p>
          ) : (
            <ul className="divide-y divide-border">
              {devoluciones.slice(0, 6).map((c) => (
                <li key={c.id} className="py-2.5">
                  <p className="text-sm font-semibold text-foreground truncate">{titulo(c.nombre_demandante)}</p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 truncate" title={c.devolucion_motivo}>
                    <Undo2 className="w-3 h-3 shrink-0" /> {c.devolucion_motivo}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SeccionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Documentos por abogado */}
        <SeccionCard icon={FileText} titulo="Documentos por abogado">
          {abogadoDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sin documentos generados todavía.</p>
          ) : (
            <div className="space-y-3">
              {abogadoDocs.map((a) => <BarraDato key={a.id} label={a.nombre} valor={a.docs} max={maxDocs} />)}
            </div>
          )}
        </SeccionCard>

        {/* Informes (futuro) */}
        <SeccionCard icon={BarChart3} titulo="Informes">
          <div className="rounded-lg border border-dashed border-border p-5 text-center">
            <BarChart3 className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-medium text-foreground mt-2">Próximamente</p>
            <p className="text-xs text-muted-foreground mt-0.5">Reportes de productividad, tiempos y estados por abogado y por período.</p>
          </div>
        </SeccionCard>
      </div>

      <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5"><Shield className="w-3 h-3" /> Vista limitada a tu organización.</p>
    </div>
  );
}
