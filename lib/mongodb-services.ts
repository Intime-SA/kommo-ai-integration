import { MongoClient, ObjectId } from 'mongodb';
import clientPromise from './mongodb';

// Función helper para obtener fecha hace N horas
function getDateHoursAgo(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}

// Función helper para obtener fecha actual
function getCurrentDate(): string {
  return new Date().toISOString();
}

// Tipos para las colecciones MongoDB

export interface UserDocument {
  _id?: string;
  clientId: string; // client.id del payload
  name: string; // client.name
  contactId: string;
  phone?: string; // Teléfono extraído de custom_fields
  source: string;
  sourceUid: string;
  sourceName: string;
  messageText: string;
  createdAt: string; // ISO string en horario Argentina
  updatedAt: string; // ISO string en horario Argentina
}

export interface LeadDocument {
  _id?: string;
  uid: string;
  source: string;
  sourceUid: string;
  category: string;
  leadId: string;
  contactId: string;
  pipelineId: string;
  createdAt: string; // ISO string en horario Argentina
  client: {
    name: string;
    id: string;
  };
  messageText: string;
  sourceName: string;
  updatedAt: string; // ISO string en horario Argentina
}

export interface TaskDocument {
  _id?: string;
  talkId: string;
  contactId: string;
  chatId: string;
  entityId: string;
  entityType: string;
  origin: string;
  isInWork: boolean;
  isRead: boolean;
  createdAt: string; // ISO string en horario Argentina
  updatedAt: string; // ISO string en horario Argentina
}

export interface MessageDocument {
  _id?: string;
  id: string; // ID del mensaje de Kommo
  chatId: string;
  talkId: string;
  contactId: string;
  text: string;
  createdAt: string; // ISO string en horario Argentina
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
  updatedAt: string; // ISO string en horario Argentina
}

export interface BotActionDocument {
  _id?: string;
  talkId: string;
  entityId: string;
  contactId: string;
  messageText: string;
  messageCreatedAt: string; // ISO string en horario Argentina
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
  processingTimestamp: string; // ISO string en horario Argentina
  createdAt: string; // ISO string en horario Argentina
}

export interface TokenVisitDocument {
  _id?: string;
  token: string;
  lead: any; // El objeto lead que viene del payload
  createdAt: string; // ISO string en horario Argentina
}

// Interface para documentos de settings
export interface SettingsDocument {
  _id?: string;
  accountCBU: string;
  context: string;
  message: string;
  createdAt?: string;
  updatedAt?: string;
}

// Interfaz para el contexto histórico de un contacto
export interface ContactContext {
  contactId: string;
  userInfo?: {
    name: string;
    clientId: string;
    source: string;
    sourceName: string;
    firstMessage: string;
    firstMessageDate: string;
  };
  activeLeads: Array<{
    leadId: string;
    status?: string;
    createdAt: string;
    lastActivity?: string;
  }>;
  recentMessages: Array<{
    text: string;
    type: "incoming" | "outgoing";
    createdAt: string;
    authorName: string;
  }>;
  activeTasks: Array<{
    talkId: string;
    isInWork: boolean;
    isRead: boolean;
    createdAt: string;
    lastActivity?: string;
  }>;
  botActions: Array<{
    messageText: string;
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
    processingTimestamp: string;
  }>;
  summary: {
    totalMessages: number;
    lastActivity: string;
    currentStatus?: string;
    conversationDuration: string;
  };
}

// Utilidad para convertir fechas al formato ISO string en horario Argentina
export function convertToArgentinaISO(ts: string | number): string {
  // Convertir a número si viene como string
  const timestamp = typeof ts === 'string' ? Number(ts) : ts;

  // Timestamp en segundos (como viene de la API de Kommo)
  const dUTC = new Date(timestamp * 1000);

  // Obtener la diferencia horaria con Argentina (en minutos)
  const argentinaOffset = dUTC.toLocaleString('en', { timeZone: 'America/Argentina/Buenos_Aires' });
  const utcOffset = dUTC.toLocaleString('en', { timeZone: 'UTC' });

  // Crear fecha ajustada restando el offset de Argentina
  const dAR = new Date(dUTC.getTime() - (3 * 60 * 60 * 1000)); // Restar 3 horas

  return dAR.toISOString();
}

// Función helper para obtener la fecha actual en Argentina ISO
export function getCurrentArgentinaISO(): string {
  const now = new Date();

  // Crear fecha ajustada restando 3 horas (Argentina offset)
  const dAR = new Date(now.getTime() - (3 * 60 * 60 * 1000));

  return dAR.toISOString();
}

