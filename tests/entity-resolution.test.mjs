import test from 'node:test';
import assert from 'node:assert/strict';
import { matchCandidate, mergeSnapshot, normalizeObservedName, proposeEntityMatches } from '../packages/core/src/entity-resolution.mjs';

test('normalizes honorifics and company suffixes without losing the observed form', () => {
  assert.equal(normalizeObservedName('M/s. Zenith Tech Pvt. Ltd.'), 'zenith tech private limited');
  assert.equal(normalizeObservedName('Shri R. Kumar'), 'r kumar');
});

test('blocks same-name entities with conflicting identifiers', () => {
  const result = matchCandidate({ raw_text: 'R Kumar', entity_type: 'person', identifiers: { pan: 'AAA' } }, { raw_text: 'R. Kumar', entity_type: 'person', identifiers: { pan: 'BBB' } });
  assert.equal(result.decision, 'blocked');
});

test('promotes exact identifiers above name similarity', () => {
  const result = matchCandidate({ raw_text: 'Zenith Tech', entity_type: 'organization', identifiers: { cin: 'U123' } }, { raw_text: 'Zenith Technologies Private Limited', entity_type: 'organization', identifiers: { cin: 'U123' } });
  assert.equal(result.decision, 'strong_candidate');
  assert.ok(result.reasons.includes('identifier_match:cin'));
});

test('produces reviewable pair proposals', () => {
  const proposals = proposeEntityMatches([{ id: 'a', raw_text: 'Zenith Pvt Ltd', entity_type: 'organization' }, { id: 'b', raw_text: 'Zenith Private Limited', entity_type: 'organization' }]);
  assert.equal(proposals.length, 1);
});

test('captures reversible merge assignments', () => {
  const snapshot = mergeSnapshot('target', [{ id: 'source', status: 'active', display_name: 'Alias' }], [{ id: 'm1', entity_id: 'source' }]);
  assert.deepEqual(snapshot.mention_assignments, [{ mention_id: 'm1', previous_entity_id: 'source' }]);
});
