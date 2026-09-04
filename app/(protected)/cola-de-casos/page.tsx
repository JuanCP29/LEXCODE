import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { puedeCoordinar } from "@/lib/auth/roles";
import { ColaCasos } from "@/components/cola/cola-casos";

export default async function ColaDeCasosPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user!.id).single();
  if (!puedeCoordinar(perfil?.rol)) redirect("/dashboard");

  return <ColaCasos />;
}
