# Consideraciones v2 — Reconstrucción del método (documento vivo)

Reconstrucción metódica de la sección **Consideraciones** (`sec_16_consideraciones`), el cerebro
del análisis. Se rehace desde cero porque el resultado actual no es el esperado.

**Brechas confirmadas por el cliente (Fase 0):**
1. **ESTRUCTURA / ORDEN** — el orden y la organización del texto no reflejan cómo debe construirse
   una Consideraciones (los 9 pasos actuales no sirven o van en otro orden).
2. **USO DE FUENTES** — cómo lee y usa el expediente / acto ancla / repositorio: se le escapan
   datos, no aprovecha bien el acto ancla, o cita mal.

**Punto de partida elegido:** definir primero el ESTÁNDAR (qué es una Consideraciones excelente) y
la rúbrica; luego contrastar.

**Método de diagnóstico (acordado con el cliente):** el cliente entrega los documentos que
normalmente se cargan a la app para un caso; Claude genera A MANO (en el chat, razonando sobre los
insumos, sin la API) un borrador de TODAS las secciones de la ficha, con foco en Consideraciones;
luego el cliente entrega su versión MANUAL del mismo caso (el oro) y se hace comparación
estructurada (aciertos, faltantes, diferencias de orden y de uso de fuentes) → de ahí salen las
brechas concretas, la estructura/orden objetivo y la doctrina de fuentes.

### Casos de diagnóstico
_(se registran aquí a medida que se procesan: caso, insumos recibidos, brechas observadas)_

**Caso 1 — 10521453 (SOBREVIVIENTES, Jairo Quiñones vs Colpensiones; oro: Mejía y Asociados).**
Insumos: demanda + SUB 149655, SUB 225981 (reposición), DPE (apelación). Oro: 10521453_FC.pdf.
Hallazgos al comparar mi borrador (9 pasos, sintético) vs. el oro:
- ESTRUCTURA/ORDEN del oro: (1) "Antecedentes:" [cadena de actos] → (2) marco normativo TRANSCRITO
  extenso (arts. 46-47) → (3) jurisprudencia de FINALIDAD (C-111/2006, C-1094/2003) → (4)
  "INVESTIGACIÓN ADMINISTRATIVA" [Concepto BZ_2015_5672865 + informe verbatim] → (5) subsunción
  (elementos: cohabitación/singularidad/permanencia) → (6) jurisprudencia del REQUISITO (SL3507-2024,
  rad. 53820/2014, SU-149-21, Concepto BZ 2018_4671485) → (7) corolario con acto ancla DPE 9090/2019.
  ⇒ La jurisprudencia va en DOS bloques (no un "paso 6"); se TRANSCRIBE norma y sentencias en extenso
  (no sintético); usa subtítulos puntuales ("Antecedentes:", "INVESTIGACIÓN ADMINISTRATIVA"), no prosa lisa.
- USO DE FUENTES (hallazgo mayor): el oro se alimenta MASIVAMENTE del REPOSITORIO, no de los docs del
  caso. Fuentes del oro ausentes del expediente: SL3507-2024 (precedente decisivo), Lineamiento 004/2020
  (BZ2020_12873188), Concepto BZ 2018_4671485, SU-149-21, C-111/2006, C-1094/2003, rad. 53820/2014,
  SL 7358/2014. Solo BZ_2015 y el informe estaban en los insumos. ⇒ El método actual SUBUTILIZA el
  repositorio; sin inyectar el precedente + lineamiento + conceptos correctos (indexados por tipo de
  pretensión), la Consideraciones no iguala al oro.
- Otros: el oro nombra el acto ancla como DPE 9090/2019 (mi DPE.pdf solo traía radicado); el oro NO
  menciona la sentencia de familia 266/2025 (la ignora, argumenta liso que no hubo convivencia); cuantía
  del oro "Superior a $35.018.100" (no los $320M de la demanda).
- ACIERTOS de mi borrador: núcleo correcto (no se acreditó convivencia de 5 años + investigación
  administrativa), postura NO CONCILIAR, riesgo medio-alto, cadena de actos. Buena lectura del expediente;
  el faltante es la CAPA de repositorio y la forma (transcripción/orden).

