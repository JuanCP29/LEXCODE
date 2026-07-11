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

    const { data: caso, error } = await supabase
      .from("casos")
      .select("radicado, radicado_bizagi, nombre_demandante, cedula_demandante, despacho, pretension, clase_pretension, jurisdiccion")
      .eq("id", caso_id)
      .single();

    if (error || !caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });

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

      const AZUL  = "#1a4a8a";
      const NEGRO = "#0f1117";
      const GRIS  = "#64748b";
      const NARANJA = "#c2410c";
      const ANCHO = doc.page.width - 144;

      // ── Encabezado ──
      doc
        .fontSize(9)
        .fillColor(GRIS)
        .font("Helvetica")
        .text("COLLEGIA ABOGADOS  |  MEMORIAL — SOLICITUD DE ACCESO AL EXPEDIENTE", { align: "center" });

      doc.moveDown(0.3);
      doc.moveTo(72, doc.y).lineTo(72 + ANCHO, doc.y).strokeColor(AZUL).lineWidth(1.5).stroke();
      doc.moveDown(1);

      // ── Destinatario ──
      doc
        .fontSize(10)
        .fillColor(NEGRO)
        .font("Helvetica-Bold")
        .text(`Señores`)
        .font("Helvetica-Bold")
        .fillColor(AZUL)
        .text((caso.despacho ?? "JUZGADO COMPETENTE").toUpperCase());

      doc.moveDown(0.3);
      doc.font("Helvetica").fillColor(GRIS).fontSize(9).text("E. S. D.");
      doc.moveDown(1.2);

      // ── Asunto ──
      doc
        .fontSize(10)
        .fillColor(NEGRO)
        .font("Helvetica-Bold")
        .text("ASUNTO: ", { continued: true })
        .font("Helvetica")
        .text("Solicitud de acceso al expediente — traslado y anexos de la demanda");

      doc.moveDown(0.4);
      doc
        .font("Helvetica-Bold")
        .text("RADICADO: ", { continued: true })
        .font("Helvetica")
        .text(caso.radicado ?? "—");

      doc.moveDown(0.4);
      doc
        .font("Helvetica-Bold")
        .text("DEMANDANTE: ", { continued: true })
        .font("Helvetica")
        .text(`${caso.nombre_demandante ?? "—"}  C.C. ${caso.cedula_demandante ?? "—"}`);

      doc.moveDown(1.2);

      // ── Cuerpo del memorial ──
      doc
        .fontSize(10)
        .fillColor(NEGRO)
        .font("Helvetica-Bold")
        .text("Respetado(a) señor(a) Juez(a):");

      doc.moveDown(0.6);

      const parrafos = [
        `Yo, ${nombreAbogado}, abogado(a) en ejercicio, actuando en calidad de apoderado(a) externo(a) de ADMINISTRADORA COLOMBIANA DE PENSIONES — COLPENSIONES, dentro del proceso de la referencia, identificado con el radicado No. ${caso.radicado ?? "_______________"}, en el que figura como demandante ${caso.nombre_demandante ?? "_______________"}, con cédula de ciudadanía No. ${caso.cedula_demandante ?? "_______________"}, me permito dirigirme ante su Despacho, con el fin de elevar la siguiente solicitud:`,

        `Que, en atención a la AUDIENCIA DE CONCILIACIÓN JUDICIAL programada en el marco del presente proceso, y en cumplimiento de lo establecido en el artículo 77 del Código Procesal del Trabajo y de la Seguridad Social, esta representación requiere acceder al traslado y a los anexos de la demanda, los cuales, a la fecha, no se encuentran disponibles en la plataforma BIZAGI de COLPENSIONES.`,

        `Lo anterior, con el propósito de analizar el material probatorio del caso, elaborar la correspondiente Ficha de Conciliación Judicial y adoptar la posición institucional que corresponda conforme a las directrices del Comité de Conciliación de COLPENSIONES, en cumplimiento de los principios de eficiencia y economía procesal que rigen la función pública.`,

        `En consecuencia, respetuosamente solicito al Despacho se sirva REMITIR o FACILITAR el acceso al expediente físico y/o digital, incluidos el traslado de la demanda y sus anexos, a la dirección de correo electrónico institucional de esta representación, o a través del mecanismo que su Despacho tenga habilitado.`,
      ];

      doc.font("Helvetica").fillColor(NEGRO).fontSize(10);
      for (const p of parrafos) {
        doc.text(p, { align: "justify", lineGap: 3 });
        doc.moveDown(0.8);
      }

      // ── Petición ──
      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .fillColor(NARANJA)
        .font("Helvetica-Bold")
        .text("PETICIÓN", { align: "center" });
      doc.moveDown(0.4);

      doc
        .fontSize(10)
        .fillColor(NEGRO)
        .font("Helvetica")
        .text(
          `Sírvase el Despacho disponer lo pertinente para que esta representación tenga acceso oportuno al traslado y anexos de la demanda del proceso No. ${caso.radicado ?? "_______________"}, a fin de cumplir con las obligaciones procesales a cargo de COLPENSIONES dentro del término legal establecido.`,
          { align: "justify", lineGap: 3 }
        );

      doc.moveDown(1.5);
      doc
        .fontSize(10)
        .fillColor(GRIS)
        .text(`Atentamente,`, { align: "left" });

      doc.moveDown(2.5);

      // Firma
      doc.moveTo(72, doc.y).lineTo(72 + 200, doc.y).strokeColor(NEGRO).lineWidth(0.5).stroke();
      doc.moveDown(0.4);
      doc
        .fontSize(10)
        .fillColor(NEGRO)
        .font("Helvetica-Bold")
        .text(nombreAbogado);
      doc
        .fontSize(9)
        .fillColor(GRIS)
        .font("Helvetica")
        .text("Apoderado(a) Externo(a) — Collegia Abogados")
        .text("Colpensiones");

      doc.moveDown(2);

      // ── Pie ──
      doc
        .fontSize(8)
        .fillColor(GRIS)
        .text(`Documento generado por LEGIUX — Collegia Abogados  ·  ${fechaHoy}`, { align: "center" });

      doc.end();
    });

    const radicadoSafe = (caso.radicado ?? "SIN_RADICADO").replace(/[^a-zA-Z0-9]/g, "_");
    const nombreArchivo = `MEMORIAL_EXPEDIENTE_${radicadoSafe}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (e) {
    console.error("generar-memorial-expediente:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
