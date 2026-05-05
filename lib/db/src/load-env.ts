import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.DATABASE_URL) {
  try {
    const cf = await import("cloudflare:workers");
    const hyperdrive = (cf.env as Record<string, unknown> | undefined)?.HYPERDRIVE as
      | { connectionString?: string }
      | undefined;
    const workerDatabaseUrl = (cf.env as Record<string, string | undefined> | undefined)?.DATABASE_URL;

    if (hyperdrive?.connectionString) {
      process.env.DATABASE_URL = hyperdrive.connectionString;
    } else if (workerDatabaseUrl) {
      process.env.DATABASE_URL = workerDatabaseUrl;
    }
  } catch {}
}

let workerSafeImportDir: string | null = null;
try {
  if (typeof import.meta.url === "string" && import.meta.url.startsWith("file:")) {
    workerSafeImportDir = path.dirname(fileURLToPath(import.meta.url));
  }
} catch {}

const envCandidates = [
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), ".env"),
  ...(workerSafeImportDir
    ? [
        path.resolve(workerSafeImportDir, "../../../.env.local"),
        path.resolve(workerSafeImportDir, "../../../.env"),
      ]
    : []),
];

for (const envFile of envCandidates) {
  if (process.env.DATABASE_URL) {
    break;
  }
  try {
    process.loadEnvFile(envFile);
  } catch {}
}
