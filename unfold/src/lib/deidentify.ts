import type { TokenKind } from '../types';

const TOKEN_ORDER: TokenKind[] = ['PERSON', 'SCHOOL', 'ADDRESS', 'PHONE', 'EMAIL'];

const NAME_STOP = new Set([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'Today',
  'Yesterday',
  'Tomorrow',
  'January',
  'February',
  'March',
  'April',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'Secondary',
  'Primary',
  'School',
  'College',
  'University',
  'The',
  'This',
  'That',
  'Mum',
  'Mom',
  'Dad',
  'More',
  'Really',
  'Very',
  'Just',
  'Not',
]);

// ---------------------------------------------------------------------------
// Chinese patterns (traditional + simplified; transcripts are converted to
// traditional, but typed notes may be either). Deliberately conservative:
// every rule needs a strong signal so ordinary narrative is left untouched.
// ---------------------------------------------------------------------------

/** Common Chinese surnames, used as the first character of a full-name match. */
const ZH_SURNAMES =
  '陳林黃張李王吳劉蔡楊許鄭謝郭洪曾邱廖賴周徐蘇葉莊呂江何蕭羅高潘簡朱鍾彭游詹胡施沈余盧梁曹顏柯孫魏翁方馬馮杜鄧傅侯連溫白范趙陸韓袁譚宋唐湯董金錢秦任阮伍麥歐區藍黎關霍倪柳' +
  '陈黄张刘杨郑谢赖苏叶庄吕萧罗简钟卢颜孙邓连温范赵陆韩谭汤钱麦欧蓝关';

/**
 * Characters common in Chinese given names but rare in grammar words.
 * Requiring every given-name character to come from this set is the main
 * guard against redacting ordinary words (黃色, 陳年, 一張紙 never match).
 */
const ZH_GIVEN =
  '小大子文明華华玉金志強强健德永俊傑杰偉伟嘉欣怡婷靜静雅詩诗雨曉晓天宇航浩然軒轩豪樂乐心思可安寧宁光輝辉耀祖國国建立成美麗丽香蘭兰桂珍珠鳳凤燕萍芳芬莉敏慧穎颖瑩莹雪冰春秋冬君英榮荣富貴贵龍龙鋒锋劍剑斌鵬鹏飛飞翔晨晴楠梅松濤涛波海洋峰霖禮礼義义仁信孝良賢贤聰聪卓希旭朗琛琪瑤瑶雯毅睿智遠远逸家宏正世少淑婉倩蕊彤嵐岚桐柏泉坤忠達达庭雲云山';

/** Everyday words that a name pattern could otherwise swallow. */
const ZH_NAME_STOP = new Set([
  '白天',
  '王子',
  '王后',
  '王國',
  '王国',
  '馬上',
  '马上',
  '馬路',
  '马路',
  '馬虎',
  '马虎',
  '高山',
  '高地',
  '高中',
  '方法',
  '方式',
  '方向',
  '方面',
  '白色',
  '白飯',
  '白饭',
  '葉子',
  '叶子',
  '溫柔',
  '温柔',
  '溫馨',
  '温馨',
  '關心',
  '关心',
  '金山',
  '黃大仙',
  '馬鞍山',
  '蘇格蘭',
  '苏格兰',
  '白云山',
  '白雲山',
]);

const ZH_SURNAME_CLASS = `[${ZH_SURNAMES}]`;
const ZH_GIVEN_CLASS = `[${ZH_GIVEN}]`;
/** Verbs that typically follow a person's name in Chinese narrative. */
const ZH_NAME_VERBS = '說講話問答喊哭笑叫鬧嗌駡罵';
/** Relationship words that typically precede a person's name. */
const ZH_NAME_PREFIX =
  '(?:同學|同学|朋友|老師|老师|表哥|表姐|表弟|表妹|堂哥|堂姐|堂弟|堂妹|鄰居|邻居|學長|学长|學姐|学姐|師兄|师兄|師姐|师姐|同事)';
/** Titles that follow a surname (陳老師, 黃先生) — an unambiguous name signal. */
const ZH_NAME_TITLE = '(?:先生|小姐|太太|老師|老师|醫生|医生|校長|校长|姑娘|經理|经理)';

/**
 * Grammar/function characters that never appear inside a Chinese place name.
 * The address patterns only accept prefixes built from other CJK characters,
 * so 呢條街 / 我喺太古城 never match at the wrong span.
 */
const ZH_ADDR_FORBIDDEN =
  '我你他她佢它們们是在於于喺咗著着過咁噉嘅哋嘢呢嗰邊边裏裡內外前後下左右間间出入來去到返走行企坐落住食飲饮睇見聽听講說说话問答想覺觉會会能可唔沒没有好壞坏多少舊旧年月日號号今昨哪嗎吗吧啊呀啦囉啰咩啲個个條条塊块件本支杯碗碟盒包袋座層层的了和與与跟同';
/** A single allowed place-name character (CJK minus function words). */
const ZH_ADDR_CHAR = `(?:(?![${ZH_ADDR_FORBIDDEN}])[㐀-鿿])`;
/** Generic road words that are not addresses (matched by suffix). */
const ZH_ADDR_STOP = [
  '知道',
  '味道',
  '地道',
  '公道',
  '頻道',
  '频道',
  '渠道',
  '報道',
  '报导',
  '街道',
  '馬路',
  '马路',
  '公路',
  '鐵路',
  '铁路',
  '道路',
  '套路',
  '思路',
  '出路',
  '活路',
  '去路',
  '門路',
  '门路',
  '後路',
  '后路',
  '絕路',
  '绝路',
  '迷路',
  '問路',
  '问路',
  '趕路',
  '赶路',
  '公里',
  '英里',
  '海里',
  '家里',
  '屋里',
  '心里',
  '这里',
  '那里',
  '哪里',
];

