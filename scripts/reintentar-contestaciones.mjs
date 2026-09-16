/**
 * Reintenta SOLO las contestaciones con error en _EXTRACCION.json (Parte B).
 * max_tokens mayor, regla anti-comillas reforzada y saneamiento del texto de entrada.
 *   node scripts/reintentar-contestaciones.mjs
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const dir = "C:/Users/USER/AppData/Local/Temp/claude/C--Users-USER-OneDrive-Escritorio-FICHAS-DE-CONCILIACI-N-LEXCODE/8342da8d-957c-4fdf-89f3-3b74721f5bd9/scratchpad/contestaciones";
const outFile = path.join(dir, "_EXTRACCION.json");
const data = JSON.parse(fs.readFileSync(outFile, "utf8"));
const pendientes = Object.entries(data).filter(([,f]) => f && f.error).map(([id]) => id);
console.log("Pendientes (con error):", pendientes.length, "\n");

const INSTR = `Eres abogado analista de COLPENSIONES. El texto es una CONTESTACION DE DEMANDA. Extrae en JSON EXCLUSIVAMENTE lo que consta; NO inventes.
REGLA JSON CRITICA: devuelve JSON ESTRICTAMENTE VALIDO. Dentro de los valores NUNCA uses comillas dobles ("): si necesitas citar, usa comillas simples o « ». No uses saltos de linea sin escapar.
Devuelve SOLO este JSON:
{ "tema": "clasificacion breve del asunto", "prestacion": "vejez|sobrevivientes|invalidez|indemnizacion|administradora|otro", "controversia": "1-2 frases", "argumentos_defensa": [ { "tesis": "1 frase", "fundamento": "normas/articulos", "sentencias": ["radicados"] } ], "excepciones": ["nombres"], "sentencias_clave": [ { "cita": "SLxxxx-aaaa o C-xxx/aaaa", "sostiene": "1 frase" } ], "documentos_internos": [ { "tipo": "memorando|concepto|circular|directriz", "id": "..." } ] }`;
const parse = (raw) => { let out=(raw||"").replace(/^```[a-z]*\n?/i,"").replace(/```$/i,"").trim(); const m=out.match(/\{[\s\S]*\}/); if(!m)return null; try{return JSON.parse(m[0]);}catch{} try{ return JSON.parse(m[0].replace(/,\s*([}\]])/g,"$1")); }catch{return null;} };

let ok=0, fail=0;
for (const id of pendientes) {
  const p = path.join(dir, id + ".txt");
  if (!fs.existsSync(p)) { console.log("✗ sin txt", id.slice(0,8)); fail++; continue; }
  // sanea comillas dobles del texto de entrada (reduce que el modelo las copie al JSON)
  const txt = fs.readFileSync(p, "utf8").replace(/[""]/g,'«').slice(0,110000);
  try {
    const msg = await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: 3800, messages: [{ role: "user", content: `${INSTR}\n\nCONTESTACION:\n${txt}` }] });
    const b = msg.content.find(x=>x.type==="text");
    const ficha = parse(b && "text" in b ? b.text : "");
    if (!ficha) { console.log("✗ sigue sin ficha", id.slice(0,8)); fail++; }
    else { data[id] = ficha; ok++; console.log(`✓ ${id.slice(0,8)} | ${ficha.prestacion||"?"} | ${ficha.tema||"?"}`); }
  } catch (e) { console.log("✗ error", id.slice(0,8), (e?.message||"").slice(0,50)); fail++; }
  fs.writeFileSync(outFile, JSON.stringify(data, null, 1), "utf8");
}
console.log(`\nHecho. recuperadas:${ok} · siguen fallando:${fail}`);
