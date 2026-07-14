export type NarrativeSupportBinding = {
  object_type: string;
  object_id: string;
  source_span_id: string;
  support_role: 'primary' | 'supporting' | 'context' | 'contradictory' | 'omission_basis';
};

export type NarrativeSentenceInput = {
  section_key?: string;
  position?: number;
  sentence_text?: string;
  claim_type?: string;
  materiality?: string;
  attribution_entity_id?: string | null;
  dispute_status?: string;
  uncertainty_status?: string;
  omission_status?: string;
  creation_method?: string;
  processing_version?: string;
  support_bindings?: Array<Partial<NarrativeSupportBinding>>;
  [key: string]: unknown;
};

export type ValidatedNarrativeSentence = {
  section_key: string;
  position: number;
  sentence_text: string;
  claim_type: string;
  materiality: string;
  attribution_entity_id: string | null;
  dispute_status: string;
  uncertainty_status: string;
  omission_status: string;
  creation_method: string;
  processing_version: string;
  support_bindings: NarrativeSupportBinding[];
  warnings: string[];
  support_status: 'supported' | 'review_required' | 'blocked';
};

export function detectUnsupportedLanguage(input?: NarrativeSentenceInput): string[];
export function validateNarrativeSentence(input?: NarrativeSentenceInput): ValidatedNarrativeSentence;
export function narrativeSentenceReadiness(sentence?: Record<string, unknown>): {
  ready_for_review: boolean;
  ready_for_acceptance: boolean;
  support_count: number;
  warnings: string[];
};
export function narrativeSupportSetReadiness(sentences?: Array<Record<string, unknown>>, context?: Record<string, unknown>): {
  ready_for_overview: boolean;
  sentence_count: number;
  blocked_sentence_count: number;
  unreviewed_sentence_count: number;
  production_use_allowed: false;
  warnings: string[];
};
export const narrativeSupportConstants: Record<string, string[]>;
