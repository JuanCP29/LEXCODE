import { consultarProceso, type ActuacionRama } from "./rama";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any; // SupabaseClient (admin o server) — tipado laxo para no acoplar versión

export type ResultadoSync = {
  radicado: string;
  encontrado: boolean;
  nuevas: number;       // actuaciones nuevas insertadas
  novedades: number;    // novedades generadas (0 en el backfill inicial)
  error?: string;
};

// Palabras clave que convierten una actuación en NOVEDAD DE ACCIÓN (diferenciador FoQs):
// disparan preparar el escrito o agendar la audiencia.
const PATRON_ACCION =
  /(corre\s+traslado|traslado\s+de\s+la\s+demanda|admite\s+la\s+demanda|contestaci[oó]n|fija\s+fecha|se[ñn]ala\s+fecha|audiencia|requerimiento|niega|fallo|sentencia)/i;

function nivelDe(a: ActuacionRama): "accion" | "info" {
  const t = `${a.actuacion ?? ""} ${a.anotacion ?? ""}`;
  return PATRON_ACCION.test(t) ? "accion" : "info";
}

function resumenDe(a: ActuacionRama): string {
  const tipo = (a.actuacion ?? "Actuación").trim();
  const nota = (a.anotacion ?? "").trim();
  return nota ? `${tipo} — ${nota}`.slice(0, 400) : tipo.slice(0, 400);
}

function fechaISO(v: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Sincroniza un proceso vigilado con la Rama Judicial.
 * - Trae el historial completo (Fuente 1 / CPNU).
 * - Inserta solo las actuaciones cuyo hash no existía (dedup por unique(proceso_id, hash)).
 * - Crea `novedades` por cada actuación nueva, SALVO en el backfill inicial
 *   (cuando el proceso aún no tenía backfill_completo): ahí solo se carga el historial.
 */
export async function sincronizarProceso(
  sb: Sb,
  proceso: { id: string; radicado: string; backfill_completo: boolean }
): Promise<ResultadoSync> {
  const res: ResultadoSync = {
    radicado: proceso.radicado, encontrado: false, nuevas: 0, novedades: 0,
  };

  let datos;
  try {
    datos = await consultarProceso(proceso.radicado);
  } catch (e) {
    res.error = e instanceof Error ? e.message : "Error consultando la Rama Judicial";
    return res;
  }

  if (!datos.encontrado) {
    await sb.from("procesos_vigilados")
      .update({ estado: datos.privado ? "privado" : "no_encontrado", updated_at: new Date().toISOString() })
      .eq("id", proceso.id);
    return res;
  }
  res.encontrado = true;

  // Hashes ya conocidos para este proceso
  const { data: existentes } = await sb
    .from("actuaciones_vigilancia").select("hash").eq("proceso_id", proceso.id);
  const conocidos = new Set<string>((existentes ?? []).map((r: { hash: string }) => r.hash));

  const esBackfill = !proceso.backfill_completo;
  const nuevas = datos.actuaciones.filter((a) => !conocidos.has(a.hash));

  for (const a of nuevas) {
    const { data: ins, error } = await sb
      .from("actuaciones_vigilancia")
      .insert({
        proceso_id: proceso.id,
        fecha_rama: fechaISO(a.fecha),
        actuacion: a.actuacion,
        anotacion: a.anotacion,
        fecha_registro: fechaISO(a.fechaRegistro),
        hash: a.hash,
      })
      .select("id")
      .single();
    if (error || !ins) continue; // colisión de hash concurrente → se ignora
    res.nuevas += 1;

    if (!esBackfill) {
      await sb.from("novedades_vigilancia").insert({
        proceso_id: proceso.id,
        actuacion_id: ins.id,
        resumen: resumenDe(a),
        nivel: nivelDe(a),
      });
      res.novedades += 1;
    }
  }

  // Actualiza cabecera del proceso
  const ultima = datos.actuaciones[0]; // ya vienen desc
  await sb.from("procesos_vigilados").update({
    id_proceso_externo: datos.idProceso,
    despacho: datos.despacho,
    sujetos: datos.sujetos,
    ciudad: datos.ciudad,
    departamento: datos.departamento,
    estado: "activo",
    ultimo_movimiento: fechaISO(datos.fechaUltimaActuacion) ?? fechaISO(ultima?.fecha ?? null),
    ultima_actuacion_hash: ultima?.hash ?? proceso.radicado,
    backfill_completo: true,
    updated_at: new Date().toISOString(),
  }).eq("id", proceso.id);

  return res;
}
