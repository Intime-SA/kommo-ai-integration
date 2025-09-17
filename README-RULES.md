# 📋 Servicio de Rules - API REST

## 📖 Descripción

El servicio de Rules proporciona operaciones CRUD completas para administrar las reglas de negocio del sistema KOMMO. Las reglas se almacenan en MongoDB y están disponibles a través de endpoints REST API.

## 🏗️ Estructura de Datos

Cada regla tiene la siguiente estructura:

```json
{
  "_id": "ObjectId (generado automáticamente)",
  "createdAt": "2024-09-17T12:00:00.000Z",
  "updatedAt": "2024-09-17T12:00:00.000Z",
  "rule": "1",
  "text": "Analiza siempre el contenido literal del mensaje...",
  "crm": "kommo",
  "pipeline": "sales",
  "priority": 10,
  "status": "active"
}
```

### Campos Requeridos
- `rule`: Identificador único de la regla (string)
- `text`: Descripción de la regla (string)
- `crm`: Sistema CRM (string)
- `pipeline`: Pipeline donde se aplica (string)
- `priority`: Prioridad (0-10, number)
- `status`: Estado de la regla ('active' | 'inactive' | 'draft')

### Campos Automáticos
- `createdAt`: Fecha de creación (ISO string)
- `updatedAt`: Fecha de última actualización (ISO string)

## 🚀 Endpoints API

### Base URL
```
/api/rules
```

### 📋 Listar todas las reglas
**GET** `/api/rules`

**Parámetros de consulta opcionales:**
- `rule`: Filtrar por número de regla
- `text`: Buscar en el texto de la regla
- `crm`: Filtrar por CRM
- `pipeline`: Filtrar por pipeline
- `status`: Filtrar por status ('active' | 'inactive' | 'draft')
- `priority`: Filtrar por prioridad
- `startDate`: Fecha desde (ISO string)
- `endDate`: Fecha hasta (ISO string)
- `limit`: Número de resultados (default: 50)
- `offset`: Desplazamiento para paginación
- `sortBy`: Campo para ordenar ('createdAt' | 'updatedAt' | 'rule' | 'priority' | 'status')
- `sortOrder`: Orden ('asc' | 'desc')

**Ejemplo:**
```bash
GET /api/rules?crm=kommo&pipeline=sales&status=active&limit=10
```

### ➕ Crear nueva regla
**POST** `/api/rules`

**Body (JSON):**
```json
{
  "rule": "11",
  "text": "Nueva regla de ejemplo",
  "crm": "kommo",
  "pipeline": "sales",
  "priority": 5,
  "status": "active"
}
```

### 👁️ Obtener regla específica
**GET** `/api/rules/[id]`

**Parámetros:**
- `id`: ID de la regla en MongoDB

### ✏️ Actualizar regla
**PUT** `/api/rules/[id]`

**Body (JSON) - Solo campos a actualizar:**
```json
{
  "text": "Texto actualizado",
  "priority": 8,
  "status": "inactive"
}
```

### 🗑️ Eliminar regla
**DELETE** `/api/rules/[id]`

## 📊 Endpoints Especializados

### Obtener reglas activas
```bash
GET /api/rules?crm=kommo&pipeline=sales&status=active&sortBy=priority&sortOrder=desc
```

### Buscar reglas por texto
```bash
GET /api/rules?text=analiza&status=active
```

### Obtener reglas por prioridad alta
```bash
GET /api/rules?priority=8&crm=kommo&status=active
```

## 💾 Script de Carga de Datos

Para cargar datos de ejemplo, ejecuta:

```bash
node scripts/seed-rules.js
```

Este script cargará las reglas de ejemplo desde `sample-rules.json` a la base de datos.

## 🔧 Configuración

### Variables de Entorno
Asegúrate de tener configurada la variable:
```env
MONGODB_URI=mongodb://localhost:27017/kommo
```

### Dependencias
El servicio utiliza:
- MongoDB para almacenamiento
- Next.js API Routes para endpoints
- Logger personalizado para trazabilidad

## 📝 Ejemplos de Uso

### Crear regla
```javascript
const response = await fetch('/api/rules', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    rule: 'CUSTOM_1',
    text: 'Regla personalizada para validaciones',
    crm: 'kommo',
    pipeline: 'custom',
    priority: 7,
    status: 'active'
  })
});
```

### Obtener reglas activas
```javascript
const response = await fetch('/api/rules?crm=kommo&status=active&sortBy=priority&sortOrder=desc');
const data = await response.json();
```

### Actualizar regla
```javascript
const response = await fetch('/api/rules/[rule-id]', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    status: 'inactive',
    priority: 3
  })
});
```

## 🛡️ Validaciones

- **Campos requeridos**: Todos los campos son obligatorios al crear
- **Prioridad**: Debe ser un número entre 0 y 10
- **Status**: Solo valores permitidos: 'active', 'inactive', 'draft'
- **Fechas**: Se manejan automáticamente en formato ISO string
- **IDs únicos**: Los números de regla deben ser únicos

## 📋 Estados de las Reglas

- **`active`**: Regla activa y en uso
- **`inactive`**: Regla temporalmente desactivada
- **`draft`**: Regla en desarrollo o revisión

## 🔍 Búsqueda y Filtrado

El API soporta búsqueda avanzada:
- Búsqueda por texto en el contenido de la regla
- Filtros por CRM, pipeline, status y prioridad
- Rango de fechas de creación/actualización
- Ordenamiento personalizado
- Paginación para grandes volúmenes de datos

## 📊 Respuestas de Error

```json
{
  "error": "Mensaje descriptivo del error"
}
```

Códigos HTTP:
- `200`: Éxito
- `201`: Creado exitosamente
- `400`: Datos inválidos
- `404`: Recurso no encontrado
- `500`: Error interno del servidor

## 📈 Headers de Respuesta

```http
X-Total-Count: 150
X-Has-More: true
X-Response-Time: 45ms
```

Estos headers te ayudan a manejar la paginación y medir el rendimiento.
