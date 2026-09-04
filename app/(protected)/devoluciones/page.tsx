import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { puedeCoordinar } from "@/lib/auth/roles";
import { DevolucionesPanel } from "@/components/devoluciones/devoluciones-panel";

export default async function DevolucionesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  if (!puedeCoordinar(perfil?.rol)) redirect("/dashboard");

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-bold text-foreground">Devoluciones</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Casos que un sustanciador devolvió por mala asignación · reasígnalos con su causal a la vista
        </p>
      </div>
      <DevolucionesPanel />
    </div>
  );
}
