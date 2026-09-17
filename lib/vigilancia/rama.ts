import crypto from "crypto";

// Cliente de la Consulta de Procesos Nacional Unificada (CPNU) — Fuente 1 del Vigilante Judicial.
// A diferencia de app/api/rama-judicial/route.ts (que devuelve solo las últimas 3 actuaciones
// para el preview de la ficha), aquí traemos el HISTORIAL COMPLETO paginado para el backfill.

const BASE = "https://consultaprocesos.ramajudicial.gov.co:448/api/v2";
const HEADERS = { Accept: "application/json", "User-Agent": "Mozilla/5.0 (LEXCODE)" };

export type ActuacionRama = {
  fecha: string | null;        // fechaActuacion (fecha oficial de la Rama)
  actuacion: string | null;    // tipo de actuación
  anotacion: string | null;
  fechaRegistro: string | null;
  hash: string;                // sha1(fecha + actuacion + anotacion)
};

export type ProcesoRama = {
  encontrado: boolean;
  idProceso: string | null;
  despacho: string | null;
  sujetos: string | null;
  ciudad: string | null;
  departamento: string | null;
  fechaRadicacion: string | null;
  fechaUltimaActuacion: string | null;
  privado: boolean;
  actuaciones: ActuacionRama[];
};

export function hashActuacion(fecha: unknown, actuacion: unknown, anotacion: unknown): string {
  return crypto
    .createHash("sha1")
    .update(`${fecha ?? ""}|${actuacion ?? ""}|${anotacion ?? ""}`)
    .digest("hex");
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

// CPNU limita por IP (el PoC observó bloqueo tras ~29 consultas seguidas). Ante 429/5xx o
// timeout, reintenta con backoff exponencial en vez de fallar de una.
async function fetchConTimeout(url: string, ms = 15000, reintentos = 2): Promise<Response> {
  for (let intento = 0; ; intento++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { headers: HEADERS, cache: "no-store", signal: ctrl.signal });
      if ((r.status === 429 || r.status >= 500) && intento < reintentos) {
        await pausa(1000 * Math.pow(3, intento)); // 1s, 3s
        continue;
      }
      return r;
    } catch (e) {
      if (intento < reintentos) {
        await pausa(1000 * Math.pow(3, intento));
        continue;
      }
      throw e;
    } finally {
      clearTimeout(t);
    }
  }
}

export function limpiarRadicado(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

// Consulta un proceso por radicado y trae TODAS sus actuaciones (todas las páginas).
export async function consultarProceso(radicadoRaw: string): Promise<ProcesoRama> {
  const radicado = limpiarRadicado(radicadoRaw);
  const vacio: ProcesoRama = {
    encontrado: false, idProceso: null, despacho: null, sujetos: null, ciudad: null,
    departamento: null, fechaRadicacion: null, fechaUltimaActuacion: null, privado: false,
    actuaciones: [],
  };
  if (radicado.length < 20) return vacio;

  const rProc = await fetchConTimeout(
    `${BASE}/Procesos/Consulta/NumeroRadicacion?numero=${radicado}&SoloActivos=false&pagina=1`
  );
  if (!rProc.ok) throw new Error(`La Rama Judicial respondió ${rProc.status}`);
  const dProc = await rProc.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proceso = Array.isArray(dProc?.procesos) ? (dProc.procesos as any[])[0] : null;
  if (!proceso?.idProceso) return vacio;

  const actuaciones = await traerActuaciones(String(proceso.idProceso));

  return {
    encontrado: true,
    idProceso: String(proceso.idProceso),
    despacho: proceso.despacho ?? null,
    sujetos: proceso.sujetosProcesales ?? null,
    ciudad: proceso.ciudad ?? proceso.departamento ?? null,
    departamento: proceso.departamento ?? null,
    fechaRadicacion: proceso.fechaProceso ?? null,
    fechaUltimaActuacion: proceso.fechaUltimaActuacion ?? null,
    privado: proceso.esPrivado === true,
    actuaciones,
  };
}

// Trae todas las páginas de actuaciones (la Rama pagina de a ~50; cortamos por seguridad).
async function traerActuaciones(idProceso: string): Promise<ActuacionRama[]> {
  const todas: ActuacionRama[] = [];
  for (let pagina = 1; pagina <= 40; pagina++) {
    const r = await fetchConTimeout(`${BASE}/Proceso/Actuaciones/${idProceso}?pagina=${pagina}`);
    if (!r.ok) {
      if (pagina === 1) throw new Error(`La Rama Judicial (actuaciones) respondió ${r.status}`);
      break;
    }
    const d = await r.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lote: any[] = Array.isArray(d?.actuaciones) ? d.actuaciones : [];
    if (lote.length === 0) break;
    for (const a of lote) {
      todas.push({
        fecha: a.fechaActuacion ?? null,
        actuacion: a.actuacion ?? null,
        anotacion: a.anotacion ?? null,
        fechaRegistro: a.fechaRegistro ?? null,
        hash: hashActuacion(a.fechaActuacion, a.actuacion, a.anotacion),
      });
    }
    const totalPaginas = Number(d?.paginacion?.cantidadPaginas ?? d?.cantidadPaginas ?? 1);
    if (Number.isFinite(totalPaginas) && pagina >= totalPaginas) break;
  }
  // Más recientes primero
  return todas.sort(
    (a, b) => new Date(b.fecha ?? 0).getTime() - new Date(a.fecha ?? 0).getTime()
  );
}
