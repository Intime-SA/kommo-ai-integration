

// Configuración de Kommo

export const KOMMO_CONFIG = {
  subdomain: process.env.KOMMO_SUBDOMAIN,
  accessToken: process.env.KOMMO_ACCESS_TOKEN,
  clientId: process.env.KOMMO_CLIENT_ID,
  customFields: {
    tagCbu: process.env.KOMMO_CUSTOM_FIELD_TAG_CBU,
    tagTitularAccount: process.env.KOMMO_CUSTOM_FIELD_TAG_TITULAR_ACCOUNT,
    tagWalink: process.env.KOMMO_CUSTOM_FIELD_TAG_WALINK,
    idCbu: process.env.KOMMO_CUSTOM_FIELD_ID_CBU,
    idTitularAccount: process.env.KOMMO_CUSTOM_FIELD_ID_TITULAR_ACCOUNT,
    idWalink: process.env.KOMMO_CUSTOM_FIELD_ID_WALINK,
  },
  pipelines: [
    {
      id: process.env.KOMMO_PIPELINE_ID,
      name: 'ventas',
      status: {
        Revisar: process.env.KOMMO_STATUS_REVISAR,
        PidioUsuario: process.env.KOMMO_STATUS_PIDIO_USUARIO,
        PidioCbuAlias: process.env.KOMMO_STATUS_PIDIO_CBU_ALIAS,
        Cargo: process.env.KOMMO_STATUS_CARGO,
        NoCargo: process.env.KOMMO_STATUS_NO_CARGO,
        NoAtender: process.env.KOMMO_STATUS_NO_ATENDER,
        Seguimiento: process.env.KOMMO_STATUS_SEGUIMIENTO,
        Ganado: process.env.KOMMO_STATUS_GANADO,
        Perdido: process.env.KOMMO_STATUS_PERDIDO,
      },
      settings: {
        id: process.env.MONGO_SETTINGS_ID,
      },
    },
    {
      id: process.env.KOMMO_PIPELINE_ID_2,
      name: 'regular',
      status: {},
      settings: {}
    },
  ],
};



// Configuración de MongoDB

export const MONGO_CONFIG = {
  uri: process.env.MONGODB_URI,
  database: process.env.MONGODB_DATABASE,
  collection: {
    leads: process.env.MONGODB_COLLECTION_LEADS,
    sendMeta: process.env.MONGODB_COLLECTION_SEND_META,
    users: process.env.MONGODB_COLLECTION_USERS,
    tasks: process.env.MONGODB_COLLECTION_TASKS,
    messages: process.env.MONGODB_COLLECTION_MESSAGES,
    botActions: process.env.MONGODB_COLLECTION_BOT_ACTIONS,
    rules: process.env.MONGODB_COLLECTION_RULES,
    settings: process.env.MONGODB_COLLECTION_SETTINGS,
    status: process.env.MONGODB_COLLECTION_STATUS,
    tokenVisit: process.env.MONGODB_COLLECTION_TOKEN_VISIT,
  },
};



// Configuración de Meta

export const META_CONFIG = {
  accessToken: process.env.META_ACCESS_TOKEN,
  pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  event1: process.env.META_EVENT_1 || "ConversacionCRM1",
  event2: process.env.META_EVENT_2 || "CargoCRM1",
};



// Configuración de User Registration

export const USER_REGISTRATION_CONFIG = {
  platform: [
    {
      name: "greenBet",
      mode: 'api',
      apiUrl: process.env.USER_REGISTRATION_API_URL,
      token: process.env.USER_REGISTRATION_TOKEN,
      parentId: process.env.USER_REGISTRATION_PARENT_ID,

    },
    {
      name: "moneyMaker",
      mode: 'script',
      apiUrl: process.env.USER_REGISTRATION_SCRIPT_URL,
    },
  ],
};



// Configuración de AI

export const AI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY,
};
