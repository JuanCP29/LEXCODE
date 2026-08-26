import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function sb() {
  const c = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => c.getAll(), setAll: (cs) => cs.forEach(({ name, value, options }) => c.set(name, value, options)) } }
  );
}

// GET — casos en cola. ?scope=mios|todos
export async function GET(request: NextRequest) {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const scope = request.nextUrl.searchParams.get("scope") ?? "mios";

  let query = supabase
    .from("casos")
    .select("id, radicado, radicado_bizagi, nombre_demandante, cedula_demandante, despacho, pretension, cola_estado, cola_lote, asignado_a, cola_at")
    .not("cola_estado", "is", null)
    .order("cola_at", { ascending: false });

  if (scope === "mios") {
    query = query.eq("asignado_a", user.id);
  }

  const { data, error } = await query;
  if (error) {
    console.error("GET /api/cola:", error.message);
    return NextResponse.json({ error: error.message, migracion_pendiente: true, casos: [] }, { status: 200 });
  }

  const casos = data ?? [];
  const total = casos.length;
  const completados = casos.filter((c) => c.cola_estado === "completado").length;
  const enProceso   = casos.filter((c) => c.cola_estado === "en_proceso").length;
  const pendientes  = casos.filter((c) => c.cola_estado === "pendiente").length;

  return NextResponse.json({
    casos,
    resumen: { total, completados, enProceso, pendientes, progreso: total > 0 ? Math.round((completados / total) * 100) : 0 },
  });
}
