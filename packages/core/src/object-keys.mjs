const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function requireUuid(value, label) {
  if (!UUID.test(value)) throw new Error(`${label} must be a UUID`);
  return value.toLowerCase();
}
export function originalObjectKey({ organizationId, matterId, uploadId }) {
  return `quarantine/organizations/${requireUuid(organizationId, "organizationId")}/matters/${requireUuid(matterId, "matterId")}/uploads/${requireUuid(uploadId, "uploadId")}/original`;
}
export function acceptedOriginalKey({ organizationId, matterId, fileId }) {
  return `originals/organizations/${requireUuid(organizationId, "organizationId")}/matters/${requireUuid(matterId, "matterId")}/files/${requireUuid(fileId, "fileId")}/original`;
}
export function derivedObjectKey({ organizationId, matterId, fileId, runId, relativePath }) {
  const safe = normalizeRelativeArtifactPath(relativePath);
  return `derived/organizations/${requireUuid(organizationId, "organizationId")}/matters/${requireUuid(matterId, "matterId")}/files/${requireUuid(fileId, "fileId")}/runs/${requireUuid(runId, "runId")}/${safe}`;
}
export function normalizeRelativeArtifactPath(value) {
  if (typeof value !== "string" || !value) throw new Error("artifact path is required");
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..") || normalized.includes("//") || /[\u0000-\u001f]/.test(normalized)) throw new Error("unsafe artifact path");
  if (!/^[A-Za-z0-9._/-]+$/.test(normalized)) throw new Error("unsupported artifact path characters");
  return normalized;
}
