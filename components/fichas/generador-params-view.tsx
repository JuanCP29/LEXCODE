"use client";

import { useState } from "react";
import { FormularioParametrico } from "@/components/fichas/formulario-parametrico";
import { PanelDocumentosExtra } from "@/components/fichas/panel-documentos-extra";
import { PanelInsumos } from "@/components/fichas/panel-insumos";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CamposExtraidos = Record<string, any>;

interface GeneradorParamsViewProps {
  casoId: string;
  casoData: {
    pretension: string | null;
    clase_pretension: string | null;
    jurisdiccion: string | null;
  };
}

export function GeneradorParamsView({ casoId, casoData }: GeneradorParamsViewProps) {
  const [valoresPrellenados, setValoresPrellenados] = useState<CamposExtraidos | null>(null);

  function handleCampos(campos: CamposExtraidos) {
    setValoresPrellenados(campos);
  }

  return (
    <div className="space-y-5">
      {/* Estado de insumos del caso */}
      <PanelInsumos casoId={casoId} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-start">
        {/* Formulario */}
        <FormularioParametrico
          casoId={casoId}
          casoData={casoData}
          valoresPrellenados={valoresPrellenados ?? undefined}
        />

        {/* Panel lateral PDFs */}
        <PanelDocumentosExtra onCamposExtraidos={handleCampos} />
      </div>
    </div>
  );
}
