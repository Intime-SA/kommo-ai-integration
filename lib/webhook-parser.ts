import type { KommoWebhookData } from "@/types/kommo"

export interface WebhookMetadata {
  pipelineIds?: string[];
  leadIds?: string[];
  messageLeadIds?: string[];
}

export function extractWebhookMetadata(formData: URLSearchParams): WebhookMetadata {
  const metadata: WebhookMetadata = {};

  // Extraer datos básicos del form para validación de pipeline
  for (const [key, value] of formData.entries()) {
    // Extraer pipeline_id de leads (add, status, delete)
    if (key.includes("leads[") && key.includes("[pipeline_id]")) {
      if (!metadata.pipelineIds) {
        metadata.pipelineIds = [];
      }
      metadata.pipelineIds.push(value);
    }
    // Extraer lead_id o entity_id de leads para consultar API si no hay pipeline_id
    if (
      key.includes("leads[") &&
      (key.includes("[id]") || key.includes("[entity_id]"))
    ) {
      if (!metadata.leadIds) {
        metadata.leadIds = [];
      }
      metadata.leadIds.push(value);
    }
    // Extraer lead_id de messages (element_id o entity_id) para consultar API
    if (
      key.includes("message[") &&
      (key.includes("[element_id]") || key.includes("[entity_id]"))
    ) {
      if (!metadata.messageLeadIds) {
        metadata.messageLeadIds = [];
      }
      metadata.messageLeadIds.push(value);
    }
  }

  return metadata;
}

