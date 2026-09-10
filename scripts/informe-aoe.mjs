/**
 * Informe de patrones sobre aoe_casos (LOCAL, sin API).
 * Agrega distribuciones, causales, fuentes/normas más citadas y cruza las fuentes que citan
 * los AOE contra lo que existe en el repositorio (directrices_conciliacion) → mapa de vacíos.
 *   node scripts/informe-aoe.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: casos } = await sb.from("aoe_casos").select("*");
const { data: repo } = await sb.from("directrices_conciliacion").select("nombre, codigo, tipo_documento");
const N = casos.length;

const tally = (rows, key, norm = (x) => x) => {
  const m = new Map();
  for (const r of rows) { const v = norm(r[key]); if (v == null || v === "") continue; m.set(v, (m.get(v) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const pct = (n) => `${((n / N) * 100).toFixed(0)}%`;
const line = (arr, total = N) => arr.map(([k, v]) => `${k}: ${v} (${((v / total) * 100).toFixed(0)}%)`).join(" · ");

console.log(`\n============ INFORME DE PATRONES — aoe_casos (${N} casos) ============`);

// 1. Distribuciones básicas
console.log(`\n── 1. Prestación\n${line(tally(casos, "tipo_prestacion"))}`);
console.log(`\n── 2. Sentido de decisión\n${line(tally(casos, "sentido_decision"))}`);
console.log(`\n── 3. Tipo de solicitud\n${line(tally(casos, "tipo_solicitud"))}`);
const desf = casos.filter((c) => c.es_desfavorable === true).length;
const fav = casos.filter((c) => c.es_desfavorable === false).length;
console.log(`\n── 4. Desfavorabilidad\ndesfavorable: ${desf} (${pct(desf)}) · favorable: ${fav} (${pct(fav)}) · sin dato: ${N - desf - fav}`);
console.log(`\n── 5. Confianza / estado de texto\n${line(tally(casos, "confianza"))}  ||  ${line(tally(casos, "estado_texto"))}`);

// 2. Prestación × sentido (matriz)
console.log(`\n── 6. Prestación × sentido`);
const prests = [...new Set(casos.map((c) => c.tipo_prestacion))];
for (const p of prests) {
  const sub = casos.filter((c) => c.tipo_prestacion === p);
  console.log(`  ${p.padEnd(14)} (${sub.length}): ${tally(sub, "sentido_decision").map(([k, v]) => `${k} ${v}`).join(" · ")}`);
}

// 3. Causales dominantes por prestación (texto corto)
console.log(`\n── 7. Causales de decisión (muestra por prestación)`);
for (const p of prests) {
  const sub = casos.filter((c) => c.tipo_prestacion === p && c.causal_decision);
  if (!sub.length) continue;
  console.log(`  ▸ ${p.toUpperCase()}`);
  for (const c of sub.slice(0, 6)) console.log(`     - [${c.sentido_decision}] ${(c.causal_decision || "").slice(0, 150)}`);
}

// 4. Normas más citadas
const normasMap = new Map();
for (const c of casos) for (const n of (c.normas_citadas || [])) { const k = String(n).trim(); if (k) normasMap.set(k, (normasMap.get(k) || 0) + 1); }
console.log(`\n── 8. Normas más citadas (top 20)`);
[...normasMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}×  ${k}`));

// 5. Fuentes institucionales más citadas (por tipo + identificación)
const fuentesMap = new Map();
const porTipo = new Map();
for (const c of casos) for (const f of (c.fuentes_citadas || [])) {
  const tipo = String(f.tipo || "?").toLowerCase();
  const id = String(f.identificacion || "").trim();
  porTipo.set(tipo, (porTipo.get(tipo) || 0) + 1);
  if (id) { const k = `${tipo} · ${id}`; fuentesMap.set(k, (fuentesMap.get(k) || 0) + 1); }
}
console.log(`\n── 9. Fuentes institucionales — por tipo\n  ${[...porTipo.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}:${v}`).join(" · ")}`);
console.log(`\n── 10. Fuentes institucionales más citadas (top 25)`);
[...fuentesMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}×  ${k}`));

// 6. Mapa de vacíos: fuentes que citan los AOE vs. lo que hay en el repositorio.
//    Emparejamiento por "firma": tokens distintivos (números ≥3 díg y códigos OAL-\d+), que son
//    estables aunque el AOE agregue prefijos ("Concepto Bizagi ...", "Memorando ...").
const firmas = (s) => {
  const t = String(s || "").toLowerCase();
  const out = new Set();
  (t.match(/\d{3,}/g) || []).forEach((x) => out.add(x));
  (t.match(/oal[\s-]?\d{2,}/g) || []).forEach((x) => out.add(x.replace(/[\s-]/g, "")));
  return out;
};
const repoFirmas = new Set();
for (const r of repo) for (const f of firmas(`${r.codigo || ""} ${r.nombre || ""}`)) repoFirmas.add(f);
// Descarta lo que NO es documento del repositorio: normas positivas y actos administrativos del expediente.
const esNormaOActo = (id) => /\b(ley|decreto|art[ií]culo|art\.|c\.?p\.?a\.?c\.?a|c[oó]digo|resoluci[oó]n\s*sub|\bsub\s*\d|gnr|vpb)\b/i.test(id) || /^art[ií]culo/i.test(id.trim());
const enRepo = (id) => { const fs2 = [...firmas(id)]; return fs2.length > 0 && fs2.some((x) => repoFirmas.has(x)); };
const faltan = new Map();
let ruidoNorma = 0, yaEnRepo = 0;
for (const [k, v] of fuentesMap.entries()) {
  const tipo = k.split(" · ")[0];
  const id = k.split(" · ").slice(1).join(" · ") || "";
  if (tipo === "jurisprudencia") continue;             // la jurisprudencia no vive como doc del repo
  if (esNormaOActo(id)) { ruidoNorma += v; continue; } // norma/acto mal clasificado como fuente
  if (/^(no\s|ninguna|n\/a|sin\s|no identificada)/i.test(id.trim())) { ruidoNorma += v; continue; }
  if (enRepo(id)) { yaEnRepo += v; continue; }         // ya está en el repositorio
  faltan.set(k, v);
}
// Consolidar faltantes por firma (varias grafías del mismo doc → una sola línea).
const faltConsolidado = new Map();
for (const [k, v] of faltan.entries()) {
  const id = k.split(" · ").slice(1).join(" · ");
  const tipo = k.split(" · ")[0];
  const firmaKey = [...firmas(id)][0] || id.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  const key = `${tipo}|${firmaKey}`;
  const prev = faltConsolidado.get(key);
  if (prev) { prev.v += v; if (id.length > prev.label.length) prev.label = id; }
  else faltConsolidado.set(key, { tipo, label: id, v });
}
console.log(`\n── 11. VACÍOS: documentos institucionales citados por los AOE que NO están en el repositorio`);
console.log(`  (repo: ${repo.length} docs · ya-en-repo: ${yaEnRepo} citas · ruido norma/acto/placeholder descartado: ${ruidoNorma} citas)`);
[...faltConsolidado.values()].sort((a, b) => b.v - a.v).forEach(({ tipo, label, v }) => console.log(`  ${String(v).padStart(3)}×  ${tipo} · ${label}`));

console.log(`\n===================================================================`);