// Función helper para convertir una fecha ISO a zona horaria de Argentina
export function convertToArgentinaTime(dateString: string): Date {
  const date = new Date(dateString);
  // Si la fecha ya está en zona Argentina (como los datos almacenados),
  // devolverla tal cual. Si viene del frontend, asumir que está en UTC y convertir.
  // Para consultas, asumir que las fechas del frontend están en zona local/UTC
  // y convertirlas a zona Argentina para comparar con los datos almacenados.

  // Los datos se almacenan como: new Date().toISOString() pero restando 3 horas
  // Para consultas, si el usuario envía "2025-09-12T15:18:00.000Z",
  // necesitamos convertirlo a zona Argentina: restar 3 horas
  return new Date(date.getTime() - (3 * 60 * 60 * 1000));
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
    const db = client.db('kommo');
    return db.collection(collectionName);
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
    const collection = await this.getCollection('users');

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
    const collection = await this.getCollection('leads');

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

      await collection.updateOne(
        { uid: data.uid },
        { $set: updateData }
      );

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
    const collection = await this.getCollection('tasks');

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
      isInWork: data.isInWork === '1',
      isRead: data.isRead === '1',
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
    const collection = await this.getCollection('tasks');

    const updateData: Partial<TaskDocument> = {
      contactId: data.contactId,
      chatId: data.chatId,
      entityId: data.entityId,
      entityType: data.entityType,
      origin: data.origin,
      isInWork: data.isInWork === '1',
      isRead: data.isRead === '1',
      updatedAt: convertToArgentinaISO(data.updatedAt),
    };

    const result = await collection.findOneAndUpdate(
      { talkId: data.talkId },
      { $set: updateData },
      { returnDocument: 'after' }
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
  }): Promise<MessageDocument> {
    const collection = await this.getCollection('messages');

    // Verificar si ya existe un mensaje con este id
    const existingMessage = await collection.findOne({ id: data.id });

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
        updatedAt: getCurrentArgentinaISO(),
      };

      await collection.updateOne(
        { id: data.id },
        { $set: updateData }
      );

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
    const collection = await this.getCollection('bot_actions');

    // Crear nuevo registro de acción del bot
    const botActionDocument: BotActionDocument = {
      talkId: data.talkId,
      entityId: data.entityId,
      contactId: data.contactId,
      messageText: data.messageText,
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
    token: string;
    lead: any;
  }): Promise<TokenVisitDocument> {
    const collection = await this.getCollection('token_visit');

    // Crear nuevo registro de token visit
    const tokenVisitDocument: TokenVisitDocument = {
      token: data.token,
      lead: data.lead,
      createdAt: getCurrentArgentinaISO(),
    };

    const { _id, ...tokenVisitData } = tokenVisitDocument;
    const result = await collection.insertOne(tokenVisitData);
    return { ...tokenVisitDocument, _id: result.insertedId.toString() };
  }

  // Servicio para buscar token por valor
  async findTokenVisit(token: string): Promise<TokenVisitDocument | null> {
    const collection = await this.getCollection('token_visit');
    const result = await collection.findOne({ token });
    return result ? { ...result, _id: result._id.toString() } as TokenVisitDocument : null;
  }

  // Servicio para obtener contexto histórico de un contacto (últimas 24 horas)
  async getContactContext(contactId: string): Promise<ContactContext> {
    const client = await this.getClient();
    const db = client.db('kommo');

    // Calcular fecha límite (24 horas atrás)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Consultas paralelas para optimizar rendimiento
    const [
      userResult,
      leadsResult,
      messagesResult,
      tasksResult,
      botActionsResult
    ] = await Promise.all([
      // Información del usuario
      db.collection('users').findOne({ contactId }),

      // Leads activos (últimas 24 horas)
      db.collection('leads')
        .find({
          contactId,
          createdAt: { $gte: twentyFourHoursAgo.toISOString() }
        })
        .sort({ createdAt: -1 })
        .toArray(),

      // Mensajes recientes
      db.collection('messages')
        .find({
          contactId,
          createdAt: { $gte: twentyFourHoursAgo.toISOString() }
        })
        .sort({ createdAt: 1 })
        .toArray(),

      // Tareas activas
      db.collection('tasks')
        .find({
          contactId,
          createdAt: { $gte: twentyFourHoursAgo.toISOString() }
        })
        .sort({ updatedAt: -1 })
        .toArray(),

      // Acciones del bot recientes
      db.collection('bot_actions')
        .find({
          contactId,
          createdAt: { $gte: twentyFourHoursAgo.toISOString() }
        })
        .sort({ createdAt: -1 })
        .toArray()
    ]);

    // Procesar y normalizar la información del usuario
    const userInfo = userResult ? {
      name: userResult.name,
      clientId: userResult.clientId,
      source: userResult.source,
      sourceName: userResult.sourceName,
      firstMessage: userResult.messageText,
      firstMessageDate: userResult.createdAt
    } : undefined;

    // Procesar leads activos
    const activeLeads = leadsResult.map(lead => ({
      leadId: lead.leadId,
      createdAt: lead.createdAt,
      lastActivity: lead.updatedAt
    }));

    // Procesar mensajes recientes
    const recentMessages = messagesResult.map(msg => ({
      text: msg.text,
      type: msg.type,
      createdAt: msg.createdAt,
      authorName: msg.author?.name || 'Desconocido'
    }));

    // Procesar tareas activas
    const activeTasks = tasksResult.map(task => ({
      talkId: task.talkId,
      isInWork: task.isInWork,
      isRead: task.isRead,
      createdAt: task.createdAt,
      lastActivity: task.updatedAt
    }));

    // Procesar acciones del bot
    const botActions = botActionsResult.map(action => ({
      messageText: action.messageText,
      aiDecision: action.aiDecision,
      statusUpdateResult: action.statusUpdateResult,
      processingTimestamp: action.processingTimestamp
    }));

    // Calcular resumen
    const totalMessages = recentMessages.length;
    const lastActivity = recentMessages.length > 0
      ? recentMessages[recentMessages.length - 1].createdAt
      : (userInfo?.firstMessageDate || new Date().toISOString());

    // Determinar status actual basado en la última acción del bot
    const currentStatus = botActions.length > 0
      ? botActions[0].aiDecision.newStatus
      : undefined;

    // Calcular duración de la conversación
    const firstActivity = userInfo?.firstMessageDate || lastActivity;
    const conversationDuration = this.calculateDuration(firstActivity, lastActivity);

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
        conversationDuration
      }
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

  /**
   * Obtiene logs de mensajes recibidos con filtros y paginación
   */
  async getReceivedMessagesLogs(params: LogsQueryParams): Promise<{ logs: ReceivedMessageLog[], total: number }> {
    const collection = await this.getCollection('messages');

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
    if (params.userName) andConditions.push({ 'author.name': { $regex: params.userName, $options: 'i' } });

    // Filtro por searchTerm (busca en contactId, leadId o authorName)
    if (params.searchTerm) {
      const searchRegex = { $regex: params.searchTerm, $options: 'i' };
      andConditions.push({
        $or: [
          { contactId: searchRegex },
          { entityId: searchRegex },
          { 'author.name': searchRegex },
          { 'text': searchRegex } // También buscar en el texto del mensaje
        ]
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
        from: 'users',
        localField: 'contactId',
        foreignField: 'contactId',
        as: 'userInfo'
      }
    });

    // Lookup para obtener información del lead
    pipeline.push({
      $lookup: {
        from: 'leads',
        localField: 'entityId',
        foreignField: 'leadId',
        as: 'leadInfo'
      }
    });

    // Proyección de los campos necesarios
    pipeline.push({
      $project: {
        id: '$id',
        timestamp: '$createdAt',
        type: { $literal: 'received_messages' },
        contactId: '$contactId',
        leadId: '$entityId',
        talkId: '$talkId',
        messageText: '$text',
        messageType: '$type',
        authorName: '$author.name',
        messageId: '$id',
        chatId: '$chatId',
        userName: { $ifNull: [{ $arrayElemAt: ['$userInfo.name', 0] }, '$author.name'] },
        clientId: { $ifNull: [{ $arrayElemAt: ['$userInfo.clientId', 0] }, ''] },
        sourceName: { $ifNull: [{ $arrayElemAt: ['$userInfo.sourceName', 0] }, ''] }
      }
    });

    // Ordenamiento con estabilidad (primero por campo principal, luego por id para consistencia)
    const sortField = params.sortBy === 'timestamp' ? 'timestamp' :
                     params.sortBy === 'userName' ? 'userName' :
                     params.sortBy === 'contactId' ? 'contactId' :
                     params.sortBy === 'leadId' ? 'leadId' :
                     params.sortBy === 'type' ? 'type' : 'timestamp';
    const sortOrder = params.sortOrder === 'asc' ? 1 : -1;
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
        userName: log.userName || 'Usuario desconocido',
        clientId: log.clientId || '',
        sourceName: log.sourceName || ''
      })) as ReceivedMessageLog[],
      total
    };
  }

  /**
   * Obtiene logs de cambios de status
   */
  async getChangeStatusLogs(params: LogsQueryParams): Promise<{ logs: ChangeStatusLog[], total: number }> {
    const collection = await this.getCollection('bot_actions');

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
    if (params.status) andConditions.push({ 'aiDecision.newStatus': params.status });
    if (params.changedBy === 'bot') andConditions.push({ 'aiDecision.shouldChange': true });

    // Filtro por searchTerm (busca en contactId, leadId o userName)
    if (params.searchTerm) {
      const searchRegex = { $regex: params.searchTerm, $options: 'i' };
      andConditions.push({
        $or: [
          { contactId: searchRegex },
          { entityId: searchRegex },
          { messageText: searchRegex }
        ]
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
        from: 'users',
        localField: 'contactId',
        foreignField: 'contactId',
        as: 'userInfo'
      }
    });

    // Proyección
    pipeline.push({
      $project: {
        id: '$_id',
        timestamp: '$createdAt',
        type: { $literal: 'change_status' },
        contactId: '$contactId',
        leadId: '$entityId',
        talkId: '$talkId',
        oldStatus: '$aiDecision.currentStatus',
        newStatus: '$aiDecision.newStatus',
        changedBy: { $literal: 'bot' },
        reason: '$aiDecision.reasoning',
        confidence: '$aiDecision.confidence',
        success: '$statusUpdateResult.success',
        userName: { $ifNull: [{ $arrayElemAt: ['$userInfo.name', 0] }, 'Usuario desconocido'] },
        clientId: { $ifNull: [{ $arrayElemAt: ['$userInfo.clientId', 0] }, ''] },
        sourceName: { $ifNull: [{ $arrayElemAt: ['$userInfo.sourceName', 0] }, ''] }
      }
    });

    // Ordenamiento con estabilidad (primero por campo principal, luego por id para consistencia)
    const sortField = params.sortBy === 'timestamp' ? 'timestamp' :
                     params.sortBy === 'userName' ? 'userName' :
                     params.sortBy === 'contactId' ? 'contactId' :
                     params.sortBy === 'leadId' ? 'leadId' :
                     params.sortBy === 'type' ? 'type' : 'timestamp';
    const sortOrder = params.sortOrder === 'asc' ? 1 : -1;
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
        userName: log.userName || 'Usuario desconocido',
        clientId: log.clientId || '',
        sourceName: log.sourceName || ''
      })) as ChangeStatusLog[],
      total
    };
  }

  /**
   * Obtiene logs de acciones del bot
   */
  async getBotActionsLogs(params: LogsQueryParams): Promise<{ logs: BotActionLog[], total: number }> {
    const collection = await this.getCollection('bot_actions');

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
    if (params.status) andConditions.push({ 'aiDecision.newStatus': params.status });

    // Filtro por searchTerm (busca en contactId, leadId o userName)
    if (params.searchTerm) {
      const searchRegex = { $regex: params.searchTerm, $options: 'i' };
      andConditions.push({
        $or: [
          { contactId: searchRegex },
          { entityId: searchRegex },
          { messageText: searchRegex }
        ]
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
        from: 'users',
        localField: 'contactId',
        foreignField: 'contactId',
        as: 'userInfo'
      }
    });

    // Calcular tiempo de procesamiento
    pipeline.push({
      $addFields: {
        processingTime: {
          $subtract: [
            { $dateFromString: { dateString: '$createdAt' } },
            { $dateFromString: { dateString: '$messageCreatedAt' } }
          ]
        }
      }
    });

    // Proyección
    pipeline.push({
      $project: {
        id: '$_id',
        timestamp: '$createdAt',
        type: { $literal: 'bot_actions' },
        contactId: '$contactId',
        leadId: '$entityId',
        talkId: '$talkId',
        messageText: '$messageText',
        aiDecision: '$aiDecision',
        statusUpdateResult: '$statusUpdateResult',
        processingTime: '$processingTime',
        userName: { $ifNull: [{ $arrayElemAt: ['$userInfo.name', 0] }, 'Usuario desconocido'] },
        clientId: { $ifNull: [{ $arrayElemAt: ['$userInfo.clientId', 0] }, ''] },
        sourceName: { $ifNull: [{ $arrayElemAt: ['$userInfo.sourceName', 0] }, ''] }
      }
    });

    // Ordenamiento con estabilidad (primero por campo principal, luego por id para consistencia)
    const sortField = params.sortBy === 'timestamp' ? 'timestamp' :
                     params.sortBy === 'userName' ? 'userName' :
                     params.sortBy === 'contactId' ? 'contactId' :
                     params.sortBy === 'leadId' ? 'leadId' :
                     params.sortBy === 'type' ? 'type' : 'timestamp';
    const sortOrder = params.sortOrder === 'asc' ? 1 : -1;
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
        userName: log.userName || 'Usuario desconocido',
        clientId: log.clientId || '',
        sourceName: log.sourceName || '',
        processingTime: typeof log.processingTime === 'number' ? log.processingTime : 0
      })) as BotActionLog[],
      total
    };
  }

  /**
   * Obtiene logs de envío a Meta
   */
  async getSendMetaLogs(params: LogsQueryParams): Promise<{ logs: SendMetaLog[], total: number }> {
    const collection = await this.getCollection('leads');

    // Construir pipeline de agregación para send_meta
    const pipeline: any[] = [];

    // Filtros de fecha (usar updatedAt que es cuando se actualizó el envío)
    if (params.startDate || params.endDate) {
      const dateFilter: any = {};
      if (params.startDate) dateFilter.$gte = new Date(params.startDate);
      if (params.endDate) dateFilter.$lte = new Date(params.endDate);
      pipeline.push({ $match: { updatedAt: dateFilter } });
    }

    // Filtros adicionales
    const matchFilter: any = {};
    const andConditions: any[] = [];

    // Filtros específicos
    if (params.contactId) andConditions.push({ contactId: params.contactId });
    if (params.leadId) andConditions.push({ leadId: params.leadId });
    if (params.userName) andConditions.push({ 'client.name': { $regex: params.userName, $options: 'i' } });

    // Filtro por searchTerm (busca en contactId, leadId, client.name o extractedCode)
    if (params.searchTerm) {
      const searchRegex = { $regex: params.searchTerm, $options: 'i' };
      andConditions.push({
        $or: [
          { contactId: searchRegex },
          { leadId: searchRegex },
          { 'client.name': searchRegex },
          { 'meta_data.extractedCode': searchRegex }
        ]
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
        from: 'users',
        localField: 'contactId',
        foreignField: 'contactId',
        as: 'userInfo'
      }
    });

    // Lookup para obtener información del lead
    pipeline.push({
      $lookup: {
        from: 'leads',
        localField: 'leadId',
        foreignField: 'leadId',
        as: 'leadInfo'
      }
    });

    // Proyección de los campos necesarios
    pipeline.push({
      $project: {
        id: '$_id',
        timestamp: { $ifNull: ['$updatedAt', '$createdAt'] },
        type: { $literal: 'send_meta' },
        contactId: '$contactId',
        leadId: '$leadId',
        talkId: '$talkId',
        extractedCode: '$meta_data.extractedCode',
        conversionData: '$meta_data.conversionData',
        conversionResults: '$meta_data.conversionResults',
        success: '$meta_data.success',
        messageText: '$messageText',
        userName: { $ifNull: [{ $arrayElemAt: ['$userInfo.name', 0] }, '$client.name'] },
        clientId: { $ifNull: [{ $arrayElemAt: ['$userInfo.clientId', 0] }, '$client.id'] },
        sourceName: { $ifNull: [{ $arrayElemAt: ['$userInfo.sourceName', 0] }, '$sourceName'] }
      }
    });

    // Ordenamiento con estabilidad (primero por campo principal, luego por id para consistencia)
    const sortField = params.sortBy === 'timestamp' ? 'timestamp' :
                     params.sortBy === 'userName' ? 'userName' :
                     params.sortBy === 'contactId' ? 'contactId' :
                     params.sortBy === 'leadId' ? 'leadId' :
                     params.sortBy === 'extractedCode' ? 'extractedCode' :
                     params.sortBy === 'type' ? 'type' : 'timestamp';
    const sortOrder = params.sortOrder === 'asc' ? 1 : -1;
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
        timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp,
        userName: log.userName || 'Usuario desconocido',
        clientId: log.clientId || '',
        sourceName: log.sourceName || '',
        talkId: log.talkId || '',
        extractedCode: log.extractedCode || '',
        conversionData: log.conversionData || [],
        conversionResults: log.conversionResults || [],
        success: log.success || false
      })) as SendMetaLog[],
      total
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
    const [messagesCount, statusCount, actionsCount, sendMetaCount] = await Promise.all([
      this.getReceivedMessagesLogs({ ...params, limit: 0, offset: 0 }).then(r => r.total).catch(() => 0),
      this.getChangeStatusLogs({ ...params, limit: 0, offset: 0 }).then(r => r.total).catch(() => 0),
      this.getBotActionsLogs({ ...params, limit: 0, offset: 0 }).then(r => r.total).catch(() => 0),
      this.getSendMetaLogs({ ...params, limit: 0, offset: 0 }).then(r => r.total).catch(() => 0)
    ]);

    return {
      received_messages: messagesCount,
      change_status: statusCount,
      bot_actions: actionsCount,
      send_meta: sendMetaCount
    };
  }

  /**
   * Obtiene logs consolidados de todos los tipos
   */
  async getConsolidatedLogs(params: LogsQueryParams): Promise<LogsResponse> {
    // Aplicar filtro de 24 horas por defecto si no se especifican fechas
    const effectiveParams = !params.startDate && !params.endDate ? {
      ...params,
      startDate: getDateHoursAgo(24),
      endDate: getCurrentDate()
    } : params;

    const limit = effectiveParams.limit || 50;
    const offset = effectiveParams.offset || 0;

    let allLogs: LogEntry[] = [];
    let totalCount = 0;

    // Calcular estadísticas por tipo de log
    const stats = await this.getLogsStats(effectiveParams);

    // Si se especifica un tipo específico, consultar solo ese
    // Los métodos individuales ya manejan la paginación, así que no aplicar paginación adicional
    if (effectiveParams.logType === 'received_messages') {
      const result = await this.getReceivedMessagesLogs(effectiveParams);
      // Los logs ya vienen paginados del método individual
      return {
        logs: result.logs,
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total,
        stats,
        query: effectiveParams
      };
    } else if (effectiveParams.logType === 'change_status') {
      const result = await this.getChangeStatusLogs(effectiveParams);
      // Los logs ya vienen paginados del método individual
      return {
        logs: result.logs,
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total,
        stats,
        query: effectiveParams
      };
    } else if (effectiveParams.logType === 'bot_actions') {
      const result = await this.getBotActionsLogs(effectiveParams);
      // Los logs ya vienen paginados del método individual
      return {
        logs: result.logs,
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total,
        stats,
        query: effectiveParams
      };
    } else if (effectiveParams.logType === 'send_meta') {
      const result = await this.getSendMetaLogs(effectiveParams);
      // Los logs ya vienen paginados del método individual
      return {
        logs: result.logs,
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total,
        stats,
        query: effectiveParams
      };
    } else {
      // Consultar todos los tipos y combinar
      const [messagesResult, statusResult, actionsResult, sendMetaResult] = await Promise.all([
        this.getReceivedMessagesLogs({ ...effectiveParams, limit: 10000, offset: 0 }), // Obtener más para combinar
        this.getChangeStatusLogs({ ...effectiveParams, limit: 10000, offset: 0 }),
        this.getBotActionsLogs({ ...effectiveParams, limit: 10000, offset: 0 }),
        this.getSendMetaLogs({ ...effectiveParams, limit: 10000, offset: 0 })
      ]);

      // Combinar logs
      const combinedLogs = [
        ...messagesResult.logs,
        ...statusResult.logs,
        ...actionsResult.logs,
        ...sendMetaResult.logs
      ];

      // Ordenar según los parámetros especificados con estabilidad (id como criterio secundario)
      allLogs = combinedLogs.sort((a, b) => {
        let aValue: any, bValue: any;

        switch (effectiveParams.sortBy) {
          case 'timestamp':
            aValue = new Date(a.timestamp).getTime();
            bValue = new Date(b.timestamp).getTime();
            break;
          case 'userName':
            aValue = a.userName?.toLowerCase() || '';
            bValue = b.userName?.toLowerCase() || '';
            break;
          case 'contactId':
            aValue = a.contactId?.toLowerCase() || '';
            bValue = b.contactId?.toLowerCase() || '';
            break;
          case 'type':
            aValue = a.type;
            bValue = b.type;
            break;
          case 'leadId':
            aValue = a.leadId || '';
            bValue = b.leadId || '';
            break;
          case 'extractedCode':
            aValue = (a as any).extractedCode || '';
            bValue = (b as any).extractedCode || '';
            break;
          default:
            aValue = new Date(a.timestamp).getTime();
            bValue = new Date(b.timestamp).getTime();
        }

        // Primero comparar por el campo principal
        if (aValue < bValue) return effectiveParams.sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return effectiveParams.sortOrder === 'asc' ? 1 : -1;

        // Si son iguales, usar id como criterio secundario para estabilidad
        const aId = a.id || '';
        const bId = b.id || '';
        if (aId < bId) return -1;
        if (aId > bId) return 1;

        return 0;
      });

      totalCount = messagesResult.total + statusResult.total + actionsResult.total + sendMetaResult.total;
    }

    // Aplicar paginación al resultado combinado
    const paginatedLogs = allLogs.slice(offset, offset + limit);

    // Asignar índices consecutivos a los logs paginados
    const logsWithIndex = paginatedLogs.map((log, index) => ({
      ...log,
      index: offset + index + 1
    }));

    return {
      logs: logsWithIndex,
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount,
      stats,
      query: effectiveParams
    };
  }

  // Servicio para verificar si un mensaje ya fue procesado por la IA en los últimos 30 minutos
  async isMessageAlreadyProcessed(talkId: string, entityId: string, contactId: string, messageText: string): Promise<boolean> {
    const collection = await this.getCollection('bot_actions');

    // Calcular la fecha límite (30 minutos atrás)
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    // Buscar si ya existe una acción del bot para este mensaje específico en los últimos 30 minutos
    const existingBotAction = await collection.findOne({
      talkId: talkId,
      entityId: entityId,
      contactId: contactId,
      messageText: messageText,
      createdAt: { $gte: thirtyMinutesAgo.toISOString() }
    });

    return existingBotAction !== null;
  }

  // Servicio para verificar si ya se envió una conversión a Meta para este código y tipo de evento en los últimos 30 minutos
  async isConversionAlreadySent(extractedCode: string, eventName: string): Promise<boolean> {
    const collection = await this.getCollection('send_meta');

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
        { "conversionData.1.data.0.event_name": eventName }
      ]
    });

    return existingConversion !== null;
  }

  // ===== MÉTODOS PARA SETTINGS =====

  /**
   * Obtener todos los documentos de settings
   */
  async getAllSettings(): Promise<SettingsDocument[]> {
    const collection = await this.getCollection('settings');
    const settings = await collection.find({}).toArray();

    return settings.map(setting => ({
      _id: setting._id.toString(),
      accountCBU: setting.accountCBU,
      context: setting.context,
      message: setting.message,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt
    })) as SettingsDocument[];
  }

  /**
   * Obtener un documento de settings por ID
   */
  async getSettingsById(id: string): Promise<SettingsDocument | null> {
    const collection = await this.getCollection('settings');
    const setting = await collection.findOne({ _id: new ObjectId(id) });

    if (!setting) return null;

    return {
      _id: setting._id.toString(),
      accountCBU: setting.accountCBU,
      context: setting.context,
      message: setting.message,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt
    } as SettingsDocument;
  }

  /**
   * Actualizar un documento de settings por ID
   */
  async updateSettingsById(id: string, updateData: Partial<Omit<SettingsDocument, '_id'>>): Promise<SettingsDocument | null> {
    const collection = await this.getCollection('settings');

    const updateDoc = {
      ...updateData,
      updatedAt: getCurrentArgentinaISO(),
    };

    try {
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateDoc },
        { returnDocument: 'after' }
      );

      if (!result) return null;

      return {
        _id: result._id.toString(),
        accountCBU: result.accountCBU,
        context: result.context,
        message: result.message,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt
      } as SettingsDocument;
    } catch (error) {
      return null;
    }
  }
}

