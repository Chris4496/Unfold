import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAudible, mixToMono, resample, toPcm16 } from './pcm';
import { nextComposerText, readTranscript } from './transcriptText';

test('mixes stereo into one channel', () => {
  const mixed = mixToMono([
    new Float32Array([0, 1]),
    new Float32Array([1, 1]),
  ]);
  assert.deepEqual(Array.from(mixed), [0.5, 1]);
});

test('resamples a short signal to a lower rate', () => {
  const output = resample(new Float32Array([0, 0, 1, 1]), 4, 2);
  assert.deepEqual(Array.from(output), [0, 1]);
});

test('silence is not treated as speech', () => {
  assert.equal(isAudible(new Float32Array(16000)), false);
  assert.equal(isAudible(new Float32Array([0, 0.2, 0])), true);
});

test('converts samples to 16-bit PCM for the phone speech model', () => {
  const pcm = new Int16Array(toPcm16(new Float32Array([0, 1, -1, 2, 0.5])));
  assert.deepEqual(Array.from(pcm), [0, 32767, -32767, 32767, 16384]);
});

test('drops non-speech tags from a speech model result', () => {
  assert.equal(readTranscript({ result: '' }), '');
  assert.equal(readTranscript(' _(Mandarin)      '), '');
  assert.equal(readTranscript('[Music]'), '');
  assert.equal(readTranscript('(笑聲) 我今日好攰'), '我今日好攰');
});

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
