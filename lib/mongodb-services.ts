import { MongoClient, ObjectId } from "mongodb";
import clientPromise from "./mongodb";
import {
  logWelcomeBotSkipped,
  logWelcomeBotDetection,
  logWelcomeBotLaunched,
  logWelcomeBotError,
  logger,
} from "./logger";
import { META_CONFIG, MONGO_CONFIG } from "./kommo-config";
import {
  BotActionLog,
  ChangeStatusLog,
  LogEntry,
  LogsQueryParams,
  LogsResponse,
  ReceivedMessageLog,
  RuleDocument,
  RulesQueryParams,
  RulesResponse,
  SendMetaLog,
  UserDocument,
  LeadDocument,
  TaskDocument,
  MessageDocument,
  BotActionDocument,
  TokenVisitDocument,
  ContactContext,
  StatusDocument,
  SettingsDocument,
} from "@/types/kommo";
import {
  convertToArgentinaISO,
  convertToUTC,
  getCurrentArgentinaISO,
  getCurrentDate,
  getDateHoursAgo,
} from "./utils";

export interface PaymentRequestDocument {
  _id?: string;
  leadId: string;
  contactId: string;
  talkId: string;
  attachment: {
    type: string;
    link: string;
    file_name: string;
  };
  createdAt: string;
  updatedAt: string;
  status: "pending" | "processed" | "error";
  receipt?: {
    url: string;
    name: string;
  };
  gptAnalysis?: {
    success: boolean;
    extractedAt: string;
    partial: boolean;
    note?: string;
    confidence?: number;
  };
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
  username?: string;
  platform?: any;
}

// Servicios para interactuar con MongoDB
export class KommoDatabaseService {
  private static instance: KommoDatabaseService;
  private client: MongoClient | null = null;

  private constructor() {}

  static getInstance(): KommoDatabaseService {
    if (!KommoDatabaseService.instance) {
      KommoDatabaseService.instance = new KommoDatabaseService();
    }
    return KommoDatabaseService.instance;
  }

  private async getClient(): Promise<MongoClient> {
    if (!this.client) {
      this.client = await clientPromise;
    }
    return this.client;
  }

  private async getCollection(collectionName: string) {
    const client = await this.getClient();
    console.log(`🗄️ Usando base de datos: ${MONGO_CONFIG.database}`);
    console.log(`📋 Usando colección: ${collectionName}`);
    const db = client.db(MONGO_CONFIG.database);
    return db.collection(collectionName);
  }

  // servicio para crear solicitud de pago
  async createPaymentRequest(data: {
    leadId: string;
    contactId: string;
    talkId: string;
    attachment: {
      type: string;
      link: string;
      file_name: string;
    };
  }): Promise<PaymentRequestDocument> {
    // Verificar si ya existe una solicitud de pago para este lead y contacto
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.requestImages || ""
    );

    // Verificar si ya existe una solicitud de pago para este lead y contacto
    console.log(
      `💰 Creando solicitud de pago para attachment: ${data.attachment}`
    );

    const paymentRequestDocument: PaymentRequestDocument = {
      talkId: data.talkId,
      leadId: data.leadId,
      contactId: data.contactId,
      attachment: data.attachment,
      createdAt: getCurrentArgentinaISO(),
      updatedAt: getCurrentArgentinaISO(),
      status: "pending",
    };

