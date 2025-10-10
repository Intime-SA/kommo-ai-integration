import { MongoClient, ServerApiVersion, MongoClientOptions } from 'mongodb';

const uri = process.env.MONGO_DB_URI;

if (!uri) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

// Definir las opciones con tipo
const options: MongoClientOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  // Asegúrate de que estas opciones sean adecuadas para tu caso de uso
  // Puedes necesitar ajustar `maxPoolSize`, `wtimeoutMS`, etc.
  // Consulta la documentación: https://mongodb.github.io/node-mongodb-native/4.9/interfaces/MongoClientOptions.html
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// Definir un tipo para la propiedad global para evitar errores de TS
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  // En modo desarrollo, usa una variable global para preservar el valor
  // a través de recargas de módulos causadas por HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
    console.log("MongoDB Connection Initialized (Development)"); // Log para confirmar inicialización
  }
  clientPromise = global._mongoClientPromise;
} else {
  // En producción, es mejor no usar una variable global.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
  console.log("MongoDB Connection Initialized (Production)"); // Log para confirmar inicialización
}

// Exporta una promesa del cliente MongoClient. Al resolver esta promesa,
// obtendrás el cliente MongoClient conectado.
// Puedes usar esto en tus endpoints de API o funciones getServerSideProps.
// Ejemplo: import clientPromise from '../lib/mongodb';
//          const client = await clientPromise;
//          const db = client.db("yourDbName");
//          ... usar db ...
export default clientPromise; 