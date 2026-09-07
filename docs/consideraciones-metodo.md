# Sección CONSIDERACIONES — Anatomía, rúbrica y plan (basado en 5 casos oro)

> Documento de trabajo (fase de diagnóstico). Base para (a) el prompt especializado,
> (b) el few-shot y (c) el set de evaluación. Los casos se referencian por número/tipo;
> los ejemplos originales contienen datos personales y deben anonimizarse antes de usarse.

## 1. Muestra estudiada
| Caso | Pretensión | Firma | Eje del argumento | Riesgo | Recom. |
|---|---|---|---|---|---|
| 4 | Pensión especial de **alto riesgo** (bomberos) | Mejía & Asociados | **Doctrina interna** (Decreto 2090/2003; Circular 15/2015; OAL-01/2020; concepto GNR BZ_2016_12472081) + subsunción | Medio alto | NO CONCILIAR |
| 5 | **Reliquidación** de vejez (IBL / tasa) | Mejía & Asociados | **Cálculo** (art. 34 Ley 100, fórmula r=65.50−0.50s, tablas) + Memorando OAL-016/2023 | Medio alto | NO CONCILIAR |
| 8 | **Sobrevivientes** (compañera permanente) | Lawyer's Ltda | **Prueba** (investigación admin. JAHV McGregor; documentos del causante) + art. 47 + SU-149/2021 | Medio bajo (4 criterios) | NO CONCILIAR |
| 9 | **Ineficacia de traslado** RPM↔RAIS | Lawyer's Ltda | **Jurisprudencia/defensa** (SU-107/2024; C-1024/2004); Colpensiones demandada pasiva | Medio (4 criterios) | NO CONCILIAR |
| 10 | **Sobrevivientes** (cónyuge separada de hecho) | Lawyer's Ltda | **Prueba + presunción de legalidad** (investigación COLCO; art. 167 CGP) + SU-149/2021, T-964/2014 | Medio | NO CONCILIAR |

## 2. Anatomía común (esqueleto del razonamiento)
Todas las Consideraciones siguen, con variaciones, esta secuencia:

1. **Delimitación de la controversia** — qué se pide y en qué calidad; problema jurídico concreto.
2. **Antecedentes administrativos** — resoluciones (SUB/DPE), radicados, investigaciones; qué negó/reconoció Colpensiones y por qué.
3. **Datos duros del caso** — semanas, edad, IBL, fechas, certificaciones (a menudo **transcritas textualmente**).
4. **Marco normativo pertinente** — leyes/decretos aplicables a esa pretensión (citados en cursiva/comillas).
5. **Doctrina interna de Colpensiones** — circulares, memorandos, conceptos (GNR/OAL/VPB). *Columna vertebral cuando la pretensión la tiene.*
6. **Jurisprudencia** — CSJ Sala Laboral (SL) y Corte Constitucional (SU/C/T), pertinente a la pretensión.
7. **Subsunción** — contrasta hecho por hecho contra el requisito → identifica el **requisito incumplido** o la **fortaleza de la resolución** (presunción de legalidad, carga de la prueba art. 167 CGP).
8. **Sub-acápites por pretensión accesoria** — **intereses moratorios** (art. 141) e **indexación** ("lo accesorio sigue la suerte de lo principal").
9. **Corolario** — "Colpensiones actuó conforme a la ley / la resolución goza de presunción de legalidad" → base de la recomendación.

Luego: **Evaluación del riesgo** (simple "Medio/…" o desglosada en 4 criterios) → **Recomendación** (NO CONCILIAR) → **Elaboró**.

## 3. Dos posturas según el rol de Colpensiones
- **Negación de prestación (casos 4, 5, 8, 10):** tono **concluyente** — "no cumple requisitos", con subsunción cerrada.
- **Demandada pasiva / tercero responsable (caso 9 traslado):** tono **defensivo y matizado** — "corresponde al juez valorar", responsabilidad de las AFP; igual concluye NO CONCILIAR.
El prompt debe **detectar el rol** y ajustar el grado de contundencia.

