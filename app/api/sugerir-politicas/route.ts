import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { buscarCoincidenciasRepositorio, construirFuentesRepositorio } from "@/lib/ia/repositorio-match";

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

const soloUtil = (s: string) => s.replace(/=== .*? ===/g, "").replace(/\s+/g, " ").trim().length;

const REGLAS_POLITICAS = `Identifica, en las RESOLUCIONES/OFICIOS de COLPENSIONES del expediente (numeros que empiezan por SUB, DPE,
GNR, VPB, DIR, HL o BZ —la respuesta previa de la entidad—), los DOCUMENTOS INSTITUCIONALES que se MENCIONEN: lineamientos,
directrices, circulares, conceptos, memorandos u oficios de la Oficina Asesora de lo Legal (OAL) de Colpensiones (ej. «Memorando
OAL 016»).
Para CADA uno relaciona SOLO el NOMBRE y una BREVE reseña (1-2 frases sobre su contenido o postura). UNA por linea, empezando con
vineta '• ' (ej. '• Memorando OAL 016 — reseña breve de su contenido').
Si abajo se incluye un bloque "REPOSITORIO INSTITUCIONAL" que coincide con alguno de esos documentos, usa su contenido para la
reseña; cita la fuente entre parentesis si aporta (p. ej. «(Repositorio)»).
Incluye UNICAMENTE los documentos que se MENCIONEN en las resoluciones/oficios; NO inventes ni tomes del TRASLADO/demanda.
Si en las resoluciones no se menciona ningun documento institucional, responde exactamente la palabra: null.
Resalta EN NEGRITA con doble asterisco (**nombre**) el NOMBRE de cada documento institucional. Para transcribir usa comillas
angulares « ». Responde SOLO el texto (o null), sin JSON ni encabezados.`;

/**
 * Sección 10 (Políticas / llamamientos). Endpoint ligero disparado por el cliente
 * tras "Analizar con IA": lista los documentos institucionales (memorando/OAL/
 * concepto/circular/directriz/lineamiento) que citan las resoluciones, con una
 * breve reseña robustecida con el repositorio.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await request.json() as {
      textoDocs?: string | null;
      caso_id?: string | null;
      pretension?: string | null;
    };

    // Texto de las resoluciones: el que ya extrajo el análisis principal, o el persistido.
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
    if (soloUtil(textoDocs) < 200) return NextResponse.json({ politicas: null });

    // Repositorio: documentos activos que coinciden con lo citado en las resoluciones.
    const coincidencias = await buscarCoincidenciasRepositorio(supabase, textoDocs);
    const fuentesRepo = construirFuentesRepositorio(coincidencias, 8000);
    const bloqueRepo = fuentesRepo
      ? `\n\nREPOSITORIO INSTITUCIONAL (coincide con lo citado en las resoluciones):\n${fuentesRepo}`
      : "";

    const contexto = `PRETENSION DEL CASO: ${body.pretension ?? "No especificada"}`;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      messages: [{
        role: "user",
        content: `${contexto}\n\nDOCUMENTOS:\n${textoDocs.slice(0, 30000)}${bloqueRepo}\n\n${REGLAS_POLITICAS}`,
      }],
    });
    const respuesta = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const texto = respuesta.trim().replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
    const politicas = texto && texto.toLowerCase() !== "null" ? texto : null;
    return NextResponse.json({ politicas });
  } catch (e) {
    console.error("sugerir-politicas:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error interno" }, { status: 500 });
  }
}
