// Server-side GenAI integration for Unfold.
//
// All LLM calls go to the Gemini API (OpenAI-compatible chat completions)
// using the GEMINI_API_KEY from this server's environment only. The key must
// never be bundled into the Expo client or the worker-web frontend.
//
// Every exported function returns one of:
//   { result, genai: true }                    - real GenAI result, validated
//   { result, genai: false, reason }           - deterministic local fallback
//
// The `genai` flag lets the UI clearly show when output is NOT GenAI-produced.
// Fallback logic is a rule-based port of the on-device heuristics in
// unfold/src/lib/organise.ts and unfold/src/lib/ask.ts.
//
// This module is self-contained: it reads process.env directly and imports
// nothing from sibling server files.

// ---------------------------------------------------------------------------
// Configuration (read per call so tests and runtime env changes take effect)
// ---------------------------------------------------------------------------

function getConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY || '',
    baseUrl: (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/+$/, ''),
    model: process.env.GENAI_MODEL || 'gemini-3.8-flash',
    timeoutMs: Number(process.env.GENAI_TIMEOUT_MS || 15000),
  };
}

// ---------------------------------------------------------------------------
// Error type carrying a machine-readable fallback reason
// ---------------------------------------------------------------------------

class GenaiUnavailable extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GenaiUnavailable';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Low-level chat completion call returning a parsed JSON object
// ---------------------------------------------------------------------------

