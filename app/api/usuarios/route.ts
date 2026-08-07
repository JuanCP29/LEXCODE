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

// GET — miembros del equipo (abogados/revisores activos) para asignar casos
export async function GET() {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre_completo, rol")
    .eq("activo", true)
    .in("rol", ["abogado", "revisor", "admin"])
    .order("nombre_completo");

  if (error) {
    console.error("GET /api/usuarios:", error.message);
    return NextResponse.json({ usuarios: [] });
  }

  const usuarios = (data ?? []).map((u) => ({
    id: u.id,
    nombre: u.nombre_completo || "Sin nombre",
    rol: u.rol,
    esYo: u.id === user.id,
  }));

  return NextResponse.json({ usuarios });
}
