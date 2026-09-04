import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { esCoordinador, ROLES_ASIGNABLES } from "@/lib/auth/roles";

function sbUser() {
  const c = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => c.getAll(), setAll: () => {} } }
  );
}
function sbAdmin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// GET — casos devueltos de la organización del coordinador + usuarios asignables.
export async function GET() {
  const { data: { user } } = await sbUser().auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = sbAdmin();
  const { data: perfil } = await admin.from("perfiles").select("rol, org_id").eq("id", user.id).single();
  if (!perfil || !esCoordinador(perfil.rol)) {
    return NextResponse.json({ error: "Solo un Coordinador puede ver las devoluciones" }, { status: 403 });
  }
  const orgId = perfil.org_id as string | null;
  if (!orgId) return NextResponse.json({ error: "Sin organización" }, { status: 400 });

  const [{ data: casos }, { data: perfiles }] = await Promise.all([
    admin
      .from("casos")
      .select("id, radicado, radicado_bizagi, nombre_demandante, cedula_demandante, despacho, cola_estado, asignado_a, devolucion_motivo, devuelto_at, devuelto_por")
      .eq("org_id", orgId)
      .not("devolucion_motivo", "is", null)
      .order("devuelto_at", { ascending: false }),
    admin.from("perfiles").select("id, nombre_completo, rol").eq("org_id", orgId),
  ]);

  const nombrePorId = new Map<string, string>();
  for (const p of perfiles ?? []) nombrePorId.set(p.id, p.nombre_completo || "—");

  const devoluciones = (casos ?? []).map((c) => ({
    ...c,
    devuelto_por_nombre: c.devuelto_por ? (nombrePorId.get(c.devuelto_por) ?? "—") : null,
  }));

  const usuarios = (perfiles ?? [])
    .filter((p) => ROLES_ASIGNABLES.includes(p.rol))
    .map((p) => ({ id: p.id, nombre: p.nombre_completo || "Sin nombre", rol: p.rol, esYo: p.id === user.id }));

  return NextResponse.json({ devoluciones, usuarios });
}
