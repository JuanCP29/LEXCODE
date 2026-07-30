# Patrón de extracción documental y sugerencias con revisión humana

Referencia técnica derivada del análisis de la app hermana "Lexcode Docs v2"
(generador de Estudios de Procedencia). Documenta el patrón que queremos llevar
a la Ficha de Conciliación de LEXCODE.

## 1. Pipeline de extracción (multi-documento en una sola pasada)

```
Cliente arrastra N PDFs (Sentencia, Casación, AOE, SUB, traslado, actos…)
        │
        ▼
POST /api/blob/prefill-upload  (uno por archivo → Vercel Blob / Supabase Storage)
        │  devuelve la ruta/URL de cada archivo
        ▼
Server Action / API de extracción  (recibe las rutas, NO los binarios)
        │  descarga los PDFs, extrae texto, y los manda a la IA
        │  EN UNA SOLA LLAMADA para cruzar datos entre documentos
        ▼
Respuesta de DOS NIVELES (ver §2)
        │
        ▼
UI: auto-rellena campos de datos + muestra sugerencias en panel aparte
```

Clave: los documentos se analizan **juntos en una sola pasada** para poder
correlacionar datos (ej. el número de resolución sale del AOE/SUB, las fechas de
las sentencias, los valores del acto de cumplimiento).

## 2. Respuesta de dos niveles (el corazón del patrón)

La IA separa **hechos textuales** de **prosa redactada**:

```jsonc
{
  "ok": true,
  "data": {                          // NIVEL 1 — hechos verbatim → auto-rellenan campos
    "proceso.afiliado": "Alvaro Hurtado Gil",
    "proceso.cedula": "16664013",
    "proceso.radicado": "76001310502120240035401",
    "proceso.despacho1": "Juzgado Veintiuno Laboral del Circuito de Cali",
    "proceso.despacho2": "Tribunal Superior del Distrito Judicial Cali - Sala Laboral",
    "proceso.pretension1": "Vejez",
    "proceso.clasePretension": "Reliquidacion",
    "proceso.modificaChecked": true, // detecta estado procesal (modificó/revocó/confirmó)
    "aoe.oae": "SUB 88206 del 14 de marzo de 2024",
    "cumplimiento.valorFallo": "$14.987.886,71"
    // … 23 campos con claves namespaced (proceso.*, responsable.*, aoe.*, cumplimiento.*)
  },
  "suggestions": {                   // NIVEL 2 — prosa IA → panel de sugerencia (copiar)
    "sentidoCondena": "reliquidar la pensión de vejez… tasa 80%… retroactivo $14.987.886,71…",
    "antecedentes":  "<narrativa completa de hechos>",
    "analisis":      "<análisis jurídico completo>"
  },
  "fieldsFound": 23
}
```

- **`data`**: datos duros, verificables, con claves con espacio de nombre que mapean
  1:1 a los campos del formulario. Se auto-rellenan y se **resaltan** para revisión.
- **`suggestions`**: texto jurídico redactado por IA. **NO se auto-inserta.**

## 3. Patrón "sugerencia con copiar + revisión humana"

Para el contenido de alto riesgo (lo que ordena/recomienda), la app NO auto-rellena
el campo. En su lugar:

- Muestra la sugerencia en un **panel aparte** (encabezado "✦ Sugerencia — …").
- Botón **"Copiar"** al portapapeles.
- Disclaimer: *"Revisa antes de pegar. La sugerencia es generada por IA y puede
  contener errores."*
- El campo del formulario queda **vacío** hasta que el humano pega conscientemente.

Además, un campo determinístico separado arma la **entradilla factual** solo con datos
extraídos (ej. "Con fundamento en la sentencia proferida por [despacho], radicado
[X], modificado por [tribunal], se ordenó a Colpensiones…"), y la parte sustantiva
llega por copiar-pegar de la sugerencia.

**Auto-propagación:** una vez confirmado el "sentido de la condena", se replica
automáticamente a las secciones dependientes (Antecedentes, Recomendaciones). El
humano revisa una vez y cascada al resto.

## 4. Aplicación a LEXCODE (Ficha de Conciliación)

LEXCODE ya tiene la base: extracción por PDF, matriz de secciones con fuentes
controladas (`lib/ficha/matriz-secciones.ts`), y `criticalReview: true` en las
secciones 16 (Consideraciones), 17 (Evaluación del riesgo) y 18 (Recomendación).

Mejoras a implementar con este patrón:

1. **Extracción multi-documento en una pasada**: en vez de analizar cada documento
   por separado, mandar traslado + actos administrativos juntos a Claude y devolver
   respuesta de dos niveles (`data` + `suggestions`).

2. **Salida de dos niveles**:
   - `data` → encabezado y campos paramétricos (radicado, demandante, despacho,
     cuantía, fechas, resoluciones) — auto-rellenar + resaltar.
   - `suggestions` → secciones narrativas.

3. **Panel de sugerencia con copiar para las 3 secciones críticas (16, 17, 18)**:
   en el editor de ficha, en vez de auto-rellenar esas secciones, mostrar la
   sugerencia IA en un panel lateral con botón "Copiar" y el disclaimer "revisar
   antes de pegar". Las secciones de hechos/datos (1-4, 7) sí se auto-rellenan.
   Esto refuerza la regla ya adoptada: sin fuente → N/A; contenido de criterio →
   revisión humana obligatoria.

4. **Auto-propagación controlada**: reutilizar el texto confirmado de la sección 8
   (problema jurídico / objeto conciliable) como insumo de la 16/18, evitando
   re-generación divergente.

Archivos LEXCODE afectados (referencia, no exhaustivo):
- `lib/ficha/construir-prompt-v2.ts` — devolver `{ data, suggestions }` de dos niveles
- `app/api/generar-ficha/route.ts` — persistir data auto y suggestions aparte
- `app/(protected)/generador/[caso_id]/ficha/editor-ficha.tsx` + `components/fichas/caja-ia.tsx`
  — panel de sugerencia con "Copiar" + disclaimer para secciones criticalReview
- `components/fichas/panel-documentos-extra.tsx` — envío multi-documento en una pasada
