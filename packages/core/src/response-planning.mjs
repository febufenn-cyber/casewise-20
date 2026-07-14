const NODE_TYPES = new Set(['factual_answer','evidence_to_verify','client_question','contradiction_to_resolve','authority_research_task','internal_note']);
const MATERIALITIES = new Set(['critical','high','medium','low','unrated']);
const NODE_STATUSES = new Set(['open','in_progress','blocked','resolved','dismissed']);
const SUPPORT_ROLES = new Set(['primary','supporting','context','contradictory','question_basis']);

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

export function validatePlanNode(input = {}) {
  const nodeType = input.node_type ?? 'internal_note';
  const materiality = input.materiality ?? 'unrated';
  const nodeStatus = input.node_status ?? 'open';
  if (!NODE_TYPES.has(nodeType)) throw new Error('invalid node_type');
  if (!MATERIALITIES.has(materiality)) throw new Error('invalid materiality');
  if (!NODE_STATUSES.has(nodeStatus)) throw new Error('invalid node_status');
  if (!input.matrix_row_id) throw new Error('matrix_row_id is required');
  if (!input.allegation_id) throw new Error('allegation_id is required');
  const title = cleanText(input.title);
  if (!title) throw new Error('title is required');
  if (title.length > 240) throw new Error('title is too long');
  const details = cleanText(input.details);
  if (details.length > 4000) throw new Error('details are too long');
  if (nodeType === 'client_question' && !/[?]$/.test(title) && !/[?]$/.test(details)) throw new Error('client question must be phrased as a question');
  if (nodeType === 'factual_answer' && /\b(will win|is liable|committed fraud|must file|should sue)\b/i.test(`${title} ${details}`)) throw new Error('factual answer node contains a legal or strategy conclusion');

  const supportBindings = (input.support_bindings ?? []).map((binding) => {
    const objectType = cleanText(binding.object_type);
    const objectId = cleanText(binding.object_id);
    const sourceSpanId = cleanText(binding.source_span_id);
    const supportRole = binding.support_role ?? 'primary';
    if (!objectType || !objectId || !sourceSpanId) throw new Error('each plan-node support requires object_type, object_id, and source_span_id');
    if (!SUPPORT_ROLES.has(supportRole)) throw new Error('invalid support_role');
    return { object_type: objectType, object_id: objectId, source_span_id: sourceSpanId, support_role: supportRole };
  });
  if (!supportBindings.length) throw new Error('at least one source-bound support is required');
  const keys = supportBindings.map((binding) => `${binding.object_type}:${binding.object_id}:${binding.source_span_id}:${binding.support_role}`);
  if (new Set(keys).size !== keys.length) throw new Error('duplicate plan-node support');

  const warnings = [];
  if (nodeType === 'authority_research_task') warnings.push('external_authority_research_not_executed');
  if (nodeType === 'client_question') warnings.push('question_not_answered_by_system');
  return {
    matrix_row_id: input.matrix_row_id,
    allegation_id: input.allegation_id,
    node_type: nodeType,
    title,
    details: details || null,
    materiality,
    node_status: nodeStatus,
    assigned_to: input.assigned_to ?? null,
    due_at: input.due_at ?? null,
    position: Number.isInteger(input.position) && input.position >= 0 ? input.position : 0,
    support_bindings: supportBindings,
    warnings,
  };
}

export function validatePlanDependencies(nodes = [], dependencies = []) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const graph = new Map();
  for (const dependency of dependencies) {
    if (!nodeIds.has(dependency.node_id) || !nodeIds.has(dependency.depends_on_node_id)) throw new Error('dependency nodes must belong to the plan');
    if (dependency.node_id === dependency.depends_on_node_id) throw new Error('plan node cannot depend on itself');
    const values = graph.get(dependency.node_id) ?? [];
    values.push(dependency.depends_on_node_id);
    graph.set(dependency.node_id, values);
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error('response plan dependencies contain a cycle');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependencyId of graph.get(id) ?? []) visit(dependencyId);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of nodeIds) visit(id);
  return true;
}

export function responsePlanReadiness(nodes = [], dependencies = [], context = {}) {
  const warnings = [];
  if (!context.matrix_snapshot_attorney_approved) warnings.push('attorney_approved_matrix_required');
  if (!context.overview_ready) warnings.push('reviewed_overview_required');
  if (!nodes.length) warnings.push('response_plan_empty');
  try { validatePlanDependencies(nodes, dependencies); }
  catch { warnings.push('response_plan_dependency_invalid'); }
  const unreviewed = nodes.filter((node) => !['accepted','corrected'].includes(node.review_status));
  const withoutSources = nodes.filter((node) => Number(node.support_count ?? node.support_bindings?.length ?? 0) === 0);
  const blocked = nodes.filter((node) => node.node_status === 'blocked');
  if (unreviewed.length) warnings.push('unreviewed_plan_nodes');
  if (withoutSources.length) warnings.push('plan_nodes_without_sources');
  if (blocked.length) warnings.push('blocked_plan_nodes');
  return {
    ready_for_approval: warnings.length === 0,
    node_count: nodes.length,
    unreviewed_node_count: unreviewed.length,
    missing_source_count: withoutSources.length,
    blocked_node_count: blocked.length,
    authority_research_task_count: nodes.filter((node) => node.node_type === 'authority_research_task').length,
    production_use_allowed: false,
    warnings: unique(warnings),
  };
}

export function responsePlanSummary(nodes = []) {
  return {
    node_count: nodes.length,
    open_count: nodes.filter((node) => node.node_status === 'open').length,
    in_progress_count: nodes.filter((node) => node.node_status === 'in_progress').length,
    resolved_count: nodes.filter((node) => node.node_status === 'resolved').length,
    high_materiality_count: nodes.filter((node) => ['critical','high'].includes(node.materiality)).length,
    client_question_count: nodes.filter((node) => node.node_type === 'client_question').length,
    authority_research_task_count: nodes.filter((node) => node.node_type === 'authority_research_task').length,
  };
}

export const responsePlanningConstants = {
  node_types: [...NODE_TYPES],
  materialities: [...MATERIALITIES],
  node_statuses: [...NODE_STATUSES],
  support_roles: [...SUPPORT_ROLES],
};
