import { MongoClient } from 'mongodb';
import clientPromise from './mongodb';

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

export const getContactContext = (contactId: string) =>
  kommoDatabaseService.getContactContext(contactId);
