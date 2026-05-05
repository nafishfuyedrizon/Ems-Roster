import "@workspace/db/load-env";
import { httpServerHandler } from "cloudflare:node";

const { default: app } = await import("./app");

const workerPort = Number(process.env["PORT"] ?? process.env["API_PORT"] ?? "3000");

app.listen(workerPort);

export default httpServerHandler({ port: workerPort });
