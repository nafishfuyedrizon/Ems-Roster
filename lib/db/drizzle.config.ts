import path from "node:path";
import { defineConfig } from "drizzle-kit";

const envFiles = [
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), "../../.env.local"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
];

for (const envFile of envFiles) {
  if (process.env.DATABASE_URL) {
    break;
  }
  try {
    process.loadEnvFile(envFile);
  } catch {}
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before running drizzle-kit.");
}

export default defineConfig({
  // Keep this as a relative POSIX path. Absolute Windows paths can make
  // drizzle-kit report "No schema files found" even when the file exists.
  schema: "./src/schema/index.ts",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
