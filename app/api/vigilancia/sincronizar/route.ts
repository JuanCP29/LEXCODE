import { NextRequest, NextResponse } from "next/server";
import { contextoOrg } from "@/lib/vigilancia/contexto";
import { sincronizarProceso, type ResultadoSync } from "@/lib/vigilancia/sincronizar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// CPNU bloquea por IP tras ~29 consultas seguidas (hallazgo del PoC en 201 procesos) y el
// serverless de Vercel corta a 60s. Por eso el "sincronizar todo" avanza por LOTE, con una
// pausa de cortesía entre procesos, y reporta cuántos quedan para el siguiente llamado/cron.
const LOTE = 12;
const PAUSA_MS = 600;
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

// POST — sincroniza con la Rama Judicial. Con { proceso_id } sincroniza uno;
// sin cuerpo, sincroniza un lote de los procesos activos (los menos recientes primero).
export async function POST(request: NextRequest) {
  const ctx = await contextoOrg();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = await request.json().catch(() => ({}));
  const procesoId = body?.proceso_id ? String(body.proceso_id) : null;

  if (procesoId) {
    const { data: uno } = await ctx.sb
      .from("procesos_vigilados")
      .select("id, radicado, backfill_completo")
      .eq("org_id", ctx.orgId).eq("activo", true).eq("id", procesoId).maybeSingle();
    if (!uno) return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 });
    const r = await sincronizarProceso(ctx.sb, { ...uno, org_id: ctx.orgId }, { buscarDoc: true });
    return NextResponse.json({ ok: true, sincronizados: 1, novedades: r.novedades, restantes: 0, resultados: [r] });
  }

  // Total de activos y lote a procesar (los que llevan más sin actualizarse van primero).
  const { count: total } = await ctx.sb
    .from("procesos_vigilados")
    .select("id", { count: "exact", head: true })
    .eq("org_id", ctx.orgId).eq("activo", true);

  const { data: procesos } = await ctx.sb
    .from("procesos_vigilados")
    .select("id, radicado, backfill_completo")
    .eq("org_id", ctx.orgId).eq("activo", true)
    .order("updated_at", { ascending: true, nullsFirst: true })
    .limit(LOTE);

  if (!procesos?.length) {
    return NextResponse.json({ error: "No hay procesos para sincronizar" }, { status: 404 });
  }

  const resultados: ResultadoSync[] = [];
  let novedades = 0;
  for (let i = 0; i < procesos.length; i++) {
    const r = await sincronizarProceso(ctx.sb, { ...procesos[i], org_id: ctx.orgId });
    resultados.push(r);
    novedades += r.novedades;
    if (i < procesos.length - 1) await pausa(PAUSA_MS); // cortesía con la Rama
  }

  const restantes = Math.max(0, (total ?? procesos.length) - procesos.length);
  return NextResponse.json({ ok: true, sincronizados: resultados.length, novedades, restantes, resultados });
}