    const { _id, ...paymentRequestData } = paymentRequestDocument;
    const result = await collection.insertOne(paymentRequestData);
    return { ...paymentRequestDocument, _id: result.insertedId.toString() };
  }

  // Servicio para obtener solicitud de pago por leadId (solo status pending)
  async getPaymentRequestByLeadId(
    leadId: string
  ): Promise<PaymentRequestDocument | null> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.requestImages || ""
    );
    console.log(
      `🔍 Buscando solicitud de pago PENDING más reciente para leadId: ${leadId}`
    );
    const paymentRequest = (await collection.findOne(
      {
        leadId,
        status: "pending",
      },
      {
        sort: { createdAt: -1 },
      }
    )) as PaymentRequestDocument | null;

    if (paymentRequest) {
      console.log(
        `✅ Encontrada solicitud de pago PENDING con attachment: ${paymentRequest.attachment}`
      );
    } else {
      console.log(
        `❌ No se encontró solicitud de pago PENDING para leadId: ${leadId}`
      );
    }

    return paymentRequest;
  }

  // Servicio para actualizar solicitud de pago por leadId
  async updatePaymentRequestByLeadId(
    leadId: string,
    updateData: Partial<PaymentRequestDocument>
  ): Promise<boolean> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.requestImages || ""
    );

    console.log(`🔄 Actualizando solicitud de pago para leadId: ${leadId}`);

    try {
      const result = await collection.updateOne(
        { leadId },
        { $set: updateData }
      );

      if (result.matchedCount > 0) {
        console.log(
          `✅ Solicitud de pago actualizada exitosamente para leadId: ${leadId}`
        );
        return true;
      } else {
        console.log(
          `❌ No se encontró solicitud de pago para actualizar leadId: ${leadId}`
        );
        return false;
      }
    } catch (error) {
      console.error(
        `❌ Error actualizando solicitud de pago para leadId: ${leadId}`,
        error
      );
      throw error;
    }
  }

  async updatePaymentById(
    id: string,
    updateData: Partial<PaymentRequestDocument>
  ): Promise<boolean> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.requestImages || ""
    );
    console.log(`🔄 Actualizando solicitud de pago por id: ${id}`);
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    return result.matchedCount > 0;
  }

  // Servicio para crear usuario
  async createUser(data: {
    sourceUid: string;
    client: { name: string; id: string };
    createdAt: string | number;
    contactId: string;
    source: string;
    sourceName: string;
    messageText: string;
  }): Promise<UserDocument> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.users || ""
    );

    // Verificar si ya existe un usuario con este client.id
    const existingUser = await collection.findOne({ clientId: data.client.id });

    if (existingUser) {
      // Actualizar el usuario existente
      const updateData: Partial<UserDocument> = {
        name: data.client.name,
        contactId: data.contactId,
        source: data.source,
        sourceUid: data.sourceUid,
        sourceName: data.sourceName,
        messageText: data.messageText,
        updatedAt: getCurrentArgentinaISO(),
      };

      await collection.updateOne(
        { clientId: data.client.id },
        { $set: updateData }
      );

      return { ...existingUser, ...updateData } as UserDocument;
    }

    // Crear nuevo usuario
    const userDocument: UserDocument = {
      clientId: data.client.id,
      name: data.client.name,
      contactId: data.contactId,
      source: data.source,
      sourceUid: data.sourceUid,
      sourceName: data.sourceName,
      messageText: data.messageText,
      createdAt: convertToArgentinaISO(data.createdAt),
      updatedAt: getCurrentArgentinaISO(),
    };

    const { _id, ...userData } = userDocument;
    const result = await collection.insertOne(userData);
    return { ...userDocument, _id: result.insertedId.toString() };
  }

  // Servicio para crear lead (elemento no ordenado)
  async createLead(data: {
    uid: string;
    source: string;
    sourceUid: string;
    category: string;
    leadId: string;
    contactId: string;
    pipelineId: string;
    createdAt: string | number;
    client: { name: string; id: string };
    messageText: string;
    sourceName: string;
  }): Promise<LeadDocument> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.leads || ""
    );

    // Verificar si ya existe un lead con este uid
    const existingLead = await collection.findOne({ uid: data.uid });

    if (existingLead) {
      // Actualizar el lead existente
      const updateData: Partial<LeadDocument> = {
        source: data.source,
        sourceUid: data.sourceUid,
        category: data.category,
        leadId: data.leadId,
        contactId: data.contactId,
        pipelineId: data.pipelineId,
        client: data.client,
        messageText: data.messageText,
        sourceName: data.sourceName,
        updatedAt: getCurrentArgentinaISO(),
      };

      await collection.updateOne({ uid: data.uid }, { $set: updateData });

      return { ...existingLead, ...updateData } as LeadDocument;
    }

    // Crear nuevo lead
    const leadDocument: LeadDocument = {
      uid: data.uid,
      source: data.source,
      sourceUid: data.sourceUid,
      category: data.category,
      leadId: data.leadId,
      contactId: data.contactId,
      pipelineId: data.pipelineId,
      createdAt: convertToArgentinaISO(data.createdAt),
      client: data.client,
      messageText: data.messageText,
      sourceName: data.sourceName,
      updatedAt: getCurrentArgentinaISO(),
    };

    const { _id, ...leadData } = leadDocument;
    const result = await collection.insertOne(leadData);
    return { ...leadDocument, _id: result.insertedId.toString() };
  }

  // Servicio para crear task (nueva conversación)
  async createTask(data: {
    talkId: string;
    contactId: string;
    chatId: string;
    entityId: string;
    entityType: string;
    origin: string;
    isInWork: string;
    isRead: string;
    createdAt: string | number;
  }): Promise<TaskDocument> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.tasks || ""
    );

    // Verificar si ya existe una task con este talkId
    const existingTask = await collection.findOne({ talkId: data.talkId });

    if (existingTask) {
      // Si existe, actualizarla
      return this.updateTask({
        talkId: data.talkId,
        contactId: data.contactId,
        chatId: data.chatId,
        entityId: data.entityId,
        entityType: data.entityType,
        origin: data.origin,
        isInWork: data.isInWork,
        isRead: data.isRead,
        updatedAt: data.createdAt,
      });
    }

    // Crear nueva task
    const taskDocument: TaskDocument = {
      talkId: data.talkId,
      contactId: data.contactId,
      chatId: data.chatId,
      entityId: data.entityId,
      entityType: data.entityType,
      origin: data.origin,
      isInWork: data.isInWork === "1",
      isRead: data.isRead === "1",
      createdAt: convertToArgentinaISO(data.createdAt),
      updatedAt: getCurrentArgentinaISO(),
    };

    const { _id, ...taskData } = taskDocument;
    const result = await collection.insertOne(taskData);
    return { ...taskDocument, _id: result.insertedId.toString() };
  }

  // Servicio para actualizar task (actualización de conversación)
  async updateTask(data: {
    talkId: string;
    contactId: string;
    chatId: string;
    entityId: string;
    entityType: string;
    origin: string;
    isInWork: string;
    isRead: string;
    updatedAt: string | number;
  }): Promise<TaskDocument> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.tasks || ""
    );

    const updateData: Partial<TaskDocument> = {
      contactId: data.contactId,
      chatId: data.chatId,
      entityId: data.entityId,
      entityType: data.entityType,
      origin: data.origin,
      isInWork: data.isInWork === "1",
      isRead: data.isRead === "1",
      updatedAt: convertToArgentinaISO(data.updatedAt),
    };

    const result = await collection.findOneAndUpdate(
      { talkId: data.talkId },
      { $set: updateData },
      { returnDocument: "after" }
    );

    if (!result) {
      throw new Error(`Task with talkId ${data.talkId} not found`);
    }

    return result as unknown as TaskDocument;
  }

  // Servicio para recibir mensaje
  async receiveMessage(data: {
    id: string;
    chatId: string;
    talkId: string;
    contactId: string;
    text: string;
    createdAt: string | number;
    elementType: string;
    entityType: string;
    elementId: string;
    entityId: string;
    type: "incoming" | "outgoing";
    author: {
      id: string;
      type: string;
      name: string;
    };
    attachment?: {
      type: string;
      link: string;
      file_name: string;
    };
  }): Promise<MessageDocument> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.messages || ""
    );

    // Verificar si ya existe un mensaje con este id
    const existingMessage = await collection.findOne({ text: data.text });

    if (existingMessage) {
      // Si existe, actualizarlo (aunque los mensajes normalmente no cambian)
      const updateData: Partial<MessageDocument> = {
        chatId: data.chatId,
        talkId: data.talkId,
        contactId: data.contactId,
        text: data.text,
        elementType: data.elementType,
        entityType: data.entityType,
        elementId: data.elementId,
        entityId: data.entityId,
        type: data.type,
        author: data.author,
        attachment: data.attachment,
        updatedAt: getCurrentArgentinaISO(),
      };

      await collection.updateOne({ id: data.id }, { $set: updateData });

      return { ...existingMessage, ...updateData } as MessageDocument;
    }

    // Crear nuevo mensaje
    const messageDocument: MessageDocument = {
      id: data.id,
      chatId: data.chatId,
      talkId: data.talkId,
      contactId: data.contactId,
      text: data.text,
      createdAt: convertToArgentinaISO(data.createdAt),
      elementType: data.elementType,
      entityType: data.entityType,
      elementId: data.elementId,
      entityId: data.entityId,
      type: data.type,
      author: data.author,
      attachment: data.attachment,
      updatedAt: getCurrentArgentinaISO(),
    };

    const { _id, ...messageData } = messageDocument;
    const result = await collection.insertOne(messageData);
    return { ...messageDocument, _id: result.insertedId.toString() };
  }

  // Servicio para crear registro de acción del bot
  async createBotAction(data: {
    talkId: string;
    entityId: string;
    contactId: string;
    messageText: string;
    messageCreatedAt: string | number;
    aiDecision: {
      currentStatus: string;
      newStatus: string;
      shouldChange: boolean;
      reasoning: string;
      confidence: number;
    };
    statusUpdateResult: {
      success: boolean;
      error?: string;
    };
  }): Promise<BotActionDocument> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.botActions || ""
    );

    // Crear nuevo registro de acción del bot
    const botActionDocument: BotActionDocument = {
      talkId: data.talkId,
      entityId: data.entityId,
      contactId: data.contactId,
      messageText: data.messageText.trim().toLowerCase(), // Normalizar el texto para consistencia
      messageCreatedAt: convertToArgentinaISO(data.messageCreatedAt),
      aiDecision: data.aiDecision,
      statusUpdateResult: data.statusUpdateResult,
      processingTimestamp: getCurrentArgentinaISO(),
      createdAt: getCurrentArgentinaISO(),
    };

    const { _id, ...botActionData } = botActionDocument;
    const result = await collection.insertOne(botActionData);
    return { ...botActionDocument, _id: result.insertedId.toString() };
  }

  // Servicio para crear registro de token visit
  async createTokenVisit(data: {
    campaignId?: string;
    token: string;
    lead: any;
    eventSourceUrl: string;
  }): Promise<TokenVisitDocument> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.tokenVisit || ""
    );

    const settings = await this.getAllSettings();

    // Seleccionar número de redireccionamiento basado en uso reciente
    let redirectNumber: { name: string; phone: string } | undefined;

    if (
      settings.length > 0 &&
      settings[0].numbers &&
      settings[0].numbers.length > 0
    ) {
      const availableNumbers = settings[0].numbers;

      // Obtener los últimos tokens visit para ver qué números se usaron recientemente
      const lastTokens = await this.getLastTokenVisits(availableNumbers.length);

      // Crear un mapa de números usados recientemente (phone -> último uso)
      const recentlyUsedNumbers = new Map<string, string>();
      lastTokens.forEach((token) => {
        if (token.redirectNumber) {
          recentlyUsedNumbers.set(token.redirectNumber.phone, token.createdAt);
        }
      });

      // Encontrar números que no se han usado recientemente
      const unusedNumbers = availableNumbers.filter(
        (num) => !recentlyUsedNumbers.has(num.phone)
      );

      if (unusedNumbers.length > 0) {
        // Si hay números no usados recientemente, seleccionar el primero
        redirectNumber = unusedNumbers[0];
        console.log(
          `🔄 Número seleccionado (no usado recientemente): ${redirectNumber.name} (${redirectNumber.phone})`
        );
      } else {
        // Si todos los números se han usado recientemente, seleccionar el menos usado
        // Ordenar por fecha de último uso (más antiguo primero)
        const sortedByLastUse = availableNumbers
          .map((num) => ({
            number: num,
            lastUsed:
              recentlyUsedNumbers.get(num.phone) || "1970-01-01T00:00:00.000Z",
          }))
          .sort(
            (a, b) =>
              new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime()
          );

        redirectNumber = sortedByLastUse[0].number;
        console.log(
          `🔄 Número seleccionado (menos usado recientemente): ${redirectNumber.name} (${redirectNumber.phone}) - último uso: ${sortedByLastUse[0].lastUsed}`
        );
      }
    } else {
      console.log(
        "⚠️ No hay números disponibles en settings para redireccionamiento"
      );
    }

    // Crear nuevo registro de token visit
    const tokenVisitDocument: TokenVisitDocument = {
      token: data.token,
      lead: data.lead,
      eventSourceUrl: data.eventSourceUrl,
      createdAt: getCurrentArgentinaISO(),
      redirectNumber: redirectNumber,
      message: settings[0].message,
      campaignId: data.campaignId || "",
    };

    const { _id, ...tokenVisitData } = tokenVisitDocument;
    const result = await collection.insertOne(tokenVisitData);
    return {
      ...tokenVisitDocument,
      _id: result.insertedId.toString(),
      redirectNumber: redirectNumber,
      message: settings[0].message,
    };
  }

  // Servicio para buscar token por valor
  async findTokenVisit(token: string): Promise<TokenVisitDocument | null> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.tokenVisit || ""
    );
    const result = await collection.findOne({ token });
    return result
      ? ({
          ...result,
          _id: result._id.toString(),
          message: result.message,
        } as TokenVisitDocument)
      : null;
  }

  // Servicio para obtener los últimos tokens visit con números de redirección
  async getLastTokenVisits(limit: number = 10): Promise<TokenVisitDocument[]> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.tokenVisit || ""
    );

    const results = await collection
      .find({ redirectNumber: { $exists: true } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return results.map(
      (result) =>
        ({
          ...result,
          _id: result._id.toString(),
          message: result.message,
        } as TokenVisitDocument)
    );
  }

  // Servicio para obtener estadísticas de reportes desde sendMeta
  async getReports(
    campaignId?: string,
    startDate?: string,
    endDate?: string,
    eventName?: string,
    eventSourceUrl?: string
  ): Promise<{
    totalEvents: number;
    eventTypes: string[];
    event1Count: number;
    event2Count: number;
  }> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.sendMeta || ""
    );

    // Calcular fecha límite (últimas 24 horas)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Construir filtros
    const filters: any = {
      success: true, // Solo registros exitosos
    };

    // Manejar filtros de fecha
    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) {
        const startDateObj = new Date(startDate);
        if (!isNaN(startDateObj.getTime())) {
          dateFilter.$gte = startDateObj;
        } else {
          console.warn(`⚠️ Fecha de inicio inválida: ${startDate}`);
        }
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        if (!isNaN(endDateObj.getTime())) {
          dateFilter.$lte = endDateObj;
        } else {
          console.warn(`⚠️ Fecha de fin inválida: ${endDate}`);
        }
      }
      // Solo aplicar filtro si al menos una fecha es válida
      if (Object.keys(dateFilter).length > 0) {
        filters.timestamp = dateFilter;
      } else {
        // Si las fechas son inválidas, usar últimas 24 horas
        filters.timestamp = { $gte: twentyFourHoursAgo };
      }
    } else {
      // Por defecto, últimas 24 horas si no se especifican fechas
      filters.timestamp = { $gte: twentyFourHoursAgo };
    }

    // Agregar filtros opcionales
    if (campaignId) {
      filters.campaignId = campaignId;
    }

    if (eventName) {
      filters["conversionData.data.event_name"] = eventName;
    }

    if (eventSourceUrl) {
      filters["conversionData.data.event_source_url"] = eventSourceUrl;
    }

    // Obtener todos los documentos que coinciden con los filtros
    const documents = await collection.find(filters).toArray();

    // Procesar los datos para calcular estadísticas
    let totalEvents = 0;
    const eventCounts: { [key: string]: number } = {};
    const eventTypes: Set<string> = new Set();

    documents.forEach((doc) => {
      if (doc.conversionData && Array.isArray(doc.conversionData)) {
        doc.conversionData.forEach((conversion: any) => {
          if (conversion && conversion.data && Array.isArray(conversion.data)) {
            conversion.data.forEach((event: any) => {
              if (event && event.event_name) {
                totalEvents++;
                eventTypes.add(event.event_name);
                eventCounts[event.event_name] =
                  (eventCounts[event.event_name] || 0) + 1;
              }
            });
          }
        });
      }
    });

    // Obtener conteos específicos para event1 y event2 desde META_CONFIG
    const event1Count = eventCounts[META_CONFIG.event1] || 0;
    const event2Count = eventCounts[META_CONFIG.event2] || 0;

    return {
      totalEvents,
      eventTypes: Array.from(eventTypes),
      event1Count,
      event2Count,
    };
  }

  // Servicio para obtener o crear resumen diario de meta events
  async getOrCreateDailyMeta(dateString: string): Promise<{
    timestamp: string;
    data: {
      totalEvents: number;
      eventTypes: string[];
      [key: string]: any;
    };
    action: "created" | "updated";
  }> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.dailyMeta || ""
    );

    // Crear fecha exacta sin modificaciones de zona horaria
    const targetDate = new Date(dateString);
    if (isNaN(targetDate.getTime())) {
      throw new Error(`Fecha inválida: ${dateString}`);
    }

    // Crear fechas para el inicio y fin del día SIN modificar zona horaria
    // Usar la fecha tal cual viene, solo ajustar horas del mismo día
    const year = targetDate.getUTCFullYear();
    const month = targetDate.getUTCMonth();
    const day = targetDate.getUTCDate();

    const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

    console.log("startOfDay", startOfDay);
    console.log("endOfDay", endOfDay);

    // Obtener datos resumidos del día usando la misma lógica de agregación que la query del usuario
    const sendMetaCollection = await this.getCollection(
      MONGO_CONFIG.collection.sendMeta || ""
    );

    // DEBUG: Obtener todos los registros que se van a sumarizar
    const debugDocuments = await sendMetaCollection
      .find({
        success: true,
        timestamp: {
          $gte: startOfDay,
          $lt: endOfDay,
        },
      })
      .toArray();

    console.log(
      `📊 DEBUG - Registros encontrados para sumarizar (${debugDocuments.length}):`,
      debugDocuments
    );

    const pipeline = [
      {
        $match: {
          success: true,
          timestamp: {
            $gte: startOfDay,
            $lt: endOfDay,
          },
        },
      },
      {
        $unwind: "$conversionData",
      },
      {
        $unwind: "$conversionData.data",
      },
      {
        $project: {
          event_name: "$conversionData.data.event_name",
        },
      },
      {
        $group: {
          _id: null,
          totalEvents: {
            $sum: 1,
          },
          eventTypes: {
            $addToSet: "$event_name",
          },
          eventCounts: {
            $push: "$event_name",
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalEvents: 1,
          eventTypes: 1,
          eventCounts: {
            $arrayToObject: {
              $map: {
                input: "$eventTypes",
                as: "type",
                in: {
                  k: "$$type",
                  v: {
                    $size: {
                      $filter: {
                        input: "$eventCounts",
                        as: "e",
                        cond: {
                          $eq: ["$$e", "$$type"],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          totalEvents: 1,
          eventTypes: 1,
          eventCounts: {
            $mergeObjects: ["$eventCounts", {}],
          },
        },
      },
    ];

    const aggregationResult = await sendMetaCollection
      .aggregate(pipeline)
      .toArray();
    const dailyData =
      aggregationResult.length > 0
        ? aggregationResult[0]
        : {
            totalEvents: 0,
            eventTypes: [],
            eventCounts: {},
          };

    // Crear el objeto de datos para guardar
    const dataToSave = {
      totalEvents: dailyData.totalEvents,
      eventTypes: dailyData.eventTypes,
      [META_CONFIG.event1]: dailyData.eventCounts[META_CONFIG.event1] || 0,
      [META_CONFIG.event2]: dailyData.eventCounts[META_CONFIG.event2] || 0,
    };

    // Buscar si ya existe un registro para esta fecha exacta
    const existingRecord = await collection.findOne({
      timestamp: targetDate,
    });

    if (existingRecord) {
      // Actualizar registro existente - solo actualizar data y updatedAt
      await collection.updateOne(
        { _id: existingRecord._id },
        {
          $set: {
            data: dataToSave,
            updatedAt: getCurrentArgentinaISO(),
          },
        }
      );

      console.log(
        `📅 Registro ${
          MONGO_CONFIG.collection.dailyMeta
        } actualizado para fecha: ${targetDate.toISOString().split("T")[0]}`
      );

      return {
        timestamp: targetDate.toISOString(),
        data: dataToSave,
        action: "updated",
      };
    } else {
      // Crear nuevo registro
      const newRecord = {
        timestamp: targetDate,
        data: dataToSave,
        createdAt: getCurrentArgentinaISO(),
        updatedAt: getCurrentArgentinaISO(),
      };

      await collection.insertOne(newRecord);

      console.log(
        `📅 Nuevo registro daily_meta creado para fecha: ${
          targetDate.toISOString().split("T")[0]
        }`
      );

      return {
        timestamp: targetDate.toISOString(),
        data: dataToSave,
        action: "created",
      };
    }
  }

  // Servicio para obtener datos de gráficos desde daily_meta
  async getReportsStats(
    campaignId?: string,
    startDate?: string,
    endDate?: string,
    eventName?: string
  ): Promise<{
    all: Array<{ x: string; y: number }>;
    event1: Array<{ x: string; y: number }>;
    event2: Array<{ x: string; y: number }>;
  }> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.dailyMeta || ""
    );

    // === 1️⃣ Filtros base ===
    const filters: any = {};
    if (startDate || endDate) {
      filters.timestamp = {};
      if (startDate) filters.timestamp.$gte = new Date(startDate);
      if (endDate) filters.timestamp.$lte = new Date(endDate);
    }

    // === 2️⃣ Obtenemos los documentos ya resumidos ===
    const docs = await collection
      .find(filters)
      .sort({ timestamp: 1 })
      .toArray();

    // === 3️⃣ Mapeamos la data a formato gráfico ===
    const all: Array<{ x: string; y: number }> = [];
    const event1: Array<{ x: string; y: number }> = [];
    const event2: Array<{ x: string; y: number }> = [];

    docs.forEach((doc) => {
      const date = new Date(doc.timestamp).toISOString().split("T")[0]; // "YYYY-MM-DD"
      const data = doc.data || {};

      all.push({
        x: date,
        y: data.totalEvents || 0,
      });

      event1.push({
        x: date,
        y: data.ConversacionCRM1 || 0, // tu evento principal
      });

      event2.push({
        x: date,
        y: data.CargoCRM1 || 0, // tu segundo evento
      });
    });

    return { all, event1, event2 };
  }

  // Servicio para obtener contexto histórico de un contacto (últimas 24 horas)
  async getContactContext(contactId: string): Promise<ContactContext> {
    const client = await this.getClient();
    const db = client.db(MONGO_CONFIG.database);

    // Calcular fecha límite (24 horas atrás)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Consultas paralelas para optimizar rendimiento
    const [
      userResult,
      leadsResult,
      messagesResult,
      tasksResult,
      botActionsResult,
    ] = await Promise.all([
      // Información del usuario
      db.collection(MONGO_CONFIG.collection.users || "").findOne({ contactId }),

      // Leads activos (últimas 24 horas)
      db
        .collection(MONGO_CONFIG.collection.leads || "")
        .find({
          contactId,
          createdAt: { $gte: twentyFourHoursAgo.toISOString() },
        })
        .sort({ createdAt: -1 })
        .toArray(),

      // Mensajes recientes
      db
        .collection(MONGO_CONFIG.collection.messages || "")
        .find({
          contactId,
          createdAt: { $gte: twentyFourHoursAgo.toISOString() },
        })
        .sort({ createdAt: 1 })
        .toArray(),

      // Tareas activas
      db
        .collection(MONGO_CONFIG.collection.tasks || "")
        .find({
          contactId,
          createdAt: { $gte: twentyFourHoursAgo.toISOString() },
        })
        .sort({ updatedAt: -1 })
        .toArray(),

      // Acciones del bot recientes
      db
        .collection(MONGO_CONFIG.collection.botActions || "")
        .find({
          contactId,
          createdAt: { $gte: twentyFourHoursAgo.toISOString() },
        })
        .sort({ createdAt: -1 })
        .toArray(),
    ]);

    // Procesar y normalizar la información del usuario
    const userInfo = userResult
      ? {
          name: userResult.name,
          clientId: userResult.clientId,
          source: userResult.source,
          sourceName: userResult.sourceName,
          firstMessage: userResult.messageText,
          firstMessageDate: userResult.createdAt,
        }
      : undefined;

    // Procesar leads activos
    const activeLeads = leadsResult.map((lead) => ({
      leadId: lead.leadId,
      createdAt: lead.createdAt,
      lastActivity: lead.updatedAt,
    }));

    // Procesar mensajes recientes
    const recentMessages = messagesResult.map((msg) => ({
      text: msg.text,
      type: msg.type,
      createdAt: msg.createdAt,
      authorName: msg.author?.name || "Desconocido",
    }));

    // Procesar tareas activas
    const activeTasks = tasksResult.map((task) => ({
      talkId: task.talkId,
      isInWork: task.isInWork,
      isRead: task.isRead,
      createdAt: task.createdAt,
      lastActivity: task.updatedAt,
    }));

    // Procesar acciones del bot
    const botActions = botActionsResult.map((action) => ({
      messageText: action.messageText,
      aiDecision: action.aiDecision,
      statusUpdateResult: action.statusUpdateResult,
      processingTimestamp: action.processingTimestamp,
    }));

    // Calcular resumen
    const totalMessages = recentMessages.length;
    const lastActivity =
      recentMessages.length > 0
        ? recentMessages[recentMessages.length - 1].createdAt
        : userInfo?.firstMessageDate || new Date().toISOString();

    // Determinar status actual basado en la última acción del bot
    const currentStatus =
      botActions.length > 0 ? botActions[0].aiDecision.newStatus : undefined;

    // Calcular duración de la conversación
    const firstActivity = userInfo?.firstMessageDate || lastActivity;
    const conversationDuration = this.calculateDuration(
      firstActivity,
      lastActivity
    );

    return {
      contactId,
      userInfo,
      activeLeads,
      recentMessages,
      activeTasks,
      botActions,
      summary: {
        totalMessages,
        lastActivity,
        currentStatus,
        conversationDuration,
      },
    };
  }

  // Método auxiliar para calcular duración
  private calculateDuration(startDate: string, endDate: string): string {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  }

  // ===== MÉTODOS PARA CONSULTAR LOGS =====
  async getReceivedMessagesLogs(
    params: LogsQueryParams
  ): Promise<{ logs: ReceivedMessageLog[]; total: number }> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.messages || ""
    );

    // Construir pipeline de agregación para messages
    const pipeline: any[] = [];

    // Filtros de fecha
    if (params.startDate || params.endDate) {
      const dateFilter: any = {};
      if (params.startDate) dateFilter.$gte = params.startDate;
      if (params.endDate) dateFilter.$lte = params.endDate;
      pipeline.push({ $match: { createdAt: dateFilter } });
    }

    // Filtros adicionales
    const matchFilter: any = {};
    const andConditions: any[] = [];

    // Filtros específicos
    if (params.contactId) andConditions.push({ contactId: params.contactId });
    if (params.leadId) andConditions.push({ entityId: params.leadId });
    if (params.talkId) andConditions.push({ talkId: params.talkId });
    if (params.userName)
      andConditions.push({
        "author.name": { $regex: params.userName, $options: "i" },
      });

    // Filtro por searchTerm (busca en contactId, leadId o authorName)
    if (params.searchTerm) {
      const searchRegex = { $regex: params.searchTerm, $options: "i" };
      andConditions.push({
        $or: [
          { contactId: searchRegex },
          { entityId: searchRegex },
          { "author.name": searchRegex },
          { text: searchRegex }, // También buscar en el texto del mensaje
        ],
      });
    }

    if (andConditions.length > 0) {
      if (andConditions.length === 1) {
        Object.assign(matchFilter, andConditions[0]);
      } else {
        matchFilter.$and = andConditions;
      }
    }

    if (Object.keys(matchFilter).length > 0) {
      pipeline.push({ $match: matchFilter });
    }

    // Lookup para obtener información del usuario/contacto
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "contactId",
        foreignField: "contactId",
        as: "userInfo",
      },
    });

    // Lookup para obtener información del lead
    pipeline.push({
      $lookup: {
        from: "leads",
        localField: "entityId",
        foreignField: "leadId",
        as: "leadInfo",
      },
    });

    // Proyección de los campos necesarios
    pipeline.push({
      $project: {
        id: "$id",
        timestamp: "$createdAt",
        type: { $literal: "received_messages" },
        contactId: "$contactId",
        leadId: "$entityId",
        talkId: "$talkId",
        messageText: "$text",
        messageType: "$type",
        authorName: "$author.name",
        messageId: "$id",
        chatId: "$chatId",
        userName: {
          $ifNull: [{ $arrayElemAt: ["$userInfo.name", 0] }, "$author.name"],
        },
        clientId: {
          $ifNull: [{ $arrayElemAt: ["$userInfo.clientId", 0] }, ""],
        },
        sourceName: {
          $ifNull: [{ $arrayElemAt: ["$userInfo.sourceName", 0] }, ""],
        },
      },
    });

    // Ordenamiento con estabilidad (primero por campo principal, luego por id para consistencia)
    const sortField =
      params.sortBy === "timestamp"
        ? "timestamp"
        : params.sortBy === "userName"
        ? "userName"
        : params.sortBy === "contactId"
        ? "contactId"
        : params.sortBy === "leadId"
        ? "leadId"
        : params.sortBy === "type"
        ? "type"
        : "timestamp";
    const sortOrder = params.sortOrder === "asc" ? 1 : -1;
    pipeline.push({ $sort: { [sortField]: sortOrder, id: 1 } });

    // Paginación
    const limit = params.limit || 50;
    const offset = params.offset || 0;
    pipeline.push({ $skip: offset }, { $limit: limit });

    const logs = await collection.aggregate(pipeline).toArray();

    // Contar total usando consulta separada sin paginación
    const countPipeline = [...pipeline.slice(0, -2), { $count: "total" }]; // Quitar skip y limit
    const countResult = await collection.aggregate(countPipeline).toArray();
    const total = countResult.length > 0 ? countResult[0].total : 0;

    return {
      logs: logs.map((log, index) => ({
        ...log,
        index: offset + index + 1,
        userName: log.userName || "Usuario desconocido",
        clientId: log.clientId || "",
        sourceName: log.sourceName || "",
      })) as ReceivedMessageLog[],
      total,
    };
  }


  async getChangeStatusLogs(
    params: LogsQueryParams
  ): Promise<{ logs: ChangeStatusLog[]; total: number }> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.botActions || ""
    );

    // Construir pipeline de agregación
    const pipeline: any[] = [];

    // Filtros de fecha
    if (params.startDate || params.endDate) {
      const dateFilter: any = {};
      if (params.startDate) dateFilter.$gte = params.startDate;
      if (params.endDate) dateFilter.$lte = params.endDate;
      pipeline.push({ $match: { createdAt: dateFilter } });
    }

    // Filtros adicionales
    const matchFilter: any = {};
    const andConditions: any[] = [];

    // Filtros específicos
    if (params.contactId) andConditions.push({ contactId: params.contactId });
    if (params.leadId) andConditions.push({ entityId: params.leadId });
    if (params.talkId) andConditions.push({ talkId: params.talkId });
    if (params.status)
      andConditions.push({ "aiDecision.newStatus": params.status });
    if (params.changedBy === "bot")
      andConditions.push({ "aiDecision.shouldChange": true });

    // Filtro por searchTerm (busca en contactId, leadId o userName)
    if (params.searchTerm) {
      const searchRegex = { $regex: params.searchTerm, $options: "i" };
      andConditions.push({
        $or: [
          { contactId: searchRegex },
          { entityId: searchRegex },
          { messageText: searchRegex },
        ],
      });
    }

    if (andConditions.length > 0) {
      if (andConditions.length === 1) {
        Object.assign(matchFilter, andConditions[0]);
      } else {
        matchFilter.$and = andConditions;
      }
    }

    if (Object.keys(matchFilter).length > 0) {
      pipeline.push({ $match: matchFilter });
    }

    // Lookup para obtener información del usuario
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "contactId",
        foreignField: "contactId",
        as: "userInfo",
      },
    });

    // Proyección
    pipeline.push({
      $project: {
        id: "$_id",
        timestamp: "$createdAt",
        type: { $literal: "change_status" },
        contactId: "$contactId",
        leadId: "$entityId",
        talkId: "$talkId",
        oldStatus: "$aiDecision.currentStatus",
        newStatus: "$aiDecision.newStatus",
        changedBy: { $literal: "bot" },
        reason: "$aiDecision.reasoning",
        confidence: "$aiDecision.confidence",
        success: "$statusUpdateResult.success",
        userName: {
          $ifNull: [
            { $arrayElemAt: ["$userInfo.name", 0] },
            "Usuario desconocido",
          ],
        },
        clientId: {
          $ifNull: [{ $arrayElemAt: ["$userInfo.clientId", 0] }, ""],
        },
        sourceName: {
          $ifNull: [{ $arrayElemAt: ["$userInfo.sourceName", 0] }, ""],
        },
      },
    });

    // Ordenamiento con estabilidad (primero por campo principal, luego por id para consistencia)
    const sortField =
      params.sortBy === "timestamp"
        ? "timestamp"
        : params.sortBy === "userName"
        ? "userName"
        : params.sortBy === "contactId"
        ? "contactId"
        : params.sortBy === "leadId"
        ? "leadId"
        : params.sortBy === "type"
        ? "type"
        : "timestamp";
    const sortOrder = params.sortOrder === "asc" ? 1 : -1;
    pipeline.push({ $sort: { [sortField]: sortOrder, id: 1 } });

    // Paginación
    const limit = params.limit || 50;
    const offset = params.offset || 0;
    pipeline.push({ $skip: offset }, { $limit: limit });

    const logs = await collection.aggregate(pipeline).toArray();

    // Contar total usando consulta separada sin paginación
    const countPipeline = [...pipeline.slice(0, -2), { $count: "total" }]; // Quitar skip y limit
    const countResult = await collection.aggregate(countPipeline).toArray();
    const total = countResult.length > 0 ? countResult[0].total : 0;

    return {
      logs: logs.map((log, index) => ({
        ...log,
        index: offset + index + 1,
        id: log.id.toString(),
        userName: log.userName || "Usuario desconocido",
        clientId: log.clientId || "",
        sourceName: log.sourceName || "",
      })) as ChangeStatusLog[],
      total,
    };
  }

  /**
   * Obtiene logs de acciones del bot
   */
  async getBotActionsLogs(
    params: LogsQueryParams
  ): Promise<{ logs: BotActionLog[]; total: number }> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.botActions || ""
    );

    // Construir pipeline de agregación
    const pipeline: any[] = [];

    // Filtros de fecha
    if (params.startDate || params.endDate) {
      const dateFilter: any = {};
      if (params.startDate) dateFilter.$gte = params.startDate;
      if (params.endDate) dateFilter.$lte = params.endDate;
      pipeline.push({ $match: { createdAt: dateFilter } });
    }

    // Filtros adicionales
    const matchFilter: any = {};
    const andConditions: any[] = [];

    // Filtros específicos
    if (params.contactId) andConditions.push({ contactId: params.contactId });
    if (params.leadId) andConditions.push({ entityId: params.leadId });
    if (params.talkId) andConditions.push({ talkId: params.talkId });
    if (params.status)
      andConditions.push({ "aiDecision.newStatus": params.status });

    // Filtro por searchTerm (busca en contactId, leadId o userName)
    if (params.searchTerm) {
      const searchRegex = { $regex: params.searchTerm, $options: "i" };
      andConditions.push({
        $or: [
          { contactId: searchRegex },
          { entityId: searchRegex },
          { messageText: searchRegex },
        ],
      });
    }

    if (andConditions.length > 0) {
      if (andConditions.length === 1) {
        Object.assign(matchFilter, andConditions[0]);
      } else {
        matchFilter.$and = andConditions;
      }
    }

    if (Object.keys(matchFilter).length > 0) {
      pipeline.push({ $match: matchFilter });
    }

    // Lookup para obtener información del usuario
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "contactId",
        foreignField: "contactId",
        as: "userInfo",
      },
    });

    // Calcular tiempo de procesamiento
    pipeline.push({
      $addFields: {
        processingTime: {
          $subtract: [
            { $dateFromString: { dateString: "$createdAt" } },
            { $dateFromString: { dateString: "$messageCreatedAt" } },
          ],
        },
      },
    });

    // Proyección
    pipeline.push({
      $project: {
        id: "$_id",
        timestamp: "$createdAt",
        type: { $literal: "bot_actions" },
        contactId: "$contactId",
        leadId: "$entityId",
        talkId: "$talkId",
        messageText: "$messageText",
        aiDecision: "$aiDecision",
        statusUpdateResult: "$statusUpdateResult",
        processingTime: "$processingTime",
        userName: {
          $ifNull: [
            { $arrayElemAt: ["$userInfo.name", 0] },
            "Usuario desconocido",
          ],
        },
        clientId: {
          $ifNull: [{ $arrayElemAt: ["$userInfo.clientId", 0] }, ""],
        },
        sourceName: {
          $ifNull: [{ $arrayElemAt: ["$userInfo.sourceName", 0] }, ""],
        },
      },
    });

    // Ordenamiento con estabilidad (primero por campo principal, luego por id para consistencia)
    const sortField =
      params.sortBy === "timestamp"
        ? "timestamp"
        : params.sortBy === "userName"
        ? "userName"
        : params.sortBy === "contactId"
        ? "contactId"
        : params.sortBy === "leadId"
        ? "leadId"
        : params.sortBy === "type"
        ? "type"
        : "timestamp";
    const sortOrder = params.sortOrder === "asc" ? 1 : -1;
    pipeline.push({ $sort: { [sortField]: sortOrder, id: 1 } });

    // Paginación
    const limit = params.limit || 50;
    const offset = params.offset || 0;
    pipeline.push({ $skip: offset }, { $limit: limit });

    const logs = await collection.aggregate(pipeline).toArray();

    // Contar total usando consulta separada sin paginación
    const countPipeline = [...pipeline.slice(0, -2), { $count: "total" }]; // Quitar skip y limit
    const countResult = await collection.aggregate(countPipeline).toArray();
    const total = countResult.length > 0 ? countResult[0].total : 0;

    return {
      logs: logs.map((log, index) => ({
        ...log,
        index: offset + index + 1,
        id: log.id.toString(),
        userName: log.userName || "Usuario desconocido",
        clientId: log.clientId || "",
        sourceName: log.sourceName || "",
        processingTime:
          typeof log.processingTime === "number" ? log.processingTime : 0,
      })) as BotActionLog[],
      total,
    };
  }

  /**
   * Obtiene logs de envío a Meta
   */
  async getSendMetaLogs(
    params: LogsQueryParams
  ): Promise<{ logs: SendMetaLog[]; total: number }> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.sendMeta || ""
    );

    // Construir filtros para consulta directa
    const query: any = {};

    // Filtros de fecha (usar timestamp que está directamente en el documento)
    if (params.startDate || params.endDate) {
      const dateFilter: any = {};
      if (params.startDate) dateFilter.$gte = new Date(params.startDate);
      if (params.endDate) dateFilter.$lte = new Date(params.endDate);
      query.timestamp = dateFilter;
    }

    // Filtros específicos - buscar en messageData
    if (params.contactId) {
      query["messageData.contactId"] = params.contactId;
    }
    if (params.leadId) {
      query["messageData.elementId"] = params.leadId; // leadId se guarda en elementId
    }
    if (params.userName) {
      query["messageData.author.name"] = {
        $regex: params.userName,
        $options: "i",
      };
    }

    // Filtro por searchTerm (busca en contactId, leadId, author.name o extractedCode)
    if (params.searchTerm) {
      const searchRegex = { $regex: params.searchTerm, $options: "i" };
      query.$or = [
        { "messageData.contactId": searchRegex },
        { "messageData.elementId": searchRegex },
        { "messageData.author.name": searchRegex },
        { extractedCode: searchRegex },
      ];
    }

    // Ordenamiento
    const sortField =
      params.sortBy === "timestamp"
        ? "timestamp"
        : params.sortBy === "userName"
        ? "messageData.author.name"
        : params.sortBy === "contactId"
        ? "messageData.contactId"
        : params.sortBy === "leadId"
        ? "messageData.elementId"
        : params.sortBy === "extractedCode"
        ? "extractedCode"
        : params.sortBy === "type"
        ? "type"
        : "timestamp";
    const sortOrder = params.sortOrder === "asc" ? 1 : -1;
    const sort = { [sortField]: sortOrder, _id: 1 };

    // Paginación
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    // Ejecutar consulta principal
    const logs = await collection
      .find(query)
      .sort(sort as any)
      .skip(offset)
      .limit(limit)
      .toArray();

    // Contar total
    const total = await collection.countDocuments(query);

    return {
      logs: logs.map((log, index) => ({
        id: log._id.toString(),
        timestamp:
          log.timestamp instanceof Date
            ? log.timestamp.toISOString()
            : log.timestamp,
        type: "send_meta" as const,
        contactId: log.messageData?.contactId || "",
        leadId: log.messageData?.elementId || "",
        talkId: log.messageData?.talkId || "",
        extractedCode: log.extractedCode || "",
        conversionData: log.conversionData || [],
        conversionResults: log.conversionResults || [],
        success: log.success || false,
        messageText: log.messageData?.text || "",
        userName: log.messageData?.author?.name || "Usuario desconocido",
        clientId: "", // No disponible en sendMeta directamente
        sourceName: "", // No disponible en sendMeta directamente
        index: offset + index + 1,
      })) as SendMetaLog[],
      total,
    };
  }

  /**
   * Obtiene estadísticas de logs por tipo
   */
  async getLogsStats(params: LogsQueryParams): Promise<{
    received_messages: number;
    change_status: number;
    bot_actions: number;
    send_meta: number;
  }> {
    // Ejecutar consultas en paralelo para obtener conteos por tipo
    const [messagesCount, statusCount, actionsCount, sendMetaCount] =
      await Promise.all([
        this.getReceivedMessagesLogs({ ...params, limit: 0, offset: 0 })
          .then((r) => r.total)
          .catch(() => 0),
        this.getChangeStatusLogs({ ...params, limit: 0, offset: 0 })
          .then((r) => r.total)
          .catch(() => 0),
        this.getBotActionsLogs({ ...params, limit: 0, offset: 0 })
          .then((r) => r.total)
          .catch(() => 0),
        this.getSendMetaLogs({ ...params, limit: 0, offset: 0 })
          .then((r) => r.total)
          .catch(() => 0),
      ]);

    return {
      received_messages: messagesCount,
      change_status: statusCount,
      bot_actions: actionsCount,
      send_meta: sendMetaCount,
    };
  }

  /**
   * Obtiene logs consolidados de todos los tipos
   */
  async getConsolidatedLogs(params: LogsQueryParams): Promise<LogsResponse> {
    // Aplicar filtro de 24 horas por defecto si no se especifican fechas
    const effectiveParams =
      !params.startDate && !params.endDate
        ? {
            ...params,
            startDate: getDateHoursAgo(24),
            endDate: getCurrentDate(),
          }
        : params;

    const limit = effectiveParams.limit || 50;
    const offset = effectiveParams.offset || 0;

    let allLogs: LogEntry[] = [];
    let totalCount = 0;

    // Calcular estadísticas por tipo de log
    const stats = await this.getLogsStats(effectiveParams);

    // Si se especifica un tipo específico, consultar solo ese
    // Los métodos individuales ya manejan la paginación, así que no aplicar paginación adicional
    if (effectiveParams.logType === "received_messages") {
      const result = await this.getReceivedMessagesLogs(effectiveParams);
      // Los logs ya vienen paginados del método individual
      return {
        logs: result.logs,
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total,
        stats,
        query: effectiveParams,
      };
    } else if (effectiveParams.logType === "change_status") {
      const result = await this.getChangeStatusLogs(effectiveParams);
      // Los logs ya vienen paginados del método individual
      return {
        logs: result.logs,
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total,
        stats,
        query: effectiveParams,
      };
    } else if (effectiveParams.logType === "bot_actions") {
      const result = await this.getBotActionsLogs(effectiveParams);
      // Los logs ya vienen paginados del método individual
      return {
        logs: result.logs,
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total,
        stats,
        query: effectiveParams,
      };
    } else if (effectiveParams.logType === "send_meta") {
      const result = await this.getSendMetaLogs(effectiveParams);
      // Los logs ya vienen paginados del método individual
      return {
        logs: result.logs,
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total,
        stats,
        query: effectiveParams,
      };
    } else {
      // Consultar todos los tipos y combinar
      const [messagesResult, statusResult, actionsResult, sendMetaResult] =
        await Promise.all([
          this.getReceivedMessagesLogs({
            ...effectiveParams,
            limit: 10000,
            offset: 0,
          }), // Obtener más para combinar
          this.getChangeStatusLogs({
            ...effectiveParams,
            limit: 10000,
            offset: 0,
          }),
          this.getBotActionsLogs({
            ...effectiveParams,
            limit: 10000,
            offset: 0,
          }),
          this.getSendMetaLogs({ ...effectiveParams, limit: 10000, offset: 0 }),
        ]);

      // Combinar logs
      const combinedLogs = [
        ...messagesResult.logs,
        ...statusResult.logs,
        ...actionsResult.logs,
        ...sendMetaResult.logs,
      ];

      // Ordenar según los parámetros especificados con estabilidad (id como criterio secundario)
      allLogs = combinedLogs.sort((a, b) => {
        let aValue: any, bValue: any;

        switch (effectiveParams.sortBy) {
          case "timestamp":
            aValue = new Date(a.timestamp).getTime();
            bValue = new Date(b.timestamp).getTime();
            break;
          case "userName":
            aValue = a.userName?.toLowerCase() || "";
            bValue = b.userName?.toLowerCase() || "";
            break;
          case "contactId":
            aValue = a.contactId?.toLowerCase() || "";
            bValue = b.contactId?.toLowerCase() || "";
            break;
          case "type":
            aValue = a.type;
            bValue = b.type;
            break;
          case "leadId":
            aValue = a.leadId || "";
            bValue = b.leadId || "";
            break;
          case "extractedCode":
            aValue = (a as any).extractedCode || "";
            bValue = (b as any).extractedCode || "";
            break;
          default:
            aValue = new Date(a.timestamp).getTime();
            bValue = new Date(b.timestamp).getTime();
        }

        // Primero comparar por el campo principal
        if (aValue < bValue)
          return effectiveParams.sortOrder === "asc" ? -1 : 1;
        if (aValue > bValue)
          return effectiveParams.sortOrder === "asc" ? 1 : -1;

        // Si son iguales, usar id como criterio secundario para estabilidad
        const aId = a.id || "";
        const bId = b.id || "";
        if (aId < bId) return -1;
        if (aId > bId) return 1;

        return 0;
      });

      totalCount =
        messagesResult.total +
        statusResult.total +
        actionsResult.total +
        sendMetaResult.total;
    }

    // Aplicar paginación al resultado combinado
    const paginatedLogs = allLogs.slice(offset, offset + limit);

    // Asignar índices consecutivos a los logs paginados
    const logsWithIndex = paginatedLogs.map((log, index) => ({
      ...log,
      index: offset + index + 1,
    }));

    return {
      logs: logsWithIndex,
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount,
      stats,
      query: effectiveParams,
    };
  }

  // Servicio para verificar si un mensaje ya fue procesado por la IA en los últimos 30 minutos
  async isMessageAlreadyProcessed(
    talkId: string,
    entityId: string,
    contactId: string,
    messageText: string
  ): Promise<boolean> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.botActions || ""
    );

    // Calcular la fecha límite (30 minutos atrás)
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    // Buscar si ya existe una acción del bot para este mensaje específico en los últimos 30 minutos
    const existingBotAction = await collection.findOne({
      talkId: talkId,
      entityId: entityId,
      contactId: contactId,
      messageText: messageText,
      createdAt: { $gte: thirtyMinutesAgo.toISOString() },
    });
    return existingBotAction !== null;
  }

  // Servicio para validar si un webhook/evento debe ser procesado o es duplicado
  async validateWebhookForProcessing(
    talkId: string,
    entityId: string,
    contactId: string,
    messageText: string,
    messageType?: string,
    elementType?: string
  ): Promise<{
    shouldProcess: boolean;
    reason?: string;
    duplicateInfo?: {
      type: "message" | "event" | "status_change";
      lastProcessedAt?: string;
      existingActionId?: string;
    };
  }> {
    try {
      // 1. Validar si el mensaje ya fue procesado por IA
      const messageAlreadyProcessed = await this.isMessageAlreadyProcessed(
        talkId,
        entityId,
        contactId,
        messageText
      );

      if (messageAlreadyProcessed) {
        const botActionsCollection = await this.getCollection(
          MONGO_CONFIG.collection.botActions || ""
        );
        const existingAction = await botActionsCollection.findOne({
          talkId: talkId,
          entityId: entityId,
          contactId: contactId,
          messageText: messageText,
        });

        logger.info(
          "Mensaje ya procesado por IA en los últimos 30 minutos",
          existingAction
        );

        return {
          shouldProcess: false,
          reason: "Mensaje ya procesado por IA en los últimos 30 minutos",
          duplicateInfo: {
            type: "message",
            lastProcessedAt: existingAction?.createdAt,
            existingActionId: existingAction?._id?.toString(),
          },
        };
      }

      // 2. Validar eventos duplicados (solo para mensajes entrantes)
      if (messageType === "incoming" || elementType === "message") {
        // Verificar si hay eventos de cambio de status recientes para el mismo lead
        const recentStatusChanges = await this.getRecentStatusChanges(
          entityId,
          10
        ); // últimos 10 minutos

        if (recentStatusChanges.length > 0) {
          // Verificar si el mensaje podría ser un trigger duplicado para cambio de status
          const normalizedMessage = messageText.trim().toLowerCase();

          // Palabras clave que podrían indicar un cambio de status reciente
          const statusChangeKeywords = [
            "cambio",
            "status",
            "estado",
            "actualización",
            "modificación",
            "change",
            "update",
            "status",
            "modified",
          ];

          const mightBeStatusChange = statusChangeKeywords.some((keyword) =>
            normalizedMessage.includes(keyword)
          );

          if (mightBeStatusChange && recentStatusChanges.length >= 2) {
            return {
              shouldProcess: false,
              reason: "Posible evento duplicado de cambio de status detectado",
              duplicateInfo: {
                type: "status_change",
                lastProcessedAt: recentStatusChanges[0].createdAt,
              },
            };
          }
        }
      }

      // 3. Validar frecuencia de mensajes del mismo contacto (anti-spam)
      const recentMessages = await this.getRecentMessagesFromContact(
        contactId,
        5
      ); // últimos 5 minutos

      if (recentMessages.length >= 5) {
        // Si hay 5+ mensajes en 5 minutos, podría ser spam o duplicado
        const similarMessages = recentMessages.filter(
          (msg) =>
            msg.text.trim().toLowerCase() === messageText.trim().toLowerCase()
        );

        if (similarMessages.length >= 2) {
          return {
            shouldProcess: false,
            reason: "Múltiples mensajes idénticos detectados (posible spam)",
            duplicateInfo: {
              type: "event",
              lastProcessedAt: similarMessages[0].createdAt,
            },
          };
        }
      }

      return { shouldProcess: true };
    } catch (error) {
      // En caso de error en la validación, permitir el procesamiento para evitar bloquear mensajes legítimos
      console.warn("Error en validación de webhook duplicado:", error);
      return { shouldProcess: true };
    }
  }

  // Helper: Obtener cambios de status recientes para un lead
  private async getRecentStatusChanges(
    entityId: string,
    minutesAgo: number = 10
  ) {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.botActions || ""
    );

    const timeAgo = new Date();
    timeAgo.setMinutes(timeAgo.getMinutes() - minutesAgo);

    const statusChanges = await collection
      .find({
        entityId: entityId,
        "aiDecision.shouldChange": true,
        createdAt: { $gte: timeAgo.toISOString() },
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    return statusChanges.map((change) => ({
      createdAt: change.createdAt,
      oldStatus: change.aiDecision.currentStatus,
      newStatus: change.aiDecision.newStatus,
    }));
  }

  // Helper: Obtener mensajes recientes de un contacto
  private async getRecentMessagesFromContact(
    contactId: string,
    minutesAgo: number = 5
  ) {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.messages || ""
    );

    const timeAgo = new Date();
    timeAgo.setMinutes(timeAgo.getMinutes() - minutesAgo);

    const messages = await collection
      .find({
        contactId: contactId,
        createdAt: { $gte: timeAgo.toISOString() },
      })
      .sort({ createdAt: -1 })
      .toArray();

    return messages.map((msg) => ({
      text: msg.text,
      createdAt: msg.createdAt,
      id: msg.id,
    }));
  }

  // Servicio para verificar si ya se envió una conversión a Meta para este código y tipo de evento en los últimos 30 minutos
  async isConversionAlreadySent(
    extractedCode: string,
    eventName: string
  ): Promise<boolean> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.sendMeta || ""
    );

    // Calcular la fecha límite (30 minutos atrás)
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    // Buscar si ya existe una conversión enviada para este código y tipo de evento en los últimos 30 minutos
    const existingConversion = await collection.findOne({
      extractedCode: extractedCode,
      timestamp: { $gte: thirtyMinutesAgo },
      // Verificar si ya existe este tipo de evento en el array conversionData
      $or: [
        // Para arrays con estructura antigua (único objeto)
        { "conversionData.event_name": eventName },
        // Para arrays con estructura nueva ([0] = ConversacionCRM1, [1] = CargoCRM1)
        { "conversionData.0.data.0.event_name": eventName },
        { "conversionData.1.data.0.event_name": eventName },
      ],
    });

    return existingConversion !== null;
  }

  // ===== FUNCIONES HELPER PARA STATUS =====
  private isValidHexColor(color: string): boolean {
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexRegex.test(color);
  }


  // ===== MÉTODOS PARA STATUS =====
  async createStatus(
    data: Omit<StatusDocument, "_id" | "createdAt" | "updatedAt" | "kommo_id">
  ): Promise<StatusDocument> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.status || ""
    );

    // Verificar si ya existe un status con este statusId
    const existingStatus = await collection.findOne({
      statusId: data.statusId,
    });

    if (existingStatus) {
      throw new Error(`Ya existe un status con statusId: ${data.statusId}`);
    }

    // Validar color si está presente
    if (data.color && !this.isValidHexColor(data.color)) {
      throw new Error(
        `El color debe tener formato hex válido (ej: #FF0000 o #F00)`
      );
    }

    const statusDocument: Omit<StatusDocument, "_id"> = {
      ...data,
      kommo_id: null, // Siempre se crea como null inicialmente
      createdAt: getCurrentArgentinaISO(),
      updatedAt: getCurrentArgentinaISO(),
    };

    const result = await collection.insertOne(statusDocument);
    return {
      _id: result.insertedId.toString(),
      ...statusDocument,
    } as StatusDocument;
  }


  async getAllStatus(): Promise<StatusDocument[]> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.status || ""
    );
    const status = await collection.find({}).sort({ createdAt: -1 }).toArray();

    return status.map((status) => ({
      _id: status._id.toString(),
      statusId: status.statusId,
      name: status.name,
      description: status.description,
      kommo_id: status.kommo_id,
      color: status.color,
      createdAt: status.createdAt,
      updatedAt: status.updatedAt,
    })) as StatusDocument[];
  }


  async getStatusById(id: string): Promise<StatusDocument | null> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.status || ""
    );
    const status = await collection.findOne({ _id: new ObjectId(id) });

    if (!status) return null;

    return {
      _id: status._id.toString(),
      statusId: status.statusId,
      name: status.name,
      description: status.description,
      kommo_id: status.kommo_id,
      color: status.color,
      createdAt: status.createdAt,
      updatedAt: status.updatedAt,
    } as StatusDocument;
  }


  async getStatusByStatusId(statusId: string): Promise<StatusDocument | null> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.status || ""
    );
    const status = await collection.findOne({ statusId });

    if (!status) return null;

    return {
      _id: status._id.toString(),
      statusId: status.statusId,
      name: status.name,
      description: status.description,
      kommo_id: status.kommo_id,
      color: status.color,
      createdAt: status.createdAt,
      updatedAt: status.updatedAt,
    } as StatusDocument;
  }


  async updateStatusById(
    id: string,
    updateData: Partial<Omit<StatusDocument, "_id" | "createdAt">>
  ): Promise<StatusDocument | null> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.status || ""
    );

    // Validar color si está presente en los datos de actualización
    if (updateData.color && !this.isValidHexColor(updateData.color)) {
      throw new Error(
        `El color debe tener formato hex válido (ej: #FF0000 o #F00)`
      );
    }

    const updateDoc = {
      ...updateData,
      updatedAt: getCurrentArgentinaISO(),
    };

    try {
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateDoc },
        { returnDocument: "after" }
      );

      if (!result) return null;

      return {
        _id: result._id.toString(),
        statusId: result.statusId,
        name: result.name,
        description: result.description,
        kommo_id: result.kommo_id,
        color: result.color,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      } as StatusDocument;
    } catch (error) {
      return null;
    }
  }


  async deleteStatusById(id: string): Promise<boolean> {
    const collection = await this.getCollection("status");

    try {
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      return false;
    }
  }


  // ===== MÉTODOS PARA SETTINGS =====

  async getAllSettings(): Promise<SettingsDocument[]> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.settings || ""
    );
    const settings = await collection.find({}).toArray();

    return settings.map((setting) => ({
      _id: setting._id.toString(),
      accountCBU: setting.accountCBU,
      context: setting.context,
      message: setting.message,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
      accountName: setting.accountName,
      walink: setting.walink,
      numbers: setting.numbers,
    })) as SettingsDocument[];
  }

  async getSettingsById(id: string): Promise<SettingsDocument | null> {
    console.log(`🔍 [MongoDB] Buscando en colección 'settings' con ID: ${id}`);

    try {
      const collection = await this.getCollection("settings");
      console.log(`📁 Colección obtenida: settings`);
      console.log(
        `🔍 [MongoDB] Buscando en colección 'settings' con ID: ${id}`
      );

      const setting = await collection.findOne({ _id: new ObjectId(id) });
      console.log(`📊 Documento encontrado:`, setting ? "Sí" : "No");

      if (!setting) return null;

      return {
        _id: setting._id.toString(),
        accountCBU: setting.accountCBU,
        context: setting.context,
        message: setting.message,
        createdAt: setting.createdAt,
        updatedAt: setting.updatedAt,
        accountName: setting.accountName,
        numbers: setting.numbers,
      } as SettingsDocument;
    } catch (error) {
      console.error(`❌ Error en getSettingsById:`, error);
      throw error;
    }
  }

  async updateSettingsById(
    id: string,
    updateData: Partial<Omit<SettingsDocument, "_id">>
  ): Promise<SettingsDocument | null> {
    const collection = await this.getCollection(
      MONGO_CONFIG.collection.settings || ""
    );

    const updateDoc = {
      ...updateData,
      updatedAt: getCurrentArgentinaISO(),
    };

    try {
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateDoc },
        { returnDocument: "after" }
      );

      if (!result) return null;

      return {
        _id: result._id.toString(),
        accountName: result.accountName,
        accountCBU: result.accountCBU,
        context: result.context,
        message: result.message,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        numbers: result.numbers,
      } as SettingsDocument;
    } catch (error) {
      return null;
    }
  }
}

