import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ROL } from "@/lib/auth/roles";
import { OrganizacionesPanel } from "@/components/admin/organizaciones-panel";

export default async function OrganizacionesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== ROL.SUPERADMIN) redirect("/dashboard");

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-bold text-foreground">Organizaciones</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Panel del Propietario · crea clientes y su primer Coordinador
        </p>
      </div>
      <OrganizacionesPanel />
    </div>
  );
}
