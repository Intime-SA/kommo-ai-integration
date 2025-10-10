import { KOMMO_CONFIG } from "./kommo-config"

// Pipeline configuration
export const PIPELINE_CONFIG = {
    id: KOMMO_CONFIG.pipelines[0].id,
    name: KOMMO_CONFIG.pipelines[0].name,
  } as const
  
  // Status ID mapping - configured based on your Kommo pipeline
  export const STATUS_MAPPING = {
    Revisar: KOMMO_CONFIG.pipelines[0].status.Revisar ,
    PidioUsuario: KOMMO_CONFIG.pipelines[0].status.PidioUsuario,
    PidioCbuAlias: KOMMO_CONFIG.pipelines[0].status.PidioCbuAlias,
    Cargo: KOMMO_CONFIG.pipelines[0].status.Cargo,
    NoCargo: KOMMO_CONFIG.pipelines[0].status.NoCargo,
    NoAtender: KOMMO_CONFIG.pipelines[0].status.NoAtender,
    Seguimiento: KOMMO_CONFIG.pipelines[0].status.Seguimiento,
    Ganado: KOMMO_CONFIG.pipelines[0].status.Ganado,
    Perdido: KOMMO_CONFIG.pipelines[0].status.Perdido,
  } as const