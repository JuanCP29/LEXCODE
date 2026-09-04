import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { esCoordinador } from "@/lib/auth/roles";

// Cliente service-role (con cookies solo para identificar al usuario).
function sb() {
  const c = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => c.getAll(), setAll: () => {} } }
  );
}

// Un caso "cuenta" mientras no esté completado.
const activo = (colaEstado: string | null) => colaEstado !== "completado";

// GET — contadores para los badges del sidebar (Reparto y Devoluciones).
//   reparto      = casos asignados a MÍ y aún no completados.
//   devoluciones = casos de MI organización con causal de devolución y no completados.
export async function GET() {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ reparto: 0, devoluciones: 0 }, { status: 200 });

  const { data: perfil } = await supabase.from("perfiles").select("rol, org_id").eq("id", user.id).single();
  const orgId = perfil?.org_id ?? null;

  // Reparto — mis casos asignados, descontando los completados.
  const { data: mios } = await supabase
    .from("casos")
    .select("cola_estado")
    .eq("asignado_a", user.id);
  const reparto = (mios ?? []).filter((c) => activo(c.cola_estado)).length;

  // Devoluciones — solo para el Coordinador.
  let devoluciones = 0;
  if (esCoordinador(perfil?.rol) && orgId) {
    const { data: dev } = await supabase
      .from("casos")
      .select("cola_estado")
      .eq("org_id", orgId)
      .not("devolucion_motivo", "is", null);
    devoluciones = (dev ?? []).filter((c) => activo(c.cola_estado)).length;
  }

  return NextResponse.json({ reparto, devoluciones });
}
