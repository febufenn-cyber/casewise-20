export type DependencyRow = {
  upstream_type: string;
  upstream_id: string;
  downstream_type: string;
  downstream_id: string;
  dependency_reason?: string;
  status?: string;
};
export function phase5ApprovalReadiness(overview?: Record<string, any>, plan?: Record<string, any>, planReadiness?: Record<string, any>, context?: Record<string, unknown>): {
  can_approve: boolean;
  warnings: string[];
  production_use_allowed: false;
  overview_snapshot_id: string | null;
  response_plan_snapshot_id: string | null;
};
export function buildInternalExportManifest(input?: Record<string, any>): { manifest: Record<string, any>; manifest_fingerprint: string };
export function invalidationTargets(dependencies?: DependencyRow[], upstream?: { type?: string; id?: string }): Array<{ downstream_type: string; downstream_id: string; reason: string }>;
export function buildDependencyRows(input?: Record<string, any>): DependencyRow[];