function extractJson(content) {
  // First try a direct parse, then tolerate markdown fences / surrounding prose.
  try {
    return JSON.parse(content);
  } catch {
    // continue to repair attempt
  }
  const unfenced = content.replace(/```(?:json)?/gi, ' ');
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(unfenced.slice(start, end + 1));
    } catch {
      // fall through
    }
  }
  throw new GenaiUnavailable('invalid-json', 'Model response was not valid JSON');
}

async function chatJson({ system, user, maxTokens = 4096 }) {
  const { apiKey, baseUrl, model, timeoutMs } = getConfig();
  if (!apiKey) {
    throw new GenaiUnavailable('no-api-key', 'GEMINI_API_KEY is not set on the server');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        // Gemini 3 thinks by default. Keep reasoning low so short JSON tasks
        // finish inside the request timeout. Temperature is omitted so the
        // provider default applies.
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!response.ok) {
      throw new GenaiUnavailable('http-error', `Gemini API responded with status ${response.status}`);
    }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      throw new GenaiUnavailable('bad-response', 'Gemini API response had no message content');
    }
    return extractJson(content);
  } catch (err) {
    if (err instanceof GenaiUnavailable) throw err;
    if (err && err.name === 'AbortError') {
      throw new GenaiUnavailable('timeout', `Gemini API request timed out after ${timeoutMs}ms`);
    }
    throw new GenaiUnavailable('request-failed', `Gemini API request failed: ${err?.message ?? err}`);
  } finally {
    clearTimeout(timer);
  }
}

// Wraps a GenAI attempt with a deterministic fallback.
async function withFallback(attempt, fallback) {
  try {
    const result = await attempt();
    return { result, genai: true };
  } catch (err) {
    const reason = err instanceof GenaiUnavailable ? err.code : 'unknown-error';
    return { result: fallback(), genai: false, reason };
  }
}

// ---------------------------------------------------------------------------
// Shared entry normalisation (entries arrive as { id, day, text })
// ---------------------------------------------------------------------------

function entryText(entry) {
  return String(entry?.text ?? entry?.deidentified ?? entry?.transcript ?? '');
}

function entryDay(entry) {
  return String(entry?.day ?? entry?.createdAt ?? '');
}

function entryIds(entries) {
  return new Set(entries.map((entry) => String(entry.id)));
}

// ---------------------------------------------------------------------------
// Fallback utilities ported from unfold/src/lib (organise.ts, ask.ts, text.ts)
// ---------------------------------------------------------------------------

const TOPICS = [
  {
    id: 'academic',
    phrase: 'academic pressure',
    daily: 'coursework',
    words: ['coursework', 'homework', 'exam', 'exams', 'grade', 'grades', 'study', 'studying', 'assignment', 'deadline', 'class', 'project', 'schoolwork', 'academic', 'concentrate'],
  },
  { id: 'family', phrase: 'family expectations', daily: 'family', words: ['family', 'mum', 'mom', 'dad', 'parent', 'parents'] },
  { id: 'group', phrase: 'group collaboration', daily: 'group tasks', words: ['group', 'allocation', 'teammate', 'teammates', 'collaboration'] },
  { id: 'sleep', phrase: 'sleep', daily: 'sleep', words: ['sleep', 'sleeping', 'slept', 'insomnia', 'tired', 'awake'] },
  { id: 'friends', phrase: 'time with friends', daily: 'meeting friends', words: ['friend', 'friends'] },
];

const TOPIC_IDS = TOPICS.map((topic) => topic.id);
const ATTRIBUTE_IDS = ['event', 'feeling', 'interpersonal', 'help', 'everyday'];
const DIFFICULT_TOPICS = new Set(['academic', 'family', 'sleep', 'group']);

function topicById(id) {
  return TOPICS.find((topic) => topic.id === id);
}

function detectTopics(text) {
  const lower = text.toLowerCase();
  return TOPICS.filter((topic) => topic.words.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(lower))).map((topic) => topic.id);
}

function detectAttributes(text) {
  const lower = text.toLowerCase();
  const attributes = [];
  if (/\b(feel|feeling|felt|tired|stressed|stress|worried|worry|pressure|can't|cannot|unfair)\b/i.test(lower)) attributes.push('feeling');
  if (/\b(friend|mum|mom|dad|parent|group|teacher|classmate)\b/i.test(lower)) attributes.push('interpersonal');
  if (/\b(counsellor|counselor|social worker|help|support)\b/i.test(lower)) attributes.push('help');
  if (/\b(went|said|talked|finished|met|happened|deadline|class|home)\b/i.test(lower)) attributes.push('event');
  if (attributes.length === 0) attributes.push('everyday');
  return attributes;
}

function detectEventTimeHint(text) {
  const lower = text.toLowerCase();
  const patterns = [
    /\b(this morning|this afternoon|this evening|tonight|last night|yesterday|the day before yesterday|last week|last weekend|this weekend|on monday|on tuesday|on wednesday|on thursday|on friday|on saturday|on sunday)\b/i,
  ];
  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) return match[1];
  }
  return null;
}

const STOP_WORDS = new Set([
  'what', 'when', 'where', 'who', 'did', 'does', 'do', 'i', 'me', 'my', 'about', 'the', 'a', 'an', 'of', 'to', 'and', 'or', 'in', 'on', 'for', 'is', 'was', 'were', 'it', 'that', 'this', 'with', 'from', 'have', 'has', 'had', 'mention', 'mentioned', 'say', 'said', 'find', 'show', 'tell', 'earlier', 'last', 'week', 'today', 'yesterday',
]);

function words(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function joinAnd(items) {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]}`;
}

function capitalize(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function clip(text, max = 180) {
  const trimmed = String(text).replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

function sortedByDay(entries) {
  return [...entries].sort((a, b) => entryDay(a).localeCompare(entryDay(b)));
}

function countTopic(entries, topicId) {
  return entries.filter((entry) => detectTopics(entryText(entry)).includes(topicId)).length;
}

// ---------------------------------------------------------------------------
// 1. classifyEntry
// ---------------------------------------------------------------------------

const CLASSIFY_SHAPE = `{
  "topics": ["academic" | "family" | "sleep" | "group" | "friends", ...],
  "attributes": ["event" | "feeling" | "interpersonal" | "help" | "everyday", ...],
  "eventTimeHint": string | null,
  "uncertainty": [string, ...]
}`;

function classifyFallback({ text }) {
  const topics = detectTopics(text);
  return {
    topics,
    attributes: detectAttributes(text),
    eventTimeHint: detectEventTimeHint(text),
    uncertainty: topics.length > 0 ? ['topics inferred from keywords only'] : ['no clear topic detected'],
  };
}

function validateClassification(raw) {
  if (!raw || typeof raw !== 'object') throw new GenaiUnavailable('invalid-shape', 'classification is not an object');
  const subset = (value, allowed) => (Array.isArray(value) ? [...new Set(value.filter((item) => allowed.includes(item)))] : []);
  return {
    topics: subset(raw.topics, TOPIC_IDS),
    attributes: (() => {
      const attrs = subset(raw.attributes, ATTRIBUTE_IDS);
      return attrs.length > 0 ? attrs : ['everyday'];
    })(),
    eventTimeHint: typeof raw.eventTimeHint === 'string' && raw.eventTimeHint.trim() ? raw.eventTimeHint.trim() : null,
    uncertainty: Array.isArray(raw.uncertainty) ? raw.uncertainty.filter((item) => typeof item === 'string') : [],
  };
}

export async function classifyEntry({ text }) {
  const input = { text: String(text ?? '') };
  return withFallback(
    async () => {
      const raw = await chatJson({
        system:
          'You classify one short deidentified journal note from a student. ' +
          `Respond with ONLY a JSON object of exactly this shape:\n${CLASSIFY_SHAPE}\n` +
          'Rules: topics and attributes must be subsets of the listed values. ' +
          'eventTimeHint is a short phrase like "yesterday evening" only when the note hints at when the event happened, otherwise null. ' +
          'List in uncertainty anything you had to guess. Do not add any other keys or prose.',
        user: `Note:\n"""${input.text}"""`,
        maxTokens: 4096,
      });
      return validateClassification(raw);
    },
    () => classifyFallback(input),
  );
}

// ---------------------------------------------------------------------------
// 2. linkEntries
// ---------------------------------------------------------------------------

const RELATIONS = ['same-event', 'continues', 'updates', 'corrects'];

const LINK_SHAPE = `{
  "links": [
    { "fromEntryId": string, "toEntryId": string, "relation": "same-event" | "continues" | "updates" | "corrects", "note": string }
  ]
}`;

function linkFallback(entries) {
  // Conservative: only link notes on different days that share at least two
  // distinctive content words. Never merges entries and never links same-day
  // notes, so distinct events stay separate.
  const links = [];
  const wordSets = entries.map((entry) => new Set(words(entryText(entry)).filter((word) => word.length > 4)));
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      if (entryDay(entries[i]) === entryDay(entries[j])) continue;
      const shared = [...wordSets[i]].filter((word) => wordSets[j].has(word));
      if (shared.length >= 2) {
        links.push({
          fromEntryId: String(entries[i].id),
          toEntryId: String(entries[j].id),
          relation: 'continues',
          note: `Both notes mention ${shared.slice(0, 3).join(', ')}.`,
        });
      }
      if (links.length >= 10) return { links };
    }
  }
  return { links };
}

function validateLinks(raw, entries) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.links)) {
    throw new GenaiUnavailable('invalid-shape', 'link result is missing a links array');
  }
  const ids = entryIds(entries);
  const seen = new Set();
  const links = [];
  for (const link of raw.links) {
    if (!link || typeof link !== 'object') continue;
    const fromEntryId = String(link.fromEntryId ?? '');
    const toEntryId = String(link.toEntryId ?? '');
    const relation = String(link.relation ?? '');
    if (!ids.has(fromEntryId) || !ids.has(toEntryId) || fromEntryId === toEntryId) continue;
    if (!RELATIONS.includes(relation)) continue;
    const pairKey = [fromEntryId, toEntryId].sort().join('|');
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);
    links.push({
      fromEntryId,
      toEntryId,
      relation,
      note: typeof link.note === 'string' ? clip(link.note, 200) : '',
    });
    if (links.length >= 20) break;
  }
  return { links };
}

