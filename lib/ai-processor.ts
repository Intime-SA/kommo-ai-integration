import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import type { LeadStatus, BotAssignableStatus, AIDecision } from "@/types/kommo"
import type { ContactContext } from "@/lib/mongodb-services"
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
function formatContactContext(context: ContactContext): string {
  let contextText = `📋 CONTEXTO HISTÓRICO DEL CONTACTO (Últimas 24 horas):\n\n`

  // Información del usuario
  if (context.userInfo) {
    contextText += `👤 INFORMACIÓN DEL USUARIO:
- Nombre: ${context.userInfo.name}
- ID Cliente: ${context.userInfo.clientId}
- Origen: ${context.userInfo.sourceName} (${context.userInfo.source})
- Primer mensaje: "${context.userInfo.firstMessage}"
- Fecha primer contacto: ${new Date(context.userInfo.firstMessageDate).toLocaleString('es-AR')}

`
  }

  // Resumen general
  contextText += `📊 RESUMEN GENERAL:
- Total mensajes en las últimas 24h: ${context.summary.totalMessages}
- Última actividad: ${new Date(context.summary.lastActivity).toLocaleString('es-AR')}
- Duración conversación: ${context.summary.conversationDuration}
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
- Considera el historial completo para entender el contexto de la conversación
- Evalúa si el nuevo mensaje representa progreso o repetición
- Ten en cuenta el tiempo transcurrido y la frecuencia de mensajes
- Si el cliente está repitiendo solicitudes, considera "NoCargo"
- Si hay progreso claro hacia una acción (pedir usuario, CBU), actualiza el status correspondiente
- ⚠️ NUNCA cambies a "Cargo", incluso si el cliente confirma transferencias o envía comprobantes

`

  return contextText
}

export async function processMessageWithAI(
  messageText: string,
  currentStatus: LeadStatus,
  talkId: string,
  contactContext?: ContactContext,
): Promise<AIDecision> {
  const systemMessage = `Eres un asistente de IA especializado en clasificar mensajes de clientes potenciales en un CRM (Kommo).

Tu objetivo es analizar mensajes ENTRANTES de clientes y decidir si corresponde cambiar el status del Lead.
El status refleja el punto en el flujo comercial/operativo en el que se encuentra el cliente.

⚠️  **IMPORTANTE - RESTRICCIÓN CRÍTICA**: NUNCA, BAJO NINGUNA CIRCUNSTANCIA, puedes cambiar el status a "Cargo".
Esto incluye:
- Mensajes confirmando transferencias realizadas
- Comprobantes de pago enviados
- Cualquier confirmación de carga exitosa
- Mensajes que indiquen que ya transfirieron el dinero
El status "Cargo" SOLO puede ser establecido por procesos manuales o sistemas externos, NUNCA por este bot.

📌 ESTADOS DISPONIBLES PARA CAMBIOS:
- "sin-status": No se pudo obtener el status actual del lead, enviar a "Revisar".
- "Revisar": Cliente con dudas, preguntas o solicitudes que no están contempladas en los botones del menú principal. Aquí requiere intervención manual de un operador/agente humano.
- "PidioUsuario": Cliente potencial solicita un usuario/credencial para ingresar al sistema. La automatización se lo entrega y luego pasa a seguimiento.
- "PidioCbuAlias": Cliente solicita información bancaria (CBU o alias) para hacer una transferencia. Luego espera acción del operador para verificar si el cliente avanza (envío de comprobante, carga, etc.).
- "NoCargo": Cliente que lleva tiempo sin cargar, o que envía mensajes repetitivos sin concretar acción. También puede aplicar cuando solo interactúa sin intención clara de avanzar.
- "NoAtender": Cliente no calificado: niños, bromistas, molestos, vulgares, o comportamientos inapropiados. Debe marcarse para que el equipo no pierda tiempo.

📌 REGLAS DE DECISIÓN:
1. Analiza siempre el contenido literal del mensaje, pero también el contexto del status actual del Lead.
2. Solo cambia el status si hay una razón clara y específica en el mensaje (ejemplo: pide usuario, pide CBU).
3. Si el mensaje no aporta información nueva, mantiene el status actual.
4. El status "Revisar" es un comodín para consultas fuera del flujo automático: dudas, preguntas generales, etc.
5. El status "NoCargo" se aplica cuando hay inacción prolongada o mensajes que no generan avance (aunque sean educados).
6. El status "No atender" se aplica solo a casos claros de clientes no deseados (tóxicos, niños, vulgares, trolls).
7. **NUNCA** cambies a "Cargo", independientemente del mensaje recibido.
8. Si un cliente confirma que ya realizó una transferencia, mantén el status actual o cambia a "Revisar" para verificación manual.
9. Tu razonamiento debe explicar con precisión por qué cambias o mantienes el status.
10. Responde siempre en español.

📌 EJEMPLOS RÁPIDOS:
- Cliente dice: "¿Me pasas el usuario?" → newStatus = "PidioUsuario"
- Cliente dice: "Pasame cuenta" → newStatus = "PidioCbuAlias"
- Cliente dice: "Hola" y ya estaba en "PidioCbuAlias" → mantener status
- Cliente dice: "Ya cargué $500" → **NO CAMBIAR A "Cargo"** → mantener status o cambiar a "Revisar"
- Cliente dice: "No voy a cargar nada, chau" → newStatus = "NoCargo"
- Cliente insulta o hace chistes sin sentido → newStatus = "NoAtender"
- Cliente envía comprobante de transferencia → **NO CAMBIAR A "Cargo"** → cambiar a "Revisar" para verificación manual
`

  const prompt = `
Analiza este mensaje de cliente:

Mensaje: "${messageText}"
Status actual: "${currentStatus}"
Talk ID: "${talkId}"

${contactContext ? formatContactContext(contactContext) : ''}

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
