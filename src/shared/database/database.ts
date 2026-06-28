import { MongoClient, type Db } from 'mongodb';
import { config } from '../config/config.js';

let client: MongoClient | undefined;
let db: Db | undefined;

async function setupIndexes(database: Db): Promise<void> {
  const usersCollection = database.collection('users');
  await usersCollection.createIndex(
    { email: 1 },
    {
      unique: true,
      partialFilterExpression: { isActive: true },
    }
  );
}

export async function connectDatabase(): Promise<Db> {
  if (db) {
    return db;
  }

  client = new MongoClient(config.MONGODB_URI);
  await client.connect();

  const database = client.db();
  await database.command({ ping: 1 });
  await setupIndexes(database);

  db = database;
  return db;
}

export function getDatabase(): Db {
  if (!db) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return db;
}

export async function disconnectDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}
