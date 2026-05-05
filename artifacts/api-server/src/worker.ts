import "@workspace/db/load-env";
import { httpServerHandler } from "cloudflare:node";

type WorkerHandler = {
  fetch?: (request: Request, env: Record<string, unknown>, ctx: ExecutionContext) => Response | Promise<Response>;
} | ((request: Request, env: Record<string, unknown>, ctx: ExecutionContext) => Response | Promise<Response>);

type WorkerRuntime = {
  handler: WorkerHandler;
};

function primeDatabaseEnv(env: Record<string, unknown>) {
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
}

async function getWorkerRuntime(env: Record<string, unknown>) {
  primeDatabaseEnv(env);

  const globalState = globalThis as Record<string, unknown>;
  const existingRuntime = globalState["__EMS_WORKER_RUNTIME__"] as WorkerRuntime | undefined;
  if (existingRuntime) {
    return existingRuntime;
  }

  const existingPromise = globalState["__EMS_WORKER_RUNTIME_PROMISE__"] as Promise<WorkerRuntime> | undefined;
  if (existingPromise) {
    return existingPromise;
  }

  const runtimePromise = (async () => {
    const { default: app } = await import("./app");
    const workerPort = Number(process.env["PORT"] ?? process.env["API_PORT"] ?? "3000");
    app.listen(workerPort);
    const handler = httpServerHandler({ port: workerPort }) as WorkerHandler;
    const runtime = { handler } satisfies WorkerRuntime;
    globalState["__EMS_WORKER_RUNTIME__"] = runtime;
    return runtime;
  })();

  globalState["__EMS_WORKER_RUNTIME_PROMISE__"] = runtimePromise;

  try {
    return await runtimePromise;
  } finally {
    delete globalState["__EMS_WORKER_RUNTIME_PROMISE__"];
  }
}

export default {
  async fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext) {
    const { handler } = await getWorkerRuntime(env);
    return typeof handler === "function"
      ? handler(request, env, ctx)
      : handler.fetch!(request, env, ctx);
  },
};
