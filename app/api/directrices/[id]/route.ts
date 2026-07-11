import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) =>
          cs.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );
}

// GET — texto completo de una directriz (para inyectar en el prompt)
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data, error } = await supabase
      .from("directrices_conciliacion")
      .select("id, nombre, pretension, clase_pretension, texto_extraido, activo")
      .eq("id", params.id)
      .single();

    if (error || !data) return NextResponse.json({ error: "Directriz no encontrada" }, { status: 404 });

    return NextResponse.json({ directriz: data });
  } catch (e) {
    console.error("GET /api/directrices/[id]:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH — activar/desactivar (admin)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();
    if (perfil?.rol !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const body = await request.json();
    const { data, error } = await supabase
      .from("directrices_conciliacion")
      .update({ activo: body.activo })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ directriz: data });
  } catch (e) {
    console.error("PATCH /api/directrices/[id]:", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

// DELETE — eliminar directriz y archivo del storage (admin)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();
    if (perfil?.rol !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    // Obtener storage_path antes de eliminar
    const { data: directriz } = await supabase
      .from("directrices_conciliacion")
      .select("storage_path")
      .eq("id", params.id)
      .single();

    // Eliminar de Storage si existe
    if (directriz?.storage_path) {
      await supabase.storage
        .from("directrices-lexcode")
        .remove([directriz.storage_path]);
    }

    const { error } = await supabase
      .from("directrices_conciliacion")
      .delete()
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/directrices/[id]:", e);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
