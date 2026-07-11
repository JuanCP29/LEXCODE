import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ConfiguracionPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-muted-foreground mt-1">Ajustes de tu cuenta</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Correo</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Nombre</span>
            <span className="font-medium">{perfil?.nombre_completo ?? "—"}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Rol</span>
            <span className="font-medium capitalize">{perfil?.rol ?? "—"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
