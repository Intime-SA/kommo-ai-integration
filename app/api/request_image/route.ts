import { NextRequest, NextResponse } from "next/server";
import { KommoDatabaseService, PaymentRequestDocument } from "@/lib/mongodb-services";
import { parseWebhookData } from "@/lib/webhook-utils";
import { processImageWithAIByLeadId } from "@/service/agents";
import { getCurrentArgentinaISO } from "@/lib/utils";
import clientPromise from "@/lib/mongodb";
import { MONGO_CONFIG, USER_REGISTRATION_CONFIG, KOMMO_CONFIG } from "@/lib/kommo-config";
import { getLeadInfo } from "@/lib/kommo-api";

// Tipos para la respuesta del endpoint GET
interface RequestImageResponse {
  _id: string;
  talkId: string;
  leadId: string;
  contactId: string;
  attachment: {
    type: string;
    link: string;
    file_name: string;
  };
  createdAt: string;
  updatedAt: string;
  status: "pending" | "processed" | "error";
  extractedData?: {
    amount?: number;
    currency?: string;
    date?: string;
    time?: string;
    sender?: {
      name: string;
      cuit: string;
      platform: string;
      cvu: string;
      cbu: string;
    };
    receiver?: {
      name: string;
      cuit: string;
      cvu: string;
      cbu: string;
      bank?: string;
    };
    operationNumber?: string;
    transactionType?: string;
    platform?: string;
    rawText?: string;
    confidence?: number;
    [key: string]: any;
  };
  gptAnalysis?: {
    success: boolean;
    extractedAt: string;
    partial: boolean;
    note?: string;
    confidence?: number;
  };
  receipt?: {
    url: string;
    name: string;
  };
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface FiltersInfo {
  applied: {
    startDate?: string;
    endDate?: string;
    search?: string;
    status?: string;
  };
  availableStatuses: string[];
  availableChannels: string[];
}

interface StatsInfo {
  totalTransfers: number;
  totalAmount: number;
  pending: number;
  pendingAmount: number;
  processed: number;
  processedAmount: number;
  error: number;
  errorAmount: number;
  averageAmount: number;
  approvalRate: number;
}

interface SimpleResponse {
  requests: RequestImageResponse[];
  pagination: PaginationInfo;
  filters: FiltersInfo;
  stats: StatsInfo;
}

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

    // Obtener información del lead y contacto para extraer el nombre
    const kommoConfig = { subdomain: KOMMO_CONFIG.subdomain || "" };
    const leadInfo = await getLeadInfo(paymentRequest.leadId, kommoConfig);

