import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: casos } = await sb.from("casos").select("id, radicado, radicado_bizagi, created_at, estado_flujo, despacho").eq("cedula_demandante","6196900").order("created_at");
for (const c of casos ?? []) {
  const { count } = await sb.from("fichas_conciliacion").select("id",{count:"exact",head:true}).eq("caso_id", c.id);
  const { count: arch } = await sb.from("archivos_proceso").select("id",{count:"exact",head:true}).eq("caso_id", c.id);
  console.log(`caso ${c.id}\n  radicado=${c.radicado} bizagi=${c.radicado_bizagi} estado=${c.estado_flujo}\n  created=${c.created_at}\n  fichas=${count} archivos=${arch}\n`);
}
