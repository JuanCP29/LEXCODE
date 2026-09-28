import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { extraerTextoPDFDetallado } from "@/lib/ia/extraer-pdf";
import { transcribirPDFVision } from "@/lib/ia/ocr-claude";

export const maxDuration = 300;

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
    const nativo = await extraerTextoPDFDetallado(buffer);
    let texto = nativo.texto;
    let metodo = "texto";

    // OCR si viene escaneado o es MIXTO (páginas digitales + páginas imagen).
    const fraccionVacias = nativo.paginas > 0 ? nativo.paginasVacias / nativo.paginas : 0;
    const pareceEscaneado =
      !texto || texto.length < 50 ||
      (nativo.paginas >= 2 && (nativo.paginasVacias >= 2 || fraccionVacias >= 0.3));
    if (pareceEscaneado) {
      try {
        const textoOCR = await transcribirPDFVision(buffer, "application/pdf");
        if (textoOCR && textoOCR.length >= 50 && textoOCR.length > texto.length) {
          texto = textoOCR;
          metodo = "ocr";
        }
      } catch (e) {
        console.error("OCR visión (reprocesar):", e);
      }
    }

    if (!texto || texto.length < 50) {
      const msg = "El PDF no contiene texto extraíble y el OCR no pudo procesarlo (posible archivo muy grande o ilegible).";
      await supabase.from("documentos_caso")
        .update({ estado_procesamiento: "error", error_procesamiento: msg })
        .eq("id", params.id);
      return NextResponse.json({ estado: "error", error: msg });
    }

    await supabase.from("documentos_caso")
      .update({ estado_procesamiento: "ok", texto_extraido: texto })
      .eq("id", params.id);

    return NextResponse.json({ estado: "ok", metodo });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al reprocesar";
    await supabase.from("documentos_caso")
      .update({ estado_procesamiento: "error", error_procesamiento: msg })
      .eq("id", params.id);
    return NextResponse.json({ estado: "error", error: msg }, { status: 500 });
  }
}