export type Redaction = {
  text: string;
  tokens: TokenKind[];
};

function pushToken(tokens: TokenKind[], token: TokenKind): string {
  tokens.push(token);
  return `[${token}]`;
}

export function uniqueTokens(tokens: TokenKind[]): TokenKind[] {
  return TOKEN_ORDER.filter((token) => tokens.includes(token));
}

export function deidentify(input: string): Redaction {
  const tokens: TokenKind[] = [];
  let text = input;

  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, () => pushToken(tokens, 'EMAIL'));
  // Mainland mobile (11 digits) first so it is not partially matched by the 8-digit rules.
  text = text.replace(/\b(?:\+?86[\s-]?)?1[3-9]\d{9}\b/g, () => pushToken(tokens, 'PHONE'));
  text = text.replace(/\b(?:\+?852[\s-]?)?[569]\d{3}[\s-]?\d{4}\b/g, () => pushToken(tokens, 'PHONE'));
  // HK landline: the separator is required so 8-digit ids/dates are left alone.
  text = text.replace(/\b[23]\d{3}[\s-]\d{4}\b/g, () => pushToken(tokens, 'PHONE'));
  text = text.replace(
    /\b\d{1,5}[A-Za-z]?(?:\/\d{1,4})?\s+(?:[A-Z][\w'’.-]+\s+){0,4}(?:Road|Street|Rd|St|Avenue|Ave|Lane|Drive|Path|Estate|Building|Court|Crescent|Square)\b/g,
    () => pushToken(tokens, 'ADDRESS'),
  );
  text = text.replace(
    /\b(?:[A-Z][\w'’.-]+\s+){1,4}(?:Secondary|Primary|College|University|Academy|Institute|School)\b/g,
    () => pushToken(tokens, 'SCHOOL'),
  );
  text = text.replace(/\b(?:Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, () =>
    pushToken(tokens, 'PERSON'),
  );
  text = text.replace(
    /\b(friend|classmate|teacher|tutor)\s+([A-Z][a-z]+)\b/g,
    (full, relation: string, name: string) => {
      if (NAME_STOP.has(name)) return full;
      return `${relation} ${pushToken(tokens, 'PERSON')}`;
    },
  );
  text = text.replace(/\b(?:my name is|i am called|i'm called|named)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/gi, (full, name: string) => {
    if (NAME_STOP.has(name)) return full;
    const prefix = full.slice(0, full.length - name.length);
    return `${prefix}${pushToken(tokens, 'PERSON')}`;
  });
  text = text.replace(/\b([A-Z][a-z]+)\s+said\b/g, (full, name: string) => {
    if (NAME_STOP.has(name) || name.startsWith('[')) return full;
    return `${pushToken(tokens, 'PERSON')} said`;
  });

  // Chinese street addresses: place-name prefix + 道/街/路/… (+ optional 門牌號).
  text = text.replace(
    new RegExp(`${ZH_ADDR_CHAR}{1,8}(?:道|大街|街|路|里|徑|径|坊|圍|围|巷)(?:\\s*\\d{1,4}(?:[-–—]\\d{1,4})?[A-Za-z]?號)?`, 'g'),
    (full) => {
      if (!/\d/.test(full) && ZH_ADDR_STOP.some((stop) => full.endsWith(stop))) return full;
      return pushToken(tokens, 'ADDRESS');
    },
  );
  // Chinese estates and buildings: 太古城, 黃埔花園, 美孚新邨, 時代廣場…
  text = text.replace(
    new RegExp(`${ZH_ADDR_CHAR}{2,6}(?:大廈|大厦|中心|廣場|广场|花園|花园|邨|苑|城)`, 'g'),
    () => pushToken(tokens, 'ADDRESS'),
  );

  // Chinese names: surname + title (陳老師, 黃先生) — unambiguous.
  text = text.replace(new RegExp(`${ZH_SURNAME_CLASS}${ZH_NAME_TITLE}`, 'g'), () => pushToken(tokens, 'PERSON'));
  // Chinese names after a relationship word (同學陳小明, 朋友李家欣).
  text = text.replace(new RegExp(`(${ZH_NAME_PREFIX})${ZH_SURNAME_CLASS}${ZH_GIVEN_CLASS}{1,2}`, 'g'), (full, prefix: string) =>
    `${prefix}${pushToken(tokens, 'PERSON')}`,
  );
  // Chinese names right before a speech/emotion verb (陳小明話, 李明問).
  text = text.replace(
    new RegExp(`${ZH_SURNAME_CLASS}${ZH_GIVEN_CLASS}{1,2}(?=[${ZH_NAME_VERBS}])`, 'g'),
    (full) => (ZH_NAME_STOP.has(full) ? full : pushToken(tokens, 'PERSON')),
  );
  // Bare three-character full names (surname + two given-name characters, e.g. 陳小明).
  text = text.replace(
    new RegExp(`${ZH_SURNAME_CLASS}${ZH_GIVEN_CLASS}${ZH_GIVEN_CLASS}`, 'g'),
    (full) => (ZH_NAME_STOP.has(full) ? full : pushToken(tokens, 'PERSON')),
  );

  return { text, tokens: uniqueTokens(tokens) };
}
