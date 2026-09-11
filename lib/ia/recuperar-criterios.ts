/**
 * Retrieval del criterio institucional (Fase 2, Paso 2).
 * Dado un caso (pretensión + controversia + flag `conciliable`), recupera del repositorio los
 * documentos que GOBIERNAN el análisis, según el router:
 *   - conciliable = true  → rama CONCILIABILIDAD → busca la DIRECTRIZ aplicable (y sus condiciones).
 *   - conciliable = false → rama DEFENSA         → busca los CRITERIOS DE DEFENSA aplicables.
 * La selección por escenario la hace un SELECTOR CON IA (Sonnet) sobre el catálogo de fichas de
 * criterio (pequeñas). Devuelve un bloque compacto listo para inyectar en el prompt de Consideraciones.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";

const TIPOS_DEFENSA = ["memorando", "concepto", "circular", "jurisprudencia", "otro"];
const MODELO = "claude-sonnet-4-6";
const MAX_INYECCION = 16000;

export type CriterioRecuperado = {
  id: string;
  nombre: string;
  codigo: string | null;
  tipo_documento: string;
  resumen_criterio: string | null;
  jurisprudencia_acogida: { cita: string; sostiene: string }[] | null;
  condiciones_aplicacion: string[] | null;
  motivo?: string;
};

export type ResultadoRetrieval = {
  rama: "conciliabilidad" | "defensa";
  criterios: CriterioRecuperado[];
  bloqueInyeccion: string;
  insuficiencia: boolean; // rama SÍ sin directriz aplicable → no se puede determinar conciliabilidad
};

/** Radicados de sentencias citados en un texto (para reforzar la selección con el acto ancla). */
function extraerRadicados(texto: string): string[] {
  const ids = new Set<string>();
  const t = texto ?? "";
  Array.from(t.matchAll(/\bSL\s?-?\s?(\d{2,6})\s?(?:-|de\s+)?\s?(\d{4})\b/gi)).forEach((m) => ids.add(`SL${m[1]}-${m[2]}`));
  Array.from(t.matchAll(/\b(C|T|SU)\s?-\s?(\d{1,4})\s?(?:\/|de\s+)?\s?(\d{2,4})\b/gi)).forEach((m) => ids.add(`${m[1].toUpperCase()}-${m[2]}/${m[3]}`));
  Array.from(t.matchAll(/radicaci[oó]n\s*(?:n[o°.]*\s*)?([\d]{4,})/gi)).forEach((m) => ids.add(`rad. ${m[1]}`));
  return Array.from(ids).slice(0, 20);
}

function catalogoLinea(c: Record<string, unknown>): string {
  const esc = Array.isArray(c.escenarios) ? (c.escenarios as string[]).join(", ") : "";
  const prest = Array.isArray(c.prestaciones) ? (c.prestaciones as string[]).join(", ") : "";
  return `[id:${c.id}] (${c.tipo_documento}${c.codigo ? ` · ${c.codigo}` : ""}) prest:[${prest}] escenarios:[${esc}]\n  ${c.resumen_criterio ?? ""}`;
}

