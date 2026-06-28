import { MongoClient, type Db } from 'mongodb';
import { config } from '../config/config.js';

let client: MongoClient | undefined;
let db: Db | undefined;

export async function connectDatabase(): Promise<Db> {
  if (db) {
    return db;
  }

  client = new MongoClient(config.MONGODB_URI);
  await client.connect();

  const database = client.db();
  await database.command({ ping: 1 });

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
