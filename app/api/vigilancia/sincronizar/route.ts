import { NextRequest, NextResponse } from "next/server";
import { contextoOrg } from "@/lib/vigilancia/contexto";
import { sincronizarProceso, type ResultadoSync } from "@/lib/vigilancia/sincronizar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST — sincroniza con la Rama Judicial. Con { proceso_id } sincroniza uno;
// sin cuerpo, sincroniza todos los procesos activos de la organización (revisión bajo demanda).
export async function POST(request: NextRequest) {
  const ctx = await contextoOrg();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = await request.json().catch(() => ({}));
  const procesoId = body?.proceso_id ? String(body.proceso_id) : null;

  let query = ctx.sb
    .from("procesos_vigilados")
    .select("id, radicado, backfill_completo")
    .eq("org_id", ctx.orgId)
    .eq("activo", true);
  if (procesoId) query = query.eq("id", procesoId);

  const { data: procesos } = await query;
  if (!procesos?.length) {
    return NextResponse.json({ error: "No hay procesos para sincronizar" }, { status: 404 });
  }

  const resultados: ResultadoSync[] = [];
  let novedades = 0;
  for (const p of procesos) {
    const r = await sincronizarProceso(ctx.sb, p);
    resultados.push(r);
    novedades += r.novedades;
  }

  return NextResponse.json({ ok: true, sincronizados: resultados.length, novedades, resultados });
}