// Instancia singleton del servicio
export const kommoDatabaseService = KommoDatabaseService.getInstance();

export const createPaymentRequest = (
  data: Parameters<KommoDatabaseService["createPaymentRequest"]>[0]
) => kommoDatabaseService.createPaymentRequest(data);

// Funciones de conveniencia para usar los servicios
export const createUser = (
  data: Parameters<KommoDatabaseService["createUser"]>[0]
) => kommoDatabaseService.createUser(data);

export const createLead = (
  data: Parameters<KommoDatabaseService["createLead"]>[0]
) => kommoDatabaseService.createLead(data);

export const createTask = (
  data: Parameters<KommoDatabaseService["createTask"]>[0]
) => kommoDatabaseService.createTask(data);

export const updateTask = (
  data: Parameters<KommoDatabaseService["updateTask"]>[0]
) => kommoDatabaseService.updateTask(data);

export const receiveMessage = (
  data: Parameters<KommoDatabaseService["receiveMessage"]>[0]
) => kommoDatabaseService.receiveMessage(data);

export const createBotAction = (
  data: Parameters<KommoDatabaseService["createBotAction"]>[0]
) => kommoDatabaseService.createBotAction(data);

export const createTokenVisit = (
  data: Parameters<KommoDatabaseService["createTokenVisit"]>[0]
) => kommoDatabaseService.createTokenVisit(data);