// Instancia singleton del servicio
export const kommoDatabaseService = KommoDatabaseService.getInstance();

// Funciones de conveniencia para usar los servicios
export const createUser = (data: Parameters<KommoDatabaseService['createUser']>[0]) =>
  kommoDatabaseService.createUser(data);

export const createLead = (data: Parameters<KommoDatabaseService['createLead']>[0]) =>
  kommoDatabaseService.createLead(data);

export const createTask = (data: Parameters<KommoDatabaseService['createTask']>[0]) =>
  kommoDatabaseService.createTask(data);

export const updateTask = (data: Parameters<KommoDatabaseService['updateTask']>[0]) =>
  kommoDatabaseService.updateTask(data);

export const receiveMessage = (data: Parameters<KommoDatabaseService['receiveMessage']>[0]) =>
  kommoDatabaseService.receiveMessage(data);

export const createBotAction = (data: Parameters<KommoDatabaseService['createBotAction']>[0]) =>
  kommoDatabaseService.createBotAction(data);

export const createTokenVisit = (data: Parameters<KommoDatabaseService['createTokenVisit']>[0]) =>
  kommoDatabaseService.createTokenVisit(data);

export const findTokenVisit = (token: string) =>
  kommoDatabaseService.findTokenVisit(token);

export const isMessageAlreadyProcessed = (talkId: string, entityId: string, contactId: string, messageText: string) =>
  kommoDatabaseService.isMessageAlreadyProcessed(talkId, entityId, contactId, messageText);

