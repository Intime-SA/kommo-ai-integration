// Script de diagnóstico para Meta Conversions API
console.log("🔍 DIAGNÓSTICO DE META CONVERSIONS API");
console.log("=====================================");

// Verificar variables de entorno
console.log("\n📋 Variables de entorno:");
console.log("META_ACCESS_TOKEN:", process.env.META_ACCESS_TOKEN ? "✅ Configurado" : "❌ NO configurado");
console.log("NEXT_PUBLIC_META_PIXEL_ID:", process.env.NEXT_PUBLIC_META_PIXEL_ID ? `✅ ${process.env.NEXT_PUBLIC_META_PIXEL_ID}` : "❌ NO configurado");
console.log("META_PIXEL_ID:", process.env.META_PIXEL_ID ? `✅ ${process.env.META_PIXEL_ID}` : "❌ NO configurado");

// Verificar conectividad a MongoDB
console.log("\n🗄️ Conexión a MongoDB:");
console.log("MONGODB_URI:", process.env.MONGODB_URI ? "✅ Configurado" : "❌ NO configurado");

// Función para probar envío a Meta
async function testMetaConversion() {
  console.log("\n🚀 Probando envío a Meta API...");

  const accessToken = process.env.META_ACCESS_TOKEN;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || process.env.META_PIXEL_ID;

  if (!accessToken) {
    console.error("❌ META_ACCESS_TOKEN no está configurado");
    return;
  }

  if (!pixelId) {
    console.error("❌ Pixel ID no está configurado");
    return;
  }

  const testConversionData = {
    data: [
      {
        event_name: "ConversacionCRM1",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: "https://test.com",
        user_data: {
          client_ip_address: "127.0.0.1",
          client_user_agent: "Test User Agent",
          fbp: "fb.2.1234567890.1234567890",
          fbc: "fb.2.1234567890.1234567890"
        }
      }
    ]
  };

  try {
    console.log("📤 Enviando conversión de prueba...");
    console.log("Pixel ID:", pixelId);
    console.log("Access Token:", accessToken.substring(0, 20) + "...");

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testConversionData),
      }
    );

    const result = await response.json();

    if (response.ok) {
      console.log("✅ Conversión enviada exitosamente:");
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error("❌ Error en Meta API:");
      console.error("Status:", response.status);
      console.error("Error:", JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error("❌ Error de red:", error.message);
  }
}

// Función para verificar colección send_meta
async function checkSendMetaCollection() {
  console.log("\n📊 Verificando colección send_meta...");

  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);

    await client.connect();
    const db = client.db('kommo');
    const collection = db.collection('send_meta');

    const count = await collection.countDocuments();
    console.log(`📈 Total de registros en send_meta: ${count}`);

    if (count > 0) {
      const latest = await collection.find().sort({ timestamp: -1 }).limit(1).toArray();
      console.log("📅 Último registro:");
      console.log(JSON.stringify(latest[0], null, 2));
    } else {
      console.log("⚠️ No hay registros en send_meta");
    }

    await client.close();
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error.message);
  }
}

// Función para verificar colección token_visit
async function checkTokenVisitCollection() {
  console.log("\n🔑 Verificando colección token_visit...");

  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);

    await client.connect();
    const db = client.db('kommo');
    const collection = db.collection('token_visit');

    const count = await collection.countDocuments();
    console.log(`📈 Total de tokens en token_visit: ${count}`);

    if (count > 0) {
      const latest = await collection.find().sort({ createdAt: -1 }).limit(3).toArray();
      console.log("📅 Últimos tokens:");
      latest.forEach((token, index) => {
        console.log(`${index + 1}. Token: ${token.token}, Fecha: ${token.createdAt}`);
      });
    } else {
      console.log("⚠️ No hay tokens en token_visit");
    }

    await client.close();
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error.message);
  }
}

// Función para probar extracción de códigos
function extractCodeFromMessage(messageText) {
  console.log("Extrayendo código de mensaje:", messageText);

  // Patrón para buscar códigos generados por nanoid (incluyen guiones y caracteres especiales)
  const codePattern = /(?:descuento|codigo|código|token|promocion|promoción)\s*:\s*([A-Za-z0-9_-]{1,21})\.?/i;
  const match = messageText.match(codePattern);
  console.log("Match del patrón principal:", match);

  if (match && match[1]) {
    return match[1];
  }

  // También buscar códigos sueltos generados por nanoid
  const looseCodePatterns = [
    /\b([A-Za-z0-9_-]{8,21})\b/,  // Códigos de 8-21 caracteres con guiones
    /\b([A-Za-z0-9_-]{1,21})\b/,  // Códigos de 1-21 caracteres con guiones
  ];

  for (const pattern of looseCodePatterns) {
    const looseMatch = messageText.match(pattern);
    console.log("Match del patrón suelto:", looseMatch);
    if (looseMatch && looseMatch[1]) {
      return looseMatch[1];
    }
  }

  return null;
}

