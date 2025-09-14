# Variables de Entorno Necesarias

Este proyecto requiere las siguientes variables de entorno para funcionar correctamente:

## Variables Obligatorias

### Base de Datos
- `MONGODB_URI`: URL de conexión a MongoDB
  - Ejemplo: `mongodb://localhost:27017/kommo`

### Kommo API
- `KOMMO_SUBDOMAIN`: Subdominio de tu cuenta Kommo
  - Ejemplo: `miempresa`

### OpenAI API
- `OPENAI_API_KEY`: Clave API de OpenAI para procesamiento de IA
  - Obtenla desde: https://platform.openai.com/api-keys

### Meta Conversions API
- `META_ACCESS_TOKEN`: Token de acceso de Meta para enviar conversiones
  - **Importante**: Este token se usa cuando se valida un código en un mensaje entrante
  - Valor: `EAACRchBdq8oBPY9pkScZA5H1rKhxO9fB3Fnk52ZCmetdZBdrVk9os9E4BVho72WZAfL42cMIh99pCZCZAk1ES6Gxw8na8gnp3WlX8MR7cDkI6TfkypwDBZA3ZAvY1L64ZCWFe6RXMTJdUUBCvhD3KyYbnbonaTmhCENsQQsxqIZAaMYs5TvOzvFaeZAWBLQTqUmLwZDZD`
- `META_PIXEL_ID`: ID del pixel de Meta para "ConversacionCRM1"
  - **Valor correcto**: `1293636532487008`
  - **Evento**: "Other" con parámetro personalizado "TRUE"

## Variables Opcionales
- `NODE_ENV`: Entorno de ejecución (`development`, `production`)
- `META_PIXEL_ID`: ID del pixel de Meta (si no se especifica, usa valor por defecto)

## Configuración del archivo .env

1. Crea un archivo `.env` en la raíz del proyecto
2. Copia las variables de arriba y configura sus valores
3. Asegúrate de que `.env` esté en `.gitignore`

## Archivo .env de ejemplo

Copia y pega esto en tu archivo `.env`:

```bash
# Base de datos MongoDB
MONGODB_URI=mongodb://localhost:27017/kommo

# Configuración de Kommo
KOMMO_SUBDOMAIN=tu-subdominio

# API de OpenAI
OPENAI_API_KEY=tu-api-key-de-openai

# Meta Conversions API - Configuración actualizada
META_ACCESS_TOKEN=EAACRchBdq8oBPY9pkScZA5H1rKhxO9fB3Fnk52ZCmetdZBdrVk9os9E4BVho72WZAfL42cMIh99pCZCZAk1ES6Gxw8na8gnp3WlX8MR7cDkI6TfkypwDBZA3ZAvY1L64ZCWFe6RXMTJdUUBCvhD3KyYbnbonaTmhCENsQQsxqIZAaMYs5TvOzvFaeZAWBLQTqUmLwZDZD
META_PIXEL_ID=1293636532487008

# Configuración de desarrollo
NODE_ENV=development
```

## Funcionalidad de Validación de Códigos

Cuando un mensaje entrante contiene un código (como "Descuento: ABC12345. Hola..."), el sistema:

1. **Extrae el código** del mensaje usando expresiones regulares
2. **Busca el código** en la colección `token_visit` de MongoDB
3. **Si encuentra el código**, obtiene los datos del lead asociado que incluyen:
   - **fbp**: Identificador de navegador de Facebook Pixel
   - **fbc**: Identificador del clic de Facebook (opcional)
   - **userAgent**: Agente de usuario del navegador
   - **ip**: Dirección IP del usuario
4. **Envía una conversión** a Meta usando:
   - Pixel ID: `1293636532487008` (ConversacionCRM1)
   - Event Name: `"Other"`
   - Custom Parameter: `"TRUE"`
   - **Datos técnicos completos**: fbp, fbc, userAgent, IP
   - Access Token proporcionado
5. **Registra el resultado** en los logs

### Formatos de código soportados:
- `Descuento: ABC12345.`
- `Código: XYZ78901`
- `Token: DEF45678`
- Códigos sueltos de 8 caracteres alfanuméricos

### Configuración de Meta Actualizada:
- **Pixel ID**: `1293636532487008`
- **Nombre del Evento**: `ConversacionCRM1`
- **Tipo de Evento**: `Other`
- **Parámetro Personalizado**: `TRUE`
- **Descripción**: "Se inicio una conversacion en el CRM"

### Datos Enviados a Meta

El sistema envía los siguientes datos del lead a la API de conversiones de Meta:

#### Datos de Contacto (`user_data`):
- `em`: Email del lead (como array)
- `ph`: Teléfono del lead (como array)
- `fn`: Nombre del lead (como array)
- `ln`: Apellido del lead (como array)

#### Datos Técnicos Requeridos (`user_data`):
- `fbp`: Facebook Pixel ID del navegador
- `fbc`: Facebook Click ID (si existe)
- `client_user_agent`: Agente de usuario del navegador
- `client_ip_address`: Dirección IP del usuario

#### Datos Personalizados (`custom_data`):
- `currency`: Moneda (ARS)
- `value`: Valor de la conversión
- `content_name`: "Conversacion CRM iniciada"
- `custom_event_parameter`: "TRUE"

### Ejemplo de Payload Enviado a Meta

```json
{
  "data": [
    {
      "event_name": "Other",
      "event_time": 1694726400,
      "user_data": {
        "em": ["usuario@email.com"],
        "ph": ["+54911234567"],
        "fn": ["Juan"],
        "ln": ["Pérez"],
        "fbp": ["fb.2.1757872733635.432748660491649953"],
        "fbc": null,
        "client_user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        "client_ip_address": "181.230.76.252"
      },
      "custom_data": {
        "currency": "ARS",
        "value": "0",
        "content_name": "Conversacion CRM iniciada",
        "custom_event_parameter": "TRUE"
      }
    }
  ]
}
```