export const isConversionAlreadySent = (extractedCode: string, eventName: string) =>
  kommoDatabaseService.isConversionAlreadySent(extractedCode, eventName);

// Función helper para convertir fecha a UTC (restando 3 horas para Argentina)
function convertToUTC(date: Date): Date {
  return new Date(date.getTime() - (3 * 60 * 60 * 1000));
}

// Función utilitaria para extraer código de un mensaje
export function extractCodeFromMessage(messageText: string): string | null {
  console.log("Extrayendo código de mensaje:", messageText);
  // Patrón para buscar códigos generados por nanoid (incluyen guiones y caracteres especiales)
  // Busca patrones como "Descuento: Nv5M-ilY." o "Código: AbCdEfGh-"
  const codePattern = /(?:descuento|codigo|código|token)\s*:\s*([A-Za-z0-9_-]{1,21})\.?/i;
  const match = messageText.match(codePattern);
  console.log("Match del patrón principal:", match);
  if (match && match[1]) {
    return match[1];
  }

  // También buscar códigos sueltos generados por nanoid
  // nanoid por defecto genera 21 caracteres, pero podemos buscar patrones más cortos también
  const looseCodePatterns = [
    /\b([A-Za-z0-9_-]{8,21})\b/,  // Códigos de 8-21 caracteres con guiones
    /\b([A-Za-z0-9_-]{1,21})\b/,  // Códigos de 1-21 caracteres con guiones
  ];

  for (const pattern of looseCodePatterns) {
    const looseMatch = messageText.match(pattern);
    console.log("Match del patrón suelto:", looseMatch);
    if (looseMatch && looseMatch[1]) {
      return looseMatch[1];
    }
  }

  return null;
}

