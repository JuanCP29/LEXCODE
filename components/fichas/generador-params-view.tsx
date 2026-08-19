"use client";

import { useState } from "react";
import { FormularioParametrico } from "@/components/fichas/formulario-parametrico";
import { PanelDocumentosExtra } from "@/components/fichas/panel-documentos-extra";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CamposExtraidos = Record<string, any>;

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
  const [valoresPrellenados, setValoresPrellenados] = useState<CamposExtraidos | null>(null);

  function handleCampos(campos: CamposExtraidos) {
    setValoresPrellenados(campos);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
      {/* Formulario por pasos */}
      <FormularioParametrico
        casoId={casoId}
        casoData={casoData}
        valoresPrellenados={valoresPrellenados ?? undefined}
      />

      {/* Panel lateral: prerrellenar desde PDFs */}
      <PanelDocumentosExtra onCamposExtraidos={handleCampos} />
    </div>
  );
}
