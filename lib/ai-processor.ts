import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import type { LeadStatus, AIDecision } from "@/types/kommo"
import { logAiProcessingError, logAiPromptSent, logAiResponseReceived } from "./logger"

const aiDecisionSchema = z.object({
  currentStatus: z.enum(["Revisar", "PidioUsuario", "PidioCbuAlias", "Cargo", "NoCargo", "NoAtender"]),
  newStatus: z.enum(["Revisar", "PidioUsuario", "PidioCbuAlias", "Cargo", "NoCargo", "NoAtender"]),
  shouldChange: z.boolean(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
})

export async function processMessageWithAI(
  messageText: string,
  currentStatus: LeadStatus,
  talkId: string,
): Promise<AIDecision> {
  const systemMessage = `Eres un asistente de IA especializado en clasificar mensajes de clientes potenciales en un CRM (Kommo).

Tu objetivo es analizar mensajes ENTRANTES de clientes y decidir si corresponde cambiar el status del Lead.
El status refleja el punto en el flujo comercial/operativo en el que se encuentra el cliente.

📌 ESTADOS DISPONIBLES:
- "Revisar": Cliente con dudas, preguntas o solicitudes que no están contempladas en los botones del menú principal. Aquí requiere intervención manual de un operador/agente humano.
- "PidioUsuario": Cliente potencial solicita un usuario/credencial para ingresar al sistema. La automatización se lo entrega y luego pasa a seguimiento.
- "PidioCbuAlias": Cliente solicita información bancaria (CBU o alias) para hacer una transferencia. Luego espera acción del operador para verificar si el cliente avanza (envío de comprobante, carga, etc.).
- "Cargo": Cliente confirma o demuestra que realizó una primera carga de dinero exitosa.
- "NoCargo": Cliente que lleva tiempo sin cargar, o que envía mensajes repetitivos sin concretar acción. También puede aplicar cuando solo interactúa sin intención clara de avanzar.
- "NoAtender": Cliente no calificado: niños, bromistas, molestos, vulgares, o comportamientos inapropiados. Debe marcarse para que el equipo no pierda tiempo.

📌 REGLAS DE DECISIÓN:
1. Analiza siempre el contenido literal del mensaje, pero también el contexto del status actual del Lead.
2. Solo cambia el status si hay una razón clara y específica en el mensaje (ejemplo: pide usuario, envía comprobante, pide CBU).
3. Si el mensaje no aporta información nueva, mantiene el status actual.
4. El status "Revisar" es un comodín para consultas fuera del flujo automático: dudas, preguntas generales, etc.
5. El status "NoCargo" se aplica cuando hay inacción prolongada o mensajes que no generan avance (aunque sean educados).
6. El status "No atender" se aplica solo a casos claros de clientes no deseados (tóxicos, niños, vulgares, trolls).
7. Tu razonamiento debe explicar con precisión por qué cambias o mantienes el status.
8. Responde siempre en español.

📌 EJEMPLOS RÁPIDOS:
- Cliente dice: "¿Me pasas el usuario?" → newStatus = "PidioUsuario"
- Cliente dice: "Pasame cuenta" → newStatus = "PidioCbuAlias"
- Cliente envía: "Ya cargué $500" → newStatus = "Cargo"
- Cliente dice: "Hola" y ya estaba en "PidioCbuAlias" → mantener status
- Cliente dice: "No voy a cargar nada, chau" → newStatus = "NoCargo"
- Cliente insulta o hace chistes sin sentido → newStatus = "NoAtender"
`

  const prompt = `
Analiza este mensaje de cliente:

Mensaje: "${messageText}"
Status actual: "${currentStatus}"
Talk ID: "${talkId}"

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

    // Fallback decision
    return {
      currentStatus,
      newStatus: currentStatus,
      shouldChange: false,
      reasoning: "Error en el procesamiento de IA, manteniendo status actual",
      confidence: 0,
    }
  }
}
