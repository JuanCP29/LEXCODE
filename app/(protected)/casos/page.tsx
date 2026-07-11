import { createClient } from "@/lib/supabase/server";
import { TablaCasos } from "@/components/casos/tabla-casos";
import { CasosHeader } from "@/components/casos/casos-header";

export default async function CasosPage() {
  const supabase = createClient();

  const { data: casos } = await supabase
    .from("casos")
    .select("*, fichas_conciliacion(id, estado)")
    .order("created_at", { ascending: false });

  const total = casos?.length ?? 0;

  return (
    <div className="space-y-5 max-w-6xl">
      <CasosHeader total={total} />
      <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
        <TablaCasos casos={casos ?? []} />
      </div>
    </div>
  );
}
