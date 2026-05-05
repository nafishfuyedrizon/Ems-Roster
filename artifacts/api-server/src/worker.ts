import "@workspace/db/load-env";
import { httpServerHandler } from "cloudflare:node";

const { default: app } = await import("./app");

const workerPort = Number(process.env["PORT"] ?? process.env["API_PORT"] ?? "3000");

app.listen(workerPort);

const workerHandler = httpServerHandler({ port: workerPort }) as {
  fetch?: (request: Request, env: Record<string, unknown>, ctx: ExecutionContext) => Response | Promise<Response>;
} | ((request: Request, env: Record<string, unknown>, ctx: ExecutionContext) => Response | Promise<Response>);

export default {
  async fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext) {
    const globalState = globalThis as Record<string, unknown>;
    if (!process.env.DATABASE_URL) {
      const hyperdrive = env["HYPERDRIVE"] as { connectionString?: string } | undefined;
      const envDatabaseUrl = env["DATABASE_URL"];
      if (typeof hyperdrive?.connectionString === "string" && hyperdrive.connectionString.length > 0) {
        process.env.DATABASE_URL = hyperdrive.connectionString;
        globalState["__EMS_DATABASE_URL__"] = hyperdrive.connectionString;
      } else if (typeof envDatabaseUrl === "string" && envDatabaseUrl.length > 0) {
        process.env.DATABASE_URL = envDatabaseUrl;
        globalState["__EMS_DATABASE_URL__"] = envDatabaseUrl;
      }
    } else if (!globalState["__EMS_DATABASE_URL__"] && process.env.DATABASE_URL) {
      globalState["__EMS_DATABASE_URL__"] = process.env.DATABASE_URL;
    }

    if (!globalState["__EMS_DATABASE_URL__"]) {
      const hyperdrive = env["HYPERDRIVE"] as { connectionString?: string } | undefined;
      if (typeof hyperdrive?.connectionString === "string" && hyperdrive.connectionString.length > 0) {
        globalState["__EMS_DATABASE_URL__"] = hyperdrive.connectionString;
      }
    }

    return typeof workerHandler === "function"
      ? workerHandler(request, env, ctx)
      : workerHandler.fetch!(request, env, ctx);
  },
};
