import { readTranscript } from './lib/transcriptText';

const SCRIBE_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
const MODEL_ID = 'scribe_v2';
const DEFAULT_API_KEY = 'sk_9ae5f0a46aa51760b4350379e17226a36ad8d689e3073069';

export type TranscribePhase = 'preparing' | 'transcribing';

type NativeUpload = {
  uri: string;
  name: string;
  type: string;
};

function scribeApiKey(): string {
  return process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY?.trim() || DEFAULT_API_KEY;
}

export function audioFileName(type: string | undefined, uri: string): string {
  const source = `${type ?? ''} ${uri}`.toLowerCase();
  if (source.includes('wav')) return 'recording.wav';
  if (source.includes('mpeg') || source.includes('mp3')) return 'recording.mp3';
  if (source.includes('ogg')) return 'recording.ogg';
  if (source.includes('webm')) return 'recording.webm';
  if (source.includes('aac')) return 'recording.aac';
  return 'recording.m4a';
}

export function audioMimeType(type: string | undefined, uri: string): string {
  if (type && type !== 'application/octet-stream') return type;
  const name = audioFileName(type, uri);
  if (name.endsWith('.wav')) return 'audio/wav';
  if (name.endsWith('.mp3')) return 'audio/mpeg';
  if (name.endsWith('.ogg')) return 'audio/ogg';
  if (name.endsWith('.webm')) return 'audio/webm';
  if (name.endsWith('.aac')) return 'audio/aac';
  return 'audio/mp4';
}

function isNativeFileUri(uri: string): boolean {
  return /^(file|content):/i.test(uri);
}

async function appendRecording(form: FormData, uri: string): Promise<void> {
  const fallbackType = audioMimeType(undefined, uri);
  const fallbackName = audioFileName(undefined, uri);

  if (isNativeFileUri(uri)) {
    const file: NativeUpload = { uri, name: fallbackName, type: fallbackType };
    form.append('file', file as unknown as Blob);
    return;
  }

  const response = await fetch(uri);
  if (!response.ok) throw new Error('Could not read the recording');
  const blob = await response.blob();
  if (blob.size === 0) throw new Error('Recording is empty');
  const type = audioMimeType(blob.type, uri);
  const name = audioFileName(type, uri);
  if (typeof File !== 'undefined') {
    form.append('file', new File([blob], name, { type }));
    return;
  }
  form.append('file', blob, name);
}

export async function transcribeRecording(audioUri: string, onPhase?: (phase: TranscribePhase) => void): Promise<string> {
  if (!audioUri) return '';
  const apiKey = scribeApiKey();
  if (!apiKey) throw new Error('ElevenLabs API key is missing');

  onPhase?.('preparing');
  const form = new FormData();
  await appendRecording(form, audioUri);
  form.append('model_id', MODEL_ID);
  form.append('tag_audio_events', 'false');
  form.append('timestamps_granularity', 'none');

  onPhase?.('transcribing');
  const response = await fetch(SCRIBE_URL, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  });
  if (!response.ok) {
    throw new Error('Transcription failed');
  }
  return readTranscript(await response.json());
}

export async function retainRecording(uri?: string): Promise<string | undefined> {
  if (!uri) return undefined;
  if (!uri.startsWith('blob:') || typeof fetch !== 'function' || typeof URL === 'undefined') return uri;
  try {
    const blob = await (await fetch(uri)).blob();
    if (blob.size === 0) return undefined;
    return URL.createObjectURL(blob);
  } catch {
    return uri;
  }
}
