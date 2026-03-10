import { createClient } from "@libsql/client";
import { TURSO_API, TURSO_URL } from "./env.js";

const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_API,
});

const DB_TIMEOUT = 20000; // 20 seconds

async function safeExecute(query, params = []) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("DATABASE_TIMEOUT")), DB_TIMEOUT),
  );

  try {
    return await Promise.race([client.execute(query, params), timeoutPromise]);
  } catch (error) {
    console.error("DB ERROR:", error.message);
    throw error;
  }
}

export const db = {
  execute: safeExecute,
};
