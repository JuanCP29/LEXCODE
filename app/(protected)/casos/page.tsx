import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ROL } from "@/lib/auth/roles";
import { TablaCasos } from "@/components/casos/tabla-casos";
import { CasosHeader } from "@/components/casos/casos-header";

export default async function CasosPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: yo } = await supabase.from("perfiles").select("rol").eq("id", user!.id).single();
  if (yo?.rol === ROL.SUPERADMIN) redirect("/dashboard");

  // Reparto = los casos asignados a MÍ (el coordinador solo ve lo que se autoasignó;
  // la bolsa completa para distribuir vive en Asignaciones).
  const { data: casos } = await supabase
    .from("casos")
    .select("*, fichas_conciliacion(id, estado), contestaciones(sec_hechos, sec_pretensiones, sec_defensa)")
    .eq("asignado_a", user!.id)
    .order("created_at", { ascending: false });

  const total = casos?.length ?? 0;

  return (
    <div className="space-y-5 max-w-[1400px]">
      <CasosHeader total={total} />
      <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
        <TablaCasos casos={casos ?? []} currentUserId={user?.id ?? null} />
      </div>
    </div>
  );
}