export async function recuperarCriterios(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  anthropic: Anthropic,
  args: {
    pretension: string | null;
    controversia: string;      // texto de la controversia / expediente / síntesis
    conciliable: boolean;
    textoActoAncla?: string;   // opcional: para el refuerzo por cita
  }
): Promise<ResultadoRetrieval> {
  const rama: ResultadoRetrieval["rama"] = args.conciliable ? "conciliabilidad" : "defensa";

  // 1. Filtro por naturaleza + solo enriquecidos y activos.
  let q = supabase
    .from("directrices_conciliacion")
    .select("id, nombre, codigo, tipo_documento, resumen_criterio, escenarios, prestaciones, jurisprudencia_acogida, condiciones_aplicacion")
    .eq("activo", true)
    .not("resumen_criterio", "is", null);
  q = rama === "conciliabilidad" ? q.eq("tipo_documento", "directriz") : q.in("tipo_documento", TIPOS_DEFENSA);
  const { data: docs } = await q;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catalogo = (docs ?? []) as any[];

  if (catalogo.length === 0) {
    return { rama, criterios: [], bloqueInyeccion: "", insuficiencia: rama === "conciliabilidad" };
  }

  // 2. Refuerzo por cita: sentencias del acto ancla que algún documento acoge.
  const radicados = args.textoActoAncla ? extraerRadicados(args.textoActoAncla) : [];
  const acogenCitas = new Set<string>();
  if (radicados.length) {
    for (const d of catalogo) {
      const citas = Array.isArray(d.jurisprudencia_acogida) ? d.jurisprudencia_acogida.map((j: { cita: string }) => (j.cita ?? "").toLowerCase()) : [];
      if (radicados.some((r) => citas.some((c: string) => c.includes(r.toLowerCase()) || r.toLowerCase().includes(c)))) acogenCitas.add(d.id);
    }
  }

  // 3. Selector con IA.
  const refuerzo = acogenCitas.size
    ? `\nREFUERZO: el acto ancla cita sentencias que estos documentos acogen (prioriza si aplican): ${Array.from(acogenCitas).join(", ")}.`
    : "";
  const prompt = `Eres un asistente de recuperación jurídica de COLPENSIONES. Selecciona, del catálogo de criterios
institucionales, ÚNICAMENTE los que GOBIERNAN la controversia del caso. ${rama === "conciliabilidad"
    ? "Se trata de un asunto marcado como CONCILIABLE: busca la DIRECTRIZ de conciliación cuyo supuesto de hecho corresponda al caso."
    : "Se trata de un asunto NO conciliable: busca los CRITERIOS DE DEFENSA (memorando/concepto/circular/jurisprudencia acogida) que sustenten la actuación."}

CASO
- Pretensión: ${args.pretension ?? "no especificada"}
- Controversia: ${args.controversia.slice(0, 6000)}${refuerzo}

CATÁLOGO (${rama})
${catalogo.map(catalogoLinea).join("\n")}

Devuelve SOLO este JSON: { "seleccion": [ { "id": "<id exacto del catálogo>", "motivo": "<1 frase>" } ] }
Reglas: incluye solo documentos cuyo criterio APLIQUE realmente a ESTA controversia (máximo 5, ordenados
por pertinencia). Si NINGUNO aplica, devuelve { "seleccion": [] }. No inventes ids ni selecciones por
simple coincidencia temática lejana.
PRECISIÓN POR SUB-CONTROVERSIA: la coincidencia de PRESTACIÓN no basta; el criterio debe gobernar el
PUNTO CONCRETO en discusión. En pensión de SOBREVIVIENTES distingue dos planos que NO deben mezclarse:
(a) la CAUSACIÓN del derecho por el afiliado causante —densidad de semanas, condición más beneficiosa,
tránsitos legislativos, fecha de estructuración/fallecimiento—; y (b) la ACREDITACIÓN de la calidad del
BENEFICIARIO —convivencia, dependencia económica, calidad de cónyuge/compañero/padre/hijo, edad—. Si la
controversia es del plano (b), NO selecciones criterios del plano (a), como los de condición más
beneficiosa, aunque sean de la misma prestación; y viceversa.`;

  let seleccion: { id: string; motivo?: string }[] = [];
  try {
    const msg = await anthropic.messages.create({ model: MODELO, max_tokens: 1200, messages: [{ role: "user", content: prompt }] });
    const b = msg.content.find((x) => x.type === "text");
    const raw = (b && "text" in b ? b.text : "").replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      const p = JSON.parse(m[0]);
      if (Array.isArray(p.seleccion)) seleccion = p.seleccion.filter((s: { id?: unknown }) => s && s.id).map((s: { id: unknown; motivo?: unknown }) => ({ id: String(s.id), motivo: s.motivo ? String(s.motivo) : undefined }));
    }
  } catch {
    // si el selector falla, cae al refuerzo por cita (si hubo) o a vacío.
    seleccion = Array.from(acogenCitas).map((id) => ({ id }));
  }

  // 4. Materializar los criterios seleccionados (en el orden dado por el selector).
  const byId = new Map(catalogo.map((d) => [d.id, d]));
  const criterios: CriterioRecuperado[] = seleccion
    .map((s) => { const d = byId.get(s.id); return d ? { ...d, motivo: s.motivo } as CriterioRecuperado : null; })
    .filter((x): x is CriterioRecuperado => !!x)
    .slice(0, 5);

  // 5. Bloque de inyección compacto, según la rama.
  const bloqueInyeccion = construirBloque(rama, criterios).slice(0, MAX_INYECCION);
  const insuficiencia = rama === "conciliabilidad" && criterios.length === 0;

  return { rama, criterios, bloqueInyeccion, insuficiencia };
}

function construirBloque(rama: ResultadoRetrieval["rama"], criterios: CriterioRecuperado[]): string {
  if (criterios.length === 0) {
    return rama === "conciliabilidad"
      ? "DIRECTRIZ DE CONCILIACIÓN APLICABLE: no se identificó en el repositorio una directriz que gobierne este supuesto. Debe señalarse la insuficiencia documental (no improvisar un criterio de conciliación)."
      : "";
  }
  const titulo = rama === "conciliabilidad"
    ? "DIRECTRIZ DE CONCILIACIÓN APLICABLE (aplica sus condiciones al caso; concluye procede/no procede conciliar según su cumplimiento):"
    : "CRITERIOS DE DEFENSA INSTITUCIONALES APLICABLES (susténtate en ellos y en la jurisprudencia que acogen; no uses jurisprudencia externa no acogida):";
  const partes = criterios.map((c) => {
    const cab = `### ${c.tipo_documento.toUpperCase()}: ${c.nombre}${c.codigo ? ` (${c.codigo})` : ""}`;
    const resumen = c.resumen_criterio ?? "";
    const cond = c.condiciones_aplicacion?.length
      ? `\nCONDICIONES DE APLICACIÓN:\n${c.condiciones_aplicacion.map((x) => `- ${x}`).join("\n")}`
      : "";
    const juris = c.jurisprudencia_acogida?.length
      ? `\nJURISPRUDENCIA ACOGIDA:\n${c.jurisprudencia_acogida.map((j) => `- ${j.cita}${j.sostiene ? `: ${j.sostiene}` : ""}`).join("\n")}`
      : "";
    return `${cab}\n${resumen}${cond}${juris}`;
  });
  return `${titulo}\n\n${partes.join("\n\n")}`;
}
