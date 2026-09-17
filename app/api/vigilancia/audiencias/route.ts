import { NextRequest, NextResponse } from "next/server";
import { contextoOrg } from "@/lib/vigilancia/contexto";

export const dynamic = "force-dynamic";

// GET — audiencias de la organización (con datos del proceso), opcional ?desde&hasta (ISO).
export async function GET(request: NextRequest) {
  const ctx = await contextoOrg();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  let q = ctx.sb
    .from("audiencias_vigilancia")
    .select("id, fecha, tipo, despacho, enlace, notas, origen, estado, proceso_id, procesos_vigilados(radicado, sujetos)")
    .eq("org_id", ctx.orgId)
    .order("fecha", { ascending: true, nullsFirst: false });
  if (desde) q = q.gte("fecha", desde);
  if (hasta) q = q.lte("fecha", hasta);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Error al listar audiencias" }, { status: 500 });
  return NextResponse.json({ audiencias: data ?? [] });
}

// POST — crea una audiencia manual ligada a un proceso vigilado.
export async function POST(request: NextRequest) {
  const ctx = await contextoOrg();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const b = await request.json().catch(() => ({}));
  const procesoId = b?.proceso_id ? String(b.proceso_id) : null;
  if (!procesoId) return NextResponse.json({ error: "Falta el proceso" }, { status: 400 });

  // El proceso debe ser de la organización.
  const { data: proc } = await ctx.sb
    .from("procesos_vigilados").select("id, despacho")
    .eq("id", procesoId).eq("org_id", ctx.orgId).maybeSingle();
  if (!proc) return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 });

  const { data, error } = await ctx.sb.from("audiencias_vigilancia").insert({
    org_id: ctx.orgId,
    proceso_id: procesoId,
    fecha: b?.fecha ? new Date(b.fecha).toISOString() : null,
    tipo: b?.tipo ?? "Audiencia",
    despacho: b?.despacho ?? proc.despacho ?? null,
    enlace: b?.enlace ?? null,
    notas: b?.notas ?? null,
    origen: "manual",
    estado: b?.fecha ? "programada" : "por_confirmar",
  }).select("id").single();
  if (error || !data) return NextResponse.json({ error: "No se pudo crear la audiencia" }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