// Función de prueba para verificar la detección de códigos


// Función para enviar conversión a Meta API
export async function sendConversionToMeta(leadData: any, accessToken: string, pixelId?: string) {
  try {
    // Determinar el tipo de evento (ConversacionCRM1 por defecto, o el especificado)
    const eventName = leadData.eventName || "ConversacionCRM1";

    // Usar el pixel ID correcto
    const pixel = pixelId || process.env.NEXT_PUBLIC_META_PIXEL_ID;

    const conversionData = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          event_source_url: leadData.eventSourceUrl || "https://c81af03c6bcf.ngrok-free.app",
          user_data: {
            client_ip_address: leadData.ip ? leadData.ip : undefined,
            client_user_agent: leadData.userAgent ? leadData.userAgent : undefined,
            fbp: leadData.fbp ? leadData.fbp : undefined,
            fbc: leadData.fbc ? leadData.fbc : undefined,
          }
        }
      ]
    };

    console.log(`Conversion data para ${eventName}:`, conversionData);
    console.log("Conversion data.user_data:", conversionData.data[0].user_data);

    // VERIFICAR EN BASE DE DATOS ANTES DE ENVIAR
    // Necesitamos el código para verificar duplicados
    const extractedCode = leadData.extractedCode;
    if (extractedCode) {
      console.log(`🔍 Verificando en DB si ya existe tracking de ${eventName} para código ${extractedCode}`);

      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DATABASE || "kommo");
      const collection = db.collection("send_meta");

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
          { "conversionResults.event_name": eventName }
        ]
      });

      if (existingConversion) {
        console.log(`⚠️ Conversión ${eventName} ya existe en DB para código ${extractedCode}, omitiendo envío duplicado`);
        return {
          success: false,
          error: "DUPLICATE_CONVERSION",
          message: `Conversión ya enviada anteriormente para código ${extractedCode}`
        };
      }

      console.log(`✅ No se encontró conversión previa para ${eventName} código ${extractedCode}, procediendo con envío`);
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pixel}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
    return { success: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

// Función para guardar envío a Meta en colección send_meta
export async function saveSendMetaRecord(
  conversionDataArray: any[],
  messageData: any,
  extractedCode: string,
  conversionResults: any[]
) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DATABASE || "kommo");
    const collection = db.collection("send_meta");

    // Crear timestamp en UTC
    const utcTimestamp = convertToUTC(new Date());

    // Buscar si ya existe un registro para este código
    const existingRecord = await collection.findOne({ extractedCode: extractedCode });

    if (existingRecord) {
      // Si existe, hacer push/update del array existente
      console.log(`🔄 Actualizando registro existente para código: ${extractedCode}`);

      // Combinar los arrays existentes con los nuevos
      const updatedConversionData = [...(existingRecord.conversionData || [])];
      const updatedConversionResults = [...(existingRecord.conversionResults || [])];

      // Actualizar las posiciones del array
      conversionDataArray.forEach((data, index) => {
        if (data !== null) {
          updatedConversionData[index] = data;
        }
      });

      conversionResults.forEach((result, index) => {
        if (result !== null) {
          updatedConversionResults[index] = result;
        }
      });

      const updateData = {
        conversionData: updatedConversionData,
        conversionResults: updatedConversionResults,
        timestamp: utcTimestamp,
        success: updatedConversionResults.some(result => result && result.success),
        // Actualizar messageData si viene de un evento diferente
        ...(messageData && { messageData: {
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
          author: messageData.author
        }})
      };

      const result = await collection.updateOne(
        { extractedCode: extractedCode },
        { $set: updateData }
      );

      console.log("✅ Registro actualizado en send_meta:", existingRecord._id);

      // Actualizar el lead correspondiente con meta_data actualizada
      if (messageData?.entityId || existingRecord.messageData?.entityId) {
        const entityId = messageData?.entityId || existingRecord.messageData?.entityId;
        const leadsCollection = db.collection("leads");

        // Obtener el registro actualizado para guardar en meta_data
        const updatedRecord = await collection.findOne({ extractedCode: extractedCode });

        const updateResult = await leadsCollection.updateOne(
          { leadId: entityId },
          {
            $set: {
              meta_data: updatedRecord,
              updatedAt: utcTimestamp
            }
          }
        );

        if (updateResult.matchedCount > 0) {
          console.log(`✅ Lead actualizado con meta_data para entityId: ${entityId}`);
        } else {
          console.log(`⚠️ No se encontró lead con entityId: ${entityId}`);
        }
      }

      return { success: true, updatedId: existingRecord._id };
    } else {
      // Si no existe, crear nuevo registro
      const record = {
        // Array de datos de conversiones enviadas a Meta
        // [0] = ConversacionCRM1, [1] = CargoCRM1
        conversionData: conversionDataArray,
        // Datos del mensaje que disparó la conversión
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
          author: messageData.author
        },
        // Información adicional
        extractedCode: extractedCode,
        conversionResults: conversionResults,
        timestamp: utcTimestamp,
        success: conversionResults.some(result => result && result.success)
      };

      const result = await collection.insertOne(record);
      console.log("✅ Registro creado en send_meta:", result.insertedId);

      // Actualizar el lead correspondiente agregando meta_data
      if (record.messageData.entityId) {
        const leadsCollection = db.collection("leads");
        const updateResult = await leadsCollection.updateOne(
          { leadId: record.messageData.entityId },
          {
            $set: {
              meta_data: record,
              updatedAt: utcTimestamp
            }
          }
        );

        if (updateResult.matchedCount > 0) {
          console.log(`✅ Lead actualizado con meta_data para entityId: ${record.messageData.entityId}`);
        } else {
          console.log(`⚠️ No se encontró lead con entityId: ${record.messageData.entityId}`);
        }
      }

      return { success: true, insertedId: result.insertedId };
    }
  } catch (error) {
    console.error("❌ Error al guardar en send_meta:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido"
    };
  }
}

