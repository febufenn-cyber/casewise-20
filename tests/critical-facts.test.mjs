import test from 'node:test';
import assert from 'node:assert/strict';
import { compareAmountRepresentations, parseDateMention, parseDocumentReference, parseIndianAmount, referenceResolution } from '../packages/core/src/critical-facts.mjs';

test('preserves month precision instead of inventing one day', () => {
  const value = parseDateMention('March 2024');
  assert.equal(value.precision, 'month');
  assert.equal(value.normalized_start, '2024-03-01');
  assert.equal(value.normalized_end, '2024-03-31');
});

test('keeps ambiguous numeric dates unresolved without locale', () => {
  const value = parseDateMention('03/04/2024');
  assert.equal(value.certainty, 'ambiguous');
  assert.equal(value.ambiguity.length, 2);
});

test('normalizes Indian lakh and crore scales', () => {
  assert.equal(parseIndianAmount('Rs. 8.5 lakhs').normalized_value, '850000.00');
  assert.equal(parseIndianAmount('₹2 crore').normalized_value, '20000000.00');
});

test('flags amount words and digits conflicts', () => {
  assert.equal(compareAmountRepresentations('₹5 lakh', '₹8 lakh').status, 'conflict');
});

test('resolves annexure references only when one candidate exists', () => {
  const reference = parseDocumentReference('Annexure P-7');
  assert.equal(referenceResolution(reference, [{ id: 'd1', annexure_label: 'P-7' }]).status, 'resolved');
  assert.equal(referenceResolution(reference, []).status, 'referenced_but_absent');
});
