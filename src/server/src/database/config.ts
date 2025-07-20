import { Database } from "bun:sqlite";
import path from "path";

export const DB_PATH = path.join(process.cwd(), 'data', 'db', 'nexus.db');

let dbInstance: Database | null = null;

export function getDatabase(): Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
} 