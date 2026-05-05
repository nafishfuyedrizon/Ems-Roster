import "@workspace/db/load-env";
import app from "./app";
import { httpServerHandler } from "cloudflare:node";

const workerPort = Number(process.env["PORT"] ?? process.env["API_PORT"] ?? "3000");

app.listen(workerPort);

export default httpServerHandler({ port: workerPort });