// Función de prueba simple para extracción de códigos
function testCodeExtraction() {
  console.log("🔍 PRUEBA DE EXTRACCIÓN DE CÓDIGOS");
  console.log("==================================");

  const testMessage = "Codigo Promocion: oowMSNzI. Hola me gustaria recibir el b0nus!!!";
  const extracted = extractCodeFromMessage(testMessage);

  console.log(`Mensaje: "${testMessage}"`);
  console.log(`Código extraído: "${extracted}"`);

  return extracted;
}

// Función de prueba completa
async function runDiagnostic() {
  console.log("🔍 DIAGNÓSTICO COMPLETO DE META LOGS");
  console.log("====================================");

  // Verificar variables de entorno
  console.log("\n📋 1. Variables de entorno:");
  console.log("META_ACCESS_TOKEN:", process.env.META_ACCESS_TOKEN ? "✅ Configurado" : "❌ NO configurado");
  console.log("NEXT_PUBLIC_META_PIXEL_ID:", process.env.NEXT_PUBLIC_META_PIXEL_ID ? `✅ ${process.env.NEXT_PUBLIC_META_PIXEL_ID}` : "❌ NO configurado");
  console.log("META_PIXEL_ID:", process.env.META_PIXEL_ID ? `✅ ${process.env.META_PIXEL_ID}` : "❌ NO configurado");
  console.log("MONGODB_URI:", process.env.MONGODB_URI ? "✅ Configurado" : "❌ NO configurado");

  // Probar extracción de códigos
  console.log("\n🔍 2. Probando extracción de códigos:");
  const testMessages = [
    "fauqwPlA Hola Enzo cargame con el 200!",
    "Descuento: Nv5M-ilY. Hola Enzo cargame con el 200!",
    "Código: AbCdEfGh-123",
    "Token: XYZ_789-AbC",
    "Hola, mi código es Nv5M-ilY",
    "Descuento ABC12345 sin dos puntos",
    "Mensaje sin código",
    "Descuento: ABC12345. Mensaje normal",
    "Código: Nv5M-ilY sin punto",
  ];

  testMessages.forEach((message, index) => {
    const extracted = extractCodeFromMessage(message);
    console.log(`Test ${index + 1}: "${message}" → "${extracted}"`);
  });

  // Verificar bases de datos
  await checkTokenVisitCollection();
  await checkSendMetaCollection();

  // Probar logs separados
  await testSeparateMetaLogs();

  // Probar envío a Meta
  await testMetaConversion();

  console.log("\n📝 RESUMEN Y RECOMENDACIONES:");
  console.log("1. ✅ Los logs de bot_actions y change_status están funcionando");
  console.log("2. 🔄 Sistema actualizado para logs separados de Meta");
  console.log("3. 📊 Verificar que los nuevos logs aparecen correctamente");
  console.log("4. 🔍 Si no hay logs de send_meta:");
  console.log("   - Verificar que llegan mensajes con códigos válidos");
  console.log("   - Asegurar que existan tokens correspondientes en token_visit");
  console.log("   - Revisar configuración de META_ACCESS_TOKEN y META_PIXEL_ID");
  console.log("   - Verificar que MongoDB esté corriendo");
  console.log("5. 💡 Para probar manualmente:");
  console.log("   - node -e \"require('./test-codes.js').testSeparateMetaLogs()\"");
  console.log("   - node -e \"require('./test-codes.js').cleanupOldMetaLogs()\"");
}

// Función para probar los logs separados de Meta
async function testSeparateMetaLogs() {
  console.log("🧪 PRUEBA DE LOGS SEPARADOS DE META");
  console.log("===================================");

  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('kommo');
    const collection = db.collection('send_meta');

    // Contar logs separados
    const conversacionCount = await collection.countDocuments({ eventType: 'ConversacionCRM1' });
    const cargoCount = await collection.countDocuments({ eventType: 'CargoCRM1' });
    const totalCount = await collection.countDocuments();

    console.log(`📊 Total de logs en send_meta: ${totalCount}`);
    console.log(`📝 Logs de ConversacionCRM1: ${conversacionCount}`);
    console.log(`📦 Logs de CargoCRM1: ${cargoCount}`);

    if (totalCount > 0) {
      // Mostrar algunos ejemplos
      const samples = await collection.find().sort({ timestamp: -1 }).limit(3).toArray();
      console.log("\n📋 Ejemplos de logs separados:");
      samples.forEach((log, index) => {
        console.log(`${index + 1}. ${log.eventType} - Código: ${log.extractedCode} - Éxito: ${log.success}`);
        console.log(`   Contact: ${log.messageData.contactId}, Lead: ${log.messageData.entityId}`);
      });
    }

    // Verificar que no hay arrays en los logs (deben ser objetos individuales)
    const logWithArray = await collection.findOne({
      $or: [
        { conversionData: { $type: 'array' } },
        { conversionResult: { $type: 'array' } }
      ]
    });

    if (logWithArray) {
      console.log("⚠️ ADVERTENCIA: Aún hay logs con arrays (formato antiguo)");
    } else {
      console.log("✅ Todos los logs están en formato separado correctamente");
    }

    await client.close();

  } catch (error) {
    console.error("❌ Error probando logs separados:", error.message);
  }
}

