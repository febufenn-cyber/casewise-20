export type OverviewSectionInput = { section_key?: string; title?: string; position?: number; sentence_ids?: string[] };
export type ValidatedOverviewSection = { section_key: string; title: string; position: number; sentence_ids: string[] };
export function validateOverviewSections(inputs?: OverviewSectionInput[]): ValidatedOverviewSection[];
export function overviewReadiness(sections?: ValidatedOverviewSection[], sentences?: Array<Record<string, any>>, context?: Record<string, unknown>): {
  ready_for_review: boolean;
  section_count: number;
  sentence_count: number;
  missing_sentence_count: number;
  unreviewed_sentence_count: number;
  blocked_sentence_count: number;
  missing_source_count: number;
  warnings: string[];
};
export function buildOverviewSourceManifest(snapshot?: Record<string, any>, sections?: ValidatedOverviewSection[], sentences?: Array<Record<string, any>>, supports?: Array<Record<string, any>>): {
  entries: Array<Record<string, any>>;
  manifest_fingerprint: string;
};
export function overviewSummary(sections?: ValidatedOverviewSection[], sentences?: Array<Record<string, any>>): Record<string, number>;
