import { Lucia } from "lucia";
import { BunSQLiteAdapter } from "@lucia-auth/adapter-sqlite";
import { getDatabase } from "../database/config";

const db = getDatabase();

const adapter = new BunSQLiteAdapter(db, {
  user: "users",
  session: "user_sessions"
});

const isDevelopment = process.env.NODE_ENV !== "production";

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    name: "nexusdrop-session",
    expires: false,
    attributes: {
      secure: !isDevelopment,
      sameSite: isDevelopment ? "lax" : "strict",
      domain: isDevelopment ? undefined : ".syl.rest",
      path: "/",
    }
  },
  getUserAttributes: (attributes) => {
    return {
      username: attributes.username,
      role: attributes.role,
    };
  }
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      username: string;
      role: 'user' | 'admin';
    };
  }
} 