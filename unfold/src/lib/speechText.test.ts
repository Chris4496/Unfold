import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyRecognitionResult,
  chooseRecognitionLanguage,
  emptyDraft,
  joinSpeech,
  languageSwitchLocales,
  readDraft,
} from './speechText';

test('prefers an installed Cantonese or Hong Kong locale', () => {
  assert.deepEqual(chooseRecognitionLanguage(['en-US', 'zh-HK'], ['en-US', 'yue-HK']), {
    lang: 'yue-HK',
    onDevice: true,
  });
  assert.deepEqual(chooseRecognitionLanguage(['en-US', 'zh-HK'], []), {
    lang: 'zh-HK',
    onDevice: false,
  });
});

test('uses the web fallback when the device has no locale list', () => {
  assert.deepEqual(chooseRecognitionLanguage([], [], 'yue-Hant-HK'), {
    lang: 'yue-Hant-HK',
    onDevice: false,
  });
});

test('keeps an installed locale when Cantonese and English are unavailable', () => {
  assert.deepEqual(chooseRecognitionLanguage(['fr-FR'], ['fr-FR']), {
    lang: 'fr-FR',
    onDevice: true,
  });
  assert.deepEqual(chooseRecognitionLanguage([], ['fr-FR']), {
    lang: 'fr-FR',
    onDevice: true,
  });
});

test('offers Android language switching only when Chinese and English are installed', () => {
  assert.deepEqual(languageSwitchLocales(['zh-HK', 'en-US']), ['zh-HK', 'en-US']);
  assert.equal(languageSwitchLocales(['zh-HK']), null);
  assert.equal(languageSwitchLocales(['en-GB']), null);
});

test('builds a transcript from interim text and later final segments', () => {
  let draft = emptyDraft();
  draft = applyRecognitionResult(draft, { isFinal: false, transcript: 'hello' });
  assert.equal(readDraft(draft), 'hello');
  draft = applyRecognitionResult(draft, { isFinal: true, transcript: 'hello there' });
  draft = applyRecognitionResult(draft, { isFinal: false, transcript: 'I' });
  assert.equal(readDraft(draft), 'hello there I');
  draft = applyRecognitionResult(draft, { isFinal: true, transcript: 'am tired' });
  assert.equal(readDraft(draft), 'hello there am tired');
});

test('does not repeat a cumulative final result', () => {
  let draft = applyRecognitionResult(emptyDraft(), { isFinal: true, transcript: 'hello' });
  draft = applyRecognitionResult(draft, { isFinal: true, transcript: 'hello there' });
  assert.equal(readDraft(draft), 'hello there');
});

test('keeps the last interim phrase when the recognizer sends an empty final', () => {
  let draft = applyRecognitionResult(emptyDraft(), { isFinal: false, transcript: '我今日好攰' });
  draft = applyRecognitionResult(draft, { isFinal: true, transcript: '' });
  assert.equal(readDraft(draft), '我今日好攰');
});

test('joins Cantonese segments without an extra space', () => {
  assert.equal(joinSpeech('我今日', '好攰'), '我今日好攰');
  const draft = applyRecognitionResult(
    applyRecognitionResult(emptyDraft(), { isFinal: true, transcript: '我今日' }),
    { isFinal: true, transcript: '好攰' },
  );
  assert.equal(readDraft(draft), '我今日好攰');
});

test('drops recognition noise that has no words', () => {
  const draft = applyRecognitionResult(emptyDraft(), { isFinal: true, transcript: '...' });
  assert.equal(readDraft(draft), '');
});
