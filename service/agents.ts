import {
  AIDecision,
  ContactContext,
  LeadStatus,
  SettingsDocument,
  StatusDocument,
} from "@/types/kommo";

async function processMessageWithAI(
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
  }
): Promise<AIDecision> {
  try {
    const iaDecision = await fetch(
      `${process.env.NEXT_PUBLIC_API_AGENTS}/api/agents/sales`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageText,
          currentStatus,
          talkId,
          contactContext,
          rules,
          settings,
          statuses,
          attachment,
        }),
      }
    );

    if (!iaDecision.ok) {
      throw new Error(
        `Error en la API externa: ${iaDecision.status} ${iaDecision.statusText}`
      );
    }

    const decision: AIDecision = await iaDecision.json();
    return decision;
  } catch (error) {
    console.error("Error procesando mensaje con AI:", error);
    throw error;
  }
}

interface Attachment {
  type: string;
  link: string;
  file_name: string;
}

async function processImageWithAIByLeadId(
  attachment: Attachment
): Promise<any> {
  try {
    const imageResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_AGENTS}/api/agents/payments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attachment: attachment,
        }),
      }
    );

    if (!imageResponse.ok) {
      throw new Error(
        `Error en la API externa: ${imageResponse.status} ${imageResponse.statusText}`
      );
    }

    const result = await imageResponse.json();
    return result;
  } catch (error) {
    console.error("Error procesando imagen con AI:", error);
    throw error;
  }
}

export { processMessageWithAI, processImageWithAIByLeadId };
