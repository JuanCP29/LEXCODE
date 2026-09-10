/**
 * Extractor de producción de la muestra estratificada del histórico AOE.
 * - Marco: dedup 005-022; excluye ya-extraídos y carpetas indemnización (por ruta).
 * - Estratifica por reparto (proporcional) y llena cupo por estrato; si un caso cae en el
 *   GUARDIA DE CONTENIDO (indemnización, o escenario 80%/OAL-016/SL3501), se descarta y se
 *   repone con el siguiente del mismo estrato (reposición de cupo).
 * - Corte de seguridad: aborta si hay 3 errores de crédito consecutivos.
 *   node scripts/extraer-muestra.mjs [N=150]
 *
 * OJO: consume API (1 llamado Sonnet por caso intentado). Determinista (mismo seed que el muestreo).
 */
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { getPath } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
let w = getPath(); try { if (/^[a-zA-Z]:\\/.test(w)) w = pathToFileURL(w).href; } catch {}
PDFParse.setWorker(w);

const N = parseInt(process.argv[2] || "150", 10);
const SEED = 20260910;
const PRESTS = ["vejez", "sobrevivientes", "invalidez", "indemnizacion", "administradora", "otro"];

// ---- Guardia de contenido: qué se EXCLUYE tras leer el acto ----
// (a) indemnización sustitutiva; (b) el escenario específico de reliquidación 80% ligado a
//     SL3501-2022 / OAL-016. La tasa de reemplazo GENERAL (otros %) NO se excluye.
const RE_80 = /\bsl\s*-?\s*3501\b|3501\s*[-\/]?\s*2022|\boal\s*-?\s*016\b|(?:tasa\s+de\s+reemplazo|reemplazo)\D{0,40}\b80\b|\b80\s*%[^.]{0,40}(?:reemplazo|reliquid)/i;
function excluidoPorContenido(ficha) {
  if (String(ficha.tipo_prestacion || "").toLowerCase() === "indemnizacion") return "indemnizacion";
  const blob = [ficha.problema_juridico, ficha.causal_decision, JSON.stringify(ficha.fuentes_citadas || ""), (ficha.normas_citadas || []).join(" ")].join(" \n ");
  if (RE_80.test(blob)) return "80%/OAL-016/SL3501";
  return null;
}

// ---- Extracción (prompt corregido: separa normas / fuentes / actos) ----
const INSTR = `Eres un abogado de COLPENSIONES que estructura un acto administrativo (AOE) para una base de datos
de análisis jurídico. Extrae en JSON EXCLUSIVAMENTE lo que consta en el documento. NO inventes. Distingue
lo que AFIRMA el acto de lo que solo menciona. REGLA JSON: no uses comillas dobles rectas dentro de los
valores (usa comillas simples o « »).

Extrae:
- radicado (número del acto)
- tipo_prestacion: uno de ${PRESTS.join(", ")}
- tipo_solicitud: reconocimiento | reliquidacion | retroactivo | sustitucion | correccion_hl | incremento | indemnizacion | otro
- sentido_decision: niega | reconoce | reliquida | modifica | confirma | otro
- es_desfavorable: true/false (si la decisión fue desfavorable al solicitante)
- problema_juridico: 1-2 frases
- causal_decision: la razón CONCRETA de la decisión (el porqué)
- requisitos_examinados: array de strings
- hechos_relevantes: breve
- investigacion_administrativa: resumen o null
- normas_citadas: array de strings — SOLO normas jurídicas positivas (leyes, decretos, acuerdos,
  artículos de códigos). Ej.: 'Artículo 37 Ley 100 de 1993', 'Decreto 1730 de 2001 art. 3'.
- fuentes_citadas: array de { tipo, identificacion, fecha, emisor, fragmento }. Regla ESTRICTA — incluye
  ÚNICAMENTE fuentes doctrinales/interpretativas INTERNAS de Colpensiones o jurisprudencia, es decir tipo
  uno de: concepto | memorando | circular | directriz | lineamiento | jurisprudencia. NO incluyas aquí:
  (a) normas positivas —esas van en normas_citadas—; (b) actos administrativos del propio expediente
  (Resoluciones SUB/GNR/DIR/VPB, oficios de la propia decisión); (c) placeholders como 'No aplica',
  'Ninguna', 'N/A'. Si el acto no cita ninguna fuente doctrinal ni jurisprudencia, devuelve [] (array vacío).
- argumentos_colpensiones: array de { argumento, condiciones }
- posibles_controversias: array de { asunto, es_inferencia: true } — inferencias (no hay demanda a la vista)
- excepciones: array (particularidades que diferencian el caso)
- confianza: alta | media | baja

Devuelve SOLO el JSON con esas claves.`;