export async function linkEntries(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length < 2) {
    return { result: { links: [] }, genai: false, reason: 'too-few-entries' };
  }
  return withFallback(
    async () => {
      const described = list
        .map((entry) => `- id: ${entry.id} | day: ${entryDay(entry)} | text: """${entryText(entry)}"""`)
        .join('\n');
      const raw = await chatJson({
        system:
          'You find semantic links ACROSS deidentified journal notes from one student. ' +
          `Respond with ONLY a JSON object of exactly this shape:\n${LINK_SHAPE}\n` +
          'Relations: "same-event" (two notes about one event), "continues" (a situation that keeps going across days), ' +
          '"updates" (new information about an earlier note), "corrects" (the later note corrects the earlier one). ' +
          'Link notes by their exact ids. Be conservative: when in doubt, add no link. ' +
          'NEVER treat two clearly distinct events as one. note is one short sentence citing what the notes share. No other keys or prose.',
        user: `Notes:\n${described}`,
        maxTokens: 4096,
      });
      return validateLinks(raw, list);
    },
    () => linkFallback(list),
  );
}

// ---------------------------------------------------------------------------
// 3. dailySummary
// ---------------------------------------------------------------------------

function dailySummaryFallback({ day, entries }) {
  const phrases = [];
  for (const entry of sortedByDay(entries)) {
    for (const topicId of detectTopics(entryText(entry))) {
      const phrase = topicById(topicId).daily;
      if (!phrases.includes(phrase)) phrases.push(phrase);
    }
  }
  const label = day ? String(day) : 'this day';
  if (phrases.length === 0) return { text: `Notes saved on ${label} did not mention a specific recurring topic.` };
  return { text: `On ${label} the notes talked about ${joinAnd(phrases)}.` };
}

