/**
 * Enriquece documentos FALTANTES del repositorio a partir de los EXTRACTOS donde las
 * contestaciones de la muestra los invocan. Crea filas en directrices_conciliacion (sin PDF),
 * con texto_extraido = extractos + ficha de criterio por IA (grounded, sin inventar).
 *   node scripts/enriquecer-faltantes.mjs
 */
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const PV = ["vejez","sobrevivientes","invalidez","indemnizacion","administradora","transversal"];
const arr=(v,l)=>Array.isArray(v)?v.map(x=>String(x).trim()).filter(Boolean).slice(0,l):[];

const dir = "C:/Users/USER/AppData/Local/Temp/claude/C--Users-USER-OneDrive-Escritorio-FICHAS-DE-CONCILIACI-N-LEXCODE/8342da8d-957c-4fdf-89f3-3b74721f5bd9/scratchpad/contestaciones";
const textos = fs.readdirSync(dir).filter(f=>f.endsWith(".txt")).map(f=>fs.readFileSync(path.join(dir,f),"utf8"));

const TARGETS = [
  { nombre:"Circular OAL-02 de 2021 - Efectividad de la pension de vejez (modifica num. 1.6.5 Circular 01 de 2012)", tipo:"circular", prest:["vejez"], pat:/oal[\s-]?0?2[\s-]*(?:de\s*)?2021|circular\s+(?:interna\s+)?oal[\s-]?0?2/i },
  { nombre:"Circular Interna 24 de 2018 - Efectividad de la pension de vejez (modifica num. 1.6.5 Circular 01 de 2012)", tipo:"circular", prest:["vejez"], pat:/circular\s+(?:interna\s+)?(?:n[o°.]*\s*)?24\s+de\s+2018/i },
  { nombre:"Circular Conjunta 069 de 2008 - Cobro de cuotas partes pensionales", tipo:"circular", prest:["transversal"], pat:/circular\s+conjunta\s+(?:n[o°.]*\s*)?0?69|conjunta\s+069/i },
  { nombre:"SU-065 de 2018 - Intereses moratorios: mora en el pago vs. reconocimiento", tipo:"jurisprudencia", prest:["transversal"], pat:/su[\s-]?0?65[\s-\/]*(?:de\s*)?2018/i },
  { nombre:"T-588 de 2003 - Plazos para decidir y pagar solicitudes pensionales", tipo:"jurisprudencia", prest:["transversal"], pat:/t[\s-]?588[\s-\/]*(?:de\s*)?2003/i },
  { nombre:"C-601 de 2000 - Indemnizacion por pago tardio de mesadas pensionales", tipo:"jurisprudencia", prest:["transversal"], pat:/c[\s-]?601[\s-\/]*(?:de\s*)?2000/i },
  { nombre:"SL4338-2019 - Improcedencia de intereses e indexacion en reliquidaciones pensionales", tipo:"jurisprudencia", prest:["transversal"], pat:/sl\s?4338[\s-]?2019/i },
];

function excerpts(pat) {
  const out = [];
  for (const t of textos) {
    const p = t.replace(/\r/g," ");
    let m; const re = new RegExp(pat.source, "gi");
    while ((m = re.exec(p)) && out.length < 14) {
      const i = m.index; out.push(p.slice(Math.max(0,i-500), i+700).replace(/\s+/g," ").trim());
      re.lastIndex = i + 700;
    }
  }
  return [...new Set(out)].slice(0,12).join("\n---\n").slice(0,9000);
}

for (const T of TARGETS) {
  const { data: existe } = await sb.from("directrices_conciliacion").select("id").ilike("nombre", `%${T.nombre.slice(0,18)}%`).limit(1);
  if (existe?.length) { console.log("↷ ya existe:", T.nombre.slice(0,40)); continue; }
  const ex = excerpts(T.pat);
  if (ex.length < 120) { console.log("✗ sin extractos:", T.nombre.slice(0,40)); continue; }
  const prompt = `Los siguientes son EXTRACTOS de contestaciones de demanda de COLPENSIONES que invocan «${T.nombre}» (tipo ${T.tipo}). Extrae una FICHA DE CRITERIO en JSON con lo que los extractos permiten sostener, EN CLAVE DE DEFENSA de Colpensiones. NO inventes; usa solo lo que aparezca.
Campos: resumen_criterio (3-4 frases: la regla/ratio que el documento fija y cómo sirve a la defensa), prestaciones (de: ${PV.join(",")}), escenarios (minúscula), jurisprudencia_acogida ([{cita,sostiene}]; si es jurisprudencia incluye la propia sentencia y las que reitere), condiciones_aplicacion (null salvo directriz de conciliacion), es_regla_de_conciliacion (false). REGLA JSON: no comillas dobles dentro de valores. Devuelve SOLO el JSON.

EXTRACTOS:
${ex}`;
  const enr = await anthropic.messages.create({ model:"claude-sonnet-4-6", max_tokens:2500, messages:[{role:"user",content:prompt}] });
  const b = enr.content.find(x=>x.type==="text"); const raw=(b&&"text"in b?b.text:"").replace(/^```[a-z]*\n?/i,"").replace(/```$/i,"").trim();
  const p = raw.match(/\{[\s\S]*\}/)?JSON.parse(raw.match(/\{[\s\S]*\}/)[0]):null;
  if (!p) { console.log("✗ sin ficha:", T.nombre.slice(0,40)); continue; }
  const row = {
    nombre: T.nombre, tipo_documento: T.tipo, pretension: "general",
    texto_extraido: `FUENTE: extractos de contestaciones de la muestra (no es el documento original).\n\n${ex}`,
    resumen_criterio: p.resumen_criterio?.trim()||null,
    prestaciones: arr(p.prestaciones,6).map(s=>s.toLowerCase()).filter(s=>PV.includes(s)).length?arr(p.prestaciones,6).map(s=>s.toLowerCase()).filter(s=>PV.includes(s)):T.prest,
    escenarios: arr(p.escenarios,20).map(s=>s.toLowerCase()),
    jurisprudencia_acogida: Array.isArray(p.jurisprudencia_acogida)?p.jurisprudencia_acogida.filter(x=>x&&x.cita).map(x=>({cita:String(x.cita).trim(),sostiene:String(x.sostiene??"").trim()})).slice(0,30):[],
    condiciones_aplicacion: null, es_regla_conciliacion: false, activo: true, enriquecido_at: new Date().toISOString(),
    subido_por: "b222b632-799e-49de-81ec-6942bd866f76",
  };
  const { error } = await sb.from("directrices_conciliacion").insert(row);
  console.log(error?`✗ insert ${T.nombre.slice(0,30)}: ${error.message}`:`✓ ${T.tipo.padEnd(13)} | ${T.nombre.slice(0,50)} | prest:[${row.prestaciones.join(",")}] juris:${row.jurisprudencia_acogida.length}`);
}
const { count } = await sb.from("directrices_conciliacion").select("*",{count:"exact",head:true}).eq("activo",true);
console.log("\nDocumentos activos en repositorio:", count);
