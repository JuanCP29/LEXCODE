import { NextRequest, NextResponse } from "next/server";
import { contextoOrg } from "@/lib/vigilancia/contexto";
import { limpiarRadicado } from "@/lib/vigilancia/rama";

export const dynamic = "force-dynamic";

// POST — carga masiva: recibe una lista de radicados y los REGISTRA (sin consultar CPNU).
// El backfill del historial se hace luego con "Sincronizar todo" por lotes (respeta el
// rate-limit de la Rama y el timeout de 60s). Cada proceso nuevo queda con backfill_completo=false.
export async function POST(request: NextRequest) {
  const ctx = await contextoOrg();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = await request.json().catch(() => ({}));
  const entrada: unknown[] = Array.isArray(body?.radicados) ? body.radicados : [];
  if (!entrada.length) return NextResponse.json({ error: "No se recibieron radicados." }, { status: 400 });

  // Normaliza y valida (23 dígitos; aceptamos ≥20). Deduplica dentro del lote.
  const validos = new Set<string>();
  let invalidos = 0;
  for (const r of entrada) {
    const rad = limpiarRadicado(String(r ?? ""));
    if (rad.length >= 20 && rad.length <= 23) validos.add(rad);
    else if (String(r ?? "").trim()) invalidos++;
  }
  if (!validos.size) {
    return NextResponse.json({ error: "Ningún radicado válido (se esperan 23 dígitos).", invalidos });
  }

  const lista = Array.from(validos);
  // Ya vigilados en la organización
  const { data: existentes } = await ctx.sb
    .from("procesos_vigilados").select("radicado").eq("org_id", ctx.orgId).in("radicado", lista);
  const yaHay = new Set<string>((existentes ?? []).map((x: { radicado: string }) => x.radicado));

  const nuevos = lista.filter((r) => !yaHay.has(r)).map((radicado) => ({
    org_id: ctx.orgId,
    radicado,
    creado_por: ctx.userId,
    backfill_completo: false,
    activo: true,
  }));

  let insertados = 0;
  if (nuevos.length) {
    const { data, error } = await ctx.sb.from("procesos_vigilados").insert(nuevos).select("id");
    if (error) return NextResponse.json({ error: "No se pudieron registrar los procesos." }, { status: 500 });
    insertados = data?.length ?? nuevos.length;
  }

  return NextResponse.json({
    ok: true,
    insertados,
    duplicados: yaHay.size,
    invalidos,
    total: entrada.length,
    pendientes_backfill: insertados,
  });
}
