import { NextRequest, NextResponse } from "next/server";
import { contextoOrg } from "@/lib/vigilancia/contexto";

export const dynamic = "force-dynamic";

// PATCH — edita una audiencia (confirmar fecha, cambiar estado, notas, enlace, tipo).
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await contextoOrg();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data: aud } = await ctx.sb
    .from("audiencias_vigilancia").select("id").eq("id", params.id).eq("org_id", ctx.orgId).maybeSingle();
  if (!aud) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

  const b = await request.json().catch(() => ({}));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upd: Record<string, any> = { updated_at: new Date().toISOString() };
  if ("fecha" in b) {
    upd.fecha = b.fecha ? new Date(b.fecha).toISOString() : null;
    if (b.fecha && !("estado" in b)) upd.estado = "programada";
  }
  for (const k of ["tipo", "despacho", "enlace", "notas", "estado"]) {
    if (k in b) upd[k] = b[k];
  }

  const { error } = await ctx.sb.from("audiencias_vigilancia").update(upd).eq("id", params.id);
  if (error) return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — elimina una audiencia (p. ej. una manual o una auto errónea).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await contextoOrg();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data: aud } = await ctx.sb
    .from("audiencias_vigilancia").select("id").eq("id", params.id).eq("org_id", ctx.orgId).maybeSingle();
  if (!aud) return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });

  await ctx.sb.from("audiencias_vigilancia").delete().eq("id", params.id);
  return NextResponse.json({ ok: true });
}