function parse(raw) {
  let out = (raw || "").trim().replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
  const m = out.match(/\{[\s\S]*\}/); if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
const arr = (v, l = 30) => Array.isArray(v) ? v.map((x) => typeof x === "string" ? x.trim() : x).filter(Boolean).slice(0, l) : [];
const TIPOS_FUENTE_OK = ["concepto", "memorando", "circular", "directriz", "lineamiento", "jurisprudencia"];
const RE_ACTO_EXPEDIENTE = /\b(resoluci[oó]n|oficio|auto)\b.*\b(sub|gnr|dir|vpb|dpe|rdp)\b|\b(sub|gnr|dir|vpb|dpe|rdp)\s*[-]?\s*\d/i;
const RE_PLACEHDR = /^\s*(no\s+aplica|ninguna?|n\.?\/?a\.?|sin\s+(fuentes?|citas?)|no\s+(cita|registra|aplica|existe))/i;
function saneaFuentes(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((f) => {
    if (!f || typeof f !== "object") return false;
    const tipo = String(f.tipo ?? "").toLowerCase().trim();
    if (!TIPOS_FUENTE_OK.includes(tipo)) return false;
    const id = String(f.identificacion ?? "").trim();
    const frag = String(f.fragmento ?? "").trim();
    if (RE_PLACEHDR.test(id) || (!id && RE_PLACEHDR.test(frag))) return false;
    if (tipo !== "jurisprudencia" && RE_ACTO_EXPEDIENTE.test(id)) return false;
    if (!id && !frag) return false;
    return true;
  }).slice(0, 40);
}

async function extraerTexto(buf) {
  try { const p = new PDFParse({ data: new Uint8Array(buf) }); const r = await p.getText(); return (r.text || "").trim(); } catch { return ""; }
}
async function llamar(texto, buf) {
  const content = texto && texto.length >= 120
    ? [{ type: "text", text: `${INSTR}\n\nDOCUMENTO (AOE):\n${texto.slice(0, 120000)}` }]
    : [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") } }, { type: "text", text: INSTR }];
  const msg = await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: 3000, messages: [{ role: "user", content }] });
  const b = msg.content.find((x) => x.type === "text");
  return parse(b && "text" in b ? b.text : "");
}

// ---- 1. Marco + exclusiones por ruta + estratos ordenados (shuffle determinista) ----
let _s = SEED >>> 0;
const rnd = () => ((_s = (1103515245 * _s + 12345) & 0x7fffffff) / 0x7fffffff);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const lines = fs.readFileSync(new URL("./aoe_paths.txt", import.meta.url), "utf8").split(/\r?\n/).filter(Boolean);
const porCedula = new Map();
for (const ruta of lines) {
  const c = ruta.match(/CC_(\d+)_AOE/i)?.[1]; if (!c) continue;
  const rep = ruta.match(/REPARTO (\d+)/i)?.[1] || "?";
  const esIndemFolder = /indemnizac/i.test(ruta);
  if (!porCedula.has(c)) porCedula.set(c, { ced: c, ruta, reparto: rep, esIndemFolder });
  else if (esIndemFolder) porCedula.get(c).esIndemFolder = true;
}
const { data: prev } = await sb.from("aoe_casos").select("cedula");
const yaExtraidas = new Set((prev ?? []).map((r) => String(r.cedula)));
const porRep = new Map();
for (const v of porCedula.values()) {
  if (yaExtraidas.has(v.ced) || v.esIndemFolder) continue;
  if (!porRep.has(v.reparto)) porRep.set(v.reparto, []); porRep.get(v.reparto).push(v);
}
const reps = [...porRep.keys()].sort();
const totalEleg = reps.reduce((s, r) => s + porRep.get(r).length, 0);
const cuotas = reps.map((r) => { const size = porRep.get(r).length; const ex = (size / totalEleg) * N; return { r, size, base: Math.floor(ex), resto: ex - Math.floor(ex) }; });
let asignado = cuotas.reduce((s, c) => s + c.base, 0);
cuotas.sort((a, b) => b.resto - a.resto);
for (let i = 0; asignado < N && i < cuotas.length; i++, asignado++) cuotas[i].base++;
const cuotaPorRep = new Map(cuotas.map((c) => [c.r, Math.min(c.base, c.size)]));
for (const r of reps) shuffle(porRep.get(r)); // orden de extracción/reposición

