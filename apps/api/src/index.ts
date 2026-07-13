import { Hono } from "hono";
import type { Env, Variables } from "./env";
import { requireAuth, requestContext } from "./lib/auth";
import { jsonError } from "./lib/http";
import { consumeQueue } from "./queue";
import { allegations } from "./routes/allegations";
import { chronology } from "./routes/chronology";
import { deletion } from "./routes/deletion";
import { documents } from "./routes/documents";
import { entities } from "./routes/entities";
import { evidence } from "./routes/evidence";
import { events } from "./routes/events";
import { facts } from "./routes/facts";
import { internal } from "./routes/internal";
import { matters } from "./routes/matters";
import { responses } from "./routes/responses";
import { sources } from "./routes/sources";
import { uploads } from "./routes/uploads";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use("*", requestContext);
app.onError((error, c) => jsonError(c, error));
app.get("/healthz", (c) => c.json({ status: "ok", phase: "3c" }));
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
app.route("/api", events);
app.route("/api", chronology);
app.route("/api", allegations);
app.route("/api", responses);
app.route("/api", evidence);

export default {
  fetch: app.fetch,
  queue: consumeQueue,
} satisfies ExportedHandler<Env, import("./env").QueuePayload>;
