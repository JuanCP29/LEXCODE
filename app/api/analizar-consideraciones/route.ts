import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { extraerTextoPDF } from "@/lib/ia/extraer-pdf";
import { combinarPDFsBase64 } from "@/lib/ia/combinar-pdfs";
import { buscarCoincidenciasRepositorio, construirFuentesRepositorio } from "@/lib/ia/repositorio-match";
import { construirPromptConsideraciones } from "@/lib/ficha/metodo-consideraciones";

// El motor unificado (metodo + few-shot + repositorio) es mas pesado; damos margen (plan Pro).
export const maxDuration = 300;
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

const soloUtil = (s: string) =>
  s.replace(/=== .*? ===/g, "")
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
    .replace(/\[No se pudo extraer el texto\]/gi, "")
    .replace(/\s+/g, " ")
    .trim().length;

/**
 * Seccion CONSIDERACIONES. Endpoint aparte (disparado por el cliente tras "Analizar con IA")
 * para no exceder el limite de 60s de Vercel Hobby: cada llamada genera una sola seccion.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await request.json() as {
      paths?: { path: string; nombre: string }[];
      despacho?: string | null;
      pretension?: string | null;
      textoDocs?: string | null; // texto ya extraído por el análisis principal (evita re-ingerir)
      caso_id?: string | null;   // para leer el texto persistido del expediente (Fase 1)
      parte?: number;            // 1 = encuadre+normativo · 2 = jurisprudencia+conclusion · 0/omitido = completa
      normasSec4?: string | null; // Normas+Jurisprudencia de la Sección 4 (para traer la sentencia más relevante)
    };
    const paths = body.paths ?? [];
    const parte = body.parte === 1 ? 1 : body.parte === 2 ? 2 : 0;

    // Bloque de jurisprudencia identificada en la Sección 4 (solo lo posterior a "Jurisprudencia:").
    const normasSec4 = (body.normasSec4 ?? "").trim();
    const idxJ = normasSec4.search(/jurisprudencia\s*:/i);
    const jurisSec4 = idxJ >= 0 ? normasSec4.slice(idxJ) : "";

    // Preferir el texto que ya extrajo el análisis principal (rápido; evita re-descargar
    // y re-parsear). Si no viene, se usa el texto persistido del caso. Solo se descarga y se
    // usa visión como último respaldo cuando NO hay texto útil por ninguna vía.
    let textoDocs = (body.textoDocs ?? "").trim();
    if (soloUtil(textoDocs) < 200 && body.caso_id) {
      const { data: caso } = await supabase
        .from("casos")
        .select("texto_expediente")
        .eq("id", body.caso_id)
        .single();
      const persistido = (caso?.texto_expediente ?? "").trim();
      if (soloUtil(persistido) >= 200) textoDocs = persistido;
    }
    const tieneTextoUtil = soloUtil(textoDocs) >= 200;

    const pdfs: { nombre: string; buffer: Buffer }[] = [];
    let textoCompleto = textoDocs;

    if (!tieneTextoUtil) {
      if (paths.length === 0) return NextResponse.json({ consideraciones: null });
      const textos: string[] = [];
      for (const { path, nombre } of paths) {
        if (!path.startsWith(`${user.id}/`)) continue;
        try {
          const { data, error } = await supabase.storage.from("documentos-lexcode").download(path);
          if (error || !data) throw new Error(error?.message);
          const buffer = Buffer.from(await data.arrayBuffer());
          pdfs.push({ nombre, buffer });
          textos.push(`=== ${nombre} ===\n${await extraerTextoPDF(buffer)}`);
        } catch (e) {
          console.error(`extraccion ${nombre}:`, e);
          textos.push(`=== ${nombre} ===\n[No se pudo extraer el texto]`);
        }
      }
      if (pdfs.length === 0) return NextResponse.json({ consideraciones: null });
      textoCompleto = textos.join("\n\n");
    }
    // Repositorio institucional (RAG). Solo para partes 2/completa (la 1 no usa jurisprudencia).
    let fuentesRepo = "";
    if (parte !== 1) {
      const coincidencias = await buscarCoincidenciasRepositorio(supabase, `${textoCompleto}\n${jurisSec4}`);
      fuentesRepo = construirFuentesRepositorio(coincidencias, 8000) || "";
    }

    // Datos del caso para el encabezado del método unificado.
    const { data: casoRow } = body.caso_id
      ? await supabase.from("casos").select("radicado, nombre_demandante, clase_pretension, jurisdiccion").eq("id", body.caso_id).single()
      : { data: null };

    const escaneado = soloUtil(textoCompleto) < 200;

    // MOTOR UNIFICADO: mismo constructor de prompt que la regeneración por sección
    // (método de 9 pasos + few-shot + postura de defensa + control de citas).
    const prompt = construirPromptConsideraciones({
      radicado: casoRow?.radicado ?? "s/n",
      nombre_demandante: casoRow?.nombre_demandante ?? "el demandante",
      pretension: body.pretension ?? null,
      clase_pretension: casoRow?.clase_pretension ?? null,
      jurisdiccion: casoRow?.jurisdiccion ?? null,
      textoDemanda: escaneado
        ? "(El expediente se adjunta como PDF en este mismo mensaje; léelo íntegramente como fuente principal.)"
        : textoCompleto,
      textoLineamientos: "",
      pretende_intereses: false,
      pretende_indexacion: false,
      hay_fallo: false,
      sintesis_fallo: null,
      conciliable: null,
      repositorio: fuentesRepo || undefined,
      jurisprudencia: jurisSec4 || undefined,
      parte,
    });

    const maxTok = parte === 2 ? 3500 : parte === 1 ? 2600 : 5000;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    let respuesta = "";
    if (escaneado) {
      const recorte = await combinarPDFsBase64(pdfs, { trasladoMax: 6, otrosMax: 14, totalMax: 20 });
      if (!recorte) return NextResponse.json({ consideraciones: null });
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: maxTok,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: recorte.base64 } },
            { type: "text", text: prompt },
          ],
        }],
      });
      respuesta = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    } else {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: maxTok,
        messages: [{ role: "user", content: prompt }],
      });
      respuesta = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    }

    // Texto plano (robusto para texto largo). Limpia cercos de codigo y trata "null" como vacio.
    let texto = respuesta.trim().replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
    // Si por compatibilidad viniera un JSON { "consideraciones": "..." }, lo aceptamos.
    if (texto.startsWith("{")) {
      try { const p = JSON.parse(texto); if (p?.consideraciones) texto = String(p.consideraciones).trim(); } catch { /* se usa tal cual */ }
    }
    const consideraciones = texto && texto.toLowerCase() !== "null" ? texto : null;
    return NextResponse.json({ consideraciones });
  } catch (e) {
    console.error("analizar-consideraciones:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error interno" }, { status: 500 });
  }
}
