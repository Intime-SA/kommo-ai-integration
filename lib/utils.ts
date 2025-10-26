import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { STATUS_MAPPING } from "./constants"
import { getLeadInfo, KommoApiConfig } from "./kommo-api"
import { updateLeadStatus } from "./kommo-api"
import { KOMMO_CONFIG } from "./kommo-config"
import { NextResponse } from "next/server"
import { findContactById, findLeadById } from "./mongodb-services"
import { getContactInfo } from "./kommo-api"
import { createContactFromKommoApi } from "./mongodb-services"
import { createLeadFromKommoApi } from "./mongodb-services"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


// Helper function to get status ID by name
export function getStatusId(statusName: keyof typeof STATUS_MAPPING): string {
  return STATUS_MAPPING[statusName] || ""
}

// Helper function to update lead status by name
export async function updateLeadStatusByName(
  leadId: string,
  statusName: keyof typeof STATUS_MAPPING,
  config: KommoApiConfig
): Promise<boolean> {
  const statusId = getStatusId(statusName)
  return updateLeadStatus(leadId, statusId, config)
}

// Helper function to get status name by ID
export function getStatusName(statusId: string): keyof typeof STATUS_MAPPING | null {
  for (const [name, id] of Object.entries(STATUS_MAPPING)) {
    if (id === statusId) {
      return name as keyof typeof STATUS_MAPPING
    }
  }
  return null
}

// Función helper para obtener fecha hace N horas
export function getDateHoursAgo(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}

// Función helper para obtener fecha actual
export function getCurrentDate(): string {
  return new Date().toISOString();
}

// Utilidad para convertir fechas al formato ISO string en horario Argentina
export function convertToArgentinaISO(ts: string | number): string {
  // Convertir a número si viene como string
  const timestamp = typeof ts === "string" ? Number(ts) : ts;

  // Timestamp en segundos (como viene de la API de Kommo)
  const dUTC = new Date(timestamp * 1000);

  // Crear fecha ajustada restando el offset de Argentina
  const dAR = new Date(dUTC.getTime() - 3 * 60 * 60 * 1000); // Restar 3 horas

  // Retornar la fecha en formato ISO string en horario Argentina
  return dAR.toISOString();
}

// Función helper para obtener la fecha actual en Argentina ISO
export function getCurrentArgentinaISO(): string {
  // Crear fecha actual en horario UTC
  const now = new Date();

  // Crear fecha ajustada restando 3 horas (Argentina offset)
  const dAR = new Date(now.getTime() - 3 * 60 * 60 * 1000);

  return dAR.toISOString();
}

// Función helper para convertir una fecha ISO a zona horaria de Argentina
  // Si la fecha ya está en zona Argentina (como los datos almacenados),
  // devolverla tal cual. Si viene del frontend, asumir que está en UTC y convertir.
  // Para consultas, asumir que las fechas del frontend están en zona local/UTC
  // y convertirlas a zona Argentina para comparar con los datos almacenados.
  // Los datos se almacenan como: new Date().toISOString() pero restando 3 horas
  // Para consultas, si el usuario envía "2025-09-12T15:18:00.000Z",
  // necesitamos convertirlo a zona Argentina: restar 3 horas
export function convertToArgentinaTime(dateString: string): Date {
  const date = new Date(dateString);
  return new Date(date.getTime() - 3 * 60 * 60 * 1000);
}

