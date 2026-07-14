const ARTIFACT_TYPES = new Set(['overview_sentence','response_plan_node','stale_propagation']);
const OUTCOMES = new Set(['supported','unsupported','citation_failure','material_omission','stale_propagation_pass','stale_propagation_failure','correction_none','correction_minor','correction_major','correction_material']);
const MATERIALITIES = new Set(['critical','high','medium','low','unrated']);

function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function validatePhase5EvaluationInput(input = {}) {
  const packLabel = cleanText(input.pack_label);
  if (!packLabel) throw new Error('evaluation pack label is required');
  const baselineMinutes = Number(input.baseline_minutes);
  const casewiseMinutes = Number(input.casewise_minutes);
  if (!Number.isFinite(baselineMinutes) || baselineMinutes <= 0) throw new Error('baseline minutes must be greater than zero');
  if (!Number.isFinite(casewiseMinutes) || casewiseMinutes < 0) throw new Error('casewise minutes must be zero or greater');
  if (!Array.isArray(input.observations) || input.observations.length === 0) throw new Error('evaluation observations are required');

  const observations = input.observations.map((item, index) => {
    if (!ARTIFACT_TYPES.has(item.artifact_type)) throw new Error(`invalid artifact_type at index ${index}`);
    if (!OUTCOMES.has(item.outcome)) throw new Error(`invalid outcome at index ${index}`);
    const materiality = item.materiality ?? 'unrated';
    if (!MATERIALITIES.has(materiality)) throw new Error(`invalid materiality at index ${index}`);
    if (item.artifact_type !== 'stale_propagation' && !item.artifact_id) throw new Error(`artifact_id is required at index ${index}`);
    if (item.artifact_type === 'stale_propagation' && !['stale_propagation_pass','stale_propagation_failure'].includes(item.outcome)) throw new Error(`stale propagation observation has invalid outcome at index ${index}`);
    if (item.artifact_type !== 'stale_propagation' && ['stale_propagation_pass','stale_propagation_failure'].includes(item.outcome)) throw new Error(`non-stale observation has stale outcome at index ${index}`);
    return {
      artifact_type: item.artifact_type,
      artifact_id: item.artifact_id ?? null,
      outcome: item.outcome,
      materiality,
      source_verified: item.source_verified === true,
      expected_support: item.expected_support !== false,
      notes: cleanText(item.notes) || null,
    };
  });

  return {
    pack_label: packLabel,
    baseline_minutes: baselineMinutes,
    casewise_minutes: casewiseMinutes,
    observations,
    notes: cleanText(input.notes) || null,
  };
}

export function computePhase5Evaluation(observations = [], timing = {}) {
  const overview = observations.filter((item) => item.artifact_type === 'overview_sentence');
  const plan = observations.filter((item) => item.artifact_type === 'response_plan_node');
  const stale = observations.filter((item) => item.artifact_type === 'stale_propagation');
  const sourceRelevant = observations.filter((item) => item.artifact_type !== 'stale_propagation' && item.expected_support !== false);
  const sourceVerified = sourceRelevant.filter((item) => item.source_verified && item.outcome !== 'citation_failure');
  const materialNarrative = overview.filter((item) => ['critical','high'].includes(item.materiality));
  const unsupportedMaterial = materialNarrative.filter((item) => item.outcome === 'unsupported' || item.outcome === 'citation_failure');
  const overviewSupported = overview.filter((item) => item.outcome === 'supported' && item.source_verified);
  const planSupported = plan.filter((item) => item.outcome === 'supported' && item.source_verified);
  const materialOmissions = observations.filter((item) => item.outcome === 'material_omission');
  const staleFailures = stale.filter((item) => item.outcome === 'stale_propagation_failure');
  const correctionMinor = observations.filter((item) => item.outcome === 'correction_minor');
  const correctionMajor = observations.filter((item) => item.outcome === 'correction_major');
  const correctionMaterial = observations.filter((item) => item.outcome === 'correction_material');
  const baselineMinutes = Number(timing.baseline_minutes ?? 0);
  const casewiseMinutes = Number(timing.casewise_minutes ?? 0);
  const timeSavingsMinutes = baselineMinutes > 0 ? baselineMinutes - casewiseMinutes : null;
  const timeSavingsFraction = baselineMinutes > 0 ? Number(((baselineMinutes - casewiseMinutes) / baselineMinutes).toFixed(4)) : null;

  return {
    observation_count: observations.length,
    overview_sentence_count: overview.length,
    response_plan_node_count: plan.length,
    stale_propagation_observation_count: stale.length,
    citation_fidelity: ratio(sourceVerified.length, sourceRelevant.length),
    unsupported_material_language_count: unsupportedMaterial.length,
    unsupported_material_language_rate: ratio(unsupportedMaterial.length, materialNarrative.length),
    sentence_support_coverage: ratio(overviewSupported.length, overview.length),
    plan_node_support_coverage: ratio(planSupported.length, plan.length),
    material_omission_count: materialOmissions.length,
    stale_propagation_failure_count: staleFailures.length,
    correction_minor_count: correctionMinor.length,
    correction_major_count: correctionMajor.length,
    correction_material_count: correctionMaterial.length,
    baseline_minutes: baselineMinutes,
    casewise_minutes: casewiseMinutes,
    time_savings_minutes: timeSavingsMinutes,
    time_savings_fraction: timeSavingsFraction,
  };
}