export async function dailySummary({ day, entries }) {
  const list = Array.isArray(entries) ? entries : [];
  const input = { day, entries: list };
  if (list.length === 0) {
    return { result: { text: 'No notes were saved on this day.' }, genai: false, reason: 'no-entries' };
  }
  return withFallback(
    async () => {
      const described = list.map((entry) => `- """${entryText(entry)}"""`).join('\n');
      const raw = await chatJson({
        system:
          'You write a neutral daily summary of a student\'s deidentified journal notes. ' +
          'Respond with ONLY a JSON object of exactly this shape: { "text": string }. ' +
          'Rules: 2-4 short sentences. Faithful to the notes only - never invent events, people or feelings. ' +
          'No psychological labels, no diagnoses, no advice, no judgement. Plain factual tone.',
        user: `Day: ${String(day ?? '')}\nNotes:\n${described}`,
        maxTokens: 4096,
      });
      if (!raw || typeof raw.text !== 'string' || raw.text.trim() === '') {
        throw new GenaiUnavailable('invalid-shape', 'daily summary is missing text');
      }
      return { text: clip(raw.text.trim(), 800) };
    },
    () => dailySummaryFallback(input),
  );
}

// ---------------------------------------------------------------------------
// 4. briefResponse
// ---------------------------------------------------------------------------

const BRIEF_KINDS = ['acknowledgement', 'encouragement', 'invite-elaboration'];

