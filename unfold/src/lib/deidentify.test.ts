import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deidentify } from './deidentify';

test('removes a school, a person, and an address', () => {
  const school = deidentify('Coursework is piling up at Westview Secondary.');
  assert.equal(school.text, 'Coursework is piling up at [SCHOOL].');
  assert.deepEqual(school.tokens, ['SCHOOL']);

  const person = deidentify('Ms Chan said the deadline is Friday.');
  assert.equal(person.text, '[PERSON] said the deadline is Friday.');
  assert.deepEqual(person.tokens, ['PERSON']);

  const friend = deidentify('I talked to my friend Jamie about it after class.');
  assert.equal(friend.text, 'I talked to my friend [PERSON] about it after class.');

  const address = deidentify('I went back to 88 Harbour Road.');
  assert.equal(address.text, 'I went back to [ADDRESS].');
  assert.deepEqual(address.tokens, ['ADDRESS']);
});

test('keeps family roles and weekdays', () => {
  const result = deidentify('Mum keeps asking about grades on Friday.');
  assert.equal(result.text, 'Mum keeps asking about grades on Friday.');
  assert.deepEqual(result.tokens, []);
});

test('removes phone numbers and email addresses', () => {
  const result = deidentify('Text 9123 4567 or alex@example.com.');
  assert.equal(result.text, 'Text [PHONE] or [EMAIL].');
  assert.deepEqual(result.tokens, ['PHONE', 'EMAIL']);
});