// Función utilitaria para extraer código de un mensaje
export function extractCodeFromMessage(messageText: string): string | null {
  // Patrón para buscar códigos generados por nanoid (incluyen guiones y caracteres especiales)
  // Busca patrones como "Descuento: Nv5M-ilY.", "Código: AbCdEfGh-" o "Promocion: oowMSNzI."
  const codePattern =
    /(?:descuento|codigo|código|token|promocion|promoción)\s*:\s*([A-Za-z0-9_-]{1,21})\.?/i;
  const match = messageText.match(codePattern);
  console.log("Match del patrón principal:", match);
  if (match && match[1]) {
    return match[1];
  }

  // También buscar códigos sueltos generados por nanoid
  // nanoid por defecto genera 21 caracteres, pero podemos buscar patrones más cortos también
  const looseCodePatterns = [
    /\b([A-Za-z0-9_-]{8,21})\b/, // Códigos de 8-21 caracteres con guiones
    /\b([A-Za-z0-9_-]{1,21})\b/, // Códigos de 1-21 caracteres con guiones
  ];

  for (const pattern of looseCodePatterns) {
    const looseMatch = messageText.match(pattern);
    console.log("Match del patrón suelto:", looseMatch);
    if (looseMatch && looseMatch[1]) {
      return looseMatch[1];
    }
  }

  return null;
}

// Función helper para convertir fecha a UTC (restando 3 horas para Argentina)
export function convertToUTC(date: Date): Date {
  return new Date(date.getTime() - 3 * 60 * 60 * 1000);
}

export async function getPipelineIdFromLeadId(tempWebhookData: any): Promise<string | null> {
  // Primero intentar con leadIds de leads, luego con messageLeadIds de messages
  const leadIdSource =
    tempWebhookData.leadIds && tempWebhookData.leadIds.length > 0
      ? tempWebhookData.leadIds[0]
      : tempWebhookData.messageLeadIds &&
        tempWebhookData.messageLeadIds.length > 0
      ? tempWebhookData.messageLeadIds[0]
      : null;

  if (leadIdSource) {
    console.log(
      `🔍 Pipeline ID no encontrado en webhook, consultando API para lead ${leadIdSource}...`
    );

    try {
      const config: KommoApiConfig = {
        subdomain: KOMMO_CONFIG.subdomain || "",
      };

      if (!config.subdomain) {
        console.error(
          "❌ KOMMO_SUBDOMAIN no configurado para validación de pipeline"
        );
        return null;
      }

      const leadInfo = await getLeadInfo(leadIdSource, config);
      if (leadInfo && leadInfo.pipeline_id) {
        return leadInfo.pipeline_id.toString();
      }
    } catch (error) {
      return null;
    }
  }
  return null;
}

// Función helper para sincronizar lead y contacto desde API de Kommo
export default async function syncLeadAndContactFromKommoApi(
  leadId: string,
  contactId: string
) {
  try {
    const config: KommoApiConfig = {
      subdomain: KOMMO_CONFIG.subdomain || "",
    };

    if (!config.subdomain) {
      console.error("❌ KOMMO_SUBDOMAIN no configurado para sincronización");
      return;
    }

    // Verificar si el lead existe localmente
    const existingLead = await findLeadById(leadId);
    let leadData = null;

    if (!existingLead) {
      console.log(
        `🔄 Lead ${leadId} no existe localmente, obteniendo desde API de Kommo...`
      );
      leadData = await getLeadInfo(leadId, config);

      if (leadData) {
        // Verificar si el contacto existe localmente
        const existingContact = await findContactById(contactId);
        let contactData = null;

        if (!existingContact) {
          console.log(
            `🔄 Contacto ${contactId} no existe localmente, obteniendo desde API de Kommo...`
          );
          contactData = await getContactInfo(contactId, config);

          if (contactData) {
            // Crear contacto
            await createContactFromKommoApi(contactData);
          }
        }

        // Crear lead
        await createLeadFromKommoApi(leadData, contactData);
      }
    } else {
      console.log(`✅ Lead ${leadId} ya existe localmente`);
    }

    // Verificar si el contacto existe (por si acaso)
    const existingContact = await findContactById(contactId);
    if (!existingContact) {
      console.log(
        `🔄 Contacto ${contactId} no existe localmente, obteniendo desde API de Kommo...`
      );
      const contactData = await getContactInfo(contactId, config);

      if (contactData) {
        await createContactFromKommoApi(contactData);
      }
    } else {
      console.log(`✅ Contacto ${contactId} ya existe localmente`);
    }
  } catch (error) {
    console.error(
      "❌ Error al sincronizar lead y contacto desde API de Kommo:",
      error
    );
  }
}