export const findTokenVisit = (token: string) =>
  kommoDatabaseService.findTokenVisit(token);

export const getLastTokenVisits = (limit?: number) =>
  kommoDatabaseService.getLastTokenVisits(limit);

export const getReports = (
  campaignId?: string,
  startDate?: string,
  endDate?: string,
  eventName?: string,
  eventSourceUrl?: string
) =>
  kommoDatabaseService.getReports(
    campaignId,
    startDate,
    endDate,
    eventName,
    eventSourceUrl
  );

export const getReportsStats = (
  campaignId?: string,
  startDate?: string,
  endDate?: string,
  eventName?: string
) =>
  kommoDatabaseService.getReportsStats(
    campaignId,
    startDate,
    endDate,
    eventName
  );

export const getOrCreateDailyMeta = (dateString: string) =>
  kommoDatabaseService.getOrCreateDailyMeta(dateString);

export const isMessageAlreadyProcessed = (
  talkId: string,
  entityId: string,
  contactId: string,
  messageText: string
) =>
  kommoDatabaseService.isMessageAlreadyProcessed(
    talkId,
    entityId,
    contactId,
    messageText
  );

export const validateWebhookForProcessing = (
  talkId: string,
  entityId: string,
  contactId: string,
  messageText: string,
  messageType?: string,
  elementType?: string
) =>
  kommoDatabaseService.validateWebhookForProcessing(
    talkId,
    entityId,
    contactId,
    messageText,
    messageType,
    elementType
  );

