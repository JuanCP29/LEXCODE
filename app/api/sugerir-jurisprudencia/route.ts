import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sugerirJurisprudencia } from "@/lib/ia/sugerir-jurisprudencia";

export const maxDuration = 60;
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
 * Sección 9 (Jurisprudencia). Se dispara desde el cliente JUSTO DESPUÉS de
 * "Analizar con IA", en un request aparte, para no exceder el tiempo de la
 * función serverless. Recibe la Sección 4 (normas + jurisprudencia) y la
 * pretensión, busca en el repositorio y devuelve el resumen.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await request.json();
    const { pretension, normasText, demandaTexto } = body as {
      pretension?: string | null;
      normasText?: string | null;
      demandaTexto?: string | null;
    };

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const jurisprudencia = await sugerirJurisprudencia(supabase, anthropic, {
      pretension: pretension ?? null,
      normasText: normasText ?? null,
      demandaTexto: demandaTexto ?? null,
    });

    return NextResponse.json({ jurisprudencia });
  } catch (e) {
    console.error("sugerir-jurisprudencia:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
