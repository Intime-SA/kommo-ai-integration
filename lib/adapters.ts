export function adapterUnsortedAddToCreateUser(unsortedAdd: any) {
    return {
      sourceUid: unsortedAdd.source_uid,
      client: {
        name: unsortedAdd.source_data?.client?.name || "Unknown",
        id: unsortedAdd.source_data?.client?.id || "",
      },
      createdAt: unsortedAdd.created_at,
      contactId: unsortedAdd.data?.contacts?.[0]?.id || "",
      source: unsortedAdd.source,
      sourceName: unsortedAdd.source_data?.source_name || "",
      messageText: unsortedAdd.source_data?.data?.[0]?.text || "",
    };
  }


  export  function adapterUnsortedAddToCreateLead(unsortedAdd: any) {
    return {
      uid: unsortedAdd.uid,
      source: unsortedAdd.source,
      sourceUid: unsortedAdd.source_uid,
      category: unsortedAdd.category,
      leadId: unsortedAdd.lead_id,
      contactId: unsortedAdd.data?.contacts?.[0]?.id || "",
      pipelineId: unsortedAdd.pipeline_id,
      createdAt: unsortedAdd.created_at,
      client: {
        name: unsortedAdd.source_data?.client?.name || "Unknown",
        id: unsortedAdd.source_data?.client?.id || "",
      },
      messageText: unsortedAdd.source_data?.data?.[0]?.text || "",
      sourceName: unsortedAdd.source_data?.source_name || "",
    }
  }


  export function adapterConversionData(unsortedAdd: any, messageText: string) {
    return {
      id:
        unsortedAdd.source_data?.data?.[0]?.id || unsortedAdd.uid,
      chatId: unsortedAdd.source_data?.origin?.chat_id || "",
      talkId: "",
      contactId: unsortedAdd.data?.contacts?.[0]?.id || "",
      text: messageText,
      createdAt: unsortedAdd.created_at,
      elementType: "unsorted",
      entityType: "add",
      elementId: unsortedAdd.uid,
      entityId: unsortedAdd.lead_id,
      type: "incoming",
      author: {
        name: unsortedAdd.source_data?.client?.name || "Unknown",
        id: unsortedAdd.source_data?.client?.id || "",
      },
    }
  }