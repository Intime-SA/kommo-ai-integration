// ===== TIPOS PARA LOGS CONSOLIDADOS =====

import { ObjectId } from "mongodb";

export type LogType =
  | "received_messages"
  | "change_status"
  | "bot_actions"
  | "send_meta";

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
  type: "received_messages";
  messageText: string;
  messageType: "incoming" | "outgoing";
  authorName: string;
  messageId: string;
  chatId: string;
}

export interface ChangeStatusLog extends BaseLogEntry {
  type: "change_status";
  oldStatus?: string;
  newStatus: string;
  changedBy: "bot" | "manual" | "system";
  reason?: string;
  confidence?: number;
  success: boolean;
}

export interface BotActionLog extends BaseLogEntry {
  type: "bot_actions";
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
  type: "send_meta";
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

export type LogEntry =
  | ReceivedMessageLog
  | ChangeStatusLog
  | BotActionLog
  | SendMetaLog;

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
  changedBy?: "bot" | "manual" | "system";
  limit?: number;
  offset?: number;
  sortBy?:
    | "timestamp"
    | "userName"
    | "contactId"
    | "type"
    | "leadId"
    | "extractedCode";
  sortOrder?: "asc" | "desc";
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
  status: "active" | "inactive" | "draft"; // Estado de la regla
}

// Parámetros de consulta para rules
export interface RulesQueryParams {
  startDate?: string;
  endDate?: string; 
  rule?: string;
  text?: string;
  crm?: string;
  pipeline?: string;
  status?: "active" | "inactive" | "draft";
  priority?: number;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "rule" | "priority" | "status";
  sortOrder?: "asc" | "desc";
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

export interface KommoWebhookData {
    account: {
      subdomain: string
      id: string
      _links: {
        self: string
      }
    }
    talk?: {
      add?: Array<{
        talk_id: string
        created_at: string
        updated_at: string
        rate: string
        contact_id: string
        chat_id: string
        entity_id: string
        entity_type: string
        is_in_work: string
        is_read: string
        origin: string
      }>
      update?: Array<{
        talk_id: string
        created_at: string
        updated_at: string
        rate: string
        contact_id: string
        chat_id: string
        entity_id: string
        entity_type: string
        is_in_work: string
        is_read: string
        origin: string
      }>
    }
    unsorted?: {
      add?: Array<{
        uid: string
        source: string
        source_uid: string
        category: string
        source_data: {
          from: string
          name: string
          to: string
          date: string
          service: string
          site: string
          client: {
            name: string
            id: string
          }
          origin: {
            provider: string
            chat_id: string
          }
          data: Array<{
            id: string
            manager: string
            date: string
            text: string
          }>
          source_uid: string
          source: string
          source_name: string
        }
        date_create: string
        data: {
          contacts: Array<{
            id: string
          }>
        }
        pipeline_id: string
        account_id: string
        source_id: string
        lead_id: string
        created_at: string
      }>
      delete?: Array<{
        action: string
        decline_result: {
          leads: Array<string>
        }
        uid: string
        category: string
        created_at: string
        modified_user_id: string
      }>
    }
    message?: {
      add: Array<{
        id: string
        chat_id: string
        talk_id: string
        contact_id: string
        text: string
        created_at: string
        element_type: string
        entity_type: string
        element_id: string
        entity_id: string
        type: "incoming" | "outgoing"
        author: {
          id: string
          type: string
          name: string
        }
        attachment?: {
          type: string
          link: string
          file_name: string
        }
      }>
    }
    leads?: {
      add?: Array<{
        id: string
        name: string
        status_id: string
        responsible_user_id: string
        created_user_id: string
        date_create: string
        pipeline_id: string
        account_id: string
        created_at: string
      }>
      status?: Array<{
        id: string
        name: string
        status_id: string
        old_status_id: string
        responsible_user_id: string
        last_modified: string
        modified_user_id: string
        created_user_id: string
        date_create: string
        pipeline_id: string
        account_id: string
        created_at: string
        updated_at: string
      }>
      delete?: Array<{
        id: string
        status_id: string
        pipeline_id: string
      }>
    }
  }
  
  // Tipos para los status de los leads
  export type LeadStatus = "Revisar" | "PidioUsuario" | "PidioCbuAlias" | "Cargo" | "RevisarImagen" | "NoCargo" | "NoAtender" | "Seguimiento" | "Ganado" | "Perdido" | "sin-status"
  
  // Status que el bot puede asignar como nuevos (excluye "Cargo" por restricción de seguridad)
  export type BotAssignableStatus = "Revisar" | "PidioUsuario" | "PidioCbuAlias" | "RevisarImagen" | "NoCargo" | "NoAtender" | "sin-status"
  
  export interface AIDecision {
    currentStatus: LeadStatus
    newStatus: BotAssignableStatus
    shouldChange: boolean
    reasoning: string
    confidence: number
    attachment?: any
  }
  
  export interface ProcessedMessage {
    talkId: string
    contactId: string
    entityId: string
    messageText: string
    authorName: string
    timestamp: string
    aiDecision: AIDecision
  }
  
  // ===== TIPOS PARA LOGS CONSOLIDADOS =====

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
type: "received_messages";
messageText: string;
messageType: "incoming" | "outgoing";
authorName: string;
messageId: string;
chatId: string;
}

export interface ChangeStatusLog extends BaseLogEntry {
type: "change_status";
oldStatus?: string;
newStatus: string;
changedBy: "bot" | "manual" | "system";
reason?: string;
confidence?: number;
success: boolean;
}

export interface BotActionLog extends BaseLogEntry {
type: "bot_actions";
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
type: "send_meta";
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
changedBy?: "bot" | "manual" | "system";
limit?: number;
offset?: number;
sortBy?:
  | "timestamp"
  | "userName"
  | "contactId"
  | "type"
  | "leadId"
  | "extractedCode";
sortOrder?: "asc" | "desc";
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
status: "active" | "inactive" | "draft"; // Estado de la regla
}

// Parámetros de consulta para rules
export interface RulesQueryParams {
startDate?: string;
endDate?: string;
rule?: string;
text?: string;
crm?: string;
pipeline?: string;
status?: "active" | "inactive" | "draft";
priority?: number;
limit?: number;
offset?: number;
sortBy?: "createdAt" | "updatedAt" | "rule" | "priority" | "status";
sortOrder?: "asc" | "desc";
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
  attachment?: {
    type: string;
    link: string;
    file_name: string;
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
  campaignId: string;
  lead: any; // El objeto lead que viene del payload
  createdAt: string; // ISO string en horario Argentina
  eventSourceUrl: string;
  redirectNumber?: {
    name: string;
    phone: string;
  };
  message?: string;
}

// Interface para documentos de settings
export interface SettingsDocument {
  _id?: string;
  accountCBU: string;
  context: string;
  message: string;
  createdAt?: string;
  updatedAt?: string;
  accountName: string;
  walink?: string;
  numbers?: Array<{
    name: string;
    phone: string;
  }>;
}

// Interface para documentos de status
export interface StatusDocument {
  _id?: string;
  statusId: string;
  name: string;
  description: string;
  kommo_id: string | null;
  color?: string; // Color en formato hex (opcional)
  createdAt: string;
  updatedAt: string;
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