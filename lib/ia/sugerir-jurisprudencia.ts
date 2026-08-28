import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extraerIdentificadoresSentencias,
  buscarCoincidenciasRepositorio,
  construirFuentesRepositorio,
} from "@/lib/ia/repositorio-match";

/**
 * Sección 9 (Jurisprudencia): a partir de las sentencias que la demanda cita
 * (extraídas en la Sección 4), elige la más relevante según la pretensión,
 * BUSCA en el repositorio de documentos (directriz/memorando/lineamiento/otro)
 * material que coincida con esa sentencia y redacta un resumen trazable.
 * Nunca inventa el holding: solo resume con base en el documento del repositorio
 * o en lo que la demanda transcriba; si no hay fuente, devuelve una nota conservadora.
 * Es defensivo: cualquier fallo devuelve null (no rompe el flujo).
 */
export async function sugerirJurisprudencia(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  anthropic: Anthropic,
  opts: { pretension: string | null; normasText: string | null; demandaTexto?: string | null }
): Promise<string | null> {
  try {
    const { pretension, normasText, demandaTexto } = opts;
    if (!normasText) return null;

    // Solo el bloque de jurisprudencia de la Sección 4 (después de "Jurisprudencia:")
    const idxJuris = normasText.search(/jurisprudencia\s*:/i);
    const bloqueJuris = idxJuris >= 0 ? normasText.slice(idxJuris) : normasText;
    const identificadores = extraerIdentificadoresSentencias(bloqueJuris);
    if (identificadores.length === 0) return null;

    // 1) Buscar en el repositorio documentos activos que coincidan (emparejador compartido).
    const coincidencias = await buscarCoincidenciasRepositorio(supabase, bloqueJuris);
    const fuentesRepo = construirFuentesRepositorio(coincidencias, 12000);

    // 2) Redactar el resumen (elige la más relevante + resume con fuente).
    const prompt = `Eres un abogado de COLPENSIONES que diligencia la Sección 9 (JURISPRUDENCIA O PRECEDENTE JUDICIAL)
de la Ficha de Conciliación Judicial.

PRETENSIÓN DEL CASO: ${pretension ?? "No especificada"}

SENTENCIAS CITADAS EN LA DEMANDA (Sección 4):
${bloqueJuris.slice(0, 4000)}

${fuentesRepo ? `FUENTES DEL REPOSITORIO INSTITUCIONAL QUE COINCIDEN CON ALGUNA SENTENCIA:\n${fuentesRepo}` : "No se encontró ningún documento del repositorio que coincida con las sentencias citadas."}

${demandaTexto ? `TEXTO DE LA DEMANDA (para verificar cómo se cita/transcribe la sentencia):\n${demandaTexto.slice(0, 15000)}` : ""}

TAREA:
1. Identifica, entre las sentencias citadas, LA MÁS RELEVANTE para la pretensión del caso.
2. Redacta un resumen jurídico formal (2-4 párrafos) de esa sentencia: corporación, número/radicado, tema y regla o ratio decidendi, y su incidencia en el caso.
3. Si hay un documento del repositorio que coincide, APÓYATE en él y CÍTALO al final entre paréntesis (p. ej. «(Fuente institucional: Memorando OAL 016)»).

REGLAS ESTRICTAS:
- NO inventes el contenido de una sentencia. Resume ÚNICAMENTE con base en el documento del repositorio o en lo que la demanda transcriba.
- Si no hay documento del repositorio que coincida NI la demanda transcribe el contenido de la sentencia (solo la nombra), NO inventes su holding: responde exactamente "La demanda cita <identificador>; no se encontró en el repositorio ni transcripción en la demanda para resumirla. Requiere diligenciamiento manual." (reemplazando <identificador> por la sentencia más relevante).
- No uses comillas dobles rectas: usa comillas angulares « ».

Responde ÚNICAMENTE con el texto de la sección, sin JSON ni encabezados.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const txt = message.content[0]?.type === "text" ? message.content[0].text.trim() : "";
    return txt && txt.toLowerCase() !== "null" ? txt : null;
  } catch (e) {
    console.error("sugerirJurisprudencia:", e);
    return null;
  }
}
