import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
}

/**
 * "Cerrar la conciliación": al descargar la ficha, se deja en estado final
 * ('exportada') para habilitar el segundo documento (Contestación de la Demanda).
 * No exige el flujo de aprobación estricta: descargar equivale a cerrar.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { error } = await supabase
      .from("fichas_conciliacion")
      .update({ estado: "exportada" })
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ ok: true, estado: "exportada" });
  } catch (e) {
    console.error("cerrar ficha:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error interno" }, { status: 500 });
  }
}
