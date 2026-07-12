import { Hono } from "hono";
import type { Env, Variables } from "../env";
import { pageDisplayLabel } from "../../../../packages/core/src/page-identity.mjs";
import { signScopedToken, verifyScopedToken } from "../../../../packages/core/src/tokens.mjs";
import { audit } from "../lib/audit";
import { requireMatterRole } from "../lib/authorization";
import { ApiError } from "../lib/http";
import { serviceRest } from "../lib/supabase";
import { renderViewer } from "../viewer";

export const sources = new Hono<{ Bindings: Env; Variables: Variables }>();
async function sourceRecord(env: Env, spanId: string) {
  const rows = await serviceRest(env, `/source_spans?id=eq.${encodeURIComponent(spanId)}&select=*,text_extractions(*,pages(*,page_renders(*),uploaded_files(*)))&limit=1`);
  if (!rows?.length) throw new ApiError(404, "Source span not found", "not_found");
  return rows[0];
}

sources.get("/source-spans/:spanId", async (c) => {
  const span = await sourceRecord(c.env, c.req.param("spanId")); const extraction = span.text_extractions; const page = extraction.pages; const file = page.uploaded_files; const user = c.get("user");
  await requireMatterRole(c.env, c.get("accessToken"), user.id, file.matter_id, "viewer");
  if (["deletion_pending", "deleted"].includes(file.status)) throw new ApiError(410, "Source unavailable", "source_unavailable");
  const render = page.page_renders?.find((item: { status: string }) => item.status === "active"); if (!render) throw new ApiError(409, "Page render unavailable", "render_unavailable");
  const now = Math.floor(Date.now() / 1000); const token = await signScopedToken({ action: "view_page_render", span_id: span.id, page_id: page.id, object_key: render.object_key, exp: now + Number(c.env.DOWNLOAD_TOKEN_TTL_SECONDS) }, c.env.TOKEN_SIGNING_SECRET, now);
  await audit(c.env, { organization_id: file.organization_id, matter_id: file.matter_id, actor_id: user.id, action: "source.opened", resource_type: "source_span", resource_id: span.id, request_id: c.get("requestId") });
  return c.json({ data: { id: span.id, quoted_text: span.quoted_text, polygon: span.bounding_polygon, status: span.status, extraction_method: extraction.extraction_method, extraction_version: extraction.extraction_version, page_label: pageDisplayLabel(page), warnings: [...(extraction.warnings ?? []), ...(page.warnings ?? [])], image_url: `${c.env.PUBLIC_BASE_URL}/api/source-spans/${span.id}/page-image?token=${encodeURIComponent(token)}`, file: { id: file.id, filename: file.original_filename, sha256: file.sha256 } } });
});

sources.get("/source-spans/:spanId/page-image", async (c) => {
  const span = await sourceRecord(c.env, c.req.param("spanId")); const page = span.text_extractions.pages; const render = page.page_renders?.find((item: { status: string }) => item.status === "active");
  if (!render) throw new ApiError(404, "Page render not found", "not_found");
  await verifyScopedToken(c.req.query("token"), c.env.TOKEN_SIGNING_SECRET, { action: "view_page_render", span_id: span.id, page_id: page.id, object_key: render.object_key });
  const object = await c.env.EVIDENCE_BUCKET.get(render.object_key); if (!object) throw new ApiError(404, "Page image not found", "not_found");
  return new Response(object.body, { headers: { "content-type": "image/png", "cache-control": "private, no-store", "content-security-policy": "default-src 'none'" } });
});
sources.get("/viewer/:spanId", async (c) => c.html(renderViewer(c.req.param("spanId"))));
