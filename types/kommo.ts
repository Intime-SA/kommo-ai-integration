export interface KommoWebhookData {
  account: {
    subdomain: string
    id: string
    _links: {
      self: string
    }
  }
  talk?: {
    add: Array<{
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
}

export type LeadStatus = "Revisar" | "PidioUsuario" | "PidioCbuAlias" | "Cargo" | "NoCargo" | "NoAtender" | "Seguimiento" | "Ganado" | "Perdido"

export interface AIDecision {
  currentStatus: LeadStatus
  newStatus: LeadStatus
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
