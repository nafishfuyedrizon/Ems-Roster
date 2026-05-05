import path from "node:path";

const envCandidates = [
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(import.meta.dirname, "../../../.env.local"),
  path.resolve(import.meta.dirname, "../../../.env"),
];

for (const envFile of envCandidates) {
  if (process.env.DATABASE_URL) {
    break;
  }
  try {
    process.loadEnvFile(envFile);
  } catch {}
}