// Función para buscar lead por ID
export async function findLeadById(leadId: string) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DATABASE || "kommo");
    const collection = db.collection("leads");

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
    const db = client.db(process.env.MONGODB_DATABASE || "kommo");
    const collection = db.collection("users");

    const contact = await collection.findOne({ contactId: contactId });
    return contact;
  } catch (error) {
    console.error("❌ Error al buscar contacto por ID:", error);
    return null;
  }
}

// Función para crear lead desde datos de la API de Kommo
export async function createLeadFromKommoApi(kommoLeadData: any, kommoContactData?: any) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DATABASE || "kommo");
    const collection = db.collection("leads");

    const leadId = kommoLeadData.id.toString();

    // Verificar si ya existe un lead con este leadId
    const existingLead = await collection.findOne({ leadId: leadId });
    if (existingLead) {
      console.log(`⚠️ Lead ${leadId} ya existe localmente, omitiendo creación duplicada`);
      return existingLead;
    }

    // Obtener el contactId real del lead
    const realContactId = kommoLeadData._embedded?.contacts?.[0]?.id?.toString() || kommoContactData?.id?.toString() || "unknown";

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
        id: realContactId
      },
      messageText: `Lead sincronizado desde API: ${kommoLeadData.name}`,
      sourceName: "kommo_api_sync",
      updatedAt: convertToArgentinaISO(kommoLeadData.updated_at || kommoLeadData.created_at)
    };

    const { _id, ...leadData } = leadDocument;
    const result = await collection.insertOne(leadData);
    console.log("✅ Lead creado desde API de Kommo:", result.insertedId);
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
    const db = client.db(process.env.MONGODB_DATABASE || "kommo");
    const collection = db.collection("users");

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
      console.log(`⚠️ Contacto ${contactId} ya existe localmente, omitiendo creación duplicada`);
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
      updatedAt: convertToArgentinaISO(kommoContactData.updated_at || kommoContactData.created_at)
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
export const getAllSettings = () =>
  kommoDatabaseService.getAllSettings();

