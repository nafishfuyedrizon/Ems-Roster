import { env as workerEnv } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";

if (
  !process.env.DATABASE_URL &&
  workerEnv.HYPERDRIVE &&
  typeof workerEnv.HYPERDRIVE.connectionString === "string"
) {
  process.env.DATABASE_URL = workerEnv.HYPERDRIVE.connectionString;
}

const { default: app } = await import("./app");

const workerPort = Number(process.env["PORT"] ?? process.env["API_PORT"] ?? "3000");

app.listen(workerPort);

export default httpServerHandler({ port: workerPort });
