// Utility functions for interacting with Kommo API
// You'll need to implement these based on your Kommo API credentials

import {
  logLeadInfoSuccess,
  logKommoApiError,
  logLeadStatusNotFound,
  logLeadStatusFound,
  logOutgoingHttpRequest,
  logIncomingHttpResponse,
  logHttpError
} from "./logger"

export interface KommoApiConfig {
  subdomain: string
}

const ACCESS_TOKEN = process.env.KOMMO_ACCESS_TOKEN

export async function updateLeadStatus(leadId: string, newStatusId: string, config: KommoApiConfig): Promise<boolean> {
  const startTime = Date.now()
  const url = `https://${config.subdomain}.kommo.com/api/v4/leads/${leadId}`
  const requestBody = { status_id: parseInt(newStatusId) }

  try {
    // Log de petición saliente
    logOutgoingHttpRequest("PATCH", url, {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    }, requestBody)

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    const responseTime = Date.now() - startTime
    const responseText = await response.text()

    // Log de respuesta
    logIncomingHttpResponse(response.status, response.statusText, responseText, responseTime)

    if (!response.ok) {
      throw new Error(`Failed to update lead status: ${response.status} ${response.statusText} - ${responseText}`)
    }

    const result = JSON.parse(responseText)
    logLeadInfoSuccess(result)
    return true
  } catch (error) {
    const responseTime = Date.now() - startTime
    logHttpError("updateLeadStatus", error, url)
    logKommoApiError("updateLeadStatus", error)
    return false
  }
}

export async function updateLeadCustomFields(leadId: string, customFieldsValues: any[], config: KommoApiConfig): Promise<boolean> {
  const startTime = Date.now()
  const url = `https://${config.subdomain}.kommo.com/api/v4/leads/${leadId}`
  const requestBody = { custom_fields_values: customFieldsValues }

  try {
    // Log de petición saliente
    logOutgoingHttpRequest("PATCH", url, {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    }, requestBody)

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    const responseTime = Date.now() - startTime
    const responseText = await response.text()

    // Log de respuesta
    logIncomingHttpResponse(response.status, response.statusText, responseText, responseTime)

    if (!response.ok) {
      throw new Error(`Failed to update lead custom fields: ${response.status} ${response.statusText} - ${responseText}`)
    }

    const result = JSON.parse(responseText)
    logLeadInfoSuccess(result)
    return true
  } catch (error) {
    const responseTime = Date.now() - startTime
    logHttpError("updateLeadCustomFields", error, url)
    logKommoApiError("updateLeadCustomFields", error)
    return false
  }
}

export async function getLeadInfo(leadId: string, config: KommoApiConfig): Promise<any> {
  const startTime = Date.now()
  const url = `https://${config.subdomain}.kommo.com/api/v4/leads/${leadId}`

  try {
    // Log de petición saliente
    logOutgoingHttpRequest("GET", url, {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    })

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    })

    const responseTime = Date.now() - startTime
    const responseText = await response.text()

    // Log de respuesta
    logIncomingHttpResponse(response.status, response.statusText, responseText, responseTime)

    if (!response.ok) {
      throw new Error(`Failed to get lead info: ${response.status} ${response.statusText} - ${responseText}`)
    }

    const result = JSON.parse(responseText)
    return result
  } catch (error) {
    const responseTime = Date.now() - startTime
    logHttpError("getLeadInfo", error, url)
    logKommoApiError("getLeadInfo", error)
    return null
  }
}

export async function getContactInfo(contactId: string, config: KommoApiConfig): Promise<any> {
  const startTime = Date.now()
  const url = `https://${config.subdomain}.kommo.com/api/v4/contacts/${contactId}`

  try {
    // Log de petición saliente
    logOutgoingHttpRequest("GET", url, {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    })

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    })

    const responseTime = Date.now() - startTime
    const responseText = await response.text()

    // Log de respuesta
    logIncomingHttpResponse(response.status, response.statusText, responseText, responseTime)

    if (!response.ok) {
      throw new Error(`Failed to get contact info: ${response.status} ${response.statusText} - ${responseText}`)
    }

    const result = JSON.parse(responseText)
    return result
  } catch (error) {
    const responseTime = Date.now() - startTime
    logHttpError("getContactInfo", error, url)
    logKommoApiError("getContactInfo", error)
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
