import { NextRequest, NextResponse } from "next/server";
import { contextoOrg } from "@/lib/vigilancia/contexto";

export const dynamic = "force-dynamic";

// Verifica que el proceso pertenezca a la organización del usuario.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function propio(sb: any, orgId: string, id: string) {
  const { data } = await sb
    .from("procesos_vigilados")
    .select("id, radicado, despacho, sujetos, ciudad, estado, ultimo_movimiento, backfill_completo, caso_id")
    .eq("id", id).eq("org_id", orgId).maybeSingle();
  return data;
}

// GET — detalle del proceso con su historial de actuaciones y novedades sin atender.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await contextoOrg();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const proceso = await propio(ctx.sb, ctx.orgId, params.id);
  if (!proceso) return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 });

  const { data: actuaciones } = await ctx.sb
    .from("actuaciones_vigilancia")
    .select("id, fecha_rama, actuacion, anotacion, fecha_registro, fecha_sistema")
    .eq("proceso_id", params.id)
    .order("fecha_rama", { ascending: false, nullsFirst: false });

  const { data: novedades } = await ctx.sb
    .from("novedades_vigilancia")
    .select("id, resumen, nivel, atendida, created_at")
    .eq("proceso_id", params.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ proceso, actuaciones: actuaciones ?? [], novedades: novedades ?? [] });
}

// DELETE — excluye el proceso de la vigilancia (soft: conserva el historial).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await contextoOrg();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const proceso = await propio(ctx.sb, ctx.orgId, params.id);
  if (!proceso) return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 });

  await ctx.sb.from("procesos_vigilados")
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq("id", params.id);
  return NextResponse.json({ ok: true });
}

// PATCH — marca todas las novedades del proceso como atendidas.
export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await contextoOrg();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const proceso = await propio(ctx.sb, ctx.orgId, params.id);
  if (!proceso) return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 });

  await ctx.sb.from("novedades_vigilancia")
    .update({ atendida: true }).eq("proceso_id", params.id).eq("atendida", false);
  return NextResponse.json({ ok: true });
}
