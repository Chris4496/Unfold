import assert from 'node:assert/strict';
import { test } from 'node:test';
import { audioFileName, audioMimeType } from '../transcribeAudio';
import { isAudible, mixToMono, resample } from './pcm';
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

test('reads text from a speech model result', () => {
  assert.equal(readTranscript({ text: '  hello there  ' }), 'hello there');
  assert.equal(readTranscript([{ text: 'hello' }, { text: 'there' }]), 'hello there');
  assert.equal(readTranscript({ text: '...' }), '');
  assert.equal(readTranscript({ text: '  我今日好攰，唔想做功課  ' }), '我今日好攰，唔想做功課');
});

test('reads text from an ElevenLabs Scribe result', () => {
  assert.equal(
    readTranscript({
      language_code: 'yue',
      text: '  我今日好攰，唔想做功課  ',
      words: [{ text: '我' }, { text: '今日' }],
    }),
    '我今日好攰，唔想做功課',
  );
});

test('picks an audio filename and mime type for Scribe', () => {
  assert.equal(audioFileName('audio/webm', 'blob:http://localhost/1'), 'recording.webm');
  assert.equal(audioMimeType('audio/webm', 'blob:http://localhost/1'), 'audio/webm');
  assert.equal(audioFileName(undefined, 'file:///data/recording.m4a'), 'recording.m4a');
  assert.equal(audioMimeType(undefined, 'file:///data/recording.m4a'), 'audio/mp4');
});

test('keeps text the student already edited', () => {
  assert.equal(nextComposerText('my words', 'from the recording', true), 'my words');
  assert.equal(nextComposerText('preview', 'from the recording', false), 'from the recording');
  assert.equal(nextComposerText('preview', '   ', false), 'preview');
});
