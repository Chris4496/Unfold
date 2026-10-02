export function readableTranscript(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!/[0-9A-Za-z\u00C0-\u024F\u4E00-\u9FFF]/.test(clean)) return '';
  return clean;
}

export function readTranscript(output: unknown): string {
  return readableTranscript(collect(output));
}

export function nextComposerText(current: string, incoming: string, edited: boolean): string {
  if (edited) return current;
  const clean = incoming.trim();
  return clean || current;
}

function collect(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return output.map((item) => collect(item)).join(' ');
  if (output && typeof output === 'object' && 'text' in output) {
    const text = (output as { text?: unknown }).text;
    return typeof text === 'string' ? text : '';
  }
  return '';
}
