/**
 * Enriquecimiento del repositorio (Fase 2, Paso 1). Dado el texto de un documento
 * institucional y su tipo, genera una "ficha de criterio" estructurada que alimenta
 * el retrieval por escenario (selección con IA) y la inyección compacta al prompt de
 * Consideraciones. Una sola llamada (Sonnet) por documento; se corre en la ingesta y
 * en el backfill. NO inventa: solo extrae lo que consta en el documento.
 */
import Anthropic from "@anthropic-ai/sdk";

export type JurisprudenciaAcogida = { cita: string; sostiene: string };

export type FichaCriterio = {
  resumen_criterio: string | null;
  prestaciones: string[];
  escenarios: string[];
  jurisprudencia_acogida: JurisprudenciaAcogida[];
  condiciones_aplicacion: string[] | null;
  es_regla_conciliacion: boolean;
};

const PRESTACIONES_VALIDAS = ["vejez", "sobrevivientes", "invalidez", "administradora", "transversal"];
const MODELO = "claude-sonnet-4-6";
const MAX_TEXTO = 150000; // los docs grandes (hasta ~106k) caben; cap por seguridad

function construirPrompt(tipoDocumento: string, texto: string): string {
  return `Eres un abogado de COLPENSIONES que cataloga el repositorio institucional de criterios para la
defensa judicial y la conciliación. Recibes UN documento y su tipo declarado. Extrae una FICHA DE
CRITERIO estructurada, en JSON, EXCLUSIVAMENTE con lo que consta en el documento. NO inventes
radicados, condiciones, normas ni escenarios; si un campo no consta, déjalo vacío.

TIPO DECLARADO: ${tipoDocumento}
(Recuerda: 'directriz' = regla de CUÁNDO PROCEDE LA CONCILIACIÓN; los demás
—memorando/concepto/circular/jurisprudencia/otro— son CRITERIOS DE DEFENSA.)

Extrae:

1. resumen_criterio — en 3 a 5 frases, la REGLA o CRITERIO INSTITUCIONAL que el documento fija: qué
   debe sostener Colpensiones o, si es directriz, bajo qué condiciones procede la conciliación.
   Lenguaje institucional, objetivo, sin opinión propia. Recoge el criterio, no un resumen del texto.

2. prestaciones — una o varias de esta lista CERRADA (minúscula), según a qué prestación aplica el
   criterio: "vejez", "sobrevivientes", "invalidez", "administradora", "transversal" (usa
   "transversal" cuando aplica a cualquier prestación, p. ej. reglas probatorias o de intereses).

3. escenarios — lista de subtemas/etiquetas libres, en minúscula, que describan la controversia o el
   requisito que el documento gobierna (ej.: "convivencia", "5 años", "cónyuge separado de hecho",
   "investigación administrativa", "tasa de reemplazo", "ibl", "condición más beneficiosa",
   "intereses moratorios", "retroactivo", "traslado de régimen"). Solo lo que el documento realmente trate.

4. jurisprudencia_acogida — lista de las sentencias que el documento ADOPTA o cita como fundamento,
   cada una como { "cita": "<radicado normalizado>", "sostiene": "<qué sostiene, 1 frase>" }.
   Normaliza: "SL####-AAAA", "C-###/AAAA", "SU-###/AAAA", "T-###/AAAA", "rad. #####".
   Incluye SOLO las que aparezcan textualmente en el documento. Si no hay, deja lista vacía.

5. condiciones_aplicacion — SOLO si el TIPO DECLARADO es 'directriz': lista de las condiciones
   CONCURRENTES que el documento exige para que PROCEDA la conciliación (una por elemento).
   Si el tipo NO es 'directriz', devuelve null.

6. es_regla_de_conciliacion — true si el contenido establece de manera expresa cuándo procede o no
   procede conciliar (una regla de conciliación); false si solo fija criterios de defensa/doctrina.

REGLA JSON (CRÍTICA): dentro de los valores de texto NUNCA uses comillas dobles rectas ("); si
necesitas citar, usa comillas simples (') o angulares (« »), para no invalidar el JSON.

Devuelve ÚNICAMENTE este JSON, sin texto adicional:
{ "resumen_criterio": "…", "prestaciones": ["…"], "escenarios": ["…"], "jurisprudencia_acogida": [ { "cita": "…", "sostiene": "…" } ], "condiciones_aplicacion": ["…"], "es_regla_de_conciliacion": false }

DOCUMENTO (tipo ${tipoDocumento}):
${texto}`;
}

/** Normaliza la salida del modelo a FichaCriterio (defensivo). Devuelve null si no hay texto útil o falla el parseo. */
export function parsearFicha(raw: string, tipoDocumento: string): FichaCriterio | null {
  let out = (raw ?? "").trim().replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
  const m = out.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let p: Record<string, unknown>;
  try { p = JSON.parse(m[0]); } catch { return null; }
  const arrStr = (v: unknown, lim: number): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, lim) : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const juris = Array.isArray((p as any).jurisprudencia_acogida)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (p as any).jurisprudencia_acogida
        .filter((x: unknown) => x && typeof x === "object" && (x as { cita?: unknown }).cita)
        .map((x: { cita: unknown; sostiene?: unknown }) => ({ cita: String(x.cita).trim(), sostiene: String(x.sostiene ?? "").trim() }))
        .slice(0, 30)
    : [];
  return {
    resumen_criterio: typeof p.resumen_criterio === "string" && p.resumen_criterio.trim() ? p.resumen_criterio.trim() : null,
    prestaciones: arrStr(p.prestaciones, 6).map((s) => s.toLowerCase()).filter((s) => PRESTACIONES_VALIDAS.includes(s)),
    escenarios: arrStr(p.escenarios, 20).map((s) => s.toLowerCase()),
    jurisprudencia_acogida: juris,
    condiciones_aplicacion: tipoDocumento === "directriz" ? (arrStr(p.condiciones_aplicacion, 20).length ? arrStr(p.condiciones_aplicacion, 20) : null) : null,
    es_regla_conciliacion: p.es_regla_de_conciliacion === true,
  };
}

export async function enriquecerDirectriz(
  texto: string,
  tipoDocumento: string,
  anthropic?: Anthropic
): Promise<FichaCriterio | null> {
  const t = (texto ?? "").trim();
  if (t.length < 120) return null; // sin texto útil (p. ej. escaneado sin OCR)
  const client = anthropic ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const msg = await client.messages.create({
    model: MODELO,
    max_tokens: 4000,
    messages: [{ role: "user", content: construirPrompt(tipoDocumento || "otro", t.slice(0, MAX_TEXTO)) }],
  });
  const bloque = msg.content.find((b) => b.type === "text");
  const raw = bloque && "text" in bloque ? bloque.text : "";
  return parsearFicha(raw, tipoDocumento || "otro");
}