export const getSettingsById = (id: string) =>
  kommoDatabaseService.getSettingsById(id);

export const updateSettingsById = (id: string, updateData: Partial<Omit<SettingsDocument, '_id'>>) =>
  kommoDatabaseService.updateSettingsById(id, updateData);

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

// ===== TIPOS PARA LOGS CONSOLIDADOS =====

export type LogType = 'received_messages' | 'change_status' | 'bot_actions' | 'send_meta';

export interface BaseLogEntry {
  index: number;
  id: string;
  timestamp: string;
  type: LogType;
  contactId: string;
  leadId?: string;
  talkId?: string;
  userName: string;
  clientId: string;
  sourceName: string;
}

export interface ReceivedMessageLog extends BaseLogEntry {
  type: 'received_messages';
  messageText: string;
  messageType: 'incoming' | 'outgoing';
  authorName: string;
  messageId: string;
  chatId: string;
}

export interface ChangeStatusLog extends BaseLogEntry {
  type: 'change_status';
  oldStatus?: string;
  newStatus: string;
  changedBy: 'bot' | 'manual' | 'system';
  reason?: string;
  confidence?: number;
  success: boolean;
}

export interface BotActionLog extends BaseLogEntry {
  type: 'bot_actions';
  messageText: string;
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
  processingTime: number; // en ms
}

export interface SendMetaLog extends BaseLogEntry {
  type: 'send_meta';
  extractedCode: string;
  conversionData: Array<{
    data: Array<{
      event_name: string;
      event_time: number;
      action_source: string;
      event_source_url: string;
      user_data: {
        client_ip_address: string;
        client_user_agent: string;
        fbp: string;
        fbc: string;
      };
    }>;
  }>;
  conversionResults: Array<{
    success: boolean;
    error?: string;
    message?: string;
    data?: any;
  }>;
  success: boolean;
}

export type LogEntry = ReceivedMessageLog | ChangeStatusLog | BotActionLog | SendMetaLog;

// Parámetros de consulta para logs
export interface LogsQueryParams {
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
  logType?: LogType;
  contactId?: string;
  leadId?: string;
  talkId?: string;
  userName?: string;
  clientId?: string;
  sourceName?: string;
  status?: string;
  changedBy?: 'bot' | 'manual' | 'system';
  limit?: number;
  offset?: number;
    sortBy?: 'timestamp' | 'userName' | 'contactId' | 'type' | 'leadId' | 'extractedCode';
  sortOrder?: 'asc' | 'desc';
}

