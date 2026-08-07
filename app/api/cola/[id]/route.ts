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

// PATCH — asignar caso o cambiar su estado de cola.
// body: { asignado_a?: string|null, cola_estado?: 'pendiente'|'en_proceso'|'completado', sacar?: true }
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json() as {
    asignado_a?: string | null;
    cola_estado?: "pendiente" | "en_proceso" | "completado";
    sacar?: boolean;
  };

  const update: Record<string, unknown> = {};
  if ("asignado_a" in body) update.asignado_a = body.asignado_a;
  if (body.cola_estado) update.cola_estado = body.cola_estado;
  if (body.sacar) { update.cola_estado = null; update.cola_lote = null; }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const { error } = await supabase.from("casos").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
