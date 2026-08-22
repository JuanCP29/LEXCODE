"use client";

import { useState } from "react";
import { FormularioParametrico } from "@/components/fichas/formulario-parametrico";
import { PanelDocumentosExtra } from "@/components/fichas/panel-documentos-extra";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CamposExtraidos = Record<string, any>;

export type DocumentoPrevio = {
  id: string;
  tipo: string | null;
  nombre: string;
  created_at: string;
  url: string | null;
};

interface GeneradorParamsViewProps {
  casoId: string;
  documentos?: DocumentoPrevio[];
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

export function GeneradorParamsView({ casoId, casoData, documentos }: GeneradorParamsViewProps) {
  const [valoresPrellenados, setValoresPrellenados] = useState<CamposExtraidos | null>(null);
  const [sintesisHechos, setSintesisHechos] = useState<string | null>(null);
  const [pretensiones, setPretensiones] = useState<string | null>(null);
  const [cuantia, setCuantia] = useState<string | null>(null);
  const [normas, setNormas] = useState<string | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const [consideraciones, setConsideraciones] = useState<string | null>(null);
  const [pretensionDet, setPretensionDet] = useState<string | null>(null);
  const [claseDet, setClaseDet] = useState<string | null>(null);
  const [causanteNombre, setCausanteNombre] = useState<string | null>(null);
  const [causanteCedula, setCausanteCedula] = useState<string | null>(null);

  function handleCampos(campos: CamposExtraidos) {
    setValoresPrellenados(campos);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleSugerencias(s: any) {
    setSintesisHechos(s?.sintesis_hechos ?? null);
    setPretensiones(s?.pretensiones ?? null);
    setCuantia(s?.cuantia ?? null);
    setNormas(s?.normas ?? null);
    setProblema(s?.problema_juridico ?? null);
    setConsideraciones(s?.consideraciones ?? null);
    setPretensionDet(s?.pretension ?? null);
    setClaseDet(s?.clase_pretension ?? null);
    setCausanteNombre(s?.causante_nombre ?? null);
    setCausanteCedula(s?.causante_cedula ?? null);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
      {/* Formulario por pasos */}
      <FormularioParametrico
        casoId={casoId}
        casoData={casoData}
        valoresPrellenados={valoresPrellenados ?? undefined}
        sintesisHechosSugerida={sintesisHechos}
        pretensionesSugerida={pretensiones}
        cuantiaSugerida={cuantia}
        normasSugerida={normas}
        problemaSugerido={problema}
        consideracionesSugerida={consideraciones}
        pretensionSugerida={pretensionDet}
        claseSugerida={claseDet}
        causanteNombreSugerido={causanteNombre}
        causanteCedulaSugerida={causanteCedula}
      />

      {/* Panel lateral: ingesta + documentos previos */}
      <PanelDocumentosExtra onCamposExtraidos={handleCampos} onSugerencias={handleSugerencias} despacho={casoData.despacho} documentos={documentos} casoId={casoId} />
    </div>
  );
}
