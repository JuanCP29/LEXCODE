import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DirectricesAdmin } from "@/components/directrices/directrices-admin";

export default async function DirectricesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (perfil?.rol !== "admin") {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-bold">Acceso restringido</h1>
        <p className="text-muted-foreground mt-2">
          Esta sección es solo para administradores.
        </p>
      </div>
    );
  }

  const { data: directrices } = await supabase
    .from("directrices_conciliacion")
    .select("id, nombre, pretension, clase_pretension, nombre_original, activo, created_at")
    .order("pretension")
    .order("nombre");

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Directrices de Conciliación</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Repositorio permanente de reglas de conciliación por pretensión.
          Se inyectan automáticamente al generar cada ficha.
        </p>
      </div>
      <DirectricesAdmin directrices={directrices ?? []} />
    </div>
  );
}
