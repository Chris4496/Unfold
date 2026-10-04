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

test('removes Chinese full names in common forms', () => {
  // Bare three-character name: surname + two given-name characters.
  const bare = deidentify('陳小明又唔想返學。');
  assert.equal(bare.text, '[PERSON]又唔想返學。');
  assert.deepEqual(bare.tokens, ['PERSON']);

  // Surname + title.
  const title = deidentify('陳老師話我知。');
  assert.equal(title.text, '[PERSON]話我知。');
  assert.deepEqual(title.tokens, ['PERSON']);

  // Name after a relationship word; the relationship word is kept.
  const peer = deidentify('我同學黃家明今日喊咗。');
  assert.equal(peer.text, '我同學[PERSON]今日喊咗。');

  // Two-character name before a speech verb.
  const verb = deidentify('李明問我可唔可以幫手。');
  assert.equal(verb.text, '[PERSON]問我可唔可以幫手。');

  // Mixed English and Chinese in one note.
  const mixed = deidentify('Miss Chan said hello to 陳小明.');
  assert.equal(mixed.text, '[PERSON] said hello to [PERSON].');
  assert.deepEqual(mixed.tokens, ['PERSON']);
});

test('keeps Chinese words that only look like names', () => {
  // 黃/白 as colours, 張 as a measure word, 陳年 as “aged”.
  assert.equal(deidentify('今日買咗白色嘅衫同黃色嘅裙。').text, '今日買咗白色嘅衫同黃色嘅裙。');
  assert.equal(deidentify('我買咗一張枱同兩張凳。').text, '我買咗一張枱同兩張凳。');
  assert.equal(deidentify('陳年普洱茶好香。').text, '陳年普洱茶好香。');
  // Stop-listed everyday words that surname+given patterns could swallow.
  assert.equal(deidentify('白天唔想瞓。').text, '白天唔想瞓。');
  assert.equal(deidentify('高山反應好辛苦。').text, '高山反應好辛苦。');
  assert.equal(deidentify('溫柔講咗兩句。').text, '溫柔講咗兩句。');
  // 小王子 with no surname boundary, and the place 黃大仙.
  assert.equal(deidentify('小王子本書好好睇。').text, '小王子本書好好睇。');
  assert.equal(deidentify('黃大仙站落車。').text, '黃大仙站落車。');
  assert.equal(deidentify('今日天氣好，天空係藍色。').tokens.length, 0);
});

test('removes Chinese street addresses and estates', () => {
  const street = deidentify('我住喺旺角道12號。');
  assert.equal(street.text, '我住喺[ADDRESS]。');
  assert.deepEqual(street.tokens, ['ADDRESS']);

  const estate = deidentify('放學去咗太古城。');
  assert.equal(estate.text, '放學去咗[ADDRESS]。');

  const village = deidentify('佢搬咗去美孚新邨。');
  assert.equal(village.text, '佢搬咗去[ADDRESS]。');

  const two = deidentify('彌敦道同上海街交界。');
  assert.equal(two.text, '[ADDRESS]同[ADDRESS]交界。');

  const garden = deidentify('去咗黃埔花園食飯。');
  assert.equal(garden.text, '去咗[ADDRESS]食飯。');
});

test('keeps generic Chinese road words and bare day-of-month numbers', () => {
  assert.equal(deidentify('過馬路要小心。').text, '過馬路要小心。');
  assert.equal(deidentify('我知道咗。').text, '我知道咗。');
  assert.equal(deidentify('呢條街好嘈。').text, '呢條街好嘈。');
  assert.equal(deidentify('屋企離學校三公里。').text, '屋企離學校三公里。');
  assert.equal(deidentify('呢個城市好大。').text, '呢個城市好大。');
  // 號 without a street prefix is a date in Cantonese — leave it alone.
  assert.equal(deidentify('聽日12號要交功課。').text, '聽日12號要交功課。');
});

test('removes mainland Chinese mobile and HK landline formats', () => {
  const mobile = deidentify('打俾我 13812345678。');
  assert.equal(mobile.text, '打俾我 [PHONE]。');
  assert.deepEqual(mobile.tokens, ['PHONE']);

  const landline = deidentify('固網電話係2345 6789。');
  assert.equal(landline.text, '固網電話係[PHONE]。');

  // 8 digits without a separator and starting 2/3 is not treated as a landline.
  assert.equal(deidentify('學號係23456789。').text, '學號係23456789。');

  const mixed = deidentify('陳小明嘅電話係13812345678。');
  assert.equal(mixed.text, '[PERSON]嘅電話係[PHONE]。');
  assert.deepEqual(mixed.tokens, ['PERSON', 'PHONE']);
});
