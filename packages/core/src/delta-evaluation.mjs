const OUTCOMES = new Set(['true_positive','false_positive','false_negative','type_mismatch','material_omission']);
const MATERIALITY = new Set(['critical','high','medium','low','unrated']);

function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

export function validateDeltaEvaluationInput(input = {}) {
  const packLabel = String(input.pack_label ?? '').trim();
  if (!packLabel) throw new Error('evaluation pack label is required');
  const baselineMinutes = Number(input.baseline_minutes);
  const casewiseMinutes = Number(input.casewise_minutes);
  if (!Number.isFinite(baselineMinutes) || baselineMinutes <= 0) throw new Error('baseline minutes must be greater than zero');
  if (!Number.isFinite(casewiseMinutes) || casewiseMinutes < 0) throw new Error('casewise minutes must be zero or greater');
  if (!Array.isArray(input.observations) || input.observations.length === 0) throw new Error('evaluation observations are required');
  const observations = input.observations.map((item, index) => {
    if (!OUTCOMES.has(item.outcome)) throw new Error(`invalid evaluation outcome at index ${index}`);
    const materiality = item.materiality ?? 'unrated';
    if (!MATERIALITY.has(materiality)) throw new Error(`invalid materiality at index ${index}`);
    if (item.outcome === 'true_positive' && !item.delta_item_id) throw new Error(`true positive requires delta_item_id at index ${index}`);
    return {
      delta_item_id: item.delta_item_id ?? null,
      expected_change_type: item.expected_change_type ?? null,
      predicted_change_type: item.predicted_change_type ?? null,
      outcome: item.outcome,
      materiality,
      source_pair_verified: item.source_pair_verified === true,
      notes: String(item.notes ?? '').trim() || null,
    };
  });
  return {
    pack_label: packLabel,
    baseline_minutes: baselineMinutes,
    casewise_minutes: casewiseMinutes,
    observations,
    notes: String(input.notes ?? '').trim() || null,
  };
}

export function computeDeltaEvaluation(observations = [], timing = {}) {
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let typeMismatch = 0;
  let materialOmission = 0;
  let sourcePairFailure = 0;
  for (const item of observations) {
    if (item.outcome === 'true_positive') truePositive += 1;
    if (item.outcome === 'false_positive') falsePositive += 1;
    if (item.outcome === 'false_negative') falseNegative += 1;
    if (item.outcome === 'type_mismatch') { typeMismatch += 1; falsePositive += 1; falseNegative += 1; }
    if (item.outcome === 'material_omission') { materialOmission += 1; falseNegative += 1; }
    if (!item.source_pair_verified) sourcePairFailure += 1;
  }
  const baselineMinutes = Number(timing.baseline_minutes ?? 0);
  const casewiseMinutes = Number(timing.casewise_minutes ?? 0);
  const timeSavingsMinutes = baselineMinutes > 0 ? baselineMinutes - casewiseMinutes : null;
  const timeSavingsFraction = baselineMinutes > 0 ? Number(((baselineMinutes - casewiseMinutes) / baselineMinutes).toFixed(4)) : null;
  return {
    observation_count: observations.length,
    true_positive_count: truePositive,
    false_positive_count: falsePositive,
    false_negative_count: falseNegative,
    type_mismatch_count: typeMismatch,
    material_omission_count: materialOmission,
    source_pair_failure_count: sourcePairFailure,
    precision: ratio(truePositive, truePositive + falsePositive),
    recall: ratio(truePositive, truePositive + falseNegative),
    f1: (() => {
      const precision = ratio(truePositive, truePositive + falsePositive);
      const recall = ratio(truePositive, truePositive + falseNegative);
      return precision != null && recall != null && precision + recall > 0 ? Number((2 * precision * recall / (precision + recall)).toFixed(4)) : null;
    })(),
    baseline_minutes: baselineMinutes,
    casewise_minutes: casewiseMinutes,
    time_savings_minutes: timeSavingsMinutes,
    time_savings_fraction: timeSavingsFraction,
  };
}

export function evaluateDeltaGate(metrics, thresholds = {}) {
  const limits = {
    minimum_observations: Number(thresholds.minimum_observations ?? 20),
    minimum_precision: Number(thresholds.minimum_precision ?? 0.9),
    minimum_recall: Number(thresholds.minimum_recall ?? 0.9),
    minimum_time_savings_fraction: Number(thresholds.minimum_time_savings_fraction ?? 0.25),
  };
  const reasons = [];
  if (metrics.observation_count < limits.minimum_observations) reasons.push('evaluation_sample_too_small');
  if (metrics.precision == null || metrics.precision < limits.minimum_precision) reasons.push('precision_below_gate');
  if (metrics.recall == null || metrics.recall < limits.minimum_recall) reasons.push('recall_below_gate');
  if (metrics.material_omission_count > 0) reasons.push('material_omission_present');
  if (metrics.source_pair_failure_count > 0) reasons.push('source_pair_failure_present');
  if (metrics.time_savings_fraction == null || metrics.time_savings_fraction < limits.minimum_time_savings_fraction) reasons.push('review_time_savings_below_gate');
  const incomplete = reasons.includes('evaluation_sample_too_small');
  return {
    gate_status: reasons.length === 0 ? 'passed' : incomplete ? 'incomplete' : 'failed',
    reasons,
    thresholds: limits,
  };
}

export const deltaEvaluationConstants = {
  outcomes: [...OUTCOMES],
  materiality: [...MATERIALITY],
};
