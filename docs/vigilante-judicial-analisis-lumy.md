# Análisis de Lumy (app.lumy.legal) para el Vigilante Judicial de FoQs

> Objetivo: comparar la app Lumy (vigilancia judicial + gestión de casos, producto de Litigando)
> para **integrar y mejorar** el feature "Vigilante Judicial" dentro de FoQs como valor agregado.
> Fuente: sitio público (lumy.legal) + interior autenticado (tablero y los 12 módulos del menú).
> Fecha: 2026-09-16. No se hizo deep-dive de cada formulario interno (cuenta real del usuario).

## A. Qué hace Lumy (inventario funcional)

**Núcleo — vigilancia:** *Incluir proceso* → vigilancia automática → "Novedades de mis procesos" +
**alertas** por WhatsApp / email / SMS. Lema: "Tu vigilante con IA no duerme".

**Módulos (menú lateral):**
- **Inclusiones / Mis procesos** — alta y listado de procesos vigilados.
- **Ubicaciones** — encontrar procesos **sin radicado completo** (por partes).
- **Calendario de audiencias** — audiencias de los procesos en vigilancia.
- **Novedades** — actuaciones nuevas detectadas.
- **Notificación certificada** — envíos con **validez jurídica + evidencia de entrega**
  (WhatsApp / correo); se cobra como paquete aparte por nº de destinatarios.
- **Cartelera judicial** — consulta en tiempo real.
- **Buscador de jurisprudencia** — consulta.
- **Administrar usuarios** — multiusuario con roles.
- **Carga masiva de datos** — alta por Excel.
- **Facturación / Configuración / Centro de ayuda** — soporte y billing.

Onboarding cuidado: tablero configurable (drag-and-drop de tarjetas), tutorial, banners, notas.

**Precios (COP/mes, ref.):** Esencial $49.500 (50 procesos), Estándar $76.500 (100), Premium
$126.000 (200), Élite $270.000 (500); anual con >25% dcto; plan estudiante 50% con `.edu.co`.
Notificación certificada add-on: WhatsApp $35.997/mes, Correo $23.788/mes por paquetes de
destinatarios.

## B. Comparación con el Vigilante Judicial de FoQs

| Dimensión | Lumy | FoQs |
|---|---|---|
| Ingesta Rama Judicial | sí (maduro) | ya diseñada: 3 fuentes, F1/F2 auto HTTP sin captcha, F3 con reCAPTCHA, flujo columna G |
| Novedades + alertas multicanal | sí (WhatsApp/email/SMS) | por construir |
| Notificación certificada | sí (diferenciador + cobro) | por construir |
| Calendario de audiencias | sí | por construir |
| Multiusuario/roles, carga masiva | sí | ya existe (perfiles/organizaciones, importar-excel) |
| IA sobre la actuación | marketing, sin análisis de fondo | ventaja de FoQs: ya genera fichas/contestaciones; la vigilancia puede disparar el análisis |

**Conclusión:** Lumy = amplitud de *workflow* (vigilar + notificar + gestionar). FoQs = profundidad
de *fondo* (analizar + redactar). Integrar vigilancia en FoQs cierra el círculo que Lumy no tiene:
**detectar la actuación → preparar el escrito**.

## C. Mejoras / qué tomar (y superar)

1. **Ubicación sin radicado completo** (búsqueda por partes / cédula).
2. **Novedades con diff** — comparar la última actuación por hash y resaltar el cambio.
3. **Notificación certificada con evidencia de entrega** — diferenciador monetizable (paquetes por
   destinatario, como Lumy).
4. **Calendario de audiencias** derivado automáticamente de las actuaciones.
5. **El salto que Lumy NO da:** cuando la vigilancia detecte "traslado de demanda / contestación",
   enlazar al **generador de contestación** que FoQs ya tiene → el vigilante no solo avisa, entrega
   el borrador. Ese es el valor agregado real de FoQs.

## D. Cómo integrarlo (arquitectura sobre Next.js + Supabase)

- **Datos:** `procesos_vigilados` (radicado, partes, despacho, fuente, `caso_id` ↔ casos),
  `actuaciones` (proceso_id, fecha, tipo, texto, **hash** para diff), `audiencias`, `alertas`,
  `suscripciones_notificacion`.
- **Ingesta:** reutilizar el pipeline de las 3 fuentes (F1/F2 por HTTP; **F3 con reCAPTCHA en un
  worker aparte**, no serverless). **Cron diario** que corre la vigilancia y detecta novedades por
  hash.
- **Límite conocido:** Vercel Hobby (60s + cron limitado) y el reCAPTCHA de F3 no caben en
  serverless → conviene un **worker/servicio separado** (lo que ya anticipa la nota de columna G).
- **Notificaciones:** email (ya existe) + WhatsApp (API) + guardar **acuse/evidencia** para la parte
  "certificada".
- **UI:** módulo "Vigilancia" con tablero de novedades + calendario, **ligado al caso/ficha** (el
  proceso vigilado alimenta el generador).
- **Reutiliza ya:** `importar-excel` (carga masiva), `perfiles/organizaciones` (multiusuario/roles),
  el flujo de columna G.

## E. Detalle — Notificación electrónica certificada (módulo explorado)

- **Canales:** correo, WhatsApp y SMS, "con respaldo legal".
- **Modelo de cobro:** requiere **comprar un paquete** (correo/WhatsApp/SMS); vigencia **1 mes**.
- **Respaldo legal (clave):** *"Acreditados por el ONAC, a través del certificado de acreditación
  **16-ECD-004 del 12 de diciembre de 2016**."* → la validez jurídica no es solo técnica: descansa en
  una **acreditación ONAC** (Organismo Nacional de Acreditación de Colombia) como entidad de
  certificación / prestador de servicios de confianza.
- **Evidencia de entrega:** botón **"Ver testigos (Historial)"** → registro probatorio de la entrega
  (los "testigos" son la prueba con validez).
- **Flujo en 3 pasos** (atado a un proceso judicial):
  1. **Información del proceso:** tipo de proceso, **No. Radicado (23 dígitos)**, ciudad, tipo y número
     de documento del demandado, demandante, demandado, departamento, despacho, dirección y correo del
     despacho.
  2. **Datos de envío.**
  3. **Mensaje y adjuntos.**

### Implicación para FoQs (regulatoria, no solo técnica)
La parte "certificada" **exige acreditación ONAC** como entidad de certificación digital / prestador
de servicios de confianza. FoQs (Collegia) tiene dos caminos:
- **Integrar un tercero acreditado** (un prestador de notificación electrónica certificada acreditado
  por ONAC) vía su API — rápido, sin trámite de acreditación propia. **Recomendado.**
- **Acreditarse ONAC** por cuenta propia — costoso y lento; solo si es core del negocio.
La ingesta y el aviso multicanal (email/WhatsApp/SMS) sí se pueden construir en FoQs; el **sello de
certificación con validez probatoria** se delega al proveedor acreditado.

## F. Pendiente de detallar
- Flujo de **Incluir proceso** (opciones de búsqueda/ubicación sin radicado completo).
- Fuente y cobertura del **Buscador de jurisprudencia**.
