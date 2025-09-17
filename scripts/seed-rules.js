const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Configuración de conexión
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = 'kommo';

async function seedRules() {
  let client;

  try {
    console.log('Conectando a MongoDB...');
    client = new MongoClient(uri);
    await client.connect();

    const db = client.db(dbName);
    const collection = db.collection('rules');

    // Leer el archivo JSON
    const rulesPath = path.join(__dirname, '..', 'sample-rules.json');
    const rulesData = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

    console.log(`Cargando ${rulesData.length} reglas...`);

    // Verificar si ya existen reglas
    const existingCount = await collection.countDocuments();
    if (existingCount > 0) {
      console.log(`Ya existen ${existingCount} reglas en la base de datos.`);
      console.log('¿Deseas continuar? (y/N): ');

      // En un script real, podrías usar readline para input del usuario
      // Por ahora, continuamos automáticamente
      console.log('Continuando con la carga...');
    }

    // Insertar las reglas
    const result = await collection.insertMany(rulesData);

    console.log(`✅ Se cargaron exitosamente ${result.insertedCount} reglas en la base de datos.`);
    console.log(`📊 Total de reglas en la colección: ${await collection.countDocuments()}`);

  } catch (error) {
    console.error('❌ Error al cargar las reglas:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Conexión cerrada.');
    }
  }
}

// Ejecutar el script
seedRules().catch(console.error);
