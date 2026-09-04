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

// POST — asignación masiva. body: { caso_ids: string[], asignado_a: string|null }
export async function POST(request: NextRequest) {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json() as { caso_ids?: string[]; asignado_a?: string | null };
  const ids = Array.isArray(body.caso_ids) ? body.caso_ids.filter(Boolean) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "No se recibieron casos para asignar" }, { status: 400 });
  }

  // Al (re)asignar, se limpia la marca de devolución y pasa a "en proceso".
  const update = body.asignado_a
    ? { asignado_a: body.asignado_a, cola_estado: "en_proceso", devolucion_motivo: null }
    : { asignado_a: null };
  const { error } = await supabase
    .from("casos")
    .update(update)
    .in("id", ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, asignados: ids.length });
}
