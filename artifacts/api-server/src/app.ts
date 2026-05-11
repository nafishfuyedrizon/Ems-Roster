import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
let isWorkerRuntime = false;
try {
  await import("cloudflare:workers");
  isWorkerRuntime = true;
} catch {}

if (!isWorkerRuntime) {
  const { default: pinoHttp } = await import("pino-http");
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );
}
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "ems-api",
    health: "/api/healthz",
  });
});

app.use("/api", router);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON request body." });
  }

  logger.error({ err }, "Unhandled API error");
  return res.status(500).json({ error: "Internal server error." });
});

export default app;
