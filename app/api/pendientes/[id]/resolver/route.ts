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

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { error } = await supabase
    .from("pendientes")
    .update({ estado: "resuelto", resuelto_at: new Date().toISOString(), resuelto_por: user.id })
    .eq("id", params.id)
    .eq("creado_por", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
