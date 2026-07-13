import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { extraerTextoPDF } from "@/lib/ia/extraer-pdf";

export const maxDuration = 60;

function sb() {
  const c = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => c.getAll(), setAll: (cs) => cs.forEach(({ name, value, options }) => c.set(name, value, options)) } }
  );
}

// ── POST: reintentar extracción de texto de un documento fallido ──────────────
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: doc } = await supabase
    .from("documentos_caso")
    .select("id, storage_path, caso_id, casos!inner(abogado_id)")
    .eq("id", params.id)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!doc || (doc.casos as any)?.abogado_id !== user.id) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  await supabase.from("documentos_caso")
    .update({ estado_procesamiento: "procesando", error_procesamiento: null })
    .eq("id", params.id);

  try {
    const { data: archivo, error: dlErr } = await supabase.storage
      .from("documentos-lexcode")
      .download(doc.storage_path);
    if (dlErr || !archivo) throw new Error(dlErr?.message ?? "No se pudo descargar de Storage");

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const texto = await extraerTextoPDF(buffer);

    if (!texto || texto.length < 50) {
      const msg = "El PDF no contiene texto extraíble (posible documento escaneado).";
      await supabase.from("documentos_caso")
        .update({ estado_procesamiento: "error", error_procesamiento: msg })
        .eq("id", params.id);
      return NextResponse.json({ estado: "error", error: msg });
    }

    await supabase.from("documentos_caso")
      .update({ estado_procesamiento: "ok", texto_extraido: texto })
      .eq("id", params.id);

    return NextResponse.json({ estado: "ok" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al reprocesar";
    await supabase.from("documentos_caso")
      .update({ estado_procesamiento: "error", error_procesamiento: msg })
      .eq("id", params.id);
    return NextResponse.json({ estado: "error", error: msg }, { status: 500 });
  }
}