    let username = leadInfo.name;
    let platform = USER_REGISTRATION_CONFIG.platform;

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
      username,
      platform,
      updatedAt: getCurrentArgentinaISO(),
    };

    // Actualizar el documento en la base de datos
    const updateSuccess = await dbService.updatePaymentById(paymentRequest._id?.toString() || "", updateData as Partial<PaymentRequestDocument>);

    if (!updateSuccess) {
      console.error(`❌ Error actualizando la base de datos para leadId: ${leadId}`);
      return NextResponse.json(
        { error: "Error actualizando los datos en la base de datos" },
        { status: 500 }
      );
    }

    // Retornar los datos actualizados incluyendo username y platform
    const updatedPaymentRequest = {
      ...paymentRequest,
      ...updateData,
      username,
      platform,
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '1000', 10));

    // Parámetros de filtro de fecha
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Parámetro de búsqueda
    const searchParam = searchParams.get('search');

    // Parámetro de filtro por status
    const statusParam = searchParams.get('status');

    // Obtener colección
    const client = await clientPromise;
    const db = client.db(MONGO_CONFIG.database);
    const collection = db.collection(MONGO_CONFIG.collection.requestImages || 'request_images');

    // Construir filtros
    const filters: any[] = [
      // Siempre filtrar por registros que tienen extractedData con amount
      { 'extractedData.amount': { $exists: true, $ne: null } }
    ];

    // Filtro de búsqueda
    if (searchParam && searchParam.trim()) {
      const searchRegex = new RegExp(searchParam.trim(), 'i'); // insensible a mayúsculas
      filters.push({
        $or: [
          { 'extractedData.sender.name': { $regex: searchRegex } },
          { 'extractedData.receiver.name': { $regex: searchRegex } },
          { 'extractedData.sender.cuit': { $regex: searchRegex } },
          { 'extractedData.receiver.cuit': { $regex: searchRegex } },
          { 'extractedData.operationNumber': { $regex: searchRegex } },
          { 'extractedData.platform': { $regex: searchRegex } },
          { leadId: { $regex: searchRegex } },
          { contactId: { $regex: searchRegex } },
          { talkId: { $regex: searchRegex } },
          { username: { $regex: searchRegex } }
        ]
      });
    }

    // Filtro por status
    if (statusParam && ['pending', 'processed', 'error'].includes(statusParam)) {
      filters.push({ status: statusParam });
    }

    // Filtros de fecha
    if (startDateParam || endDateParam) {
      const dateFilter: any = {};
      if (startDateParam) {
        dateFilter.$gte = startDateParam;
      }
      if (endDateParam) {
        dateFilter.$lte = endDateParam;
      }
      filters.push({ createdAt: dateFilter });
    }

    // Construir filtro combinado usando $and
    const baseFilter = filters.length > 1 ? { $and: filters } : filters[0] || {};

    // Contar total de registros que cumplen el filtro
    const total = await collection.countDocuments(baseFilter);
    console.log('Total de registros con filtro aplicado:', total);

    // Calcular paginación
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    // Obtener los registros ordenados por fecha descendente con paginación
    const requests = await collection
      .find(baseFilter)
      .sort({ createdAt: -1, updatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(Math.min(limit, 1000)) // Máximo 1000 para evitar sobrecarga
      .toArray();

    // Calcular estadísticas usando agregación
    let statsAggregation: Array<{ _id: string; count: number }> = [];
    try {
      statsAggregation = await collection.aggregate([
        {
          $match: baseFilter
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]).toArray() as Array<{ _id: string; count: number }>;
    } catch (error) {
      console.error('Error en agregación de estadísticas:', error);
      statsAggregation = [];
    }

    // Procesar estadísticas
    const stats: StatsInfo = {
      totalTransfers: total,
      totalAmount: 0,
      pending: 0,
      pendingAmount: 0,
      processed: 0,
      processedAmount: 0,
      error: 0,
      errorAmount: 0,
      averageAmount: 0,
      approvalRate: 0,
    };


    
    statsAggregation.forEach(stat => {
      switch (stat._id) {
        case 'pending':
          stats.pending = stat.count;
          break;
        case 'processed':
          stats.processed = stat.count;
          break;
        case 'error':
          stats.error = stat.count;
          break;
      }
    });

    // Calcular montos totales para documentos processed con filtro aplicado
    try {
      const processedDocs = await collection.find({
        ...baseFilter,
        status: 'processed'
      }).toArray();

      let totalAmount = 0;
      processedDocs.forEach(doc => {
        const amount = doc.extractedData?.amount;
        if (amount && typeof amount === 'number') {
          totalAmount += amount;
        }
      });

      stats.processedAmount = totalAmount;
      stats.totalAmount = totalAmount;
      stats.averageAmount = stats.processed > 0 ? stats.totalAmount / stats.processed : 0;
    } catch (error) {
      console.error('Error calculando montos:', error);
    }

    // Calcular tasa de aprobación
    stats.approvalRate = stats.totalTransfers > 0 ? (stats.processed / stats.totalTransfers) * 100 : 0;

    // Obtener estados disponibles para filtros
    const availableStatuses = ['pending', 'processed', 'error'];
    const availableChannels = ['kommo']; // Por ahora solo kommo, pero se puede expandir

    // Construir respuesta completa
    const response: SimpleResponse = {
      requests: requests.map((request) => ({
        _id: request._id.toString(),
        talkId: request.talkId,
        leadId: request.leadId,
        contactId: request.contactId,
        attachment: request.attachment,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        status: request.status,
        extractedData: request.extractedData,
        gptAnalysis: request.gptAnalysis,
        receipt: request.receipt,
        username: request.username,
        platform: request.platform
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: {
        applied: {
          startDate: startDateParam || undefined,
          endDate: endDateParam || undefined,
          search: searchParam || undefined,
          status: statusParam || undefined
        },
        availableStatuses,
        availableChannels
      },
      stats
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error al obtener solicitudes de imagen:', error);
    return NextResponse.json({ message: 'Error interno del servidor.' }, { status: 500 });
  }
}