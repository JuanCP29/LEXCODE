import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

// POST — el usuario asignado devuelve su caso (mal asignado) al pool.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { data: { user } } = await sbUser().auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { motivo } = (await request.json()) as { motivo?: string };
  const motivoLimpio = (motivo ?? "").trim();
  if (motivoLimpio.length < 3) {
    return NextResponse.json({ error: "Indica el motivo de la devolución." }, { status: 400 });
  }

  const admin = sbAdmin();
  const { data: caso } = await admin.from("casos").select("id, asignado_a").eq("id", params.id).single();
  if (!caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });
  if (caso.asignado_a !== user.id) {
    return NextResponse.json({ error: "Solo puedes devolver un caso asignado a ti." }, { status: 403 });
  }

  // Vuelve al pool: sin asignar + pendiente en la cola, con el motivo de devolución.
  const { error } = await admin
    .from("casos")
    .update({
      asignado_a: null,
      cola_estado: "pendiente",
      devolucion_motivo: motivoLimpio,
      devuelto_at: new Date().toISOString(),
      devuelto_por: user.id,
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: `No se pudo devolver el caso: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
