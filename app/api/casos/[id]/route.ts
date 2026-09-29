import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ROL, puedeCoordinar } from "@/lib/auth/roles";

// PATCH — actualizar campos puntuales del caso (por ahora: tipologia_id)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null) as { tipologia_id?: string | null } | null;

  if (!body || typeof body !== "object" || !("tipologia_id" in body)) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  if (body.tipologia_id !== null &&
      (typeof body.tipologia_id !== "string" ||
       !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.tipologia_id))) {
    return NextResponse.json({ error: "Tipología inválida" }, { status: 400 });
  }

  const { data: perfil, error: perfilError } = await supabase.from("perfiles")
    .select("rol, org_id, activo").eq("id", user.id).single();
  if (perfilError) return NextResponse.json({ error: "No se pudo verificar el perfil" }, { status: 500 });
  if (!perfil || perfil.activo === false) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  // RLS y filtros explícitos: el reparto actual define quién puede editar.
  let query = supabase
    .from("casos")
    .update({ tipologia_id: body.tipologia_id })
    .eq("id", params.id);
  if (perfil.rol !== ROL.SUPERADMIN) {
    if (!perfil.org_id) return NextResponse.json({ error: "Sin organización" }, { status: 403 });
    query = query.eq("org_id", perfil.org_id);
    if (!puedeCoordinar(perfil.rol)) query = query.eq("asignado_a", user.id);
  }
  const { data, error } = await query.select("id").maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Caso no encontrado o sin permiso para editarlo" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
