import { Database } from "bun:sqlite";
import path from "path";

// Use import.meta.dir to get the directory of this file, then navigate to project root
const projectRoot = path.resolve(import.meta.dir, "../../../");
export const DB_PATH = path.join(projectRoot, 'data', 'db', 'nexus.db');

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