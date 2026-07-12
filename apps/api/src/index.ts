import { Hono } from "hono";
import type { Env, Variables } from "./env";
import { requireAuth, requestContext } from "./lib/auth";
import { jsonError } from "./lib/http";
import { consumeQueue } from "./queue";
import { deletion } from "./routes/deletion";
import { documents } from "./routes/documents";
import { entities } from "./routes/entities";
import { facts } from "./routes/facts";
import { internal } from "./routes/internal";
import { matters } from "./routes/matters";
import { sources } from "./routes/sources";
import { uploads } from "./routes/uploads";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use("*", requestContext);
app.onError((error, c) => jsonError(c, error));
app.get("/healthz", (c) => c.json({ status: "ok", phase: "2c" }));
app.route("/internal", internal);
app.use("/api/*", requireAuth);
app.get("/api/me", (c) => c.json({ data: c.get("user") }));
app.route("/api/matters", matters);
app.route("/api", uploads);
app.route("/api", sources);
app.route("/api", deletion);
app.route("/api", documents);
app.route("/api", entities);
app.route("/api", facts);

export default {
  fetch: app.fetch,
  queue: consumeQueue,
} satisfies ExportedHandler<Env, import("./env").QueuePayload>;