// Respuesta del endpoint de logs
export interface LogsResponse {
  logs: LogEntry[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  stats: {
    received_messages: number;
    change_status: number;
    bot_actions: number;
    send_meta: number;
  };
  query: LogsQueryParams;
}

// ===== INTERFACES PARA RULES =====

// Interface para documentos de reglas
export interface RuleDocument {
  _id?: string | ObjectId;
  createdAt: string; // ISO string en horario Argentina
  updatedAt: string; // ISO string en horario Argentina
  rule: string; // Número o identificador de la regla
  text: string; // Texto descriptivo de la regla
  crm: string; // Sistema CRM utilizado
  pipeline: string; // Pipeline donde se aplica
  priority: number; // Prioridad de la regla
  status: 'active' | 'inactive' | 'draft'; // Estado de la regla
}

// Parámetros de consulta para rules
export interface RulesQueryParams {
  startDate?: string;
  endDate?: string;
  rule?: string;
  text?: string;
  crm?: string;
  pipeline?: string;
  status?: 'active' | 'inactive' | 'draft';
  priority?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'rule' | 'priority' | 'status';
  sortOrder?: 'asc' | 'desc';
}

// Respuesta del endpoint de rules
export interface RulesResponse {
  rules: RuleDocument[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  query: RulesQueryParams;
}

// ===== FUNCIONES CRUD PARA RULES =====

/**
 * Crear una nueva regla
 */
export async function createRule(ruleData: Omit<RuleDocument, '_id' | 'createdAt' | 'updatedAt'>): Promise<RuleDocument> {
  const client = await clientPromise;
  const db = client.db('kommo');
  const collection = db.collection<RuleDocument>('rules');

  const now = new Date(Date.now() - (3 * 60 * 60 * 1000)).toISOString();
  const ruleDocument: Omit<RuleDocument, '_id'> = {
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
export async function getRules(params: RulesQueryParams = {}): Promise<RulesResponse> {
  const client = await clientPromise;
  const db = client.db('kommo');
  const collection = db.collection<RuleDocument>('rules');

  // Construir query de filtrado
  const query: any = {};

  if (params.startDate || params.endDate) {
    query.createdAt = {};
    if (params.startDate) query.createdAt.$gte = params.startDate;
    if (params.endDate) query.createdAt.$lte = params.endDate;
  }

  if (params.rule) query.rule = { $regex: params.rule, $options: 'i' };
  if (params.text) query.text = { $regex: params.text, $options: 'i' };
  if (params.crm) query.crm = params.crm;
  if (params.pipeline) query.pipeline = params.pipeline;
  if (params.status) query.status = params.status;
  if (params.priority !== undefined) query.priority = params.priority;

  // Paginación
  const limit = params.limit || 50;
  const offset = params.offset || 0;

  // Ordenamiento
  const sortBy = params.sortBy || 'createdAt';
  const sortOrder = params.sortOrder === 'asc' ? 1 : -1;
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
  const db = client.db('kommo');
  const collection = db.collection<RuleDocument>('rules');

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
export async function getRuleByRuleNumber(ruleNumber: string): Promise<RuleDocument | null> {
  const client = await clientPromise;
  const db = client.db('kommo');
  const collection = db.collection<RuleDocument>('rules');

  return await collection.findOne({ rule: ruleNumber });
}

/**
 * Actualizar una regla por ID
 */
export async function updateRule(id: string, updateData: Partial<Omit<RuleDocument, '_id' | 'createdAt'>>): Promise<RuleDocument | null> {
  const client = await clientPromise;
  const db = client.db('kommo');
  const collection = db.collection<RuleDocument>('rules');

  const updateDoc = {
    ...updateData,
    updatedAt: new Date(Date.now() - (3 * 60 * 60 * 1000)).toISOString(),
  };

  try {
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );
    return result;
  } catch (error) {
    return null;
  }
}

/**
 * Actualizar una regla por número de regla
 */
export async function updateRuleByRuleNumber(ruleNumber: string, updateData: Partial<Omit<RuleDocument, '_id' | 'createdAt'>>): Promise<RuleDocument | null> {
  const client = await clientPromise;
  const db = client.db('kommo');
  const collection = db.collection<RuleDocument>('rules');

  const updateDoc = {
    ...updateData,
    updatedAt: new Date(Date.now() - (3 * 60 * 60 * 1000)).toISOString(),
  };

  const result = await collection.findOneAndUpdate(
    { rule: ruleNumber },
    { $set: updateDoc },
    { returnDocument: 'after' }
  );

  return result;
}

/**
 * Eliminar una regla por ID
 */
export async function deleteRule(id: string): Promise<boolean> {
  const client = await clientPromise;
  const db = client.db('kommo');
  const collection = db.collection<RuleDocument>('rules');

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
export async function deleteRuleByRuleNumber(ruleNumber: string): Promise<boolean> {
  const client = await clientPromise;
  const db = client.db('kommo');
  const collection = db.collection<RuleDocument>('rules');

  const result = await collection.deleteOne({ rule: ruleNumber });
  return result.deletedCount > 0;
}

/**
 * Obtener reglas por CRM
 */
export async function getRulesByCrm(crm: string, params: Partial<RulesQueryParams> = {}): Promise<RulesResponse> {
  return getRules({
    crm,
    limit: 50,
    sortBy: 'priority',
    sortOrder: 'desc',
    ...params,
  });
}

/**
 * Obtener reglas por pipeline
 */
export async function getRulesByPipeline(pipeline: string, params: Partial<RulesQueryParams> = {}): Promise<RulesResponse> {
  return getRules({
    pipeline,
    limit: 50,
    sortBy: 'priority',
    sortOrder: 'desc',
    ...params,
  });
}

/**
 * Normalizar reglas para uso en AI (solo priority y rule)
 */
export function normalizeRulesForAI(rules: RuleDocument[]): Array<{ priority: number; rule: string }> {
  return rules.map(rule => ({
    priority: rule.priority,
    rule: rule.rule
  }))
}

/**
 * Obtener reglas activas
 */
export async function getActiveRules(params: Partial<RulesQueryParams> = {}): Promise<RulesResponse> {
  return getRules({
    status: 'active',
    limit: 50,
    sortBy: 'priority',
    sortOrder: 'desc',
    ...params,
  });
}

/**
 * Obtener reglas activas normalizadas para AI
 */
export async function getActiveRulesForAI(params: Partial<RulesQueryParams> = {}): Promise<Array<{ priority: number; rule: string }>> {
  const response = await getActiveRules(params)
  return normalizeRulesForAI(response.rules)
}
