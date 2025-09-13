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
    }>
  }
  leads?: {
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

export type LeadStatus = "Revisar" | "PidioUsuario" | "PidioCbuAlias" | "Cargo" | "NoCargo" | "NoAtender" | "Seguimiento" | "Ganado" | "Perdido" | "sin-status"

// Status que el bot puede asignar como nuevos (excluye "Cargo" por restricción de seguridad)
export type BotAssignableStatus = "Revisar" | "PidioUsuario" | "PidioCbuAlias" | "NoCargo" | "NoAtender" | "sin-status"

export interface AIDecision {
  currentStatus: LeadStatus
  newStatus: BotAssignableStatus
  shouldChange: boolean
  reasoning: string
  confidence: number
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
