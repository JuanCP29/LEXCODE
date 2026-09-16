/**
 * Agrega las fichas de _EXTRACCION.json (Parte B) en un informe: playbook por tema,
 * jurisprudencia curada (con ratio y estado en repo) y doctrina interna citada. Gratis (sin API).
 *   node scripts/agregar-contestaciones.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const dir = "C:/Users/USER/AppData/Local/Temp/claude/C--Users-USER-OneDrive-Escritorio-FICHAS-DE-CONCILIACI-N-LEXCODE/8342da8d-957c-4fdf-89f3-3b74721f5bd9/scratchpad/contestaciones";
const data = JSON.parse(fs.readFileSync(path.join(dir, "_EXTRACCION.json"), "utf8"));
const fichas = Object.values(data).filter(f => f && !f.error);
const errores = Object.values(data).filter(f => f && f.error).length;

const sig = s => String(s||"").toLowerCase().replace(/\b0+(\d)/g,"$1").replace(/\bde\b/g," ").replace(/[^a-z0-9]/g,"");
const normCita = s => String(s||"").toUpperCase().replace(/\s+/g,"").replace(/DE(\d)/g,"$1").replace(/[^A-Z0-9\/-]/g,"");

// Repo para cruce
const { data: repo } = await sb.from("directrices_conciliacion").select("nombre,codigo,jurisprudencia_acogida").eq("activo",true);
const repoSigs = new Set();
for (const d of repo) { for (const p of [d.nombre,d.codigo]) if(p) repoSigs.add(sig(p)); for (const j of (d.jurisprudencia_acogida||[])) if(j?.cita) repoSigs.add(sig(j.cita)); }
const enRepo = (c)=>{ const s=sig(c); return [...repoSigs].some(r=>r&&(r.includes(s)||s.includes(r))&&Math.min(r.length,s.length)>=5); };

// Tally sentencias (freq + un "sostiene" representativo)
const sent = new Map();
for (const f of fichas) for (const s of (f.sentencias_clave||[])) {
  if(!s?.cita) continue; const key=sig(s.cita); if(!key||key.length<4) continue;
  if(!sent.has(key)) sent.set(key,{cita:s.cita, n:0, sostiene:s.sostiene||""});
  const e=sent.get(key); e.n++; if((s.sostiene||"").length>e.sostiene.length) e.sostiene=s.sostiene;
}
// Doctrina interna
const doc = new Map();
for (const f of fichas) for (const d of (f.documentos_internos||[])) { if(!d?.id)continue; const k=`${d.tipo||"?"} · ${d.id}`; doc.set(k,(doc.get(k)||0)+1); }
// Agrupar por prestacion → tema con tesis
const byPrest = new Map();
for (const f of fichas) { const p=(f.prestacion||"otro").toLowerCase(); if(!byPrest.has(p))byPrest.set(p,[]); byPrest.get(p).push(f); }

let md = `# Playbook de defensa por tema — muestra de contestaciones\n\n> Extracción estructurada (IA) de ${fichas.length} contestaciones (${errores} sin ficha, de ${fichas.length+errores}). Fecha: 2026-09-16.\n\n`;
md += `## Resumen por prestación\n\n`;
for (const [p,arr] of [...byPrest.entries()].sort((a,b)=>b[1].length-a[1].length)) md += `- **${p}**: ${arr.length} contestaciones\n`;

md += `\n## Jurisprudencia citada (frecuencia · estado en repositorio · ratio)\n\n`;
const srt=[...sent.values()].sort((a,b)=>b.n-a.n);
md += `| Sentencia | Nº | Repo | Ratio (según los escritos) |\n|---|---|---|---|\n`;
for (const e of srt.filter(e=>e.n>=2)) md += `| ${e.cita} | ${e.n} | ${enRepo(e.cita)?"✓":"falta"} | ${(e.sostiene||"").replace(/\|/g,"/").slice(0,140)} |\n`;

md += `\n## Doctrina interna citada\n\n`;
for (const [k,v] of [...doc.entries()].sort((a,b)=>b[1]-a[1])) md += `- ${v}× ${k}${enRepo(k.split(" · ")[1])?"  (en repo)":""}\n`;

md += `\n## Playbook por prestación y tema\n`;
for (const [p,arr] of [...byPrest.entries()].sort((a,b)=>b[1].length-a[1].length)) {
  md += `\n### ${p.toUpperCase()} (${arr.length})\n`;
  // agrupar por tema
  const temas=new Map();
  for (const f of arr){ const t=(f.tema||"SIN TEMA").trim(); if(!temas.has(t))temas.set(t,[]); temas.get(t).push(f); }
  for (const [t,fs2] of [...temas.entries()].sort((a,b)=>b[1].length-a[1].length)) {
    md += `\n**${t}** (${fs2.length})\n`;
    const tesis=new Set();
    for (const f of fs2) for (const a of (f.argumentos_defensa||[])) if(a?.tesis){ const key=a.tesis.toLowerCase().slice(0,70); if(!tesis.has(key)){ tesis.add(key); md += `- ${a.tesis}${a.fundamento?` — *${a.fundamento}*`:""}${a.sentencias?.length?` [${a.sentencias.join(", ")}]`:""}\n`; } }
  }
}
const out = "C:/Users/USER/OneDrive/Escritorio/FICHAS DE CONCILIACIÓN/LEXCODE/docs/playbook-contestaciones.md";
fs.writeFileSync(out, md, "utf8");
console.log(`Fichas: ${fichas.length} | errores: ${errores}`);
console.log(`Sentencias distintas: ${sent.size} | citadas >=2: ${srt.filter(e=>e.n>=2).length}`);
console.log("\nTop 15 sentencias (freq · repo):");
srt.slice(0,15).forEach(e=>console.log(`  ${String(e.n).padStart(2)} ${enRepo(e.cita)?"[repo]":"[falta]"} ${e.cita}`));
console.log("\nPrestaciones:", [...byPrest.entries()].map(([p,a])=>`${p}:${a.length}`).join(" · "));
console.log("\nInforme:", out);
