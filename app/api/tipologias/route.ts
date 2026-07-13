import { NextResponse } from "next/server";
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

// GET — lista jerárquica de tipologías activas
export async function GET() {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("tipologias")
    .select("id, nombre, parent_id, orden")
    .eq("activa", true)
    .order("orden");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Agrupar: padres con sus hijas
  const padres = (data ?? []).filter((t) => !t.parent_id);
  const grupos = padres.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    hijas: (data ?? [])
      .filter((t) => t.parent_id === p.id)
      .map((t) => ({ id: t.id, nombre: t.nombre })),
  }));

  return NextResponse.json({ tipologias: grupos });
}