export const isConversionAlreadySent = (
  extractedCode: string,
  eventName: string
) => kommoDatabaseService.isConversionAlreadySent(extractedCode, eventName);

// Función para enviar conversión a Meta API
export async function sendConversionToMeta(
  leadData: any,
  accessToken: string,
  pixelId?: string
) {
  try {
    // Determinar el tipo de evento (ConversacionCRM1 por defecto, o el especificado)
    const eventName = leadData.eventName;

    // Usar el pixel ID correcto
    const pixel = pixelId || META_CONFIG.pixelId;

    const conversionData = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          event_source_url:
            leadData.eventSourceUrl ||
            "https://kommo-ai-integration.vercel.app",
          user_data: {
            client_ip_address: leadData.ip ? leadData.ip : undefined,
            client_user_agent: leadData.userAgent
              ? leadData.userAgent
              : undefined,
            fbp: leadData.fbp ? leadData.fbp : undefined,
            fbc: leadData.fbc ? leadData.fbc : undefined,
          },
        },
      ],
    };

    // VERIFICAR EN BASE DE DATOS ANTES DE ENVIAR
    // Necesitamos el código para verificar duplicados
    const extractedCode = leadData.extractedCode;
    if (extractedCode) {
      console.log(
        `🔍 Verificando en DB si ya existe tracking de ${eventName} para código ${extractedCode}`
      );

      const client = await clientPromise;
      const db = client.db(MONGO_CONFIG.database || "");
      const collection = db.collection(MONGO_CONFIG.collection.sendMeta || "");

      // Buscar si ya existe una conversión enviada para este código y tipo de evento
      const existingConversion = await collection.findOne({
        extractedCode: extractedCode,
        // Verificar si ya existe este tipo de evento en el array conversionData
        $or: [
          // Para arrays con estructura antigua (único objeto)
          { "conversionData.event_name": eventName },
          // Para arrays con estructura nueva ([0] = ConversacionCRM1, [1] = CargoCRM1)
          { "conversionData.0.data.0.event_name": eventName },
          { "conversionData.1.data.0.event_name": eventName },
          // También verificar en conversionResults si existe el evento
          { "conversionResults.event_name": eventName },
        ],
      });

      if (existingConversion) {
        console.log(
          `⚠️ Conversión ${eventName} ya existe en DB para código ${extractedCode}, omitiendo envío duplicado`
        );
        return {
          success: false,
          error: "DUPLICATE_CONVERSION",
          message: `Conversión ya enviada anteriormente para código ${extractedCode}`,
        };
      }

      console.log(
        `✅ No se encontró conversión previa para ${eventName} código ${extractedCode}, procediendo con envío`
      );
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pixel}/events?access_token=${accessToken}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(conversionData),
      }
    );

    const result = await response.json();

    if (response.ok) {
      console.log("✅ Conversión enviada exitosamente a Meta:", result);
      return { success: true, data: result };
    } else {
      console.error("❌ Error al enviar conversión a Meta:", result);
      return { success: false, error: result };
    }
  } catch (error) {
    console.error("❌ Error en sendConversionToMeta:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

// Función para guardar envío a Meta en colección send_meta
export async function saveSendMetaRecord(
  conversionDataArray: any[],
  messageData: any,
  extractedCode: string,
  conversionResults: any[],
  campaignId?: string
) {
  try {
    const client = await clientPromise;
    const db = client.db(MONGO_CONFIG.database || "");
    const collection = db.collection(MONGO_CONFIG.collection.sendMeta || "");

    // Crear timestamp en UTC
    const utcTimestamp = convertToUTC(new Date());

    // Buscar si ya existe un registro para este código
    const existingRecord = await collection.findOne({
      extractedCode: extractedCode,
    });

    if (existingRecord) {
      // Si existe, hacer push/update del array existente
      // Combinar los arrays existentes con los nuevos
      const updatedConversionData = [...(existingRecord.conversionData || [])];
      const updatedConversionResults = [
        ...(existingRecord.conversionResults || []),
      ];

      // Actualizar las posiciones del array
      conversionDataArray.forEach((data, index) => {
        if (data !== null) {
          updatedConversionData[index] = data;
        }
      });

      // Actualizar los resultados de la conversión
      conversionResults.forEach((result, index) => {
        if (result !== null) {
          updatedConversionResults[index] = result;
        }
      });

      // Actualizar el registro
      const updateData = {
        conversionData: updatedConversionData,
        conversionResults: updatedConversionResults,
        timestamp: utcTimestamp,
        campaignId: campaignId || "",
        success: updatedConversionResults.some(
          (result) => result && result.success
        ),
        ...(messageData && {
          messageData: {
            id: messageData.id,
            chatId: messageData.chat_id || messageData.chatId,
            talkId: messageData.talk_id || messageData.talkId,
            contactId: messageData.contact_id || messageData.contactId,
            text: messageData.text,
            createdAt: messageData.created_at || messageData.createdAt,
            elementType: messageData.element_type || messageData.elementType,
            entityType: messageData.entity_type || messageData.entityType,
            elementId: messageData.element_id || messageData.elementId,
            entityId: messageData.entity_id || messageData.entityId,
            type: messageData.type,
            author: messageData.author,
          },
        }),
      };

      const result = await collection.updateOne(
        { extractedCode: extractedCode },
        { $set: updateData }
      );

      logger.info(`✅ Registro actualizado en send_meta: ${result}`);

      // Actualizar el lead correspondiente con meta_data actualizada
      if (messageData?.entityId || existingRecord.messageData?.entityId) {
        const entityId =
          messageData?.entityId || existingRecord.messageData?.entityId;
        const leadsCollection = db.collection(
          MONGO_CONFIG.collection.leads || ""
        );

        // Obtener el registro actualizado para guardar en meta_data
        const updatedRecord = await collection.findOne({
          extractedCode: extractedCode,
        });

        const updateResult = await leadsCollection.updateOne(
          { leadId: entityId },
          {
            $set: {
              meta_data: updatedRecord,
              updatedAt: utcTimestamp,
            },
          }
        );

        logger.info(`✅ Update result: ${updateResult}`);
      }
      return { success: true, updatedId: existingRecord._id };
    } else {
      // Si no existe, crear nuevo registro
      const record = {
        conversionData: conversionDataArray,
        campaignId: campaignId || "",
        messageData: {
          id: messageData.id,
          chatId: messageData.chat_id || messageData.chatId,
          talkId: messageData.talk_id || messageData.talkId,
          contactId: messageData.contact_id || messageData.contactId,
          text: messageData.text,
          createdAt: messageData.created_at || messageData.createdAt,
          elementType: messageData.element_type || messageData.elementType,
          entityType: messageData.entity_type || messageData.entityType,
          elementId: messageData.element_id || messageData.elementId,
          entityId: messageData.entity_id || messageData.entityId,
          type: messageData.type,
          author: messageData.author,
        },
        extractedCode: extractedCode,
        conversionResults: conversionResults,
        timestamp: utcTimestamp,
        success: conversionResults.some((result) => result && result.success),
      };

      const result = await collection.insertOne(record);

      // Actualizar el lead correspondiente agregando meta_data
      if (record.messageData.entityId) {
        const leadsCollection = db.collection(
          MONGO_CONFIG.collection.leads || ""
        );
        const updateResult = await leadsCollection.updateOne(
          { leadId: record.messageData.entityId },
          {
            $set: {
              meta_data: record,
              updatedAt: utcTimestamp,
            },
          }
        );
        logger.info(`✅ Update result: ${updateResult}`);
      }
      return { success: true, insertedId: result.insertedId };
    }
  } catch (error) {
    console.error("❌ Error al guardar en send_meta:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

// Función para buscar lead por ID
export async function findLeadById(leadId: string) {
  try {
    const client = await clientPromise;
    const db = client.db(MONGO_CONFIG.database || "");
    const collection = db.collection(MONGO_CONFIG.collection.leads || "");

    const lead = await collection.findOne({ leadId: leadId });
    return lead;
  } catch (error) {
    console.error("❌ Error al buscar lead por ID:", error);
    return null;
  }
}

export async function findContactById(contactId: string) {
  try {
    const client = await clientPromise;
    const db = client.db(MONGO_CONFIG.database || "");
    const collection = db.collection(MONGO_CONFIG.collection.users || "");

    const contact = await collection.findOne({ contactId: contactId });
    return contact;
  } catch (error) {
    console.error("❌ Error al buscar contacto por ID:", error);
    return null;
  }
}

// Función para buscar registro en send_meta por leadId (entityId)
export async function findSendMetaByLeadId(leadId: string) {
  try {
    const client = await clientPromise;
    const db = client.db(MONGO_CONFIG.database || "");
    const collection = db.collection(MONGO_CONFIG.collection.sendMeta || "");

    const record = await collection.findOne({
      "messageData.entityId": leadId,
    });

    return record;
  } catch (error) {
    console.error(
      "❌ Error al buscar registro en send_meta por leadId:",
      error
    );
    return null;
  }
}

// Función para crear lead desde datos de la API de Kommo
export async function createLeadFromKommoApi(
  kommoLeadData: any,
  kommoContactData?: any
) {
  try {
    const client = await clientPromise;
    const db = client.db(MONGO_CONFIG.database || "");
    const collection = db.collection(MONGO_CONFIG.collection.leads || "");
    const leadId = kommoLeadData.id.toString();

    // Verificar si ya existe un lead con este leadId
    const existingLead = await collection.findOne({ leadId: leadId });
    if (existingLead) {
      console.log(
        `⚠️ Lead ${leadId} ya existe localmente, omitiendo creación duplicada`
      );
      return existingLead;
    }

    // Obtener el contactId real del lead
    const realContactId =
      kommoLeadData._embedded?.contacts?.[0]?.id?.toString() ||
      kommoContactData?.id?.toString() ||
      "unknown";

    const leadDocument: LeadDocument = {
      uid: `lead_${kommoLeadData.id}_${Date.now()}`,
      source: "kommo_api",
      sourceUid: kommoLeadData.id.toString(),
      category: "api_sync",
      leadId: leadId,
      contactId: realContactId,
      pipelineId: kommoLeadData.pipeline_id?.toString() || "",
      createdAt: convertToArgentinaISO(kommoLeadData.created_at),
      client: {
        name: kommoContactData?.name || kommoLeadData.name || "Unknown",
        id: realContactId,
      },
      messageText: `Lead sincronizado desde API: ${kommoLeadData.name}`,
      sourceName: "kommo_api_sync",
      updatedAt: convertToArgentinaISO(
        kommoLeadData.updated_at || kommoLeadData.created_at
      ),
    };

    const { _id, ...leadData } = leadDocument;
    const result = await collection.insertOne(leadData);
    logger.info(`✅ Lead creado desde API de Kommo: ${result.insertedId}`);
    return leadDocument;
  } catch (error) {
    console.error("❌ Error al crear lead desde API de Kommo:", error);
    return null;
  }
}

// Función para crear contacto desde datos de la API de Kommo
export async function createContactFromKommoApi(kommoContactData: any) {
  try {
    const client = await clientPromise;
    const db = client.db(MONGO_CONFIG.database || "");
    const collection = db.collection(MONGO_CONFIG.collection.users || "");

    // Extraer teléfono del campo personalizado PHONE
    let phone = "";
    if (kommoContactData.custom_fields_values) {
      const phoneField = kommoContactData.custom_fields_values.find(
        (field: any) => field.field_code === "PHONE"
      );
      if (phoneField && phoneField.values && phoneField.values.length > 0) {
        phone = phoneField.values[0].value || "";
      }
    }

    const contactId = kommoContactData.id.toString();

    // Verificar si ya existe un contacto con este contactId
    const existingContact = await collection.findOne({ contactId: contactId });
    if (existingContact) {
      console.log(
        `⚠️ Contacto ${contactId} ya existe localmente, omitiendo creación duplicada`
      );
      return existingContact;
    }

    const userDocument: UserDocument = {
      clientId: phone,
      name: kommoContactData.name || "Unknown",
      contactId: contactId,
      phone: phone, // Agregar teléfono extraído
      source: "kommo_api",
      sourceUid: kommoContactData.id.toString(),
      sourceName: "kommo_api",
      messageText: `Contacto sincronizado desde API: ${kommoContactData.name}`,
      createdAt: convertToArgentinaISO(kommoContactData.created_at),
      updatedAt: convertToArgentinaISO(
        kommoContactData.updated_at || kommoContactData.created_at
      ),
    };

    const { _id, ...userData } = userDocument;
    const result = await collection.insertOne(userData);
    console.log("✅ Contacto creado desde API de Kommo:", result.insertedId);
    return userDocument;
  } catch (error) {
    console.error("❌ Error al crear contacto desde API de Kommo:", error);
    return null;
  }
}

export const getContactContext = (contactId: string) =>
  kommoDatabaseService.getContactContext(contactId);

// Funciones de conveniencia para settings
export const getAllSettings = () => kommoDatabaseService.getAllSettings();

export const getSettingsById = (id: string) =>
  kommoDatabaseService.getSettingsById(id);

export const updateSettingsById = (
  id: string,
  updateData: Partial<Omit<SettingsDocument, "_id">>
) => kommoDatabaseService.updateSettingsById(id, updateData);

// Funciones de conveniencia para status
export const createStatus = (
  data: Omit<StatusDocument, "_id" | "createdAt" | "updatedAt" | "kommo_id">
) => kommoDatabaseService.createStatus(data);

export const getAllStatus = () => kommoDatabaseService.getAllStatus();

export const getStatusById = (id: string) =>
  kommoDatabaseService.getStatusById(id);

export const getStatusByStatusId = (statusId: string) =>
  kommoDatabaseService.getStatusByStatusId(statusId);

export const updateStatusById = (
  id: string,
  updateData: Partial<Omit<StatusDocument, "_id" | "createdAt">>
) => kommoDatabaseService.updateStatusById(id, updateData);

export const deleteStatusById = (id: string) =>
  kommoDatabaseService.deleteStatusById(id);

// Funciones de conveniencia para logs
export const getReceivedMessagesLogs = (params: LogsQueryParams) =>
  kommoDatabaseService.getReceivedMessagesLogs(params);

export const getChangeStatusLogs = (params: LogsQueryParams) =>
  kommoDatabaseService.getChangeStatusLogs(params);

export const getBotActionsLogs = (params: LogsQueryParams) =>
  kommoDatabaseService.getBotActionsLogs(params);

export const getSendMetaLogs = (params: LogsQueryParams) =>
  kommoDatabaseService.getSendMetaLogs(params);

export const getConsolidatedLogs = (params: LogsQueryParams) =>
  kommoDatabaseService.getConsolidatedLogs(params);

export async function createRule(
  ruleData: Omit<RuleDocument, "_id" | "createdAt" | "updatedAt">
): Promise<RuleDocument> {
  const client = await clientPromise;
  const db = client.db(MONGO_CONFIG.database || "");
  const collection = db.collection<RuleDocument>(
    MONGO_CONFIG.collection.rules || ""
  );

  const now = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const ruleDocument: Omit<RuleDocument, "_id"> = {
    ...ruleData,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(ruleDocument);
  return {
    _id: result.insertedId.toString(),
    ...ruleDocument,
  };
}

/**
 * Obtener todas las reglas con filtros opcionales
 */
export async function getRules(
  params: RulesQueryParams = {}
): Promise<RulesResponse> {
  const client = await clientPromise;
  const db = client.db(MONGO_CONFIG.database || "");
  const collection = db.collection<RuleDocument>("rules");

  // Construir query de filtrado
  const query: any = {};

  if (params.startDate || params.endDate) {
    query.createdAt = {};
    if (params.startDate) query.createdAt.$gte = params.startDate;
    if (params.endDate) query.createdAt.$lte = params.endDate;
  }

  if (params.rule) query.rule = { $regex: params.rule, $options: "i" };
  if (params.text) query.text = { $regex: params.text, $options: "i" };
  if (params.crm) query.crm = params.crm;
  if (params.pipeline) query.pipeline = params.pipeline;
  if (params.status) query.status = params.status;
  if (params.priority !== undefined) query.priority = params.priority;

  // Paginación
  const limit = params.limit || 50;
  const offset = params.offset || 0;

  // Ordenamiento
  const sortBy = params.sortBy || "createdAt";
  const sortOrder = params.sortOrder === "asc" ? 1 : -1;
  const sort: any = {};
  sort[sortBy] = sortOrder;

  // Ejecutar consulta
  const total = await collection.countDocuments(query);
  const rules = await collection
    .find(query)
    .sort(sort)
    .skip(offset)
    .limit(limit)
    .toArray();

  const hasMore = offset + limit < total;

  return {
    rules,
    total,
    limit,
    offset,
    hasMore,
    query: params,
  };
}

/**
 * Obtener una regla por ID
 */
export async function getRuleById(id: string): Promise<RuleDocument | null> {
  const client = await clientPromise;
  const db = client.db(MONGO_CONFIG.database || "");
  const collection = db.collection<RuleDocument>(
    MONGO_CONFIG.collection.rules || ""
  );

  try {
    const rule = await collection.findOne({ _id: new ObjectId(id) });
    return rule;
  } catch (error) {
    return null;
  }
}

/**
 * Obtener una regla por número de regla
 */
export async function getRuleByRuleNumber(
  ruleNumber: string
): Promise<RuleDocument | null> {
  const client = await clientPromise;
  const db = client.db(MONGO_CONFIG.database || "");
  const collection = db.collection<RuleDocument>(
    MONGO_CONFIG.collection.rules || ""
  );

  return await collection.findOne({ rule: ruleNumber });
}

/**
 * Actualizar una regla por ID
 */
export async function updateRule(
  id: string,
  updateData: Partial<Omit<RuleDocument, "_id" | "createdAt">>
): Promise<RuleDocument | null> {
  const client = await clientPromise;
  const db = client.db(MONGO_CONFIG.database || "");
  const collection = db.collection<RuleDocument>(
    MONGO_CONFIG.collection.rules || ""
  );

  const updateDoc = {
    ...updateData,
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  };

  try {
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateDoc },
      { returnDocument: "after" }
    );
    return result;
  } catch (error) {
    return null;
  }
}

export async function updateRuleByRuleNumber(
  ruleNumber: string,
  updateData: Partial<Omit<RuleDocument, "_id" | "createdAt">>
): Promise<RuleDocument | null> {
  const client = await clientPromise;
  const db = client.db(MONGO_CONFIG.database || "");
  const collection = db.collection<RuleDocument>(
    MONGO_CONFIG.collection.rules || ""
  );

  const updateDoc = {
    ...updateData,
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  };

  const result = await collection.findOneAndUpdate(
    { rule: ruleNumber },
    { $set: updateDoc },
    { returnDocument: "after" }
  );

  return result;
}

/**
 * Eliminar una regla por ID
 */
export async function deleteRule(id: string): Promise<boolean> {
  const client = await clientPromise;
  const db = client.db(MONGO_CONFIG.database || "");
  const collection = db.collection<RuleDocument>(
    MONGO_CONFIG.collection.rules || ""
  );

  try {
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Eliminar una regla por número de regla
 */
export async function deleteRuleByRuleNumber(
  ruleNumber: string
): Promise<boolean> {
  const client = await clientPromise;
  const db = client.db(MONGO_CONFIG.database || "");
  const collection = db.collection<RuleDocument>(
    MONGO_CONFIG.collection.rules || ""
  );

  const result = await collection.deleteOne({ rule: ruleNumber });
  return result.deletedCount > 0;
}

/**
 * Obtener reglas por CRM
 */
export async function getRulesByCrm(
  crm: string,
  params: Partial<RulesQueryParams> = {}
): Promise<RulesResponse> {
  return getRules({
    crm,
    limit: 50,
    sortBy: "priority",
    sortOrder: "desc",
    ...params,
  });
}

/**
 * Obtener reglas por pipeline
 */
export async function getRulesByPipeline(
  pipeline: string,
  params: Partial<RulesQueryParams> = {}
): Promise<RulesResponse> {
  return getRules({
    pipeline,
    limit: 50,
    sortBy: "priority",
    sortOrder: "desc",
    ...params,
  });
}

/**
 * Normalizar reglas para uso en AI (solo priority y rule)
 */
export function normalizeRulesForAI(
  rules: RuleDocument[]
): Array<{ priority: number; rule: string }> {
  return rules.map((rule) => ({
    priority: rule.priority,
    rule: rule.rule,
  }));
}

/**
 * Obtener reglas activas
 */
export async function getActiveRules(
  params: Partial<RulesQueryParams> = {}
): Promise<RulesResponse> {
  return getRules({
    status: "active",
    limit: 50,
    sortBy: "priority",
    sortOrder: "desc",
    ...params,
  });
}

/**
 * Obtener reglas activas normalizadas para AI
 */
export async function getActiveRulesForAI(
  params: Partial<RulesQueryParams> = {}
): Promise<Array<{ priority: number; rule: string }>> {
  const response = await getActiveRules(params);
  return normalizeRulesForAI(response.rules);
}

export async function checkExistingProcessingTimestamp(
  processingTimestamp: string
): Promise<boolean> {
  try {
    const db = await clientPromise;
    const collection = db
      .db(MONGO_CONFIG.database || "")
      .collection<BotActionDocument>(MONGO_CONFIG.collection.botActions || "");

    // Convertir el timestamp a Date
    const targetTime = new Date(processingTimestamp);

    // Calcular rango: 30 minutos antes y 3 horas después
    const thirtyMinutesBefore = new Date(targetTime);
    thirtyMinutesBefore.setMinutes(thirtyMinutesBefore.getMinutes() - 30);

    console.log("thirtyMinutesBefore", thirtyMinutesBefore.toISOString());

    const threeHoursAfter = new Date(targetTime);
    threeHoursAfter.setHours(threeHoursAfter.getHours() + 3);

    console.log("threeHoursAfter", threeHoursAfter.toISOString());
    // Consultar si existe algún documento en ese rango de tiempo
    const existingAction = await collection.findOne({
      processingTimestamp: {
        $gte: thirtyMinutesBefore.toISOString(),
        $lte: threeHoursAfter.toISOString(),
      },
    });
    console.log("existingAction", existingAction);

    return existingAction !== null;
  } catch (error) {
    console.error("❌ Error verificando processingTimestamp existente:", error);
    // En caso de error, permitir el procesamiento para evitar bloquear mensajes legítimos
    return false;
  }
}

/**
 * Función para detectar si un mensaje es de bienvenida y lanzar el bot de Kommo
 */
export async function detectAndLaunchWelcomeBot(
  messageText: string,
  entityId: string,
  settings: SettingsDocument | null
): Promise<{ launched: boolean; error?: string }> {
  try {
    // Verificar si tenemos settings y mensaje de bienvenida configurado
    if (!settings || !settings.message) {
      logWelcomeBotSkipped(
        messageText,
        "No hay settings o mensaje de bienvenida configurado",
        entityId
      );
      return {
        launched: false,
        error: "No settings or welcome message configured",
      };
    }

    // Normalizar textos para comparación (quitar espacios extra, convertir a minúsculas)
    const normalizedMessage = messageText.trim().toLowerCase();
    const normalizedWelcomeMessage = settings.message.trim().toLowerCase();

    // Verificar si el mensaje coincide con el mensaje de bienvenida
    // Usamos una comparación flexible que permite variaciones menores
    const isWelcomeMessage =
      normalizedMessage.includes(normalizedWelcomeMessage) ||
      normalizedWelcomeMessage.includes(normalizedMessage) ||
      // También verificar si contiene palabras clave del mensaje de bienvenida
      normalizedWelcomeMessage
        .split(" ")
        .some((word) => word.length > 3 && normalizedMessage.includes(word));

    if (!isWelcomeMessage) {
      logWelcomeBotSkipped(
        messageText,
        "Mensaje no identificado como de bienvenida",
        entityId
      );
      return { launched: false, error: "Message is not a welcome message" };
    }

    logWelcomeBotDetection(messageText, entityId);

    // Preparar el payload para el POST request
    const payload = {
      launch: {
        bot_id: 85766,
        entity_id: parseInt(entityId),
        entity_type: 2,
      },
    };

    // Hacer el POST request a la API de Kommo
    const response = await fetch(
      "https://eduardotobiasdiaz.kommo.com/api/v2/salesbot/run",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Agregar cualquier header de autenticación necesario
          Authorization: `Bearer ${process.env.KOMMO_ACCESS_TOKEN}`, // Si es necesario
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logWelcomeBotError(entityId, `HTTP ${response.status}: ${errorText}`);
      return {
        launched: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const result = await response.json();
    logWelcomeBotLaunched(entityId, 85766);

    return { launched: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logWelcomeBotError(entityId, errorMessage);
    return {
      launched: false,
      error: errorMessage,
    };
  }
}

/**
 * Verificar si ya existe un mensaje procesado con el mismo texto, entityId y dentro del rango de tiempo
 * @param messageText El texto del mensaje a verificar
 * @param entityId El ID de la entidad
 * @param processingTimestamp El timestamp de procesamiento para calcular el rango de ±24 horas
 * @returns true si el mensaje ya fue procesado, false en caso contrario
 */
export async function checkExistingMessageText(
  messageText: string,
  entityId: string,
  processingTimestamp: string
): Promise<boolean> {
  try {
    const db = await clientPromise;
    const collection = db
      .db(MONGO_CONFIG.database)
      .collection<BotActionDocument>(MONGO_CONFIG.collection.botActions || "");

    // Normalizar el mensaje para comparación (trim y lowercase) - consistente con cómo se guarda
    const normalizedMessage = messageText.trim().toLowerCase();

    // Calcular el rango de tiempo: ±24 horas alrededor del processingTimestamp
    const processingDate = convertToArgentinaISO(processingTimestamp);
    logger.info("processingDate", processingDate);
    const startDate = new Date(
      new Date(processingDate).getTime() - 24 * 60 * 60 * 1000
    );
    logger.info("startDate", startDate);
    // 24 horas atrás
    const endDate = new Date(
      new Date(processingDate).getTime() + 24 * 60 * 60 * 1000
    ); // 24 horas adelante
    logger.info("endDate", endDate);

    // Convertir a strings ISO para la consulta (compatible con el tipo string del interface)
    const startDateISO = startDate.toISOString();
    const endDateISO = endDate.toISOString();

    // Consultar si existe algún documento con los mismos criterios
    const existingAction = await collection.findOne({
      messageText: normalizedMessage,
      entityId: entityId,
      processingTimestamp: {
        $gte: startDateISO,
        $lte: endDateISO,
      },
    });
    logger.info("existingAction", existingAction);

    logger.info("Verificando mensaje existente:", {
      originalMessage: messageText,
      normalizedMessage,
      entityId,
      processingTimestamp,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      exists: existingAction !== null,
    });

    return existingAction !== null;
  } catch (error) {
    console.error("❌ Error verificando message.text existente:", error);
    return false; // En caso de error, permitir procesamiento para no bloquear
  }
}

/**
 * Verificar si ya existe una decisión procesada con un processingTimestamp específico
 * dentro de un rango de tiempo (30 minutos antes y 3 horas después)
 */
