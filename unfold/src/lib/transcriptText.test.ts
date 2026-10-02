import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextComposerText, readTranscript } from './transcriptText';

test('reads text from a speech model result', () => {
  assert.equal(readTranscript({ text: '  hello there  ' }), 'hello there');
  assert.equal(readTranscript([{ text: 'hello' }, { text: 'there' }]), 'hello there');
  assert.equal(readTranscript({ text: '...' }), '');
  assert.equal(readTranscript({ text: '  我今日好攰，唔想做功課  ' }), '我今日好攰，唔想做功課');
});

test('keeps text the student already edited', () => {
  assert.equal(nextComposerText('my words', 'from the recording', true), 'my words');
  assert.equal(nextComposerText('preview', 'from the recording', false), 'from the recording');
  assert.equal(nextComposerText('preview', '   ', false), 'preview');
});