## 4. Insumos que el análisis EXIGE (y hoy NO se ingieren)
Confirmado por los 5 casos. Cada Consideraciones se apoya en:
- **Resoluciones** (SUB, DPE, GNR…) — la negativa/reconocimiento y su motivación.
- **Historia laboral** — semanas, IBL, fechas de cotización.
- **Certificaciones de empleador / oficios**.
- **Informes de investigación administrativa** (p. ej. JAHV McGregor; investigaciones COLCO) — decisivos en sobrevivientes.
- **Doctrina interna / repositorio** — circulares, memorandos, conceptos (varios, no uno).
- **Jurisprudencia** — CSJ SL y CC, para la pretensión principal y las accesorias.
- **La demanda** — hechos, pretensiones, normas invocadas.

## 5. Rúbrica de calidad (para evaluación y control)
Una Consideraciones es buena si:
1. **Identifica el requisito incumplido / la razón de la negativa** con precisión.
2. **Cita la doctrina interna correcta** (circular/concepto/memorando pertinente) cuando aplica.
3. **Hace subsunción** explícita hecho→norma (no solo enuncia normas).
4. **Cubre las pretensiones accesorias** (intereses moratorios + indexación) con la jurisprudencia consolidada.
5. **Caracteriza bien los intereses moratorios** como **resarcitorios** (no sancionatorios) — *ver inconsistencia detectada abajo*.
6. **Cero invención**: toda norma/sentencia/cifra debe existir en las fuentes del expediente/repositorio.
7. **Cierra coherente**: corolario + recomendación (conciliar/no) alineados con el análisis.
8. **Estilo institucional**: tercera persona, cita textual entre comillas, negrita en datos clave, "mi representada".

### Inconsistencia detectada entre firmas (a corregir con el prompt/rúbrica)
- Casos 4 y 5: intereses moratorios = naturaleza **resarcitoria** (correcto, línea CSJ).
- Caso 9: los llama **sancionatoria** (impreciso).
El método debe fijar la caracterización correcta y una lista curada de jurisprudencia de intereses/indexación (es un bloque casi reutilizable).

## 6. Plan de few-shot
- Usar **2–3 casos como ejemplos de estilo/postura** (idealmente uno de negación + uno de defensa pasiva), **anonimizados**.
- Reservar los **2 restantes para evaluación** (no mostrarlos al modelo) → medir generalización.
- Extraer un **bloque plantilla de "pretensiones accesorias"** (intereses/indexación) con jurisprudencia curada, parametrizable.

## 7. Actos administrativos de Colpensiones (jerarquía — CONFIRMADO por el cliente)
No son categorías de documento distintas: son **resoluciones (actos administrativos)** emitidas por
dependencias en distinto nivel jerárquico. Tras una reestructuración, cambiaron los nombres, por lo
que conviven prefijos nuevos y antiguos:

| Prefijo | Dependencia | Función | Antes |
|---|---|---|---|
| **SUB** | Subdirección de Prestaciones Económicas | Reconoce prestaciones (orgánicamente) y resuelve **recursos de reposición** | **GNR** (Gerencia Nacional de Reconocimiento) |
| **SUBA** | Subdirección de Prestaciones Económicas | Variante: **requerimiento** de prueba/documento al ciudadano | — |
| **DPE** / **DIR** | Dirección de Prestaciones Económicas (superior a la Subdirección) | Resuelve **recursos de apelación** contra actos de la Subdirección | **VPB** (Vicepresidencia de Beneficios y Prestaciones) |

**Implicación para la ingesta:** el clasificador debe (a) detectar el prefijo (SUB/SUBA/DPE/DIR/GNR/VPB),
(b) mapearlo a su función (reconocimiento/reposición · requerimiento · apelación) y (c) tratar la
**resolución que niega** (normalmente la última en la cadena reposición→apelación) como el **ancla** del
análisis: su motivación es el punto de partida de las Consideraciones.
