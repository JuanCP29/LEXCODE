import Link from "next/link";
import { Building2, Scale, FileText, BookMarked, Inbox, Users, ArrowRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Saludo, StatCard, SeccionCard, BarraDato } from "@/components/dashboard/kit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unoDe = (r: any) => (Array.isArray(r) ? r[0] : r);

export async function DashboardPropietario({ nombre }: { nombre: string }) {
  const admin = createAdminClient();

  const [{ data: orgs }, { data: perfiles }, { data: fichas }, { count: totalDirectrices }] =
    await Promise.all([
      admin.from("organizaciones").select("id, nombre").order("creado_at", { ascending: true }),
      admin.from("perfiles").select("id, org_id, rol"),
      admin.from("fichas_conciliacion").select("id, casos(org_id)"),
      admin.from("directrices_conciliacion").select("id", { count: "exact", head: true }),
    ]);

  // Conteos de plataforma (equipos de las organizaciones cliente).
  const coordinadores = (perfiles ?? []).filter((p) => p.rol === "coordinador").length;
  const sustanciadores = (perfiles ?? []).filter((p) => p.rol === "sustanciador").length;

  const usuariosPorOrg = new Map<string, number>();
  for (const p of perfiles ?? []) if (p.org_id) usuariosPorOrg.set(p.org_id, (usuariosPorOrg.get(p.org_id) ?? 0) + 1);

  const docsPorOrg = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const f of (fichas ?? []) as any[]) {
    const org = unoDe(f.casos)?.org_id;
    if (org) docsPorOrg.set(org, (docsPorOrg.get(org) ?? 0) + 1);
  }

  const listaOrgs = (orgs ?? []).map((o) => ({
    id: o.id, nombre: o.nombre,
    usuarios: usuariosPorOrg.get(o.id) ?? 0,
    docs: docsPorOrg.get(o.id) ?? 0,
  }));
  const maxDocs = Math.max(1, ...listaOrgs.map((o) => o.docs));

  return (
    <div className="relative space-y-6 max-w-5xl overflow-x-clip">
      <div className="pointer-events-none absolute -top-20 left-0 w-[26rem] h-[26rem] rounded-full bg-brand/10 blur-3xl -z-10" aria-hidden />
      <Saludo nombre={nombre} />

      {/* KPIs de plataforma */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Organizaciones" value={listaOrgs.length} icon={Building2} tint="#35b9db" href="/organizaciones" />
        <StatCard label="Coordinadores" value={coordinadores} icon={Users} tint="#2563eb" href="/organizaciones" />
        <StatCard label="Sustanciadores" value={sustanciadores} icon={Scale} tint="#0891b2" href="/organizaciones" />
        <StatCard label="Directrices" value={totalDirectrices ?? 0} icon={BookMarked} tint="#7c3aed" href="/configuracion/directrices" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Organizaciones */}
        <SeccionCard icon={Building2} titulo="Organizaciones" href="/organizaciones" hrefLabel="Gestionar">
          {listaOrgs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Aún no hay organizaciones. Crea la primera en Organizaciones.</p>
          ) : (
            <ul className="divide-y divide-border">
              {listaOrgs.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{o.nombre}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> {o.usuarios} usuario{o.usuarios !== 1 ? "s" : ""}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{o.docs} doc{o.docs !== 1 ? "s" : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </SeccionCard>

        {/* Documentos por organización */}
        <SeccionCard icon={FileText} titulo="Documentos por organización">
          {listaOrgs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sin datos todavía.</p>
          ) : (
            <div className="space-y-3">
              {listaOrgs.map((o) => <BarraDato key={o.id} label={o.nombre} valor={o.docs} max={maxDocs} />)}
            </div>
          )}
        </SeccionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Repositorio jurídico */}
        <SeccionCard icon={BookMarked} titulo="Repositorio jurídico" href="/configuracion/directrices" hrefLabel="Abrir">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-lg bg-brand-subtle text-brand-ink flex items-center justify-center shrink-0"><BookMarked className="w-5 h-5" /></span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{totalDirectrices ?? 0} directrices cargadas</p>
              <p className="text-xs text-muted-foreground mt-0.5">Directrices de Colpensiones que la IA usa para generar las fichas. Gestiónalas en el repositorio.</p>
              <Link href="/configuracion/directrices" className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-brand-ink hover:underline">
                Ir al repositorio <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </SeccionCard>

        {/* Requerimientos de clientes (futuro) */}
        <SeccionCard icon={Inbox} titulo="Requerimientos de clientes">
          <div className="rounded-lg border border-dashed border-border p-5 text-center">
            <Inbox className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-medium text-foreground mt-2">Próximamente</p>
            <p className="text-xs text-muted-foreground mt-0.5">Bandeja para recibir y atender solicitudes de tus organizaciones cliente.</p>
          </div>
        </SeccionCard>
      </div>
    </div>
  );
}
