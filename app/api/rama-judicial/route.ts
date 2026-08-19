import { NextRequest, NextResponse } from "next/server";

// Proxy server-side a la Consulta de Procesos Nacional Unificada (CPNU) de la Rama Judicial.
// Evita CORS y expone solo lo necesario: las últimas actuaciones del proceso.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BASE = "https://consultaprocesos.ramajudicial.gov.co:448/api/v2";
const HEADERS = { Accept: "application/json", "User-Agent": "Mozilla/5.0 (LEXCODE)" };

async function fetchConTimeout(url: string, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers: HEADERS, cache: "no-store", signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function GET(request: NextRequest) {
  const radicado = (request.nextUrl.searchParams.get("radicado") ?? "").replace(/\D/g, "");
  if (radicado.length < 20) {
    return NextResponse.json({ error: "Ingresa el radicado completo (23 dígitos)." }, { status: 400 });
  }

  try {
    // 1. Buscar el proceso por número de radicación
    const rProc = await fetchConTimeout(
      `${BASE}/Procesos/Consulta/NumeroRadicacion?numero=${radicado}&SoloActivos=false&pagina=1`
    );
    if (!rProc.ok) throw new Error(`La Rama Judicial respondió ${rProc.status}`);
    const dProc = await rProc.json();
    const proceso = Array.isArray(dProc?.procesos) ? dProc.procesos[0] : null;

    if (!proceso?.idProceso) {
      return NextResponse.json({ encontrado: false, actuaciones: [] });
    }

    // 2. Actuaciones del proceso
    const rAct = await fetchConTimeout(`${BASE}/Proceso/Actuaciones/${proceso.idProceso}?pagina=1`);
    if (!rAct.ok) throw new Error(`La Rama Judicial (actuaciones) respondió ${rAct.status}`);
    const dAct = await rAct.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actuaciones = (Array.isArray(dAct?.actuaciones) ? dAct.actuaciones : [])
      .slice()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => new Date(b.fechaActuacion).getTime() - new Date(a.fechaActuacion).getTime())
      .slice(0, 3)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((a: any) => ({
        fecha: a.fechaActuacion ?? null,
        actuacion: a.actuacion ?? null,
        anotacion: a.anotacion ?? null,
        fechaRegistro: a.fechaRegistro ?? null,
      }));

    return NextResponse.json({
      encontrado: true,
      proceso: {
        despacho: proceso.despacho ?? null,
        sujetos: proceso.sujetosProcesales ?? null,
        fechaRadicacion: proceso.fechaProceso ?? null,
        fechaUltimaActuacion: proceso.fechaUltimaActuacion ?? null,
      },
      actuaciones,
    });
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError"
      ? "La Rama Judicial no respondió a tiempo. Intenta de nuevo."
      : e instanceof Error ? e.message : "Error consultando la Rama Judicial";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
