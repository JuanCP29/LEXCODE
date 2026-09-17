import { NextRequest, NextResponse } from "next/server";
import { contextoOrg } from "@/lib/vigilancia/contexto";
import { sincronizarProceso } from "@/lib/vigilancia/sincronizar";
import { limpiarRadicado } from "@/lib/vigilancia/rama";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // el backfill inicial consulta todas las páginas de la Rama

// GET — lista los procesos vigilados de la organización con conteo de novedades sin atender.
export async function GET() {
  const ctx = await contextoOrg();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data: procesos, error } = await ctx.sb
    .from("procesos_vigilados")
    .select("id, radicado, despacho, sujetos, ciudad, estado, ultimo_movimiento, backfill_completo, activo, created_at, caso_id")
    .eq("org_id", ctx.orgId)
    .eq("activo", true)
    .order("ultimo_movimiento", { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ error: "Error al listar procesos" }, { status: 500 });

  const ids = (procesos ?? []).map((p: { id: string }) => p.id);
  const conteo: Record<string, number> = {};
  if (ids.length) {
    const { data: nov } = await ctx.sb
      .from("novedades_vigilancia")
      .select("proceso_id")
      .in("proceso_id", ids)
      .eq("atendida", false);
    for (const n of nov ?? []) conteo[n.proceso_id] = (conteo[n.proceso_id] ?? 0) + 1;
  }

  const salida = (procesos ?? []).map((p: { id: string }) => ({
    ...p,
    novedades: conteo[p.id] ?? 0,
  }));
  return NextResponse.json({ procesos: salida });
}

// POST — incluye un proceso por radicado y hace el backfill del historial completo.
export async function POST(request: NextRequest) {
  const ctx = await contextoOrg();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = await request.json().catch(() => ({}));
  const radicado = limpiarRadicado(String(body?.radicado ?? ""));
  const casoId = body?.caso_id ? String(body.caso_id) : null;
  if (radicado.length < 20) {
    return NextResponse.json({ error: "Ingresa el radicado completo (23 dígitos)." }, { status: 400 });
  }

  // ¿Ya está vigilado en esta organización?
  const { data: existente } = await ctx.sb
    .from("procesos_vigilados")
    .select("id, activo")
    .eq("org_id", ctx.orgId)
    .eq("radicado", radicado)
    .maybeSingle();

  let procesoId: string;
  if (existente) {
    if (existente.activo) {
      return NextResponse.json({ error: "Este proceso ya está en vigilancia." }, { status: 409 });
    }
    await ctx.sb.from("procesos_vigilados")
      .update({ activo: true, updated_at: new Date().toISOString() })
      .eq("id", existente.id);
    procesoId = existente.id;
  } else {
    const { data: creado, error } = await ctx.sb
      .from("procesos_vigilados")
      .insert({ org_id: ctx.orgId, radicado, caso_id: casoId, creado_por: ctx.userId, backfill_completo: false })
      .select("id")
      .single();
    if (error || !creado) {
      return NextResponse.json({ error: "No se pudo registrar el proceso." }, { status: 500 });
    }
    procesoId = creado.id;
  }

  // Backfill inicial: trae el historial sin generar novedades.
  const resultado = await sincronizarProceso(ctx.sb, {
    id: procesoId, radicado, backfill_completo: !!existente?.activo,
  });

  if (!resultado.encontrado) {
    return NextResponse.json({
      ...resultado,
      encontrado: false,
      proceso_id: procesoId,
      mensaje: "El proceso quedó registrado pero la Rama Judicial no devolvió datos (puede ser privado o no existir).",
    });
  }

  return NextResponse.json({ ...resultado, encontrado: true, proceso_id: procesoId });
}
