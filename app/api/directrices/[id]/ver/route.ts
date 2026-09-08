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

// GET — genera una URL firmada del PDF del documento y redirige a ella
// (para abrir el archivo original en una pestaña nueva desde el repositorio).
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: directriz, error } = await supabase
      .from("directrices_conciliacion")
      .select("storage_path")
      .eq("id", params.id)
      .single();

    if (error || !directriz?.storage_path) {
      return NextResponse.json(
        { error: "Este documento no tiene archivo almacenado" },
        { status: 404 }
      );
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from("directrices-lexcode")
      .createSignedUrl(directriz.storage_path, 120); // válida 2 min

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ error: "No se pudo generar el enlace" }, { status: 500 });
    }

    return NextResponse.redirect(signed.signedUrl);
  } catch (e) {
    console.error("GET /api/directrices/[id]/ver:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
