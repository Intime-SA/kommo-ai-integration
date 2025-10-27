import { NextRequest, NextResponse } from "next/server";
import { KommoDatabaseService, PaymentRequestDocument } from "@/lib/mongodb-services";
import { parseWebhookData } from "@/lib/webhook-utils";
import { processImageWithAIByLeadId } from "@/service/agents";
import { getCurrentArgentinaISO } from "@/lib/utils";

export async function POST(request: NextRequest) {
  // Parsear datos del webhook usando función unificada
  const { leadId } = await parseWebhookData(request);

    if (!leadId) {
      return NextResponse.json(
        { error: "Parámetro leadId es requerido" },
        { status: 400 }
      );
    }

    try {

    const dbService = KommoDatabaseService.getInstance();
    const paymentRequest = await dbService.getPaymentRequestByLeadId(leadId);
    console.log("paymentRequest", paymentRequest);

    if (!paymentRequest) {
      return NextResponse.json(
        { error: "No se encontró solicitud de pago para este leadId" },
        { status: 404 }
      );
    }

    const analysisResult = await processImageWithAIByLeadId({
      type: paymentRequest?.attachment?.type || "",
      link: paymentRequest?.attachment?.link as string || "",
      file_name: paymentRequest?.attachment?.file_name || "",
    });

    console.log("analysisResult", analysisResult);

    const updateData = {
      status: (analysisResult.success ? "processed" : "error") as "processed" | "error",
      receipt: {
        url: paymentRequest?.attachment?.link || "",
        name: paymentRequest?.attachment?.file_name || "receipt.webp",
      },
      gptAnalysis: {
        success: analysisResult.success,
        extractedAt: analysisResult.extractedAt,
        partial: analysisResult.partial,
        note: analysisResult.note,
        confidence: analysisResult.confidence,
      },
      extractedData: analysisResult.data || {},
      updatedAt: getCurrentArgentinaISO(),
    };

    // Actualizar el documento en la base de datos
    const updateSuccess = await dbService.updatePaymentRequestByLeadId(leadId, updateData as Partial<PaymentRequestDocument>);

    if (!updateSuccess) {
      console.error(`❌ Error actualizando la base de datos para leadId: ${leadId}`);
      return NextResponse.json(
        { error: "Error actualizando los datos en la base de datos" },
        { status: 500 }
      );
    }

    // Retornar los datos actualizados
    const updatedPaymentRequest = {
      ...paymentRequest,
      ...updateData,
    };

    return NextResponse.json({
      success: true,
      data: updatedPaymentRequest,
      message: "Análisis completado y datos actualizados exitosamente"
    });

  } catch (error) {
    console.error("Error obteniendo solicitud de pago:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
        { status: 500 }
      );
    }
  }
