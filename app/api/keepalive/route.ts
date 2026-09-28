import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Keepalive: una petición diaria (Vercel Cron) que toca la base por el API gateway de Supabase
// para que el proyecto NO se pause por inactividad en el plan gratuito. Es de solo lectura.
// Si CRON_SECRET está configurado en Vercel, exige el header que Vercel Cron envía.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  try {
    const sb = createAdminClient();
    // Consulta trivial a través de PostgREST → cuenta como actividad del proyecto.
    const { error } = await sb.from("perfiles").select("id").limit(1);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
