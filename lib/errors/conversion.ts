import { logger } from "../logger";

export function logConversionError(error: any, extractedCode: string) {
  console.error(`❌ Error al enviar conversión para código ${extractedCode}:`, error);
  logger.error(`❌ Error al enviar conversión para código ${extractedCode}:`, error);
}