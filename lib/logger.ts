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

  webhookParsed(account: any, message?: any, talk?: any) {
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

    if (talk) {
      this.info("- Conversación", {
        talk_id: talk.talk_id,
        contact_id: talk.contact_id,
        chat_id: talk.chat_id,
        entity_id: talk.entity_id,
        entity_type: talk.entity_type,
        origin: talk.origin,
        is_in_work: talk.is_in_work,
        is_read: talk.is_read
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

  // Logs específicos para peticiones HTTP
  outgoingHttpRequest(method: string, url: string, headers?: any, body?: any) {
    this.info(`📤 PETICIÓN SALIENTE: ${method} ${url}`)
    if (headers) {
      this.debug("Headers enviados", headers)
    }
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
}

// Instancia singleton del logger
export const logger = new Logger()

// Exportar funciones de conveniencia para mantener compatibilidad
export const logWebhookReceived = (body: string) => logger.webhookReceived(body)
export const logWebhookParsed = (account: any, message?: any, talk?: any) => logger.webhookParsed(account, message, talk)
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

// Nuevas funciones de logging para HTTP
export const logOutgoingHttpRequest = (method: string, url: string, headers?: any, body?: any) => logger.outgoingHttpRequest(method, url, headers, body)
export const logIncomingHttpResponse = (status: number, statusText: string, data?: any, responseTime?: number) => logger.incomingHttpResponse(status, statusText, data, responseTime)
export const logHttpError = (operation: string, error: any, url?: string) => logger.httpError(operation, url, error)

// Nuevas funciones de logging para AI
export const logAiPromptSent = (prompt: string, systemMessage: string) => logger.aiPromptSent(prompt, systemMessage)
export const logAiResponseReceived = (response: any, confidence: number) => logger.aiResponseReceived(response, confidence)
