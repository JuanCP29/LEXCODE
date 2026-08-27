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
    .select("id, nombre, tipo_documento, codigo, fecha_directriz, pretension, clase_pretension, nombre_original, activo, created_at, directriz_tipologias(tipologia_id)")
    .order("pretension")
    .order("nombre");

  return (
    <div className="max-w-[1400px] space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Repositorio de documentos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Directrices, memorandos y lineamientos disponibles para consulta
          y análisis de casos.
        </p>
      </div>
      <DirectricesAdmin directrices={directrices ?? []} />
    </div>
  );
}
