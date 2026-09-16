/**
 * Mapa de vacíos de citas de la muestra de contestaciones, con matcher ROBUSTO por FIRMAS.
 * Cada cita (SL/constitucional/circular/OAL/BZ) se reduce a una firma normalizada (tipo+numero[+año]).
 * Un documento está EN REPO si alguna de sus firmas coincide con las firmas del nombre/codigo/
 * jurisprudencia_acogida del repositorio (intersección de conjuntos), robusto a palabras intermedias
 * y a ceros a la izquierda. Sin API.
 *   node scripts/faltantes-contestaciones.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const z = n => String(parseInt(n,10)); // quita ceros a la izquierda
function sigsOf(s) {
  const t = " " + String(s||"").replace(/_/g," ") + " "; const out = new Set();
  for (const m of t.matchAll(/\bSL\s?-?\s?(\d{2,6})\s?(?:-|de\s+)?\s?((?:19|20)\d{2})\b/gi)) out.add("sl"+z(m[1])+m[2]);
  for (const m of t.matchAll(/\b(SU|C|T)\s?-\s?(\d{1,4})\s*(?:de\s+|\/)\s*((?:19|20)\d{2})\b/gi)) out.add(m[1].toLowerCase()+z(m[2])+m[3]);
  for (const m of t.matchAll(/\bcircular\b[^\n]{0,60}?(\d{1,4})\D{1,10}((?:19|20)\d{2})\b/gi)) out.add("circ"+z(m[1])+m[2]);
  for (const m of t.matchAll(/\boal[\s-]?0*(\d{2,4})\b/gi)) out.add("oal"+z(m[1]));
  for (const m of t.matchAll(/\b(\d{5,})\b/g)) out.add("n"+m[1]); // radicados largos (conceptos/BZ)
  return out;
}

// Firmas del repositorio
const { data } = await sb.from("directrices_conciliacion").select("nombre,codigo,jurisprudencia_acogida").eq("activo",true);
const repoSigs = new Set();
for (const d of data){ for (const p of [d.nombre,d.codigo]) for (const s of sigsOf(p)) repoSigs.add(s); for (const j of (d.jurisprudencia_acogida||[])) for (const s of sigsOf(j?.cita)) repoSigs.add(s); }
const enRepo = (cita)=>{ for (const s of sigsOf(cita)) if (repoSigs.has(s)) return true; return false; };

// Citas de las contestaciones (forma legible + frecuencia por nº de documentos)
const dir = "C:/Users/USER/AppData/Local/Temp/claude/C--Users-USER-OneDrive-Escritorio-FICHAS-DE-CONCILIACI-N-LEXCODE/8342da8d-957c-4fdf-89f3-3b74721f5bd9/scratchpad/contestaciones";
const files = fs.readdirSync(dir).filter(f=>f.endsWith(".txt"));
const cnt = { SL:new Map(), CONST:new Map(), CIRC:new Map(), DOCT:new Map() };
const bump=(m,k)=>m.set(k,(m.get(k)||0)+1);
for (const f of files) {
  const t = fs.readFileSync(path.join(dir,f),"utf8"); const S={SL:new Set(),CONST:new Set(),CIRC:new Set(),DOCT:new Set()};
  for (const m of t.matchAll(/\bSL\s?-?\s?(\d{2,6})\s?(?:-|de\s+)\s?((?:19|20)\d{2})\b/gi)) S.SL.add(`SL${m[1]}-${m[2]}`);
  for (const m of t.matchAll(/\b(SU|C|T)\s?-\s?(\d{1,4})\s*(?:de\s+|\/)\s*((?:19|20)\d{2})\b/gi)) S.CONST.add(`${m[1].toUpperCase()}-${m[2]}/${m[3]}`);
  for (const m of t.matchAll(/\bCircular(?:\s+(?:interna|conjunta|externa))?\s*(?:n[o°.]*\s*)?0*(\d{1,4})\s*de\s*((?:19|20)\d{2})/gi)) S.CIRC.add(`Circular ${m[1]} de ${m[2]}`);
  for (const m of t.matchAll(/\bOAL[\s-]?0*(\d{2,4})\b/gi)) S.DOCT.add(`Memorando OAL-${m[1]}`);
  for (const m of t.matchAll(/\bBZ[_\s]?(\d{4})[_\s]?(\d{4,})\b/gi)) S.DOCT.add(`BZ_${m[1]}_${m[2]}`);
  for (const c of ["SL","CONST","CIRC","DOCT"]) for (const k of S[c]) bump(cnt[c],k);
}
const falt=(m,min)=>[...m.entries()].filter(([k,v])=>v>=min&&!enRepo(k)).sort((a,b)=>b[1]-a[1]);
const show=(t,rows)=>{ console.log(`\n— ${t}: ${rows.length}`); rows.forEach(([k,v])=>console.log(`   ${String(v).padStart(2)}  ${k}`)); };
console.log("FALTANTES reales (matcher por firmas · repo:", data.length, "docs)");
show("Sentencias Sala Laboral (≥3)", falt(cnt.SL,3));
show("Constitucionales (≥2)", falt(cnt.CONST,2));
show("Circulares (≥1)", falt(cnt.CIRC,1));
show("Doctrina interna (≥1)", falt(cnt.DOCT,1));