export function parseWebhookFormData(formData: URLSearchParams): Partial<KommoWebhookData> {
  const webhookData: Partial<KommoWebhookData> = {}

  // Parse the form data into our structure
  for (const [key, value] of formData.entries()) {

    if (key.includes("message[add][0]")) {
      if (!webhookData.message) {
        webhookData.message = { add: [{ id: "", chat_id: "", talk_id: "", contact_id: "", text: "", created_at: "", element_type: "", entity_type: "", element_id: "", entity_id: "", type: "incoming", author: { id: "", type: "", name: "" }, attachment: { type: "", link: "", file_name: "" } }] }
      }

      const field = key.replace("message[add][0][", "").replace("]", "")
      if (field.includes("[")) {
        // Handle nested fields like author[name]
        const [parentField, childField] = field.split("[")
        const cleanChildField = childField.replace("]", "")

        if (!webhookData.message.add[0][parentField as keyof (typeof webhookData.message.add)[0]]) {
          ;(webhookData.message.add[0] as any)[parentField] = {}
        }
        ;(webhookData.message.add[0] as any)[parentField][cleanChildField] = value
      } else {
        ;(webhookData.message.add[0] as any)[field] = value
      }
    }

    if (key.includes("talk[add][0]")) {
      if (!webhookData.talk) {
        webhookData.talk = { add: [{ talk_id: "", created_at: "", updated_at: "", rate: "", contact_id: "", chat_id: "", entity_id: "", entity_type: "", is_in_work: "", is_read: "", origin: "" }] }
      }

      const field = key.replace("talk[add][0][", "").replace("]", "")
      if (webhookData.talk.add) {
        ;(webhookData.talk.add[0] as any)[field] = value
      }
    }

    if (key.includes("talk[update][0]")) {
      if (!webhookData.talk) {
        webhookData.talk = { update: [{ talk_id: "", created_at: "", updated_at: "", rate: "", contact_id: "", chat_id: "", entity_id: "", entity_type: "", is_in_work: "", is_read: "", origin: "" }] }
      }
      if (!webhookData.talk.update) {
        webhookData.talk.update = [{ talk_id: "", created_at: "", updated_at: "", rate: "", contact_id: "", chat_id: "", entity_id: "", entity_type: "", is_in_work: "", is_read: "", origin: "" }]
      }

      const field = key.replace("talk[update][0][", "").replace("]", "")
      ;(webhookData.talk.update[0] as any)[field] = value
    }

    if (key.includes("account[")) {
      if (!webhookData.account) {
        webhookData.account = {} as any
      }

      const field = key.replace("account[", "").replace("]", "")
      if (webhookData.account) {
        if (field === "_links][self") {
          if (!webhookData.account._links) {
            webhookData.account._links = {} as any
          }
          webhookData.account._links.self = value
        } else {
          ;(webhookData.account as any)[field] = value
        }
      }
    }

    if (key.includes("leads[add][0]")) {
      if (!webhookData.leads) {
        (webhookData as any).leads = { add: [{ id: "", name: "", status_id: "", responsible_user_id: "", created_user_id: "", date_create: "", pipeline_id: "", account_id: "", created_at: "" }] }
      }
      if (!(webhookData as any).leads.add) {
        (webhookData as any).leads.add = [{ id: "", name: "", status_id: "", responsible_user_id: "", created_user_id: "", date_create: "", pipeline_id: "", account_id: "", created_at: "" }]
      }

      const field = key.replace("leads[add][0][", "").replace("]", "")
      if ((webhookData as any).leads.add) {
        ;((webhookData as any).leads.add[0] as any)[field] = value
      }
    }

    if (key.includes("leads[status][0]")) {
      if (!webhookData.leads) {
        webhookData.leads = { status: [{ id: "", name: "", status_id: "", old_status_id: "", responsible_user_id: "", last_modified: "", modified_user_id: "", created_user_id: "", date_create: "", pipeline_id: "", account_id: "", created_at: "", updated_at: "" }] }
      }

      const field = key.replace("leads[status][0][", "").replace("]", "")
      if (webhookData.leads.status) {
        ;(webhookData.leads.status[0] as any)[field] = value
      }
    }

    if (key.includes("leads[delete][0]")) {
      if (!webhookData.leads) {
        webhookData.leads = { delete: [{ id: "", status_id: "", pipeline_id: "" }] }
      }
      if (!webhookData.leads.delete) {
        webhookData.leads.delete = [{ id: "", status_id: "", pipeline_id: "" }]
      }

      const field = key.replace("leads[delete][0][", "").replace("]", "")
      ;(webhookData.leads.delete[0] as any)[field] = value
    }

    if (key.includes("unsorted[add][0]")) {
      if (!webhookData.unsorted) {
        webhookData.unsorted = {
          add: [{
            uid: "",
            source: "",
            source_uid: "",
            category: "",
            source_data: {
              from: "",
              name: "",
              to: "",
              date: "",
              service: "",
              site: "",
              client: { name: "", id: "" },
              origin: { provider: "", chat_id: "" },
              data: [{ id: "", manager: "", date: "", text: "" }],
              source_uid: "",
              source: "",
              source_name: ""
            },
            date_create: "",
            data: { contacts: [{ id: "" }] },
            pipeline_id: "",
            account_id: "",
            source_id: "",
            lead_id: "",
            created_at: ""
          }]
        }
      }

      const field = key.replace("unsorted[add][0][", "").replace("]", "")

      if (webhookData.unsorted.add) {
        if (field.includes("source_data[")) {
          if (!webhookData.unsorted.add[0].source_data) {
            webhookData.unsorted.add[0].source_data = {
              from: "",
              name: "",
              to: "",
              date: "",
              service: "",
              site: "",
              client: { name: "", id: "" },
              origin: { provider: "", chat_id: "" },
              data: [{ id: "", manager: "", date: "", text: "" }],
              source_uid: "",
              source: "",
              source_name: ""
            }
          }

          const sourceField = field.replace("source_data[", "").replace("]", "")
          if (sourceField.includes("client[")) {
            const clientField = sourceField.replace("client[", "").replace("]", "")
            if (!webhookData.unsorted.add[0].source_data.client) {
              webhookData.unsorted.add[0].source_data.client = { name: "", id: "" }
            }
            ;(webhookData.unsorted.add[0].source_data.client as any)[clientField] = value
          } else if (sourceField.includes("origin[")) {
            const originField = sourceField.replace("origin[", "").replace("]", "")
            if (!webhookData.unsorted.add[0].source_data.origin) {
              webhookData.unsorted.add[0].source_data.origin = { provider: "", chat_id: "" }
            }
            ;(webhookData.unsorted.add[0].source_data.origin as any)[originField] = value
          } else if (sourceField.includes("data[0][")) {
            const dataField = sourceField.replace("data[0][", "").replace("]", "")
            if (!webhookData.unsorted.add[0].source_data.data) {
              webhookData.unsorted.add[0].source_data.data = [{ id: "", manager: "", date: "", text: "" }]
            }
            ;(webhookData.unsorted.add[0].source_data.data[0] as any)[dataField] = value
          } else {
            ;(webhookData.unsorted.add[0].source_data as any)[sourceField] = value
          }
        } else if (field.includes("data[contacts][0][")) {
          const contactField = field.replace("data[contacts][0][", "").replace("]", "")
          if (!webhookData.unsorted.add[0].data.contacts) {
            webhookData.unsorted.add[0].data.contacts = [{ id: "" }]
          }
          ;(webhookData.unsorted.add[0].data.contacts[0] as any)[contactField] = value
        } else {
          ;(webhookData.unsorted.add[0] as any)[field] = value
        }
      }
    }

    if (key.includes("unsorted[delete][0]")) {
      if (!webhookData.unsorted) {
        webhookData.unsorted = {
          delete: [{
            action: "",
            decline_result: { leads: [] },
            uid: "",
            category: "",
            created_at: "",
            modified_user_id: ""
          }]
        }
      }
      if (!webhookData.unsorted.delete) {
        webhookData.unsorted.delete = [{
          action: "",
          decline_result: { leads: [] },
          uid: "",
          category: "",
          created_at: "",
          modified_user_id: ""
        }]
      }

      const field = key.replace("unsorted[delete][0][", "").replace("]", "")

      if (field.includes("decline_result[leads]")) {
        const leadIndex = field.match(/decline_result\[leads\]\[(\d+)\]/)
        if (leadIndex && leadIndex[1]) {
          const index = parseInt(leadIndex[1])
          if (!webhookData.unsorted.delete[0].decline_result.leads) {
            webhookData.unsorted.delete[0].decline_result.leads = []
          }
          if (webhookData.unsorted.delete[0].decline_result.leads.length <= index) {
            webhookData.unsorted.delete[0].decline_result.leads.length = index + 1
          }
          webhookData.unsorted.delete[0].decline_result.leads[index] = value
        }
      } else {
        ;(webhookData.unsorted.delete[0] as any)[field] = value
      }
    }
  }

  return webhookData
}