export function evaluatePhase5Gate(metrics, thresholds = {}) {
  const limits = {
    minimum_observations: Number(thresholds.minimum_observations ?? 20),
    minimum_citation_fidelity: Number(thresholds.minimum_citation_fidelity ?? 0.99),
    maximum_unsupported_material_language_rate: Number(thresholds.maximum_unsupported_material_language_rate ?? 0),
    minimum_sentence_support_coverage: Number(thresholds.minimum_sentence_support_coverage ?? 0.98),
    minimum_plan_node_support_coverage: Number(thresholds.minimum_plan_node_support_coverage ?? 0.98),
    maximum_material_omissions: Number(thresholds.maximum_material_omissions ?? 0),
    maximum_stale_propagation_failures: Number(thresholds.maximum_stale_propagation_failures ?? 0),
    maximum_material_corrections: Number(thresholds.maximum_material_corrections ?? 0),
    minimum_time_savings_fraction: Number(thresholds.minimum_time_savings_fraction ?? 0.25),
  };
  const reasons = [];
  if (metrics.observation_count < limits.minimum_observations) reasons.push('evaluation_sample_too_small');
  if (metrics.overview_sentence_count === 0) reasons.push('overview_sentence_sample_missing');
  if (metrics.response_plan_node_count === 0) reasons.push('response_plan_node_sample_missing');
  if (metrics.stale_propagation_observation_count === 0) reasons.push('stale_propagation_sample_missing');
  if (metrics.citation_fidelity == null || metrics.citation_fidelity < limits.minimum_citation_fidelity) reasons.push('citation_fidelity_below_gate');
  if (metrics.unsupported_material_language_rate == null || metrics.unsupported_material_language_rate > limits.maximum_unsupported_material_language_rate) reasons.push('unsupported_material_language_above_gate');
  if (metrics.sentence_support_coverage == null || metrics.sentence_support_coverage < limits.minimum_sentence_support_coverage) reasons.push('sentence_support_coverage_below_gate');
  if (metrics.plan_node_support_coverage == null || metrics.plan_node_support_coverage < limits.minimum_plan_node_support_coverage) reasons.push('plan_node_support_coverage_below_gate');
  if (metrics.material_omission_count > limits.maximum_material_omissions) reasons.push('material_omission_present');
  if (metrics.stale_propagation_failure_count > limits.maximum_stale_propagation_failures) reasons.push('stale_propagation_failure_present');
  if (metrics.correction_material_count > limits.maximum_material_corrections) reasons.push('material_correction_present');
  if (metrics.time_savings_fraction == null || metrics.time_savings_fraction < limits.minimum_time_savings_fraction) reasons.push('review_time_savings_below_gate');
  const incompleteReasons = new Set(['evaluation_sample_too_small','overview_sentence_sample_missing','response_plan_node_sample_missing','stale_propagation_sample_missing']);
  const incomplete = reasons.some((reason) => incompleteReasons.has(reason));
  return { gate_status: reasons.length === 0 ? 'passed' : incomplete ? 'incomplete' : 'failed', reasons, thresholds: limits };
}

export const phase5EvaluationConstants = {
  artifact_types: [...ARTIFACT_TYPES],
  outcomes: [...OUTCOMES],
  materialities: [...MATERIALITIES],
};