console.log(`Pool elegible: ${totalEleg}. Objetivo: ${N} fichas limpias (excluye indemnización y 80%/OAL-016/SL3501).`);

// ---- 2. Extraer llenando cupo por estrato, con reposición ----
let ok = 0, fail = 0, guardados = 0; const stats = {}, excl = {}; let creditoConsec = 0;
outer:
for (const r of reps) {
  const meta = cuotaPorRep.get(r); const pool = porRep.get(r); let idx = 0, acept = 0;
  while (acept < meta && idx < pool.length) {
    const item = pool[idx++];
    let f, estado = "ok";
    try {
      const buf = fs.readFileSync(item.ruta);
      const texto = await extraerTexto(buf);
      estado = texto.length >= 120 ? "ok" : "ocr";
      f = await llamar(texto, buf);
      creditoConsec = 0;
    } catch (e) {
      const msg = e?.message ?? String(e);
      if (/credit balance is too low/i.test(msg)) { if (++creditoConsec >= 3) { console.log(`\n⛔ ABORTO: 3 errores de crédito seguidos. Recarga y reanuda (ya-extraídos se saltan solos).`); break outer; } }
      console.log(`✗ ERROR R${r} CC ${item.ced}: ${msg.slice(0, 80)}`); fail++; continue;
    }
    if (!f) { console.log(`✗ SIN FICHA R${r} CC ${item.ced} (${estado})`); fail++; continue; }
    const motivo = excluidoPorContenido(f);
    if (motivo) { excl[motivo] = (excl[motivo] || 0) + 1; console.log(`↷ EXCLUIDO R${r} CC ${item.ced} · ${motivo} (repongo cupo)`); continue; }
    const row = {
      cedula: item.ced, radicado: f.radicado ? String(f.radicado).trim() : null, reparto: item.reparto, ruta_origen: item.ruta,
      tipo_prestacion: PRESTS.includes(String(f.tipo_prestacion || "").toLowerCase()) ? String(f.tipo_prestacion).toLowerCase() : "otro",
      tipo_solicitud: f.tipo_solicitud ? String(f.tipo_solicitud).toLowerCase().trim() : null,
      sentido_decision: f.sentido_decision ? String(f.sentido_decision).toLowerCase().trim() : null,
      es_desfavorable: typeof f.es_desfavorable === "boolean" ? f.es_desfavorable : null,
      problema_juridico: f.problema_juridico?.trim() || null, causal_decision: f.causal_decision?.trim() || null,
      requisitos_examinados: arr(f.requisitos_examinados), hechos_relevantes: f.hechos_relevantes?.trim() || null,
      investigacion_administrativa: f.investigacion_administrativa?.trim() || null, normas_citadas: arr(f.normas_citadas),
      fuentes_citadas: saneaFuentes(f.fuentes_citadas),
      argumentos_colpensiones: Array.isArray(f.argumentos_colpensiones) ? f.argumentos_colpensiones.slice(0, 30) : [],
      posibles_controversias: Array.isArray(f.posibles_controversias) ? f.posibles_controversias.slice(0, 20) : [],
      excepciones: arr(f.excepciones), estado_texto: estado,
      confianza: f.confianza ? String(f.confianza).toLowerCase().trim() : null, extraido_modelo: "claude-sonnet-4-6",
    };
    const { error } = await sb.from("aoe_casos").upsert(row, { onConflict: "cedula,radicado" });
    if (error) { console.log(`✗ UPSERT R${r} CC ${item.ced}: ${error.message}`); fail++; continue; }
    stats[row.tipo_prestacion] = (stats[row.tipo_prestacion] || 0) + 1; acept++; ok++; guardados++;
    console.log(`✓ R${r} CC ${item.ced.padEnd(10)} | ${row.tipo_prestacion.padEnd(13)} | ${row.sentido_decision || "?"} | fu:${row.fuentes_citadas.length} no:${row.normas_citadas.length} | ${estado} | ${acept}/${meta}`);
  }
}
console.log(`\nHecho. Guardadas:${guardados} · fail:${fail}. Excluidas por contenido: ${JSON.stringify(excl)}. Por prestación: ${JSON.stringify(stats)}`);
