// Utility functions for interacting with Kommo API
// You'll need to implement these based on your Kommo API credentials

import {
  logLeadInfoSuccess,
  logKommoApiError,
  logLeadStatusNotFound,
  logLeadStatusFound
} from "./logger"

export interface KommoApiConfig {
  subdomain: string
}

const ACCESS_TOKEN = process.env.KOMMO_ACCESS_TOKEN

export async function updateLeadStatus(leadId: string, newStatusId: string, config: KommoApiConfig): Promise<boolean> {
  try {
    const response = await fetch(`https://${config.subdomain}.kommo.com/api/v4/leads/${leadId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status_id: parseInt(newStatusId),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to update lead status: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    logLeadInfoSuccess(result)
    return true
  } catch (error) {
    logKommoApiError("updateLeadStatus", error)
    return false
  }
}

export async function getLeadInfo(leadId: string, config: KommoApiConfig): Promise<any> {
  try {
    const response = await fetch(`https://${config.subdomain}.kommo.com/api/v4/leads/${leadId}`, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to get lead info: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    logKommoApiError("getLeadInfo", error)
    return null
  }
}

// Pipeline configuration
export const PIPELINE_CONFIG = {
  id: "11862040",
  name: "Embudo de ventas",
} as const

// Status ID mapping - configured based on your Kommo pipeline
export const STATUS_MAPPING = {
  Revisar: "91366623",
  PidioUsuario: "91366607",
  PidioCbuAlias: "91366611",
  Cargo: "91366615",
  NoCargo: "91366627",
  NoAtender: "91366619",
  Seguimiento: "91366631",
  Ganado: "142",
  Perdido: "143",
} as const

// Helper function to get status ID by name
export function getStatusId(statusName: keyof typeof STATUS_MAPPING): string {
  return STATUS_MAPPING[statusName]
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

// Function to get current lead status
export async function getCurrentLeadStatus(leadId: string, config: KommoApiConfig): Promise<keyof typeof STATUS_MAPPING | null> {
  try {
    const leadInfo = await getLeadInfo(leadId, config)

    if (!leadInfo || !leadInfo.status_id) {
      logLeadStatusNotFound(leadId)
      return null
    }

    const statusName = getStatusName(leadInfo.status_id.toString())
    logLeadStatusFound(leadId, statusName, leadInfo.status_id.toString())

    return statusName
  } catch (error) {
    logKommoApiError("getCurrentLeadStatus", error, leadId)
    return null
  }
}
