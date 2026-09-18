import { NextResponse } from "next/server";
import { contextoOrg } from "@/lib/vigilancia/contexto";

export const dynamic = "force-dynamic";

const BOGOTA = "America/Bogota";
function fFecha(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-CO", { timeZone: BOGOTA, year: "numeric", month: "2-digit", day: "2-digit" });
}
function fFechaHora(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const cero = d.toLocaleTimeString("es-CO", { timeZone: BOGOTA, hour: "2-digit", minute: "2-digit", hour12: false });
  const f = d.toLocaleDateString("es-CO", { timeZone: BOGOTA, year: "numeric", month: "2-digit", day: "2-digit" });
  return cero === "00:00" ? f : `${f} ${d.toLocaleTimeString("es-CO", { timeZone: BOGOTA, hour: "numeric", minute: "2-digit", hour12: true })}`;
}
function fmtRadicado(r: string): string {
  return r.length === 23 ? `${r.slice(0, 5)}-${r.slice(5, 7)}-${r.slice(7, 9)}-${r.slice(9, 12)}-${r.slice(12)}` : r;
}

// GET — filas para el Excel de actualización de todos los procesos vigilados de la organización.
export async function GET() {
  const ctx = await contextoOrg();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data: procesos } = await ctx.sb
    .from("procesos_vigilados")
    .select("id, radicado, sujetos, despacho, ciudad, estado, ultimo_movimiento, documento_nombre, documento_url, documento_tipo")
    .eq("org_id", ctx.orgId).eq("activo", true)
    .order("ultimo_movimiento", { ascending: false, nullsFirst: false });

  const ids = (procesos ?? []).map((p: { id: string }) => p.id);
  if (!ids.length) return NextResponse.json({ filas: [] });

  // Última actuación por proceso (la más reciente).
  const { data: acts } = await ctx.sb
    .from("actuaciones_vigilancia")
    .select("proceso_id, fecha_rama, actuacion, anotacion")
    .in("proceso_id", ids)
    .order("fecha_rama", { ascending: false, nullsFirst: false });
  const ultima: Record<string, { fecha: string | null; actuacion: string | null; anotacion: string | null }> = {};
  for (const a of acts ?? []) if (!ultima[a.proceso_id]) ultima[a.proceso_id] = { fecha: a.fecha_rama, actuacion: a.actuacion, anotacion: a.anotacion };

  // Próxima audiencia por proceso (fecha >= hoy).
  const { data: auds } = await ctx.sb
    .from("audiencias_vigilancia")
    .select("proceso_id, fecha, tipo")
    .in("proceso_id", ids)
    .gte("fecha", new Date().toISOString())
    .neq("estado", "cancelada")
    .order("fecha", { ascending: true });
  const prox: Record<string, { fecha: string | null; tipo: string | null }> = {};
  for (const a of auds ?? []) if (!prox[a.proceso_id]) prox[a.proceso_id] = { fecha: a.fecha, tipo: a.tipo };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filas = (procesos ?? []).map((p: any, i: number) => {
    const u = ultima[p.id] ?? {};
    const x = prox[p.id] ?? {};
    return {
      "#": i + 1,
      "Radicado": fmtRadicado(p.radicado),
      "Partes": (p.sujetos ?? "").trim(),
      "Despacho": (p.despacho ?? "").trim(),
      "Ciudad": (p.ciudad ?? "").trim(),
      "Estado": p.estado,
      "Última actuación (fecha)": fFecha(u.fecha ?? p.ultimo_movimiento),
      "Última actuación": (u.actuacion ?? "").trim(),
      "Anotación": (u.anotacion ?? "").trim(),
      "Documento": (p.documento_nombre ?? "").trim(),
      "Link documento": p.documento_url ?? "",
      "Próxima audiencia (fecha)": fFechaHora(x.fecha ?? null),
      "Próxima audiencia (tipo)": (x.tipo ?? "").trim(),
    };
  });

  return NextResponse.json({ filas, generado: new Date().toISOString() });
}
