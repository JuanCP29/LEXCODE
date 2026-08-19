"use client";

import { FormularioParametrico } from "@/components/fichas/formulario-parametrico";

interface GeneradorParamsViewProps {
  casoId: string;
  casoData: {
    pretension: string | null;
    clase_pretension: string | null;
    jurisdiccion: string | null;
    radicado?: string | null;
    radicado_bizagi?: string | null;
    nombre_demandante?: string | null;
    cedula_demandante?: string | null;
    despacho?: string | null;
  };
}

export function GeneradorParamsView({ casoId, casoData }: GeneradorParamsViewProps) {
  return (
    <div className="space-y-5">
      <FormularioParametrico casoId={casoId} casoData={casoData} />
    </div>
  );
}
