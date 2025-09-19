/**
 * Sistema de logging centralizado para Kommo AI Integration
 * Compatible con desarrollo local y producción en Vercel
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogContext {
  timestamp: string
  level: string
  message: string
  data?: any
  talkId?: string
  leadId?: string
  [key: string]: any
}

class Logger {
  private currentLevel: LogLevel = LogLevel.INFO
  private isProduction: boolean

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production'
    // En desarrollo mostramos más logs, en producción también mostramos INFO para debugging
    this.currentLevel = this.isProduction ? LogLevel.INFO : LogLevel.DEBUG
  }

  private formatLog(level: LogLevel, message: string, data?: any, context?: Partial<LogContext>): LogContext {
    const logContext: LogContext = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      ...context,
    }

    if (data !== undefined) {
      logContext.data = data
    }

    return logContext
  }

  private logToConsole(level: LogLevel, message: string, data?: any, context?: Partial<LogContext>) {
    const logContext = this.formatLog(level, message, data, context)

    // En producción, usar console.log para todos los niveles para máxima visibilidad en Vercel
    if (this.isProduction) {
      if (data !== undefined && data !== null) {
        console.log(`[${level}] ${message}`, data)
      } else {
        console.log(`[${level}] ${message}`)
      }
      // También log estructurado para mejor parsing
      console.log(JSON.stringify(logContext))
    } else {
      // En desarrollo mantener los console methods normales
      if (level === LogLevel.DEBUG || level === LogLevel.INFO) {
        console.log(message, data ? data : '')
      } else if (level === LogLevel.WARN) {
        console.warn(message, data ? data : '')
      } else if (level === LogLevel.ERROR) {
        console.error(message, data ? data : '')
      }
    }
  }

  debug(message: string, data?: any, context?: Partial<LogContext>) {
    if (this.currentLevel <= LogLevel.DEBUG) {
      this.logToConsole(LogLevel.DEBUG, message, data, context)
    }
  }

  info(message: string, data?: any, context?: Partial<LogContext>) {
    if (this.currentLevel <= LogLevel.INFO) {
      this.logToConsole(LogLevel.INFO, message, data, context)
    }
  }

  warn(message: string, data?: any, context?: Partial<LogContext>) {
    if (this.currentLevel <= LogLevel.WARN) {
      this.logToConsole(LogLevel.WARN, message, data, context)
    }
  }

  error(message: string, data?: any, context?: Partial<LogContext>) {
    if (this.currentLevel <= LogLevel.ERROR) {
      this.logToConsole(LogLevel.ERROR, message, data, context)
    }
  }

  // Métodos específicos para mantener compatibilidad con logs existentes
  webhookReceived(body: string) {
    this.info("🔔 Webhook recibido de Kommo (datos crudos)", body)
  }

  webhookParsed(account: any, message?: any, talkAdd?: any, leads?: any, talkUpdate?: any, unsortedAdd?: any, leadsDelete?: any, unsortedDelete?: any) {
    this.info("📋 Datos del webhook parseados")
    this.info("- Cuenta", account ? {
      subdomain: account.subdomain,
      id: account.id,
      links: account._links
    } : "No disponible")

    if (message) {
      this.info("- Mensaje", {
        id: message.id,
        chat_id: message.chat_id,
        talk_id: message.talk_id,
        contact_id: message.contact_id,
        text: message.text,
        created_at: new Date(Number.parseInt(message.created_at) * 1000).toLocaleString('es-ES'),
        element_type: message.element_type,
        entity_type: message.entity_type,
        element_id: message.element_id,
        entity_id: message.entity_id,
        type: message.type,
        author: message.author,
      })
    }

    if (talkAdd) {
      this.info("- Nueva conversación (add)", {
        talk_id: talkAdd.talk_id,
        contact_id: talkAdd.contact_id,
        chat_id: talkAdd.chat_id,
        entity_id: talkAdd.entity_id,
        entity_type: talkAdd.entity_type,
        origin: talkAdd.origin,
        is_in_work: talkAdd.is_in_work,
        is_read: talkAdd.is_read,
        created_at: new Date(Number.parseInt(talkAdd.created_at) * 1000).toLocaleString('es-ES')
      })
    }

    if (talkUpdate) {
      this.info("- Actualización de conversación (update)", {
        talk_id: talkUpdate.talk_id,
        contact_id: talkUpdate.contact_id,
        chat_id: talkUpdate.chat_id,
        entity_id: talkUpdate.entity_id,
        entity_type: talkUpdate.entity_type,
        origin: talkUpdate.origin,
        is_in_work: talkUpdate.is_in_work,
        is_read: talkUpdate.is_read,
        updated_at: new Date(Number.parseInt(talkUpdate.updated_at) * 1000).toLocaleString('es-ES'),
        created_at: new Date(Number.parseInt(talkUpdate.created_at) * 1000).toLocaleString('es-ES')
      })
    }

    if (unsortedAdd) {
      this.info("- Elemento no ordenado agregado (unsorted add)", {
        uid: unsortedAdd.uid,
        source: unsortedAdd.source,
        source_uid: unsortedAdd.source_uid,
        category: unsortedAdd.category,
        lead_id: unsortedAdd.lead_id,
        contact_id: unsortedAdd.data?.contacts?.[0]?.id,
        pipeline_id: unsortedAdd.pipeline_id,
        created_at: new Date(Number.parseInt(unsortedAdd.created_at) * 1000).toLocaleString('es-ES'),
        client: unsortedAdd.source_data?.client,
        message_text: unsortedAdd.source_data?.data?.[0]?.text,
        source_name: unsortedAdd.source_data?.source_name
      })
    }

    if (leadsDelete) {
      this.info("- Eliminación de lead", {
        lead_id: leadsDelete.id,
        status_id: leadsDelete.status_id,
        pipeline_id: leadsDelete.pipeline_id
      })
    }

    if (unsortedDelete) {
      this.info("- Eliminación de elemento no ordenado (unsorted delete)", {
        action: unsortedDelete.action,
        uid: unsortedDelete.uid,
        category: unsortedDelete.category,
        created_at: new Date(Number.parseInt(unsortedDelete.created_at) * 1000).toLocaleString('es-ES'),
        modified_user_id: unsortedDelete.modified_user_id,
        decline_result_leads: unsortedDelete.decline_result?.leads
      })
    }

    if (leads?.status?.[0]) {
      this.info("- Cambio de estado del lead", {
        lead_id: leads.status[0].id,
        name: leads.status[0].name,
        from_status_id: leads.status[0].old_status_id,
        to_status_id: leads.status[0].status_id,
        responsible_user_id: leads.status[0].responsible_user_id,
        modified_user_id: leads.status[0].modified_user_id,
        last_modified: new Date(Number.parseInt(leads.status[0].last_modified) * 1000).toLocaleString('es-ES'),
        pipeline_id: leads.status[0].pipeline_id
      })
    }
  }

  messageProcessing(text: string, author: string, talkId?: string, leadId?: string) {
    this.info(`📨 Procesando mensaje: "${text}" de ${author}`, undefined, { talkId, leadId })
  }

  leadStatusQuery(leadId: string) {
    this.info(`🔍 Consultando status actual del lead ${leadId}`, undefined, { leadId })
  }

  leadStatusRetrieved(leadId: string, status: string, statusId: string) {
    this.info(`📊 Status actual del lead: "${status}"`, undefined, { leadId, status, statusId })
  }

  aiDecision(decision: any, talkId?: string, leadId?: string) {
    this.info("🤖 Decisión de IA", decision, { talkId, leadId })
  }

  statusChange(from: string, to: string, reason: string, talkId?: string, leadId?: string) {
    this.info(`🔄 Cambiando status de "${from}" a "${to}"`, undefined, { talkId, leadId })
    this.info(`📝 Razón: ${reason}`, undefined, { talkId, leadId })
  }

  leadUpdateSuccess(leadId: string, newStatus: string) {
    this.info(`✅ Lead ${leadId} actualizado exitosamente a "${newStatus}"`, undefined, { leadId })
  }

  leadUpdateError(leadId: string, newStatus: string, error?: any) {
    this.error(`❌ Error actualizando lead ${leadId} a "${newStatus}"`, error, { leadId })
  }

  configWarning(message: string) {
    this.warn(`⚠️ ${message}`)
  }

  messageSkipped(reason: string) {
    this.warn(`⚠️ ${reason}`)
  }

  webhookError(error: any, context?: string) {
    this.error(`❌ Error procesando webhook${context ? ` (${context})` : ''}`, error)
  }

  aiProcessingError(error: any) {
    this.error("Error processing message with AI", error)
  }

  kommoApiError(operation: string, error: any, leadId?: string) {
    this.error(`Error ${operation}${leadId ? ` para lead ${leadId}` : ''}`, error, { leadId })
  }

  leadInfoSuccess(result: any) {
    this.info("Lead status updated successfully", result)
  }

  leadStatusNotFound(leadId: string) {
    this.warn(`No se pudo obtener información del lead ${leadId}`, undefined, { leadId })
  }

  leadStatusFound(leadId: string, statusName: string | null, statusId: string) {
    this.info(`Lead ${leadId} tiene status actual: ${statusName} (ID: ${statusId})`, undefined, { leadId, statusName, statusId })
  }

  leadStatusChange(leadId: string, oldStatusId: string, newStatusId: string, userId: string) {
    this.info(`🔄 Cambio manual de status del lead ${leadId}`, {
      from: `Status ID ${oldStatusId}`,
      to: `Status ID ${newStatusId}`,
      by: `Usuario ${userId}`
    }, { leadId, oldStatusId, newStatusId, userId })
  }

  talkUpdate(talkId: string, contactId: string, entityId: string, isInWork: string, isRead: string) {
    this.info(`💬 Actualización de conversación ${talkId}`, {
      contact_id: contactId,
      entity_id: entityId,
      is_in_work: isInWork,
      is_read: isRead
    }, { talkId, contactId, entityId })
  }

  unsortedAdd(uid: string, source: string, category: string, leadId?: string, contactId?: string) {
    this.info(`📥 Nuevo elemento no ordenado ${uid}`, {
      source: source,
      category: category,
      lead_id: leadId,
      contact_id: contactId
    }, { uid, source, category, leadId, contactId })
  }

  leadsDelete(leadId: string, statusId: string, pipelineId: string) {
    this.info(`🗑️ Lead eliminado ${leadId}`, {
      status_id: statusId,
      pipeline_id: pipelineId
    }, { leadId, statusId, pipelineId })
  }

  unsortedDelete(uid: string, action: string, category: string, modifiedUserId: string) {
    this.info(`🗑️ Elemento no ordenado eliminado ${uid}`, {
      action: action,
      category: category,
      modified_user_id: modifiedUserId
    }, { uid, action, category, modifiedUserId })
  }

  // Logs específicos para peticiones HTTP
  outgoingHttpRequest(method: string, url: string, headers?: any, body?: any) {
    this.info(`📤 PETICIÓN SALIENTE: ${method} ${url}`)
    if (body) {
      this.debug("Body enviado", body)
    }
  }

  incomingHttpResponse(status: number, statusText: string, data?: any, responseTime?: number) {
    const timeInfo = responseTime ? ` (${responseTime}ms)` : ''
    if (status >= 200 && status < 300) {
      this.info(`📥 RESPUESTA: ${status} ${statusText}${timeInfo}`)
    } else {
      this.warn(`📥 RESPUESTA ERROR: ${status} ${statusText}${timeInfo}`)
    }
    if (data) {
      this.debug("Datos de respuesta", data)
    }
  }

  httpError(operation: string, error: any, url?: string) {
    this.error(`❌ ERROR HTTP en ${operation}${url ? ` (${url})` : ''}`, error)
  }

  // Logs para AI processing detallado
  aiPromptSent(prompt: string, systemMessage: string) {
    this.debug("🤖 PROMPT ENVIADO A AI", { prompt, systemMessage })
  }

  aiResponseReceived(response: any, confidence: number) {
    this.info(`🤖 RESPUESTA DE AI recibida (confianza: ${(confidence * 100).toFixed(1)}%)`, response)
  }

  // Logs específicos para Welcome Bot
  logWelcomeBotSkipped(messageText: string, reason: string, entityId: string) {
    this.warn(`🤖 Welcome Bot SALTADO - Entity: ${entityId}`, {
      message: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''),
      reason,
      entityId
    }, { entityId })
  }

  logWelcomeBotDetection(messageText: string, entityId: string) {
    this.info(`🤖 Welcome Bot DETECTADO - Entity: ${entityId}`, {
      message: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''),
      entityId
    }, { entityId })
  }

  logWelcomeBotLaunched(entityId: string, botId: number) {
    this.info(`🚀 Welcome Bot LANZADO exitosamente - Entity: ${entityId}`, {
      botId,
      entityId,
      timestamp: new Date().toISOString()
    }, { entityId, botId })
  }

  logWelcomeBotError(entityId: string, error: string) {
    this.error(`❌ Welcome Bot ERROR - Entity: ${entityId}`, {
      error,
      entityId,
      timestamp: new Date().toISOString()
    }, { entityId })
  }

  // Logs específicos para validación de duplicados
  logDuplicateMessageSkipped(
    talkId: string,
    entityId: string,
    contactId: string,
    messageText: string,
    reason: string,
    duplicateType: 'message' | 'event' | 'status_change',
    lastProcessedAt?: string
  ) {
    this.warn(`🚫 MENSAJE DUPLICADO SALTADO - Talk: ${talkId}`, {
      talkId,
      entityId,
      contactId,
      message: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''),
      reason,
      duplicateType,
      lastProcessedAt,
      timestamp: new Date().toISOString()
    }, { talkId, entityId, contactId })
  }

  logWebhookValidationPassed(
    talkId: string,
    entityId: string,
    contactId: string,
    messageText: string
  ) {
    this.info(`✅ Validación de webhook PASADA - Talk: ${talkId}`, {
      talkId,
      entityId,
      contactId,
      message: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : ''),
      timestamp: new Date().toISOString()
    }, { talkId, entityId, contactId })
  }

  logSpamDetected(
    contactId: string,
    messageCount: number,
    timeWindow: number
  ) {
    this.warn(`🚨 SPAM DETECTADO - Contact: ${contactId}`, {
      contactId,
      messageCount,
      timeWindowMinutes: timeWindow,
      timestamp: new Date().toISOString()
    }, { contactId })
  }
}

// Instancia singleton del logger
export const logger = new Logger()

// Exportar funciones de conveniencia para mantener compatibilidad
export const logWebhookReceived = (body: string) => logger.webhookReceived(body)
export const logWebhookParsed = (account: any, message?: any, talkAdd?: any, leads?: any, talkUpdate?: any, unsortedAdd?: any, leadsDelete?: any, unsortedDelete?: any) => logger.webhookParsed(account, message, talkAdd, leads, talkUpdate, unsortedAdd, leadsDelete, unsortedDelete)
export const logMessageProcessing = (text: string, author: string, talkId?: string, leadId?: string) => logger.messageProcessing(text, author, talkId, leadId)
export const logLeadStatusQuery = (leadId: string) => logger.leadStatusQuery(leadId)
export const logLeadStatusRetrieved = (leadId: string, status: string, statusId: string) => logger.leadStatusRetrieved(leadId, status, statusId)
export const logAiDecision = (decision: any, talkId?: string, leadId?: string) => logger.aiDecision(decision, talkId, leadId)
export const logStatusChange = (from: string, to: string, reason: string, talkId?: string, leadId?: string) => logger.statusChange(from, to, reason, talkId, leadId)
export const logLeadUpdateSuccess = (leadId: string, newStatus: string) => logger.leadUpdateSuccess(leadId, newStatus)
export const logLeadUpdateError = (leadId: string, newStatus: string, error?: any) => logger.leadUpdateError(leadId, newStatus, error)
export const logConfigWarning = (message: string) => logger.configWarning(message)
export const logMessageSkipped = (reason: string) => logger.messageSkipped(reason)
export const logWebhookError = (error: any, context?: string) => logger.webhookError(error, context)
export const logAiProcessingError = (error: any) => logger.aiProcessingError(error)
export const logKommoApiError = (operation: string, error: any, leadId?: string) => logger.kommoApiError(operation, error, leadId)
export const logLeadInfoSuccess = (result: any) => logger.leadInfoSuccess(result)
export const logLeadStatusNotFound = (leadId: string) => logger.leadStatusNotFound(leadId)
export const logLeadStatusFound = (leadId: string, statusName: string | null, statusId: string) => logger.leadStatusFound(leadId, statusName, statusId)
export const logLeadStatusChange = (leadId: string, oldStatusId: string, newStatusId: string, userId: string) => logger.leadStatusChange(leadId, oldStatusId, newStatusId, userId)
export const logTalkUpdate = (talkId: string, contactId: string, entityId: string, isInWork: string, isRead: string) => logger.talkUpdate(talkId, contactId, entityId, isInWork, isRead)
export const logUnsortedAdd = (uid: string, source: string, category: string, leadId?: string, contactId?: string) => logger.unsortedAdd(uid, source, category, leadId, contactId)
export const logLeadsDelete = (leadId: string, statusId: string, pipelineId: string) => logger.leadsDelete(leadId, statusId, pipelineId)
export const logUnsortedDelete = (uid: string, action: string, category: string, modifiedUserId: string) => logger.unsortedDelete(uid, action, category, modifiedUserId)

// Nuevas funciones de logging para HTTP
export const logOutgoingHttpRequest = (method: string, url: string, headers?: any, body?: any) => logger.outgoingHttpRequest(method, url, headers, body)
export const logIncomingHttpResponse = (status: number, statusText: string, data?: any, responseTime?: number) => logger.incomingHttpResponse(status, statusText, data, responseTime)
export const logHttpError = (operation: string, error: any, url?: string) => logger.httpError(operation, url, error)

// Nuevas funciones de logging para AI
export const logAiPromptSent = (prompt: string, systemMessage: string) => logger.aiPromptSent(prompt, systemMessage)
export const logAiResponseReceived = (response: any, confidence: number) => logger.aiResponseReceived(response, confidence)

// Funciones de logging para Welcome Bot
export const logWelcomeBotSkipped = (messageText: string, reason: string, entityId: string) => logger.logWelcomeBotSkipped(messageText, reason, entityId)
export const logWelcomeBotDetection = (messageText: string, entityId: string) => logger.logWelcomeBotDetection(messageText, entityId)
export const logWelcomeBotLaunched = (entityId: string, botId: number) => logger.logWelcomeBotLaunched(entityId, botId)
export const logWelcomeBotError = (entityId: string, error: string) => logger.logWelcomeBotError(entityId, error)

// Funciones de logging para validación de duplicados
export const logDuplicateMessageSkipped = (
  talkId: string,
  entityId: string,
  contactId: string,
  messageText: string,
  reason: string,
  duplicateType: 'message' | 'event' | 'status_change',
  lastProcessedAt?: string
) => logger.logDuplicateMessageSkipped(talkId, entityId, contactId, messageText, reason, duplicateType, lastProcessedAt)

export const logWebhookValidationPassed = (
  talkId: string,
  entityId: string,
  contactId: string,
  messageText: string
) => logger.logWebhookValidationPassed(talkId, entityId, contactId, messageText)

export const logSpamDetected = (
  contactId: string,
  messageCount: number,
  timeWindow: number
) => logger.logSpamDetected(contactId, messageCount, timeWindow)
