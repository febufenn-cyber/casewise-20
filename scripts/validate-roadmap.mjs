import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const manifestPath = new URL('docs/roadmap/remaining-phases-manifest.json', root);
const planPath = new URL('docs/roadmap/remaining-phases-autonomous-build-plan.md', root);

const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const plan = await fs.readFile(planPath, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(manifest.schema_version === 1, 'Roadmap schema_version must be 1');
assert(manifest.current_completed_phase === 4, 'Roadmap must begin after completed Phase 4');
assert(manifest.core_remaining_phase_count === 4, 'Roadmap must define exactly four core remaining phases');
assert(manifest.next_phase === 5, 'Next planned phase must be Phase 5');
assert(manifest.build_trigger === 'build', 'Build trigger must be exactly "build"');
assert(manifest.merge_policy?.target_branch === 'main', 'Roadmap merge target must be main');
assert(manifest.merge_policy?.merge_method === 'squash', 'Roadmap merge method must be squash');
assert(manifest.merge_policy?.require_green_ci_before_merge === true, 'Green CI must be required before merge');
assert(manifest.merge_policy?.verify_main_after_each_merge === true, 'Remote main verification must be required after every merge');

const phases = manifest.phases ?? [];
assert(phases.length === 4, 'Exactly four core phases must be defined');
assert(JSON.stringify(phases.map((phase) => phase.id)) === JSON.stringify([5, 6, 7, 8]), 'Core phases must be sequentially numbered 5 through 8');

const incrementIds = new Set();
for (const phase of phases) {
  assert(phase.status === 'planned', `Phase ${phase.id} must be planned`);
  assert(typeof phase.name === 'string' && phase.name.length > 8, `Phase ${phase.id} name missing`);
  assert(typeof phase.objective === 'string' && phase.objective.length > 20, `Phase ${phase.id} objective missing`);
  assert(/^\d+\.\d+\.\d+$/.test(phase.version_target), `Phase ${phase.id} version target is invalid`);
  assert(Array.isArray(phase.entry_gates) && phase.entry_gates.length >= 4, `Phase ${phase.id} needs at least four entry gates`);
  assert(Array.isArray(phase.exit_gates) && phase.exit_gates.length >= 5, `Phase ${phase.id} needs at least five exit gates`);
  assert(Array.isArray(phase.non_goals) && phase.non_goals.length >= 5, `Phase ${phase.id} needs at least five non-goals`);
  assert(Array.isArray(phase.increments) && phase.increments.length === 5, `Phase ${phase.id} must have five increments`);
  assert(plan.includes(`# Phase ${phase.id} —`), `Plan document is missing Phase ${phase.id}`);

  const expectedLetters = ['A', 'B', 'C', 'D', 'E'];
  phase.increments.forEach((increment, index) => {
    const expectedId = `${phase.id}${expectedLetters[index]}`;
    assert(increment.id === expectedId, `Expected increment ${expectedId}, found ${increment.id}`);
    assert(!incrementIds.has(increment.id), `Duplicate increment id ${increment.id}`);
    incrementIds.add(increment.id);
    assert(typeof increment.name === 'string' && increment.name.length > 4, `Increment ${increment.id} name missing`);
    assert(Array.isArray(increment.deliverables) && increment.deliverables.length >= 3, `Increment ${increment.id} needs at least three deliverables`);
  });
}

for (const requiredText of [
  'Meaning of the command `build`',
  'Mandatory pre-build verification',
  'Autonomous execution contract',
  'Mandatory stop conditions',
  'Required final confirmation after every `build`',
  'Phase 9+ expansion',
]) {
  assert(plan.includes(requiredText), `Plan document is missing required section: ${requiredText}`);
}

assert(manifest.optional_expansion?.phase_label === '9+', 'Optional expansion must be labelled Phase 9+');
assert(Array.isArray(manifest.autonomy_policy?.stop_only_for) && manifest.autonomy_policy.stop_only_for.length >= 5, 'Autonomy stop conditions are incomplete');
assert(Array.isArray(manifest.autonomy_policy?.never_claim) && manifest.autonomy_policy.never_claim.length >= 4, 'Trustworthiness rules are incomplete');

console.log(`Validated remaining-phases roadmap: ${phases.length} core phases, ${incrementIds.size} increments, build trigger '${manifest.build_trigger}'.`);
