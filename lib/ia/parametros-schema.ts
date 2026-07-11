import { z } from "zod";

export const CLASES_POR_PRETENSION: Record<string, string[]> = {
  vejez: [
    "Reliquidación 80%",
    "Reliquidación IBL",
    "Reconocimiento inicial",
    "Retroactivo",
  ],
  invalidez: [
    "Reconocimiento inicial",
    "Reliquidación",
    "Revisión PCL",
  ],
  sobrevivientes: [
    "Reconocimiento inicial",
    "Sustitución",
    "Cuota parte",
  ],
  indemnizacion: [
    "Reliquidación",
    "Reconocimiento inicial",
  ],
  devolucion: [
    "Devolución saldos RAIS",
    "Devolución aportes voluntarios",
  ],
};

export const DIRECTRICES = [
  "SL3501-2022",
  "SU-230-2015",
  "IBL 10 años",
  "Otra",
];

export const parametrosSchema = z.object({
  // Bloque 1 — Conciliabilidad
  conciliable:             z.boolean(),
  directriz_conciliacion:  z.string().optional(),

  // Bloque 2 — Pretensión
  pretension:              z.enum(["vejez", "invalidez", "sobrevivientes", "indemnizacion", "devolucion"]),
  clase_pretension:        z.string().min(1, "Selecciona la clase de pretensión"),
  resolucion_prestacion:   z.string().optional(),
  semanas_cotizadas:       z.number().positive().optional().nullable(),
  tasa_aplicada:           z.number().min(0).max(100).optional().nullable(),
  tasa_solicitada:         z.number().min(0).max(100).optional().nullable(),

  // Bloque 3 — Cuantía
  cuantia_tipo:            z.enum(["indeterminada", "determinada"]),
  cuantia_valor:           z.number().positive().optional().nullable(),

  // Bloque 4 — Pretensiones adicionales
  pretende_intereses:      z.boolean(),
  pretende_indexacion:     z.boolean(),

  // Bloque 5 — Tipo de proceso
  jurisdiccion:            z.enum(["ordinaria", "contencioso"]),
  tipo_conciliacion:       z.enum(["parametrica", "condicional"]),
  hay_fallo:               z.boolean(),
  sintesis_fallo:          z.string().optional(),
  fecha_diligencia:            z.string().optional().nullable(),
  caducidad:                   z.enum(["SI", "NO", "NO APLICA"]).optional().nullable(),
  expediente_pensional_aplica: z.enum(["SI", "NO", "NO APLICA"]).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.conciliable && !data.directriz_conciliacion) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Selecciona la directriz de conciliación",
      path: ["directriz_conciliacion"],
    });
  }
  if (data.cuantia_tipo === "determinada" && !data.cuantia_valor) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Ingresa el valor de la cuantía",
      path: ["cuantia_valor"],
    });
  }
  if (data.hay_fallo && !data.sintesis_fallo?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Ingresa la síntesis del fallo",
      path: ["sintesis_fallo"],
    });
  }
});

export type ParametrosFormData = z.infer<typeof parametrosSchema>;
