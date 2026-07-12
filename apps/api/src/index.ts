import { Hono } from "hono";
import type { Env, Variables } from "./env";
import { requireAuth, requestContext } from "./lib/auth";
import { jsonError } from "./lib/http";
import { matters } from "./routes/matters";
import { uploads } from "./routes/uploads";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use("*", requestContext);
app.onError((error, c) => jsonError(c, error));
app.get("/healthz", (c) => c.json({ status: "ok", phase: "1b" }));
app.use("/api/*", requireAuth);
app.get("/api/me", (c) => c.json({ data: c.get("user") }));
app.route("/api/matters", matters);
app.route("/api", uploads);
export default { fetch: app.fetch } satisfies ExportedHandler<Env>;
