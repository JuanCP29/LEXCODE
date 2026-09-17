/**
 * Verificación de un proceso vigilado: qué quedó registrado en FoQs (BD) vs. qué devuelve
 * CPNU (F1) en vivo, para el radicado dado. También lista fuentes consultadas vs. pendientes.
 *   node scripts/verificar-vigilancia.mjs 68001310500620260009000
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BASE = "https://consultaprocesos.ramajudicial.gov.co:448/api/v2";
const HEADERS = { Accept: "application/json", "User-Agent": "Mozilla/5.0 (LEXCODE)" };

async function main() {
  const radicado = (process.argv[2] || "").replace(/\D/g, "");
  if (radicado.length < 20) { console.error("Pasa un radicado válido"); process.exit(1); }

  // ---------- 1. Lo que quedó en FoQs ----------
  const { data: proc } = await sb.from("procesos_vigilados").select("*").eq("radicado", radicado).maybeSingle();
  if (!proc) { console.log("No hay proceso registrado con ese radicado."); return; }

  const { data: acts } = await sb.from("actuaciones_vigilancia")
    .select("fecha_rama, actuacion, anotacion, fecha_registro, fecha_sistema, hash")
    .eq("proceso_id", proc.id).order("fecha_rama", { ascending: false });
  const { data: novs } = await sb.from("novedades_vigilancia")
    .select("resumen, nivel, atendida, created_at").eq("proceso_id", proc.id);

  console.log("═".repeat(70));
  console.log("REGISTRADO EN FoQs");
  console.log("═".repeat(70));
  console.log("radicado           :", proc.radicado);
  console.log("id_proceso_externo :", proc.id_proceso_externo);
  console.log("pagina_origen      :", proc.pagina_origen, "  estado:", proc.estado);
  console.log("despacho           :", proc.despacho);
  console.log("sujetos            :", proc.sujetos);
  console.log("ultimo_movimiento  :", proc.ultimo_movimiento);
  console.log("backfill_completo  :", proc.backfill_completo);
  console.log(`\nActuaciones almacenadas: ${acts?.length ?? 0}`);
  (acts || []).forEach((a, i) => {
    console.log(`\n  [${i + 1}] fecha_rama    : ${a.fecha_rama}`);
    console.log(`      actuacion     : ${a.actuacion}`);
    console.log(`      anotacion     : ${a.anotacion}`);
    console.log(`      fecha_registro: ${a.fecha_registro}`);
    console.log(`      fecha_sistema : ${a.fecha_sistema}  (captura FoQs)`);
    console.log(`      hash          : ${a.hash}`);
  });
  console.log(`\nNovedades: ${novs?.length ?? 0}`, (novs || []).map(n => `${n.nivel}${n.atendida ? "(atendida)" : ""}`).join(", "));

  // ---------- 2. CPNU en vivo (F1) ----------
  console.log("\n" + "═".repeat(70));
  console.log("CPNU EN VIVO (F1) — fuente");
  console.log("═".repeat(70));
  const rP = await fetch(`${BASE}/Procesos/Consulta/NumeroRadicacion?numero=${radicado}&SoloActivos=false&pagina=1`, { headers: HEADERS });
  const dP = await rP.json();
  const p0 = Array.isArray(dP?.procesos) ? dP.procesos[0] : null;
  if (!p0) { console.log("CPNU no devuelve el proceso ahora."); }
  else {
    console.log("idProceso          :", p0.idProceso);
    console.log("despacho           :", p0.despacho);
    console.log("sujetosProcesales  :", p0.sujetosProcesales);
    console.log("fechaUltimaActuacion (resumen):", p0.fechaUltimaActuacion);
    const rA = await fetch(`${BASE}/Proceso/Actuaciones/${p0.idProceso}?pagina=1`, { headers: HEADERS });
    const dA = await rA.json();
    const live = Array.isArray(dA?.actuaciones) ? dA.actuaciones : [];
    console.log(`\nActuaciones en CPNU (pagina 1): ${live.length}  |  paginacion:`, JSON.stringify(dA?.paginacion || dA?.cantidadPaginas || "n/d"));
    live.forEach((a, i) => {
      console.log(`\n  [${i + 1}] fechaActuacion: ${a.fechaActuacion}`);
      console.log(`      actuacion     : ${a.actuacion}`);
      console.log(`      anotacion     : ${a.anotacion}`);
      console.log(`      fechaRegistro : ${a.fechaRegistro}`);
    });

    // ---------- 3. Cotejo ----------
    console.log("\n" + "═".repeat(70));
    console.log("COTEJO");
    console.log("═".repeat(70));
    const enBD = new Set((acts || []).map(a => a.hash));
    // recomputo hash igual que lib/vigilancia/rama.ts
    const { createHash } = await import("node:crypto");
    const h = (f, ac, an) => createHash("sha1").update(`${f ?? ""}|${ac ?? ""}|${an ?? ""}`).digest("hex");
    let faltan = 0, coinciden = 0;
    for (const a of live) {
      const hh = h(a.fechaActuacion, a.actuacion, a.anotacion);
      if (enBD.has(hh)) coinciden++; else { faltan++; console.log("  ⚠ en CPNU pero NO en FoQs:", a.fechaActuacion, a.actuacion); }
    }
    console.log(`\n  Coinciden: ${coinciden}/${live.length}  ·  faltan en FoQs: ${faltan}`);
    console.log(`  Actuaciones en FoQs no presentes en CPNU pagina 1: ${(acts || []).filter(a => !live.some(l => h(l.fechaActuacion, l.actuacion, l.anotacion) === a.hash)).length}`);
  }

  console.log("\n" + "═".repeat(70));
  console.log("FUENTES");
  console.log("═".repeat(70));
  console.log("  Consultada : F1 CPNU (rama_unificada)");
  console.log("  NO consultadas (v2): F2 Publicaciones · F3 SIUGJ (reCAPTCHA) · F4 SAMAI · TYBA");
}
main().catch(e => { console.error(e); process.exit(1); });
