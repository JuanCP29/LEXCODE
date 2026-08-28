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

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await request.json() as {
      caso_id?: string;
      sec_hechos?: string | null;
      sec_pretensiones?: string | null;
      sec_defensa?: string | null;
    };
    if (!body.caso_id) return NextResponse.json({ error: "caso_id es obligatorio" }, { status: 400 });

    // ficha_id: la última ficha del caso (referencia informativa).
    const { data: ficha } = await supabase
      .from("fichas_conciliacion")
      .select("id")
      .eq("caso_id", body.caso_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from("contestaciones")
      .upsert(
        {
          caso_id: body.caso_id,
          ficha_id: ficha?.id ?? null,
          sec_hechos: body.sec_hechos ?? null,
          sec_pretensiones: body.sec_pretensiones ?? null,
          sec_defensa: body.sec_defensa ?? null,
          creado_por: user.id,
        },
        { onConflict: "caso_id" }
      )
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (e) {
    console.error("guardar-contestacion:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error interno" }, { status: 500 });
  }
}
