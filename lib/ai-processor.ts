import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import type { LeadStatus, BotAssignableStatus, AIDecision } from "@/types/kommo"
import type { ContactContext, SettingsDocument, StatusDocument } from "@/lib/mongodb-services"
import { logAiProcessingError, logAiPromptSent, logAiResponseReceived } from "./logger"

// Schema para validar las decisiones de la IA (excluye "Cargo" por restricción de seguridad)
const aiDecisionSchema = z.object({
  currentStatus: z.enum(["Revisar", "PidioUsuario", "PidioCbuAlias", "Cargo", "NoCargo", "NoAtender", "sin-status"]),
  newStatus: z.enum(["Revisar", "PidioUsuario", "PidioCbuAlias", "NoCargo", "NoAtender", "sin-status"]),
  shouldChange: z.boolean(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
})

// Función helper para formatear el contexto histórico del contacto
function formatContactContext(context: ContactContext, settings?: SettingsDocument | null): string {
  let contextText = `📋 CONTEXTO HISTÓRICO DEL CONTACTO (Últimas 24 horas):\n\n`

  // Información del usuario
  if (context.userInfo) {
    contextText += `👤 INFORMACIÓN DEL USUARIO:
- NOMBRE CLIENTE: ${context.userInfo.name}
- TELEFONO CLIENTE: ${context.userInfo.clientId}
- FECHA PRIMER CONTACTO: ${new Date(context.userInfo.firstMessageDate).toLocaleString('es-AR')}
`
  }

  // Resumen general
  contextText += `📊 RESUMEN GENERAL:
- Total mensajes en las últimas 24h: ${context.summary.totalMessages}
${context.summary.currentStatus ? `- Status actual: ${context.summary.currentStatus}` : '- Status actual: No determinado'}
`

  // Leads activos
  if (context.activeLeads.length > 0) {
    contextText += `🎯 LEADS ACTIVOS:\n`
    context.activeLeads.forEach((lead, index) => {
      contextText += `${index + 1}. Lead ID: ${lead.leadId}
   - Creado: ${new Date(lead.createdAt).toLocaleString('es-AR')}
   ${lead.lastActivity ? `- Última actividad: ${new Date(lead.lastActivity).toLocaleString('es-AR')}` : ''}\n`
    })
    contextText += '\n'
  }

  // Conversaciones activas
  if (context.activeTasks.length > 0) {
    contextText += `💬 CONVERSACIONES ACTIVAS:\n`
    context.activeTasks.forEach((task, index) => {
      contextText += `${index + 1}. Talk ID: ${task.talkId}
   - En trabajo: ${task.isInWork ? 'Sí' : 'No'}
   - Leído: ${task.isRead ? 'Sí' : 'No'}
   - Creada: ${new Date(task.createdAt).toLocaleString('es-AR')}
   ${task.lastActivity ? `- Última actividad: ${new Date(task.lastActivity).toLocaleString('es-AR')}` : ''}\n`
    })
    contextText += '\n'
  }

  // Historial de mensajes recientes (últimos 10 para no sobrecargar)
  if (context.recentMessages.length > 0) {
    contextText += `💭 HISTORIAL DE MENSAJES RECIENTES:\n`
    const messagesToShow = context.recentMessages.slice(-10) // Últimos 10 mensajes
    messagesToShow.forEach((msg, index) => {
      const direction = msg.type === 'incoming' ? '→' : '←'
      contextText += `${index + 1}. [${new Date(msg.createdAt).toLocaleString('es-AR')}] ${direction} ${msg.authorName}: "${msg.text}"\n`
    })
    contextText += '\n'
  }

  // Historial de decisiones del bot
  if (context.botActions.length > 0) {
    contextText += `🤖 HISTORIAL DE DECISIONES DEL BOT:\n`
    context.botActions.slice(0, 5).forEach((action, index) => { // Últimas 5 decisiones
      contextText += `${index + 1}. Mensaje: "${action.messageText}"
   - Status anterior: ${action.aiDecision.currentStatus}
   - Status nuevo: ${action.aiDecision.newStatus}
   - ¿Cambió?: ${action.aiDecision.shouldChange ? 'Sí' : 'No'}
   - Confianza: ${(action.aiDecision.confidence * 100).toFixed(1)}%
   - Razón: ${action.aiDecision.reasoning}
   - Resultado: ${action.statusUpdateResult.success ? '✅ Exitoso' : '❌ Falló'}
   - Procesado: ${new Date(action.processingTimestamp).toLocaleString('es-AR')}\n\n`
    })
  }

  contextText += `🔍 INSTRUCCIONES PARA ANÁLISIS:
- ${settings?.message ? `Mensaje de bienvenida: [CODE] ${settings.message}` : ''}

- Si llega mensaje de bienvenida, cambia el status a "PidioUsuario".
- Si son mensajes repetidos, no cambies el status. El webhook envia repeticiones.
- Considera el historial para entender el contexto de la conversación
- Evalúa si el nuevo mensaje representa progreso o repetición
- Ten en cuenta el tiempo transcurrido y la frecuencia de mensajes

- ⚠️ NUNCA cambies a "Cargo", incluso si el cliente confirma transferencias o envía comprobantes
`
  return contextText
}

export async function processMessageWithAI(
  messageText: string,
  currentStatus: LeadStatus,
  talkId: string,
  contactContext?: ContactContext,
  rules?: Array<{ priority: number; rule: string }>,
  settings?: SettingsDocument | null | undefined,
  statuses?: StatusDocument[] | null,
  attachment?: {
    type: string;
    link: string;
    file_name: string;
  },
): Promise<AIDecision> {
  const systemMessage = `
  ${settings?.context ? `📌 CONTEXTO: ${settings.context}` : ''}
  
📌 ESTADOS DISPONIBLES PARA CAMBIOS:
- "sin-status": No se pudo obtener el status actual del lead, enviar a "Revisar".
${statuses ? statuses.map(s => `• ${s.name}: ${s.description}`).join('\n') : 'No hay statuses disponibles'}

📌 REGLAS DE DECISIÓN: Las prioridad 1 son las mas importantes y las 10 son las menos importantes.
${rules ? rules.map(r => `• Prioridad ${r.priority}: ${r.rule}`).join('\n') : 'No hay reglas adicionales configuradas'}

📌 EJEMPLOS RÁPIDOS:
- Cliente dice: "¿Me pasas el usuario?" → newStatus = "PidioUsuario"
- Cliente dice: "Pasame cuenta" → newStatus = "PidioCbuAlias"
- Cliente dice: "Hola" y ya estaba en "PidioCbuAlias" → mantener status
- Cliente dice: "Ya cargué $500" → **NO CAMBIAR A "Cargo"** → mantener status o cambiar a "Revisar"
- Cliente dice: "No voy a cargar nada, chau" → newStatus = "NoCargo"
- Cliente insulta o hace chistes sin sentido → newStatus = "NoAtender"
- Cliente envía comprobante de transferencia → **NO CAMBIAR A "Cargo"** → cambiar a "Revisar" para verificación manual
`
  const prompt =
  `
Analiza este mensaje de cliente:

Mensaje: "${messageText}"
Status actual: "${currentStatus}"
Talk ID: "${talkId}"
${attachment ? `Archivo adjunto: ${attachment.type} - ${attachment.file_name}` : ''}

${contactContext ? formatContactContext(contactContext, settings) : ''}

${attachment ? `
📎 CONSIDERACIONES PARA ARCHIVOS ADJUNTOS:
- Si el cliente envía una imagen, documento o archivo, probablemente es información relevante (comprobante, documento de identidad, etc.)
- Los archivos adjuntos suelen indicar que el cliente está avanzando en el proceso
- Si es un comprobante de pago, NO cambiar automáticamente a "Cargo" - enviar a "Revisar" para verificación manual
- Si es documentación solicitada, mantener el status actual o cambiar a uno apropiado según el contexto
` : ''}

Determina:
1. Si el status debe cambiar
2. A qué nuevo status (si aplica)
3. Tu razonamiento
4. Tu nivel de confianza (0-1)
      `

  try {
    // Log del prompt enviado a la AI
    logAiPromptSent(prompt, systemMessage)

    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema: aiDecisionSchema,
      system: systemMessage,
      prompt: prompt,
    })

    // Log de la respuesta de la AI
    logAiResponseReceived(object, object.confidence)

    return object
  } catch (error) {
    logAiProcessingError(error)

    // Fallback decision - si currentStatus es "Cargo", cambiar a "Revisar" para revisión manual
    const fallbackNewStatus: BotAssignableStatus = currentStatus === "Cargo" ? "Revisar" : currentStatus as BotAssignableStatus

    return {
      currentStatus,
      newStatus: fallbackNewStatus,
      shouldChange: false,
      reasoning: "Error en el procesamiento de IA, manteniendo status actual",
      confidence: 0,
    }
  }
}
