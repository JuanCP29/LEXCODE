// ============================================================
// LEXCODE — Tipos TypeScript
// Alineados con supabase/schema.sql v3
// ============================================================

export type UserRol = "admin" | "abogado" | "revisor";
export type CasoEstado = "activo" | "archivado";
export type Pretension = "vejez" | "invalidez" | "sobrevivientes" | "indemnizacion" | "devolucion";
export type Jurisdiccion = "ordinaria" | "contencioso";
export type TipoConciliacion = "parametrica" | "condicional";
export type CuantiaTipo = "determinada" | "indeterminada";
export type FichaEstado = "borrador" | "en_revision" | "listo";
export type ArchivoTipo = "demanda_pdf" | "excel_proceso" | "lineamientos";

export interface Perfil {
  id: string;
  nombre_completo: string | null;
  rol: UserRol;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Caso {
  id: string;
  radicado: string;
  radicado_bizagi: string | null;
  nombre_demandante: string;
  cedula_demandante: string | null;
  expediente_pensional: string | null;
  despacho: string | null;
  pretension: Pretension | null;
  clase_pretension: string | null;
  jurisdiccion: Jurisdiccion | null;
  estado: CasoEstado;
  abogado_id: string;
  created_at: string;
  updated_at: string;
}

export interface FichaConciliacion {
  id: string;
  caso_id: string;

  // Parámetros de configuración
  tipo_conciliacion: TipoConciliacion | null;
  conciliable: boolean | null;
  directriz_conciliacion: string | null;
  resolucion_prestacion: string | null;
  semanas_cotizadas: number | null;
  tasa_aplicada: number | null;
  tasa_solicitada: number | null;
  cuantia_tipo: CuantiaTipo | null;
  cuantia_valor: number | null;
  pretende_intereses: boolean;
  pretende_indexacion: boolean;
  hay_fallo: boolean;
  sintesis_fallo: string | null;

  // 19 secciones
  sec_1_hechos: string | null;
  sec_2_pretensiones: string | null;
  sec_3_cuantia: string | null;
  sec_4_normas: string | null;
  sec_5_apelacion: string | null;
  sec_6_sentencia: string | null;
  sec_7_probatorio: string | null;
  sec_8_problema: string | null;
  sec_9_caducidad: string | null;
  sec_10_movimientos: string | null;
  sec_11_jurisprudencia: string | null;
  sec_12_doctrina: string | null;
  sec_13_comite_ext: string | null;
  sec_14_casos_similares: string | null;
  sec_15_politicas: string | null;
  sec_16_consideraciones: string | null;
  sec_17_riesgo: string | null;
  sec_18_recomendacion: string | null;
  sec_19_elaboro: string | null;

  estado: FichaEstado;
  docx_url: string | null;
  ia_prompt_usado: string | null;
  ia_respuesta_cruda: string | null;
  creado_por: string;
  created_at: string;
  updated_at: string;
}

export interface ArchivoProceso {
  id: string;
  caso_id: string;
  tipo: ArchivoTipo;
  storage_path: string;
  nombre_original: string;
  created_at: string;
}

// Tipos para formularios
export type CasoFormData = Omit<Caso, "id" | "abogado_id" | "created_at" | "updated_at">;
export type FichaFormData = Omit<FichaConciliacion, "id" | "creado_por" | "created_at" | "updated_at" | "docx_url" | "ia_prompt_usado" | "ia_respuesta_cruda">;
