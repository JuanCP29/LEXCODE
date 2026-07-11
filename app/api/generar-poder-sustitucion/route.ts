import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import PDFDocument from "pdfkit";

function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) =>
          cs.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { caso_id } = await request.json() as { caso_id: string };
    if (!caso_id) return NextResponse.json({ error: "Falta caso_id" }, { status: 400 });

    // Cargar datos del caso
    const { data: caso, error } = await supabase
      .from("casos")
      .select("radicado, radicado_bizagi, nombre_demandante, cedula_demandante, despacho, pretension, clase_pretension, jurisdiccion")
      .eq("id", caso_id)
      .single();

    if (error || !caso) {
      return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });
    }

    // Cargar perfil del abogado
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre_completo")
      .eq("id", user.id)
      .single();

    const nombreAbogado = perfil?.nombre_completo ?? "Apoderado Externo";
    const fechaHoy = new Date().toLocaleDateString("es-CO", {
      day: "2-digit", month: "long", year: "numeric",
    });

    // ── Generar PDF ──────────────────────────────────────────────────────
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 72, size: "LETTER" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const AZUL   = "#1a4a8a";
      const NEGRO  = "#0f1117";
      const GRIS   = "#64748b";
      const ANCHO  = doc.page.width - 144; // margen 72 x 2

      // ── Encabezado ──
      doc
        .fontSize(9)
        .fillColor(GRIS)
        .text("COLLEGIA ABOGADOS  |  PODER DE SUSTITUCIÓN", { align: "center" });

      doc.moveDown(0.3);
      doc
        .moveTo(72, doc.y)
        .lineTo(72 + ANCHO, doc.y)
        .strokeColor(AZUL)
        .lineWidth(1.5)
        .stroke();
      doc.moveDown(0.8);

      // ── Título ──
      doc
        .fontSize(16)
        .fillColor(AZUL)
        .font("Helvetica-Bold")
        .text("PODER DE SUSTITUCIÓN", { align: "center" });

      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .fillColor(GRIS)
        .font("Helvetica")
        .text("Formato para delegación de representación judicial", { align: "center" });

      doc.moveDown(1.2);

      // ── Datos del proceso ──
      doc
        .fontSize(10)
        .fillColor(AZUL)
        .font("Helvetica-Bold")
        .text("DATOS DEL PROCESO");

      doc.moveDown(0.4);
      doc
        .moveTo(72, doc.y)
        .lineTo(72 + ANCHO, doc.y)
        .strokeColor("#e2e8f0")
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.4);

      const fila = (label: string, valor: string) => {
        doc
          .fontSize(9)
          .fillColor(GRIS)
          .font("Helvetica-Bold")
          .text(label.toUpperCase(), { continued: true, width: 180 })
          .fillColor(NEGRO)
          .font("Helvetica")
          .text(`  ${valor}`);
        doc.moveDown(0.3);
      };

      fila("Radicado (23 dígitos)",  caso.radicado ?? "—");
      fila("Radicación Bizagi",       caso.radicado_bizagi ?? "—");
      fila("Demandante",              caso.nombre_demandante ?? "—");
      fila("Cédula demandante",       caso.cedula_demandante ?? "—");
      fila("Despacho / Autoridad",    caso.despacho ?? "—");
      fila("Pretensión",              [caso.pretension, caso.clase_pretension].filter(Boolean).join(" — ") || "—");
      fila("Jurisdicción",            caso.jurisdiccion ?? "—");

      doc.moveDown(1);

      // ── Cuerpo del poder ──
      doc
        .fontSize(10)
        .fillColor(AZUL)
        .font("Helvetica-Bold")
        .text("PODER ESPECIAL DE SUSTITUCIÓN");

      doc.moveDown(0.5);

      const cuerpo = [
        `En la ciudad de Cali, a los ${fechaHoy}, yo, ${nombreAbogado}, abogado(a) en ejercicio, identificado(a) con tarjeta profesional del Consejo Superior de la Judicatura, actuando como apoderado(a) externo(a) de COLPENSIONES dentro del proceso identificado con el radicado No. ${caso.radicado ?? "_______________"}, que cursa ante ${caso.despacho ?? "el despacho competente"}, en el que figura como demandante ${caso.nombre_demandante ?? "_______________"}, identificado(a) con C.C. No. ${caso.cedula_demandante ?? "_______________"},`,
        `CONFIERO PODER ESPECIAL DE SUSTITUCIÓN`,
        `a un(a) abogado(a) debidamente facultado(a) para representar a COLPENSIONES en todas las actuaciones judiciales del proceso anteriormente descrito, con plenas facultades para presentar y contestar demandas, proponer excepciones, interponer recursos, asistir a audiencias, celebrar acuerdos conciliatorios, recibir notificaciones y demás actuaciones que el proceso requiera, en los términos del artículo 77 del C.P.T. y S.S.`,
        `El presente poder de sustitución se otorga con el fin de garantizar la adecuada representación de COLPENSIONES ante la autoridad competente que conoce del proceso, de conformidad con lo establecido en el Código General del Proceso y demás normas concordantes.`,
      ];

      doc.font("Helvetica").fontSize(10).fillColor(NEGRO);
      for (const parrafo of cuerpo) {
        if (parrafo === "CONFIERO PODER ESPECIAL DE SUSTITUCIÓN") {
          doc.moveDown(0.5);
          doc
            .font("Helvetica-Bold")
            .fontSize(11)
            .fillColor(AZUL)
            .text(parrafo, { align: "center" });
          doc.moveDown(0.5);
          doc.font("Helvetica").fontSize(10).fillColor(NEGRO);
        } else {
          doc.text(parrafo, { align: "justify", lineGap: 3 });
          doc.moveDown(0.7);
        }
      }

      doc.moveDown(2);

      // ── Firma ──
      doc
        .moveTo(72, doc.y)
        .lineTo(72 + ANCHO, doc.y)
        .strokeColor("#e2e8f0")
        .lineWidth(0.5)
        .stroke();

      doc.moveDown(1);

      const mitad = ANCHO / 2;
      const xIzq  = 72;
      const xDer  = 72 + mitad + 20;

      const yFirma = doc.y;

      // Columna izquierda
      doc
        .fontSize(9)
        .fillColor(NEGRO)
        .font("Helvetica-Bold")
        .text("PODERDANTE", xIzq, yFirma, { width: mitad - 10 });
      doc.moveDown(2.5);
      doc
        .moveTo(xIzq, doc.y)
        .lineTo(xIzq + mitad - 30, doc.y)
        .strokeColor(NEGRO)
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.3);
      doc
        .fontSize(9)
        .fillColor(NEGRO)
        .font("Helvetica")
        .text(nombreAbogado, xIzq, doc.y, { width: mitad - 10 });
      doc
        .fontSize(8)
        .fillColor(GRIS)
        .text("Apoderado Externo — Collegia Abogados", xIzq, doc.y, { width: mitad - 10 });

      // Columna derecha
      doc
        .fontSize(9)
        .fillColor(NEGRO)
        .font("Helvetica-Bold")
        .text("SUSTITUTO(A)", xDer, yFirma, { width: mitad - 10 });
      doc.moveDown(2.5);
      doc
        .moveTo(xDer, doc.y)
        .lineTo(xDer + mitad - 30, doc.y)
        .strokeColor(NEGRO)
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.3);
      doc
        .fontSize(9)
        .fillColor(GRIS)
        .font("Helvetica")
        .text("Nombre y T.P.", xDer, doc.y, { width: mitad - 10 });

      // ── Pie de página ──
      doc.moveDown(2);
      doc
        .fontSize(8)
        .fillColor(GRIS)
        .font("Helvetica")
        .text(
          `Documento generado por LEGIUX — Collegia Abogados  ·  ${fechaHoy}`,
          { align: "center" }
        );

      doc.end();
    });

    const radicadoSafe = (caso.radicado ?? "SIN_RADICADO").replace(/[^a-zA-Z0-9]/g, "_");
    const nombreArchivo = `PODER_SUSTITUCION_${radicadoSafe}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (e) {
    console.error("generar-poder-sustitucion:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