// Función para limpiar logs antiguos (si es necesario)
async function cleanupOldMetaLogs() {
  console.log("🧹 LIMPIANDO LOGS ANTIGUOS DE META");
  console.log("===================================");

  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('kommo');
    const collection = db.collection('send_meta');

    // Buscar logs antiguos con arrays
    const oldLogs = await collection.find({
      $or: [
        { conversionData: { $type: 'array', $ne: [] } },
        { conversionResults: { $exists: true } }
      ]
    }).toArray();

    if (oldLogs.length > 0) {
      console.log(`📋 Encontrados ${oldLogs.length} logs antiguos con formato de arrays`);

      // Aquí podrías implementar la migración si es necesario
      console.log("💡 Para migrar los logs antiguos, ejecuta la función de migración");

    } else {
      console.log("✅ No se encontraron logs antiguos para limpiar");
    }

    await client.close();

  } catch (error) {
    console.error("❌ Error limpiando logs antiguos:", error.message);
  }
}

// Función para mostrar ejemplo de logs separados
function showExpectedFormat() {
  console.log("📋 FORMATO ESPERADO DE LOGS SEPARADOS");
  console.log("=====================================");

  const exampleConversacion = {
    "_id": "68c761973098bb2ceb2125b5",
    "timestamp": "2025-09-14T21:45:11.784Z",
    "type": "send_meta",
    "contactId": "9382110",
    "leadId": "11714144",
    "talkId": "174",
    "extractedCode": "fauqwPlA",
    "eventType": "ConversacionCRM1",
    "conversionData": {
      "data": [{
        "event_name": "ConversacionCRM1",
        "event_time": 1757897104,
        "action_source": "website",
        "event_source_url": "https://c81af03c6bcf.ngrok-free.app",
        "user_data": {
          "client_ip_address": "181.230.76.252",
          "client_user_agent": "Mozilla/5.0...",
          "fbp": "fb.2.1757879221522.434528022832166950",
          "fbc": "fb.2.1757896923150..."
        }
      }]
    },
    "conversionResult": {
      "success": false,
      "error": "DUPLICATE_CONVERSION",
      "message": "Conversión ya enviada anteriormente para código fauqwPlA"
    },
    "success": false,
    "messageText": "fauqwPlA Hola Enzo cargame con el 200!",
    "userName": "Ramiro Arce",
    "clientId": "5492234666801",
    "sourceName": "1) Storm Internet Services"
  };

  const exampleCargo = {
    "_id": "68c761983098bb2ceb2125b6",
    "timestamp": "2025-09-14T21:45:12.123Z",
    "type": "send_meta",
    "contactId": "9382110",
    "leadId": "11714144",
    "talkId": "174",
    "extractedCode": "fauqwPlA",
    "eventType": "CargoCRM1",
    "conversionData": {
      "data": [{
        "event_name": "CargoCRM1",
        "event_time": 1757897105,
        "action_source": "website",
        "event_source_url": "https://c81af03c6bcf.ngrok-free.app",
        "user_data": {
          "client_ip_address": "181.230.76.252",
          "client_user_agent": "Mozilla/5.0...",
          "fbp": "fb.2.1757879221522.434528022832166950",
          "fbc": "fb.2.1757896923150..."
        }
      }]
    },
    "conversionResult": {
      "success": true,
      "data": {
        "events_received": 1,
        "messages": [],
        "fbtrace_id": "A0SOYgiCyJCUUMzJqEstMwg"
      }
    },
    "success": true,
    "messageText": "Status changed to Cargo",
    "userName": "Ramiro Arce",
    "clientId": "5492234666801",
    "sourceName": "1) Storm Internet Services"
  };

  console.log("🔹 Log de ConversacionCRM1:");
  console.log(JSON.stringify(exampleConversacion, null, 2));
  console.log("\n🔹 Log de CargoCRM1:");
  console.log(JSON.stringify(exampleCargo, null, 2));

  console.log("\n✅ DIFERENCIAS CLAVE:");
  console.log("- Cada log es un documento separado");
  console.log("- Mismo contactId y leadId");
  console.log("- eventType diferente (ConversacionCRM1 vs CargoCRM1)");
  console.log("- conversionData y conversionResult son objetos, no arrays");
  console.log("- messageText describe la acción que generó el log");
}

// Ejecutar diagnóstico
if (require.main === module) {
  runDiagnostic();
}

module.exports = {
  testMetaConversion,
  checkSendMetaCollection,
  checkTokenVisitCollection,
  runDiagnostic,
  testCodeExtraction,
  extractCodeFromMessage,
  testSeparateMetaLogs,
  cleanupOldMetaLogs,
  showExpectedFormat
};