function briefResponseFallback({ text, recentKinds }) {
  const recent = Array.isArray(recentKinds) ? recentKinds : [];
  const lastKind = recent[recent.length - 1];
  const canInvite = lastKind !== 'invite-elaboration';
  const lower = String(text ?? '').toLowerCase();
  const hasDifficulty = /(stress|stressed|worried|worry|tired|can't|cannot|unfair|pressure|difficult|hard|awake)/i.test(lower);
  if (hasDifficulty) {
    return {
      kind: 'encouragement',
      text: 'Thanks for putting this into words - it sounds like a lot to carry. You can just save this note; nothing else is needed.',
    };
  }
  if (canInvite && lower.trim().length > 0 && lower.trim().length < 200) {
    return {
      kind: 'invite-elaboration',
      text: 'Noted. If you like, you can add a little more about what happened - or simply leave it here.',
    };
  }
  return {
    kind: 'acknowledgement',
    text: 'Noted and saved. You can move on whenever you like.',
  };
}

function validateBriefResponse(raw, recentKinds) {
  if (!raw || typeof raw !== 'object') throw new GenaiUnavailable('invalid-shape', 'brief response is not an object');
  let kind = String(raw.kind ?? '');
  if (!BRIEF_KINDS.includes(kind)) throw new GenaiUnavailable('invalid-shape', `unknown brief response kind: ${kind}`);
  let text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (!text) throw new GenaiUnavailable('invalid-shape', 'brief response is missing text');
  const recent = Array.isArray(recentKinds) ? recentKinds : [];
  // Hard rule: never invite elaboration twice in a row.
  if (kind === 'invite-elaboration' && recent[recent.length - 1] === 'invite-elaboration') {
    kind = 'acknowledgement';
    text = 'Noted and saved. You can move on whenever you like.';
  }
  return { kind, text: clip(text, 300) };
}

export async function briefResponse({ text, recentKinds }) {
  const input = { text, recentKinds };
  return withFallback(
    async () => {
      const recent = Array.isArray(recentKinds) ? recentKinds.filter((kind) => BRIEF_KINDS.includes(kind)) : [];
      const raw = await chatJson({
        system:
          'You write ONE brief, low-intensity response shown after a student saves a deidentified journal note. ' +
          'Respond with ONLY a JSON object of exactly this shape: ' +
          '{ "kind": "acknowledgement" | "encouragement" | "invite-elaboration", "text": string }. ' +
          'Rules: one or two short sentences. Neutral and optional wording - the student can always skip or ignore it. ' +
          'No advice, no questions beyond at most one gentle optional invitation, no psychological labels. ' +
          `"invite-elaboration" is FORBIDDEN when the previous response kind was "invite-elaboration". ` +
          `Previous response kinds (oldest to newest): ${JSON.stringify(recent)}.`,
        user: `Saved note:\n"""${String(text ?? '')}"""`,
        maxTokens: 2048,
      });
      return validateBriefResponse(raw, recentKinds);
    },
    () => briefResponseFallback(input),
  );
}

// ---------------------------------------------------------------------------
// 5. analyseBackground
// ---------------------------------------------------------------------------

function analyseBackgroundFallback(entries) {
  // Prototype pattern check only. Not a clinical threshold or a risk score.
  const list = Array.isArray(entries) ? entries : [];
  const days = new Set(list.map((entry) => entryDay(entry)).filter(Boolean));
  const hardTopics = new Set();
  const evidence = [];
  for (const entry of list) {
    const topics = detectTopics(entryText(entry)).filter((topicId) => DIFFICULT_TOPICS.has(topicId));
    if (topics.length > 0) {
      topics.forEach((topicId) => hardTopics.add(topicId));
      if (evidence.length < 6) evidence.push(String(entry.id));
    }
  }
  const approaching = list.length >= 3 && days.size >= 2 && hardTopics.size >= 2;
  if (!approaching) {
    return {
      approaching: false,
      explanation:
        'The notes do not yet show difficult topics repeating across several days, so no background support pattern is flagged. ' +
        'This is an automatic keyword pattern check on the notes, not a clinical judgement.',
      evidence: [],
    };
  }
  const phrases = [...hardTopics].map((topicId) => topicById(topicId).phrase);
  return {
    approaching: true,
    explanation:
      `Across ${days.size} days the notes repeatedly mention ${joinAnd(phrases)}, which suggests the difficulties have persisted rather than appeared once. ` +
      'This is an automatic keyword pattern check on the notes, not a clinical judgement.',
    evidence,
  };
}

function validateBackground(raw, entries) {
  if (!raw || typeof raw !== 'object' || typeof raw.approaching !== 'boolean') {
    throw new GenaiUnavailable('invalid-shape', 'background analysis is missing a boolean approaching flag');
  }
  const ids = entryIds(entries);
  const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim() : '';
  if (!explanation) throw new GenaiUnavailable('invalid-shape', 'background analysis is missing an explanation');
  const evidence = Array.isArray(raw.evidence) ? [...new Set(raw.evidence.map(String).filter((id) => ids.has(id)))].slice(0, 10) : [];
  // Conservative: never flag without at least one cited record.
  const approaching = raw.approaching && evidence.length > 0;
  return { approaching, explanation: clip(explanation, 600), evidence: approaching ? evidence : [] };
}

export async function analyseBackground({ entries }) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) {
    return {
      result: {
        approaching: false,
        explanation: 'There are no notes to analyse. This is an automatic pattern check, not a clinical judgement.',
        evidence: [],
      },
      genai: false,
      reason: 'no-entries',
    };
  }
  return withFallback(
    async () => {
      const described = sortedByDay(list)
        .map((entry) => `- id: ${entry.id} | day: ${entryDay(entry)} | text: """${entryText(entry)}"""`)
        .join('\n');
      const raw = await chatJson({
        system:
          'You assess whether a student\'s deidentified journal notes show difficulties PERSISTING or CHANGING across days, ' +
          'to decide whether background support from a social worker may be worth offering. ' +
          'Respond with ONLY a JSON object of exactly this shape: ' +
          '{ "approaching": boolean, "explanation": string, "evidence": [entryId, ...] }. ' +
          'Rules: be conservative - set approaching to true only when difficulty clearly persists or worsens across more than one day. ' +
          'explanation must cite what the records actually say (topics, days) and must state that this is not a clinical judgement. ' +
          'evidence lists only ids of notes you relied on. Never diagnose. No other keys or prose.',
        user: `Notes (oldest to newest):\n${described}`,
        maxTokens: 4096,
      });
      return validateBackground(raw, list);
    },
    () => analyseBackgroundFallback(list),
  );
}