## Roadmap
- [x] Fase 0 · Diagnóstico — brechas identificadas.
- [ ] **Fase 1 · Estándar objetivo (EN CURSO)** — principios + estructura/orden + doctrina de fuentes + rúbrica.
- [ ] **Fase 2 · Retrieval del criterio institucional (DISEÑO CERRADO — ver abajo).**
- [ ] Fase 3 · Rediseño del prompt (nuevo `metodo-consideraciones`).
- [ ] Fase 4 · Banco de evaluación (casos con salida esperada, medir e iterar).
- [ ] Fase 5 · Integración y despliegue.

---

## Fase 1 — Estándar objetivo

### A. Principios (qué debe lograr una Consideraciones excelente)

**PRINCIPIO RECTOR (definido por el cliente — corrige todo lo anterior):** la decisión de conciliar
o no **NO se razona de cero ni con criterio propio** de la IA/apoderado. Depende EXCLUSIVAMENTE de
las fuentes internas de Colpensiones:
1. Lineamientos internos · 2. Memorandos · 3. Directrices internas · 4. Jurisprudencia ACOGIDA por
Colpensiones (la que la entidad adoptó, no cualquier precedente) · 5. Investigaciones administrativas internas.
La Sección 11 = **identificar el criterio institucional aplicable al escenario + aplicarlo al caso +
concluir conciliabilidad SEGÚN lo que ese criterio dicta.** La IA es un APLICADOR fiel de la regla
institucional, no un jurista que opina. Si el criterio aplicable NO está entre las fuentes, NO se
improvisa: se señala que se requiere el lineamiento/directriz aplicable.

Corolario: el motor de la decisión es el REPOSITORIO (lineamientos/memorandos/directrices/jurisprudencia
acogida) + investigación administrativa. La Fase 2 (retrieval por escenario) es el CEREBRO del método,
no un complemento. Confirmado con el caso 1: el oro no ignoró la sentencia de familia por confianza,
sino porque el criterio decisorio ya estaba fijado (Lineamiento 004/2020 + investigación admin. +
SL3507-2024 acogida); aplicó la regla, no creó un juicio propio de riesgo.

Otros principios:
- Se ancla en la última actuación administrativa (acto ancla) y en la investigación administrativa interna.
- Usa solo lo que consta en las fuentes; no inventa; no editorializa vacíos de documentos propios de Colpensiones.
- El riesgo se INFORMA para el Comité (sección de Riesgo), pero NO es el fundamento con que la IA decide conciliar.

### A.ter — MODELO DE DECISIÓN (definido por el cliente — arquitectura central)
El repositorio tiene DOS naturalezas y el campo del caso "¿asunto conciliable? (sí/no)" es el ROUTER:
- **Documentos tipo `directriz`** = reglas de CUÁNDO PROCEDE LA CONCILIACIÓN (condiciones de aplicación).
- **Los demás** (`memorando`, `lineamiento`, `otro`/concepto) = CRITERIOS DE DEFENSA (cómo litigar).

Árbol:
- `conciliable = SÍ` → fuente rectora = DIRECTRIZ. La Sección 11 valida si el caso cumple las
  condiciones de aplicación de la conciliación (contra investigación administrativa + acto ancla).
  Cumplidas → CONCILIAR; no cumplidas → NO CONCILIAR.
- `conciliable = NO` → fuentes = criterios de defensa (memorando/lineamiento/concepto). No se evalúa
  conciliabilidad; se construye la defensa → NO CONCILIAR.

Implicaciones: (1) el método debe RAMIFICAR según el flag `conciliable` (dato de entrada, la IA no lo
decide); (2) el retrieval de Fase 2 filtra por `tipo_documento` según el flag (sí→directriz;
no→memorando/lineamiento/otro) + escenario; (3) la app YA tiene ambos insumos: el flag `conciliable`
(formulario del caso; hoy la sec.18 lo usa) y `tipo_documento` en `directrices_conciliacion`.
Pendiente confirmar: ¿"concepto" entra como `otro` o se agrega tipo `concepto`? · ¿rama SÍ + condiciones
cumplidas ⇒ recomendación CONCILIAR (hoy esa rama queda en blanco)?

