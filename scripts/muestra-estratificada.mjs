/**
 * Muestra estratificada del histórico AOE (LOCAL, sin API).
 * Marco: 16.436 cédulas deduplicadas de los repartos 005-022.
 * Excluye (por ruta, gratis): (a) cédulas ya extraídas en aoe_casos, (b) rutas en carpetas
 * rotuladas INDEMNIZAC*. Estratifica por reparto con asignación proporcional. Determinista (seed fijo).
 * NOTA: la reliquidación 80% (SL3501/OAL-016) y la indemnización en carpetas genéricas NO se pueden
 * excluir aquí (no hay señal en la ruta) → se filtran por contenido al extraer.
 *   node scripts/muestra-estratificada.mjs [N]     (N = tamaño objetivo, default 300)
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const N = parseInt(process.argv[2] || "300", 10);
const SEED = 20260910; // determinismo: misma lista en cada corrida
const OUT = new URL("./muestra_estratificada.csv", import.meta.url);

// LCG simple para shuffle reproducible.
let _s = SEED >>> 0;
const rnd = () => ((_s = (1103515245 * _s + 12345) & 0x7fffffff) / 0x7fffffff);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// 1. Cargar rutas y dedup por cédula. Marca si la ruta está rotulada como indemnización.
const lines = fs.readFileSync(new URL("./aoe_paths.txt", import.meta.url), "utf8").split(/\r?\n/).filter(Boolean);
const porCedula = new Map();
for (const ruta of lines) {
  const c = ruta.match(/CC_(\d+)_AOE/i)?.[1]; if (!c) continue;
  const rep = ruta.match(/REPARTO (\d+)/i)?.[1] || "?";
  const esIndemFolder = /indemnizac/i.test(ruta);
  if (!porCedula.has(c)) porCedula.set(c, { ced: c, ruta, reparto: rep, esIndemFolder });
  else if (esIndemFolder) porCedula.get(c).esIndemFolder = true; // si alguna copia la rotula, cuenta
}
const totalDedup = porCedula.size;

// 2. Exclusiones gratis: ya extraídos + carpeta indemnización.
const { data: prev } = await sb.from("aoe_casos").select("cedula");
const yaExtraidas = new Set((prev ?? []).map((r) => String(r.cedula)));
let exIndem = 0, exPrev = 0;
const elegibles = [];
for (const v of porCedula.values()) {
  if (yaExtraidas.has(v.ced)) { exPrev++; continue; }
  if (v.esIndemFolder) { exIndem++; continue; }
  elegibles.push(v);
}

// 3. Estratificar por reparto, asignación proporcional (método del resto mayor).
const porRep = new Map();
for (const e of elegibles) { if (!porRep.has(e.reparto)) porRep.set(e.reparto, []); porRep.get(e.reparto).push(e); }
const reps = [...porRep.keys()].sort();
const totalEleg = elegibles.length;
const cuotas = reps.map((r) => { const size = porRep.get(r).length; const exacto = (size / totalEleg) * N; return { r, size, base: Math.floor(exacto), resto: exacto - Math.floor(exacto) }; });
let asignado = cuotas.reduce((s, c) => s + c.base, 0);
cuotas.sort((a, b) => b.resto - a.resto);
for (let i = 0; asignado < N && i < cuotas.length; i++, asignado++) cuotas[i].base++;
const cuotaPorRep = new Map(cuotas.map((c) => [c.r, Math.min(c.base, c.size)]));

// 4. Tomar aleatoriamente dentro de cada reparto.
const muestra = [];
for (const r of reps) {
  const g = shuffle(porRep.get(r).slice());
  for (let i = 0; i < cuotaPorRep.get(r); i++) muestra.push(g[i]);
}

// 5. Escribir CSV y resumen.
const rows = ["cedula,reparto,ruta"].concat(muestra.map((m) => `${m.ced},${m.reparto},"${m.ruta}"`));
fs.writeFileSync(OUT, rows.join("\n"), "utf8");

console.log(`\n===== MUESTRA ESTRATIFICADA (objetivo N=${N}) =====`);
console.log(`Marco deduplicado:        ${totalDedup}`);
console.log(`  − ya extraídos:         ${exPrev}`);
console.log(`  − carpeta indemnización:${String(exIndem).padStart(6)}  (exclusión por ruta)`);
console.log(`Pool elegible:            ${totalEleg}`);
console.log(`Muestra generada:         ${muestra.length}`);
console.log(`\nComposición por reparto (muestra / pool elegible del reparto):`);
for (const r of reps) console.log(`  R${r}: ${String(cuotaPorRep.get(r)).padStart(3)} / ${porRep.get(r).length}`);
console.log(`\nArchivo: ${OUT.pathname.replace(/^\//, "")}`);
console.log(`\nPendiente de filtrar POR CONTENIDO al extraer: reliquidación 80% (SL3501/OAL-016) e`);
console.log(`indemnización en carpetas genéricas (sin señal en la ruta). El extractor los descarta y repone cupo.`);
