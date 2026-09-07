/**
 * OCR de PDFs escaneados con la lectura nativa de PDF/visión de Claude.
 *
 * Los expedientes de Colpensiones se suben como PDF escaneado (imagen), del que
 * pdf-parse no extrae texto. En vez de un servicio OCR aparte, enviamos el PDF como
 * "document block" y Claude lo transcribe. Modelo: Sonnet (transcripción fiel, más
 * barato que Opus); el razonamiento jurídico sigue en Opus 5.
 */
import Anthropic from "@anthropic-ai/sdk";

/** Límite de seguridad: el request admite ~32MB; el base64 infla ~4/3. */
export const MAX_PDF_BYTES = 28 * 1024 * 1024;

const PROMPT_OCR =
  "Este es un PDF escaneado de un expediente pensional colombiano (Colpensiones). " +
  "Transcribe FIELMENTE y por COMPLETO todo su texto. Conserva la estructura (títulos, numerales, " +
  "párrafos, tablas como texto) y respeta con exactitud los datos: números de resolución (p. ej. " +
  "SUB-123456, DPE-1234), fechas, cédulas, radicados, semanas, porcentajes y cifras. No resumas, " +
  "no interpretes, no agregues comentarios ni encabezados: devuelve ÚNICAMENTE el texto transcrito.";

/**
 * Transcribe un PDF (escaneado o no) usando visión de Claude. Devuelve el texto, o
 * "" si el documento excede el límite de tamaño. Usa streaming para no chocar con el
 * timeout HTTP del SDK en documentos de muchas páginas.
 */
export async function transcribirPDFVision(
  buffer: Buffer,
  mediaType = "application/pdf",
  modelo = "claude-sonnet-4-6"
): Promise<string> {
  if (buffer.length > MAX_PDF_BYTES) return "";
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const stream = anthropic.messages.stream({
    model: modelo,
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: [
          // El bloque de documento va ANTES del texto.
          {
            type: "document",
            source: { type: "base64", media_type: mediaType as "application/pdf", data: buffer.toString("base64") },
          },
          { type: "text", text: PROMPT_OCR },
        ],
      },
    ],
  });
  const msg = await stream.finalMessage();
  const bloque = msg.content.find((b) => b.type === "text");
  return (bloque && "text" in bloque ? bloque.text : "").trim();
}