### A.bis — Qué NO debe hacer el método (aprendido del Prompt Maestro v1)
El Prompt Maestro que construyó el cliente (Prompt_Maestro_Seccion_11) es excelente en estructura/orden,
atribución de voces (§6), confrontación (§7/§23), manejo de sentencias aportadas (§21) y anti-alucinación.
PERO su §26/§49 (y §25 como base de decisión) hacen que la IA forme un CRITERIO PROPIO de defendibilidad/
conciliabilidad → contradice el PRINCIPIO RECTOR. Debe reescribirse: la conclusión se DERIVA del criterio
institucional recuperado, no del parecer de la IA. Además §15 debe limitarse a jurisprudencia ACOGIDA.
Prueba empírica (caso 10521453): el prompt aplicado solo con los 4 docs produjo buena FORMA pero SIN
la capa jurisprudencial/lineamientos del oro (no estaban en las fuentes) → confirma que el retrieval del
repositorio es el cuello de botella real.

### B. Estructura / orden objetivo — BRECHA #1
**Estructura actual (9 pasos):** 1 Delimitación · 2 Antecedentes administrativos · 3 Datos duros ·
4 Marco normativo · 5 Doctrina interna · 6 Jurisprudencia · 7 Subsunción · 8 Accesorias · 9 Corolario.

**Qué está mal (a completar con el cliente):** _pendiente._

**Orden objetivo v2 (a definir con el cliente):** _pendiente._

### C. Doctrina de uso de fuentes — BRECHA #2
**Insumos disponibles hoy:** texto del expediente (`texto_expediente` / `documentos_caso`), actos
administrativos estructurados (`actos_administrativos`), repositorio (`directrices_conciliacion`),
jurisprudencia identificada (Sección 4).

**Qué está mal (a completar con el cliente):** _pendiente._

**Doctrina objetivo v2 (a definir con el cliente):** _pendiente._

### D. Rúbrica medible
_(se deriva de A–C una vez definidos)_

---

## Fase 2 — Retrieval del criterio institucional (DISEÑO CERRADO)

Reto: el repositorio no está clasificado por escenario (pretension='general'); solo por
`tipo_documento`. Y los docs son enormes (hasta 106k chars) → no se inyectan completos.

**Componente 1 — Enriquecer en la ingesta (una vez por doc).** Al subir un doc, una llamada Sonnet
genera una "ficha de criterio" en columnas nuevas de `directrices_conciliacion`:
`resumen_criterio`, `escenarios` (prestación+controversia), `jurisprudencia_acogida` (radicados que
adopta), `condiciones_aplicacion` (solo directrices). Backfill de los ~30 docs actuales por script.

**Componente 2 — Recuperar por caso** (reemplaza `buscarCoincidenciasRepositorio`):
1. FILTRO POR NATURALEZA según el flag `conciliable`: SÍ → `tipo_documento='directriz'`; NO →
   {memorando,concepto,circular,jurisprudencia,otro}, activo=true.
2. SELECCIÓN POR ESCENARIO = **SELECTOR CON IA** (decisión del cliente): se pasa a Sonnet el catálogo
   de fichas de criterio (nombre+tipo+resumen+escenarios) + la controversia del caso; devuelve 2–5
   IDs aplicables. Señal de refuerzo: si el acto ancla cita una sentencia y un doc la acoge, sube su
   prioridad. (Embeddings/pgvector queda como vía de escalamiento futura si el repo crece mucho.)
3. INYECCIÓN COMPACTA: resumen_criterio + jurisprudencia_acogida + condiciones + pasaje relevante
   recortado del texto de los docs seleccionados.

**Componente 3 — Integrar en el generador:** `construirPromptConsideraciones` recibe el flag y el
bloque de criterios separado en "DIRECTRIZ APLICABLE" (rama SÍ) o "CRITERIOS DE DEFENSA" (rama NO).

Validado a mano (caso 10521453, rama NO): inyectando Concepto BZ_2018_4671485 + Concepto 2015_5672865
+ Lineamiento 004/2020 (recuperados del repo), el v3 alcanza el nivel del oro. El repositorio es el motor.

Orden de construcción: (1) migración + enriquecimiento + backfill → (2) módulo de retrieval
(selector IA) → (3) integración en analizar-consideraciones/regenerar-seccion + construirPrompt.