// ---------------------------------------------------------------------------
// 6. ask
// ---------------------------------------------------------------------------

function askFallback({ question, entries }) {
  const query = words(String(question ?? ''));
  if (query.length === 0) {
    return {
      found: false,
      text: 'Try asking about something recorded in the notes, such as coursework or sleep.',
      hits: [],
    };
  }
  const ranked = entries
    .map((entry) => {
      const haystack = words(entryText(entry));
      const score = query.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    // Multiple sources are arranged by date ascending.
    .sort((a, b) => entryDay(a.entry).localeCompare(entryDay(b.entry)) || b.score - a.score);
  if (ranked.length === 0) {
    return {
      found: false,
      text: 'I could not find anything about that in the available notes.',
      hits: [],
    };
  }
  const hits = ranked.slice(0, 3).map(({ entry }) => ({
    entryId: String(entry.id),
    dateLabel: entryDay(entry),
    quote: entryText(entry),
  }));
  const lines = hits.map((hit) => `On ${hit.dateLabel} the notes say: "${hit.quote}"`);
  return { found: true, text: lines.join('\n\n'), hits };
}

function validateAsk(raw, entries) {
  if (!raw || typeof raw !== 'object') throw new GenaiUnavailable('invalid-shape', 'ask result is not an object');
  const byId = new Map(entries.map((entry) => [String(entry.id), entry]));
  const hits = [];
  if (Array.isArray(raw.hits)) {
    for (const hit of raw.hits) {
      if (!hit || typeof hit !== 'object') continue;
      const entry = byId.get(String(hit.entryId ?? ''));
      if (!entry) continue;
      const quote = typeof hit.quote === 'string' ? hit.quote.trim() : '';
      // Quotes must be verbatim from the cited entry; drop anything else.
      if (!quote || !entryText(entry).includes(quote)) continue;
      hits.push({
        entryId: String(entry.id),
        dateLabel: typeof hit.dateLabel === 'string' && hit.dateLabel.trim() ? hit.dateLabel.trim() : entryDay(entry),
        quote,
      });
      if (hits.length >= 5) break;
    }
  }
  // Arrange multiple sources by date ascending.
  hits.sort((a, b) => a.dateLabel.localeCompare(b.dateLabel));
  const found = raw.found === true && hits.length > 0;
  let text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (!found) {
    // Honest fallback wording when nothing was found, regardless of model prose.
    return {
      found: false,
      text: 'I could not find anything about that in the available notes.',
      hits: [],
    };
  }
  if (!text) {
    text = hits.map((hit) => `On ${hit.dateLabel} the notes say: "${hit.quote}"`).join('\n\n');
  }
  return { found: true, text: clip(text, 1200), hits };
}

export async function ask({ question, entries }) {
  const list = Array.isArray(entries) ? entries : [];
  const input = { question, entries: list };
  return withFallback(
    async () => {
      const described = sortedByDay(list)
        .map((entry) => `- id: ${entry.id} | day: ${entryDay(entry)} | text: """${entryText(entry)}"""`)
        .join('\n');
      const raw = await chatJson({
        system:
          'You answer a question using ONLY the deidentified journal notes provided below. Never use outside knowledge. ' +
          'Respond with ONLY a JSON object of exactly this shape: ' +
          '{ "found": boolean, "text": string, "hits": [{ "entryId": string, "dateLabel": string, "quote": string }] }. ' +
          'Rules: every quote must be copied VERBATIM from the note with that entryId. ' +
          'When several notes are relevant, include several hits arranged by date ascending and weave them into text by date. ' +
          'If the notes do not contain the answer, set found to false, return an empty hits array, and honestly say nothing was found. ' +
          'Never invent content. No other keys or prose.',
        user: `Question: """${String(question ?? '')}"""\n\nNotes:\n${described || '(no notes available)'}`,
        maxTokens: 4096,
      });
      return validateAsk(raw, list);
    },
    () => askFallback(input),
  );
}

// ---------------------------------------------------------------------------
// 7. caseSummary
// ---------------------------------------------------------------------------

function mainConcernsFallback(entries) {
  const present = new Set();
  for (const entry of entries) {
    for (const topicId of detectTopics(entryText(entry))) present.add(topicId);
  }
  if (present.has('academic') && present.has('family')) {
    return ['academic pressure', 'family expectations'];
  }
  const ranked = TOPIC_IDS.filter((id) => present.has(id) && id !== 'sleep').sort(
    (a, b) => countTopic(entries, b) - countTopic(entries, a),
  );
  const chosen = (ranked.length > 0 ? ranked : [...present]).slice(0, 2);
  if (chosen.length === 0) return ['notes without a clear recurring topic'];
  return chosen.map((id) => topicById(id).phrase);
}

function recentChangeFallback(entries) {
  const list = sortedByDay(entries);
  if (list.length < 2) return 'This is the first note, so there is no change to compare yet.';
  const mid = Math.floor(list.length / 2);
  const early = list.slice(0, Math.max(mid, 1));
  const late = list.slice(Math.max(mid, 1));
  if (countTopic(late, 'sleep') > countTopic(early, 'sleep')) {
    return 'More sleep concerns this week';
  }
  for (const topicId of ['academic', 'family', 'group']) {
    if (countTopic(late, topicId) > countTopic(early, topicId) && countTopic(early, topicId) === 0) {
      return `More ${topicById(topicId).phrase} recently`;
    }
  }
  return 'The recent notes stay on similar topics.';
}

function periodFallback(entries) {
  const list = sortedByDay(entries);
  if (list.length === 0) return 'No notes yet';
  const start = entryDay(list[0]);
  const end = entryDay(list[list.length - 1]);
  if (start === end) return `Notes from ${start}`;
  return `Notes from ${start} to ${end}`;
}

function caseSummaryFallback(entries) {
  const list = Array.isArray(entries) ? entries : [];
  return {
    mainConcerns: mainConcernsFallback(list),
    recentChange: recentChangeFallback(list),
    period: periodFallback(list),
    excerptIds: sortedByDay(list).slice(-6).map((entry) => String(entry.id)),
  };
}

function validateCaseSummary(raw, entries) {
  if (!raw || typeof raw !== 'object') throw new GenaiUnavailable('invalid-shape', 'case summary is not an object');
  const ids = entryIds(entries);
  const mainConcerns = Array.isArray(raw.mainConcerns)
    ? raw.mainConcerns.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, 5)
    : [];
  const recentChange = typeof raw.recentChange === 'string' ? raw.recentChange.trim() : '';
  const period = typeof raw.period === 'string' ? raw.period.trim() : '';
  if (mainConcerns.length === 0 || !recentChange || !period) {
    throw new GenaiUnavailable('invalid-shape', 'case summary is missing required fields');
  }
  const excerptIds = Array.isArray(raw.excerptIds)
    ? [...new Set(raw.excerptIds.map(String).filter((id) => ids.has(id)))].slice(0, 8)
    : [];
  return {
    mainConcerns,
    recentChange: clip(recentChange, 400),
    period: clip(period, 120),
    excerptIds,
  };
}

export async function caseSummary({ entries }) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) {
    return { result: caseSummaryFallback(list), genai: false, reason: 'no-entries' };
  }
  return withFallback(
    async () => {
      const described = sortedByDay(list)
        .map((entry) => `- id: ${entry.id} | day: ${entryDay(entry)} | text: """${entryText(entry)}"""`)
        .join('\n');
      const raw = await chatJson({
        system:
          'You draft a short, neutral case summary of a student\'s deidentified journal notes for a social worker. ' +
          'Respond with ONLY a JSON object of exactly this shape: ' +
          '{ "mainConcerns": [string, ...], "recentChange": string, "period": string, "excerptIds": [entryId, ...] }. ' +
          'Rules: faithful to the notes only - never invent content. No psychological labels or diagnoses. ' +
          'Preserve uncertainty explicitly: where the notes are ambiguous, say "it is unclear" instead of guessing. ' +
          'period describes the date span of the notes. excerptIds picks up to 6 representative note ids. No other keys or prose.',
        user: `Notes (oldest to newest):\n${described}`,
        maxTokens: 4096,
      });
      return validateCaseSummary(raw, list);
    },
    () => caseSummaryFallback(list),
  );
}
