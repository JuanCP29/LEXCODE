/**
 * Backfill del enriquecimiento del repositorio (Fase 2, Paso 1).
 * Recorre las filas de directrices_conciliacion con enriquecido_at = null, genera la
 * ficha de criterio con Sonnet y las actualiza. Ejecutar UNA vez (local):
 *   node scripts/backfill-enriquecer-directrices.mjs
 * Requiere .env.local con SUPABASE_SERVICE_ROLE_KEY y ANTHROPIC_API_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const PRESTACIONES_VALIDAS = ["vejez", "sobrevivientes", "invalidez", "administradora", "transversal"];

function prompt(tipo, texto) {
  return `Eres un abogado de COLPENSIONES que cataloga el repositorio institucional de criterios para la
defensa judicial y la conciliación. Recibes UN documento y su tipo declarado. Extrae una FICHA DE
CRITERIO estructurada, en JSON, EXCLUSIVAMENTE con lo que consta en el documento. NO inventes
radicados, condiciones, normas ni escenarios; si un campo no consta, déjalo vacío.

TIPO DECLARADO: ${tipo}
(Recuerda: 'directriz' = regla de CUÁNDO PROCEDE LA CONCILIACIÓN; los demás
—memorando/concepto/circular/jurisprudencia/otro— son CRITERIOS DE DEFENSA.)

Extrae:
1. resumen_criterio — en 3 a 5 frases, la REGLA o CRITERIO INSTITUCIONAL que el documento fija (qué
   debe sostener Colpensiones o, si es directriz, bajo qué condiciones procede la conciliación).
2. prestaciones — de esta lista CERRADA (minúscula): "vejez","sobrevivientes","invalidez","administradora","transversal".
3. escenarios — subtemas/etiquetas libres en minúscula (controversia/requisito que gobierna).
4. jurisprudencia_acogida — sentencias que el documento ADOPTA, cada una {"cita","sostiene"}; normaliza
   "SL####-AAAA","C-###/AAAA","SU-###/AAAA","T-###/AAAA","rad. #####". Solo las que aparezcan textualmente.
5. condiciones_aplicacion — SOLO si el tipo es 'directriz': condiciones concurrentes para conciliar; si no, null.
6. es_regla_de_conciliacion — true si establece expresamente cuándo (no) procede conciliar; si no, false.

REGLA JSON (CRÍTICA): dentro de los valores de texto NUNCA uses comillas dobles rectas ("); usa
comillas simples (') o angulares (« ») para citar, para no invalidar el JSON.

Devuelve ÚNICAMENTE este JSON:
{ "resumen_criterio":"…","prestaciones":["…"],"escenarios":["…"],"jurisprudencia_acogida":[{"cita":"…","sostiene":"…"}],"condiciones_aplicacion":["…"],"es_regla_de_conciliacion":false }

DOCUMENTO (tipo ${tipo}):
${texto}`;
}

function parsear(raw, tipo) {
  let out = (raw ?? "").trim().replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
  const m = out.match(/\{[\s\S]*\}/); if (!m) return null;
  let p; try { p = JSON.parse(m[0]); } catch { return null; }
  const arr = (v, lim) => Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean).slice(0, lim) : [];
  const juris = Array.isArray(p.jurisprudencia_acogida)
    ? p.jurisprudencia_acogida.filter(x => x && x.cita).map(x => ({ cita: String(x.cita).trim(), sostiene: String(x.sostiene ?? "").trim() })).slice(0, 30) : [];
  const cond = arr(p.condiciones_aplicacion, 20);
  return {
    resumen_criterio: typeof p.resumen_criterio === "string" && p.resumen_criterio.trim() ? p.resumen_criterio.trim() : null,
    prestaciones: arr(p.prestaciones, 6).map(s => s.toLowerCase()).filter(s => PRESTACIONES_VALIDAS.includes(s)),
    escenarios: arr(p.escenarios, 20).map(s => s.toLowerCase()),
    jurisprudencia_acogida: juris,
    condiciones_aplicacion: tipo === "directriz" ? (cond.length ? cond : null) : null,
    es_regla_conciliacion: p.es_regla_de_conciliacion === true,
  };
}

const { data: pend, error } = await sb.from("directrices_conciliacion")
  .select("id, nombre, tipo_documento, texto_extraido")
  .is("enriquecido_at", null)
  .order("created_at");
if (error) { console.error("query:", error.message); process.exit(1); }
console.log(`Pendientes de enriquecer: ${pend?.length ?? 0}`);

let ok = 0, fail = 0, saltados = 0;
for (const d of (pend ?? [])) {
  const t = (d.texto_extraido ?? "").trim();
  if (t.length < 120) { console.log(`· SALTADO (sin texto útil): ${d.nombre?.slice(0, 50)}`); saltados++; continue; }
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 4000,
      messages: [{ role: "user", content: prompt(d.tipo_documento || "otro", t.slice(0, 150000)) }],
    });
    const raw = msg.content.find(b => b.type === "text");
    const ficha = parsear(raw && "text" in raw ? raw.text : "", d.tipo_documento || "otro");
    if (!ficha) { console.log(`✗ SIN FICHA: ${d.nombre?.slice(0, 50)}`); fail++; continue; }
    const { error: upErr } = await sb.from("directrices_conciliacion").update({
      resumen_criterio: ficha.resumen_criterio,
      prestaciones: ficha.prestaciones,
      escenarios: ficha.escenarios,
      jurisprudencia_acogida: ficha.jurisprudencia_acogida,
      condiciones_aplicacion: ficha.condiciones_aplicacion,
      es_regla_conciliacion: ficha.es_regla_conciliacion,
      enriquecido_at: new Date().toISOString(),
    }).eq("id", d.id);
    if (upErr) { console.log(`✗ UPDATE falló: ${d.nombre?.slice(0, 40)} — ${upErr.message}`); fail++; continue; }
    const flag = ficha.es_regla_conciliacion && d.tipo_documento !== "directriz" ? "  ⚠ es_regla pero no es directriz" : "";
    console.log(`✓ ${d.tipo_documento.padEnd(9)} | ${(d.nombre ?? "").slice(0, 48).padEnd(48)} | prest:[${ficha.prestaciones.join(",")}] juris:${ficha.jurisprudencia_acogida.length}${flag}`);
    ok++;
  } catch (e) {
    console.log(`✗ ERROR: ${d.nombre?.slice(0, 40)} — ${e?.message ?? e}`);
    fail++;
  }
}
console.log(`\nHecho. OK: ${ok} · fallidos: ${fail} · saltados: ${saltados}`);
