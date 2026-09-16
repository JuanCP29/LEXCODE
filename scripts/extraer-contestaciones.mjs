/**
 * Extracción estructurada de las contestaciones de la muestra (Parte B).
 * Lee los .txt ya extraídos, pide a Sonnet una ficha JSON por documento (tema, argumentos de
 * defensa, sentencias clave con su ratio, doctrina interna citada), y acumula en un JSON.
 * Incremental (sobrevive a cortes) y con fail-fast ante falta de crédito.
 *   node scripts/extraer-contestaciones.mjs
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const dir = "C:/Users/USER/AppData/Local/Temp/claude/C--Users-USER-OneDrive-Escritorio-FICHAS-DE-CONCILIACI-N-LEXCODE/8342da8d-957c-4fdf-89f3-3b74721f5bd9/scratchpad/contestaciones";
const outFile = path.join(dir, "_EXTRACCION.json");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".txt")).sort();
const prev = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : {};

const INSTR = `Eres abogado analista de COLPENSIONES. El texto es una CONTESTACION DE DEMANDA (defensa de Colpensiones en un proceso laboral/pensional). Extrae en JSON EXCLUSIVAMENTE lo que consta; NO inventes. REGLA JSON: NUNCA uses comillas dobles rectas dentro de los valores (usa comillas simples o « »).
Devuelve SOLO este JSON:
{
 "tema": "clasificacion del asunto en pocas palabras (p. ej. RETROACTIVO, LEY 797 PROGRESIVIDAD, TRASLADO DE REGIMEN, AUXILIOS FUNERARIOS, CORRECCION HISTORIA LABORAL, CALCULO ACTUARIAL POR OMISION DE AFILIACION, INTERESES MORATORIOS, PAGO COSTAS, DEVOLUCION DE APORTES, CUOTAS PARTES, INCREMENTOS PENSIONALES, ALTO RIESGO, etc.)",
 "prestacion": "vejez | sobrevivientes | invalidez | indemnizacion | administradora | otro",
 "controversia": "1-2 frases: que reclama el demandante y que opone Colpensiones",
 "argumentos_defensa": [ { "tesis": "1 frase con el eje de defensa", "fundamento": "normas/articulos que lo sustentan", "sentencias": ["radicados citados para ESTE argumento, solo los que aparezcan"] } ],
 "excepciones": ["nombres de las excepciones de merito propuestas"],
 "sentencias_clave": [ { "cita": "SLxxxx-aaaa o C-xxx/aaaa o T-xxx/aaaa o SU-xxx/aaaa", "sostiene": "1 frase: la regla que el escrito le atribuye" } ],
 "documentos_internos": [ { "tipo": "memorando|concepto|circular|directriz", "id": "OAL-040 / Circular 01 de 2012 / BZ_2015_xxxx / etc." } ]
}`;

const parse = (raw) => { const m = (raw||"").replace(/^```[a-z]*\n?/i,"").replace(/```$/i,"").match(/\{[\s\S]*\}/); if(!m) return null; try { return JSON.parse(m[0]); } catch { return null; } };

let ok=0, fail=0, credito=0;
for (const f of files) {
  const id = f.replace(/\.txt$/,"");
  if (prev[id]) { ok++; continue; } // ya procesado
  const txt = fs.readFileSync(path.join(dir, f), "utf8");
  if (txt.trim().length < 200) { prev[id] = { error: "texto insuficiente" }; fail++; continue; }
  try {
    const msg = await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: 2500, messages: [{ role: "user", content: `${INSTR}\n\nCONTESTACION:\n${txt.slice(0,110000)}` }] });
    const b = msg.content.find(x=>x.type==="text");
    const ficha = parse(b && "text" in b ? b.text : "");
    if (!ficha) { prev[id] = { error: "sin ficha" }; fail++; console.log("✗ sin ficha", id.slice(0,8)); }
    else { prev[id] = ficha; ok++; console.log(`✓ ${id.slice(0,8)} | ${ficha.prestacion||"?"} | ${ficha.tema||"?"}`); credito=0; }
  } catch (e) {
    const msg = e?.message ?? String(e);
    if (/credit balance is too low/i.test(msg)) { if(++credito>=3){ console.log("⛔ ABORTO: sin crédito (se guardó lo procesado)."); break; } }
    prev[id] = { error: msg.slice(0,80) }; fail++; console.log("✗ error", id.slice(0,8), msg.slice(0,50));
  }
  fs.writeFileSync(outFile, JSON.stringify(prev, null, 1), "utf8"); // incremental
}
fs.writeFileSync(outFile, JSON.stringify(prev, null, 1), "utf8");
console.log(`\nHecho. ok:${ok} fail:${fail}. Resultado: ${outFile}`);
