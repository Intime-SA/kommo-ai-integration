import { MongoClient } from 'mongodb';
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
   * Obtiene estadísticas de logs por tipo
   */
  async getLogsStats(params: LogsQueryParams): Promise<{
    received_messages: number;
    change_status: number;
    bot_actions: number;
  }> {
    // Ejecutar consultas en paralelo para obtener conteos por tipo
    const [messagesCount, statusCount, actionsCount] = await Promise.all([
      this.getReceivedMessagesLogs({ ...params, limit: 0, offset: 0 }).then(r => r.total).catch(() => 0),
      this.getChangeStatusLogs({ ...params, limit: 0, offset: 0 }).then(r => r.total).catch(() => 0),
      this.getBotActionsLogs({ ...params, limit: 0, offset: 0 }).then(r => r.total).catch(() => 0)
    ]);

    return {
      received_messages: messagesCount,
      change_status: statusCount,
      bot_actions: actionsCount
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
    } else {
      // Consultar todos los tipos y combinar
      const [messagesResult, statusResult, actionsResult] = await Promise.all([
        this.getReceivedMessagesLogs({ ...effectiveParams, limit: 10000, offset: 0 }), // Obtener más para combinar
        this.getChangeStatusLogs({ ...effectiveParams, limit: 10000, offset: 0 }),
        this.getBotActionsLogs({ ...effectiveParams, limit: 10000, offset: 0 })
      ]);

      // Combinar logs
      const combinedLogs = [
        ...messagesResult.logs,
        ...statusResult.logs,
        ...actionsResult.logs
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

      totalCount = messagesResult.total + statusResult.total + actionsResult.total;
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

// Función utilitaria para extraer código de un mensaje
export function extractCodeFromMessage(messageText: string): string | null {
  // Patrón para buscar códigos de 8 caracteres alfanuméricos
  // Busca patrones como "Descuento: ABC12345." o "Código: XYZ78901"
  const codePattern = /(?:descuento|codigo|código|token)\s*:\s*([A-Za-z0-9]{8})\.?/i;
  const match = messageText.match(codePattern);

  if (match && match[1]) {
    return match[1];
  }

  // También buscar códigos sueltos de 8 caracteres alfanuméricos
  const looseCodePattern = /\b([A-Za-z0-9]{8})\b/;
  const looseMatch = messageText.match(looseCodePattern);

  return looseMatch ? looseMatch[1] : null;
}

// Función para enviar conversión a Meta API
export async function sendConversionToMeta(leadData: any, accessToken: string, pixelId?: string) {
  try {
    // Usar el pixel ID correcto para "ConversacionCRM1"
    const pixel = pixelId || process.env.META_PIXEL_ID || "1293636532487008";

    const conversionData = {
      data: [
        {
          event_name: "Other", // Evento configurado como "Other" en Meta
          user_data: {
            // Datos técnicos requeridos por Meta
            fbp: leadData.fbp ? [leadData.fbp] : undefined,
            fbc: leadData.fbc ? [leadData.fbc] : undefined,
            client_user_agent: leadData.userAgent ? leadData.userAgent : undefined,
            client_ip_address: leadData.ip ? leadData.ip : undefined,
          },
          custom_data: {
            currency: "ARS",
            value: leadData.value || "0",
            content_name: "Conversacion CRM iniciada",
            custom_event_parameter: "TRUE"
          },
        }
      ],
      test_event_code: process.env.NODE_ENV === "development" ? "TEST12345" : undefined
    };

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

export const getContactContext = (contactId: string) =>
  kommoDatabaseService.getContactContext(contactId);

// Funciones de conveniencia para logs
export const getReceivedMessagesLogs = (params: LogsQueryParams) =>
  kommoDatabaseService.getReceivedMessagesLogs(params);

export const getChangeStatusLogs = (params: LogsQueryParams) =>
  kommoDatabaseService.getChangeStatusLogs(params);

export const getBotActionsLogs = (params: LogsQueryParams) =>
  kommoDatabaseService.getBotActionsLogs(params);

export const getConsolidatedLogs = (params: LogsQueryParams) =>
  kommoDatabaseService.getConsolidatedLogs(params);

// ===== TIPOS PARA LOGS CONSOLIDADOS =====

export type LogType = 'received_messages' | 'change_status' | 'bot_actions';

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

export type LogEntry = ReceivedMessageLog | ChangeStatusLog | BotActionLog;

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
    sortBy?: 'timestamp' | 'userName' | 'contactId' | 'type' | 'leadId';
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
  };
  query: LogsQueryParams;
}
