// Utility functions for interacting with Kommo API
// You'll need to implement these based on your Kommo API credentials

import { STATUS_MAPPING } from "./constants"
import { KOMMO_CONFIG, USER_REGISTRATION_CONFIG } from "./kommo-config"
import {
  logLeadInfoSuccess,
  logKommoApiError,
  logLeadStatusNotFound,
  logLeadStatusFound,
  logOutgoingHttpRequest,
  logIncomingHttpResponse,
  logHttpError,
  logger
} from "./logger"
import { getStatusName } from "./utils"

export interface KommoApiConfig {
  subdomain: string
}

const ACCESS_TOKEN = KOMMO_CONFIG.accessToken

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
  logger.info(JSON.stringify(requestBody), "requestBody")

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

export async function updateLeadName(leadId: string, newName: string, config: KommoApiConfig): Promise<boolean> {
  const startTime = Date.now()
  const url = `https://${config.subdomain}.kommo.com/api/v4/leads/${leadId}`
  const requestBody = { name: newName }

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
      throw new Error(`Failed to update lead name: ${response.status} ${response.statusText} - ${responseText}`)
    }

    const result = JSON.parse(responseText)
    logLeadInfoSuccess(result)
    return true
  } catch (error) {
    const responseTime = Date.now() - startTime
    logHttpError("updateLeadName", error, url)
    logKommoApiError("updateLeadName", error)
    return false
  }
}

export async function getLeadInfo(leadId: string, config: KommoApiConfig): Promise<any> {
  const startTime = Date.now()
  const url = `https://${config.subdomain}.kommo.com/api/v4/leads/${leadId}?with=contacts`

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
    logKommoApiError("getCurrentLeadStatus()", error, leadId)
    return null
  }
}

// Generate username from contact name and ID
export function generateUsername(contactName: string, contactId: number): string {
  // Take first 3 letters of contact name, remove spaces and special characters
  const cleanName = contactName.replace(/[^a-zA-Z]/g, '').toLowerCase()
  const firstThreeLetters = cleanName.substring(0, 3).padEnd(3, 'x') // Pad with 'x' if name is shorter than 3 chars

  // Take first 3 characters of contactId as string
  const contactIdStr = contactId.toString()
  const firstThreeContactId = contactIdStr.substring(0, 3).padEnd(3, '0') // Pad with '0' if contactId is shorter than 3 chars

  // Generate 1 random number (0-9)
  const randomNum = Math.floor(Math.random() * 10).toString()

  // Combine: 3 letters from name + 3 chars from contactId + 1 random number + 'g' = exactly 8 characters
  const username = `${firstThreeLetters}${firstThreeContactId}${randomNum}g`

  return username
}

// Register user in external API
export async function registerUser(username: string, platform: string, parentId?: string): Promise<any> {
  const startTime = Date.now()

  // Find the platform configuration
  const platformConfig = USER_REGISTRATION_CONFIG.platform.find(p => p.name === platform)
  if (!platformConfig) {
    throw new Error(`Platform '${platform}' not found in configuration`)
  }

  const url = platformConfig.apiUrl || ""

  const requestBody = {
    parent_id: platformConfig.parentId || parentId,
    username: username,
    password: "123456",
    token: platformConfig.token,
  }

  try {
    // Log de petición saliente
    logOutgoingHttpRequest("POST", url, {
      "Content-Type": "application/json",
    }, requestBody)

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    const responseTime = Date.now() - startTime
    const responseText = await response.text()

    // Log de respuesta
    logIncomingHttpResponse(response.status, response.statusText, responseText, responseTime)

    // If the response is not ok, throw an error
    if (!response.ok) {
      throw new Error(`Failed to register user: ${response.status} ${response.statusText} - ${responseText}`)
    }

    // Parse the response
    const result = JSON.parse(responseText)
    return result
  } catch (error) {
    logHttpError("registerUser", error, url)
    throw error
  }
}

// Function to register user with retry logic
export async function registerUserWithRetry(baseUsername: string, maxRetries: number = 2, platform: string = 'greenBet'): Promise<any> {
  let currentUsername = baseUsername;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔐 Attempting user registration (attempt ${attempt + 1}/${maxRetries + 1}) with username: ${currentUsername} for platform: ${platform}`);
      const result = await registerUser(currentUsername, platform);
      console.log(`✅ User registration successful on attempt ${attempt + 1} with username: ${currentUsername}`);
      return result;
    } catch (error) {
      console.warn(`❌ User registration failed on attempt ${attempt + 1} for username: ${currentUsername}`, error);

      // If this is not the last attempt, generate a new username with random number
      if (attempt < maxRetries) {
        // Generate random number (1-99) and ensure total length doesn't exceed 8 characters
        const randomNum = Math.floor(Math.random() * 99) + 1;
        const randomSuffix = randomNum.toString();

        // Calculate available space for base username (max 8 - length of random suffix)
        const maxBaseLength = 8 - randomSuffix.length;
        const truncatedBase = currentUsername.length > maxBaseLength
          ? currentUsername.substring(0, maxBaseLength)
          : currentUsername;

        currentUsername = truncatedBase + randomSuffix;
        console.log(`🔄 Retrying with modified username: ${currentUsername}`);
      } else {
        // Last attempt failed, throw the error
        console.error(`❌ All registration attempts failed for base username: ${baseUsername}`);
        throw error;
      }
    }
  }
}

// Complete user creation process
export async function createUserFromLead(leadId: string, config: KommoApiConfig, platform: 'greenBet' | 'moneyMaker' ): Promise<any> {
  try {

    // 1. Get lead information
    const leadInfo = await getLeadInfo(leadId, config)
    if (!leadInfo) {
      throw new Error(`Could not get lead info for lead ${leadId}`)
    }

    // 2. Extract contact ID from lead
    const contacts = leadInfo._embedded?.contacts
    if (!contacts || contacts.length === 0) {
      throw new Error(`No contacts found for lead ${leadId}`)
    }

    // 2. Get main contact
    const mainContact = contacts.find((contact: any) => contact.is_main) || contacts[0]
    const contactId = mainContact.id

    // 3. Get contact information
    const contactInfo = await getContactInfo(contactId.toString(), config)
    if (!contactInfo) {
      throw new Error(`Could not get contact info for contact ${contactId}`)
    }

    // 4. Generate username
    const username = generateUsername(contactInfo.name, contactInfo.id)
    console.log(`👤 Generated username: ${username}`)

    // 5. Register user in external API with retry logic
    console.log(`🔐 Registering user ${username} with retry logic for platform: ${platform}`)
    const registrationResult = await registerUserWithRetry(username, 2, platform)

    console.log(`✅ User creation completed successfully for lead ${leadId}`)
    return {
      leadId,
      contactId,
      username,
      registrationResult,
      contactInfo,
      leadInfo
    }

  } catch (error) {
    console.error(`❌ Error in user creation process for lead ${leadId}:`, error)
    throw error
  }
}
