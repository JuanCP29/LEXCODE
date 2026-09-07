/**
 * Ejemplos "oro" de la sección CONSIDERACIONES para few-shot.
 *
 * Extraídos de fichas reales elaboradas por abogados externos de Colpensiones y
 * ANONIMIZADOS (sin nombres, cédulas ni radicados reales). Se conservan las normas y
 * sentencias (información pública) y el estilo/estructura, que es lo que se busca imitar.
 * Están condensados para economía de tokens; pueden ampliarse tras medir con el eval.
 *
 * Split acordado: 4, 8 y 9 como EJEMPLOS (aquí); 5 y 10 reservados para EVALUACIÓN.
 */
import type { PosturaColpensiones } from "@/lib/ficha/metodo-consideraciones";

export type EjemploConsideraciones = {
  etiqueta: string;
  pretension: string;
  postura: PosturaColpensiones;
  texto: string;
};

export const EJEMPLOS_CONSIDERACIONES: EjemploConsideraciones[] = [
  {
    etiqueta: "Pensión especial de vejez por alto riesgo (bomberos) — negación",
    pretension: "alto riesgo",
    postura: "negacion",
    texto: `Mediante Resolución SUB-XXXXX del [fecha] COLPENSIONES negó el reconocimiento y pago de la pensión especial de vejez por actividad de alto riesgo al demandante, por no acreditar los requisitos de ley. El demandante acredita [N] semanas y cuenta con [E] años de edad.

Mediante Decreto 2090 de 2003 se definieron las actividades de alto riesgo; su artículo 2 incluye, en los Cuerpos de Bomberos, la función específica de actuar en operaciones de extinción de incendios, y el artículo 3 exige cotización especial durante por lo menos 700 semanas, junto con los requisitos de edad y semanas del artículo 4 (con reducción de edad por cada 60 semanas especiales adicionales).

La Circular Interna No. 15 de 2015 (modificada por la Circular OAL-01 de 2020) establece la documentación necesaria y precisa que el empleador es quien certifica el desempeño de la actividad de alto riesgo. La Gerencia Nacional de Doctrina, mediante concepto, distinguió entre el Decreto 2090 de 2003 y el Decreto 1835 de 1994 (que exige ostentar cargos taxativos en cuerpos oficiales de bomberos), y recordó que los cuerpos de bomberos voluntarios son asociaciones privadas.

En el caso bajo estudio, de la historia laboral se evidencia que el demandante estuvo vinculado con un cuerpo de bomberos voluntarios (naturaleza privada), por lo que no ostentó la condición ni los cargos exigidos, y solo se le pueden computar como semanas de alto riesgo las cotizadas en función de extinción de incendios a partir del [fecha], que ascienden a [N] semanas especiales, inferiores al mínimo de 1000. En síntesis, NO cumple los requisitos del Decreto 2090 de 2003.

Estudiada la prestación a la luz del artículo 33 de la Ley 100 de 1993, modificado por el artículo 9 de la Ley 797 de 2003 (pensión de vejez ordinaria), si bien el actor supera las semanas exigidas, no cuenta con la edad requerida, por lo que también debe negarse.

En cuanto a los intereses moratorios del artículo 141 de la Ley 100 de 1993, tienen naturaleza resarcitoria y no sancionatoria, y su causación se rige por la mora administrativa; no proceden cuando la entidad actuó con apego a la ley y no existe prestación reconocida en mora. La indexación, por ser accesoria, sigue la suerte de la pretensión principal.

Corolario de lo anterior, COLPENSIONES actuó conforme a la Ley; no hay valores adeudados a favor del demandante.`,
  },
  {
    etiqueta: "Pensión de sobrevivientes (compañera permanente) — negación por convivencia",
    pretension: "sobrevivientes",
    postura: "negacion",
    texto: `La demandante solicita la pensión de sobrevivientes en calidad de compañera permanente del causante, a partir de la fecha de su fallecimiento, junto con retroactivo e intereses moratorios.

COLPENSIONES, en ejercicio de sus competencias, dispuso una investigación administrativa como medio probatorio, la cual concluyó que NO se acreditó una relación de convivencia por el tiempo manifestado: los testimonios recaudados no permitieron demostrar una convivencia continua e ininterrumpida durante los cinco (5) años anteriores al fallecimiento, y obran documentos suscritos por el propio causante en los que registró una dirección de residencia distinta a la alegada por la demandante, lo que constituye un indicio serio que desvirtúa la convivencia permanente invocada. En consecuencia, mediante Resolución SUB-XXXXX del [fecha] se negó el reconocimiento, decisión confirmada al resolver la vía gubernativa.

El artículo 47 de la Ley 100 de 1993, modificado por el artículo 13 de la Ley 797 de 2003, exige que el cónyuge o compañero(a) permanente acredite convivencia con el causante no inferior a cinco (5) años continuos anteriores a la muerte. La Corte Constitucional, en Sentencia SU-149 de 2021, precisó que dicho requisito aplica de manera uniforme a cónyuges y compañeros permanentes, y la Corte Suprema de Justicia (entre otras, SL1399-2018) ha definido la convivencia como una comunidad de vida real, estable y efectiva, excluyendo los encuentros pasajeros.

De los antecedentes se concluye que NO le asiste derecho a la demandante, toda vez que no probó cohabitación, singularidad y permanencia por el período legalmente exigido. La Resolución que negó goza de presunción de legalidad, y conforme al artículo 167 del C.G.P. corresponde a la parte actora desvirtuarla, carga que no cumplió.

Respecto de los intereses moratorios del artículo 141 de la Ley 100 de 1993, resultan improcedentes: solo proceden sobre prestaciones reconocidas y en mora, y en este caso no existe derecho a la prestación principal.

Por lo expuesto, no es procedente proponer fórmula conciliatoria.`,
  },
  {
    etiqueta: "Ineficacia de traslado de régimen (RPM ↔ RAIS) — defensa pasiva",
    pretension: "ineficacia de traslado",
    postura: "pasiva",
    texto: `Del análisis integral de la demanda, la controversia se circunscribe a determinar si el traslado del Régimen de Prima Media al Régimen de Ahorro Individual con Solidaridad resulta ineficaz por un presunto incumplimiento del deber de información por parte de las Administradoras de Fondos de Pensiones privadas que intervinieron, y si, como consecuencia, procede la reincorporación al Régimen de Prima Media administrado por COLPENSIONES y el reconocimiento de la pensión de vejez.

El artículo 13 de la Ley 100 de 1993 consagra la libertad de escogencia de régimen, decisión que debe adoptarse de manera libre y voluntaria. La denominada doble asesoría fue incorporada con posterioridad a los traslados discutidos (Decreto 2071 de 2015 y Circular Externa 016 de 2016 de la Superintendencia Financiera), por lo que no resulta aplicable retroactivamente; ello no excluye el deber de información que, conforme a la evolución jurisprudencial, recaía sobre las administradoras para la época.

La jurisprudencia de la Sala de Casación Laboral y la Corte Constitucional (Sentencia SU-107 de 2024) ha precisado que la declaratoria de ineficacia no es una consecuencia automática de la sola afirmación del afiliado sobre la ausencia de información, sino que corresponde al juez valorar de manera integral el material probatorio —formularios de afiliación, historia laboral, actuaciones administrativas— para establecer si existió un déficit de información con entidad suficiente para viciar el consentimiento.

Desde la perspectiva institucional, COLPENSIONES no intervino en la asesoría que motivó el traslado inicial, por lo que la eventual responsabilidad por el incumplimiento del deber de información debe analizarse frente a las administradoras privadas. Su vinculación obedece únicamente a la pretensión de reincorporación, y una eventual condena está supeditada a que se declare la ineficacia y a que la demandante acredite los requisitos para la pensión de vejez.

En cuanto a los intereses moratorios del artículo 141 de la Ley 100 de 1993, no proceden: mientras no exista decisión judicial ejecutoriada que declare la ineficacia y ordene la prestación, no puede predicarse mora a cargo de COLPENSIONES; la controversia versa sobre el derecho mismo, no sobre el incumplimiento de una obligación clara y exigible.

En consecuencia, no se encuentran acreditados, en esta etapa, los presupuestos para presumir la ineficacia del traslado, por lo que se recomienda continuar la defensa judicial y NO conciliar.`,
  },
  {
    etiqueta: "Intereses moratorios e indexación sobre retroactivo (vejez anticipada por invalidez) — improcedencia",
    pretension: "invalidez / intereses",
    postura: "negacion",
    texto: `El problema se contrae a determinar si proceden intereses moratorios (art. 141 Ley 100/1993) o indexación sobre el retroactivo de una prestación (pensión de vejez anticipada por invalidez) que ya fue reconocida y pagada.

Mediante Resolución SUB-XXXXX del [fecha], COLPENSIONES reconoció la prestación con disfrute a partir del [fecha] y liquidó el retroactivo causado, disponiendo su pago, que se efectuó el [fecha]. Entre la radicación de la solicitud y el acto de reconocimiento transcurrieron aproximadamente [N] días.

La Corte Constitucional (Sentencia T-588 de 2003) diferenció los términos aplicables: cuatro (4) meses para resolver la solicitud de reconocimiento y seis (6) meses para materializar el pago. En el caso, COLPENSIONES resolvió dentro del primer término y pagó el retroactivo dentro del segundo, por lo que no se advierte conducta omisiva ni dilatoria.

Los intereses moratorios del artículo 141 tienen naturaleza resarcitoria y suponen un retardo jurídicamente imputable a la administradora. Que el retroactivo comprenda períodos anteriores a la fecha de reconocimiento no configura, por sí solo, mora: se trata de un retroactivo derivado de una prestación con fecha de disfrute anterior, definida administrativamente dentro de los términos legales; no hay retardo injustificado.

La indexación, dirigida a preservar el poder adquisitivo, tampoco procede al haberse pagado las sumas de forma íntegra y oportuna; además, la jurisprudencia reitera la incompatibilidad entre intereses moratorios e indexación.

Corolario, COLPENSIONES actuó conforme a la ley; no existe saldo insoluto ni mora que dé lugar a los conceptos reclamados.`,
  },
  {
    etiqueta: "Reliquidación de pensión de vejez (IBL y tasa de reemplazo) — negación",
    pretension: "reliquidación de vejez",
    postura: "negacion",
    texto: `La controversia consiste en establecer si procede reliquidar la pensión de vejez con un IBL y una tasa de reemplazo del 80%, conforme al artículo 34 de la Ley 100 de 1993 (modificado por el artículo 10 de la Ley 797 de 2003).

El artículo 21 de la Ley 100 regula el IBL (promedio de los últimos diez años, salvo opción por toda la vida laboral con un mínimo de 1250 semanas). En el caso, el IBL más favorable resultó del promedio de los diez (10) años, por valor de $[X].

El artículo 34 fija la fórmula r = 65,50 − 0,50 s (donde s = número de smlmv contenidos en el IBL). Efectuadas las operaciones, s = [X] y r = [Y]%. La norma permite incrementar la tasa un 1,5% por cada 50 semanas adicionales a las mínimas requeridas, pero ese incremento está sujeto a la misma fórmula decreciente y a un tope: el aumento máximo es del 15% (equivalente a 500 semanas adicionales), de modo que la tasa definitiva es [Y]% + 15% = [Z]%.

En consecuencia, no es posible aplicar el 80% de manera indistinta: el tope del 80% solo corresponde a quien tenga tasa inicial del 65% y decrece según el nivel de ingresos. Respecto de la Sentencia SL3501-2022 invocada por el demandante, la Oficina Asesora de Asuntos Legales, mediante Memorando OAL-016 del 25 de enero de 2023, fijó la posición institucional de conservar la línea vigente. Así, la tasa aplicada por COLPENSIONES ([Z]%) se ajusta a la Ley 100 modificada por la Ley 797.

Los intereses moratorios (art. 141) no proceden respecto de reajustes y reliquidaciones, y la indexación, por accesoria, sigue la suerte de la pretensión principal. En conclusión, la mesada se mantiene conforme a la resolución vigente; COLPENSIONES actuó conforme a derecho.`,
  },
];
