import { Platform } from 'react-native';
import { readTranscript } from './lib/transcriptText';

const ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text';
const MODEL = 'scribe_v2';
const API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? '';

export type TranscribePhase = 'preparing' | 'transcribing';

async function appendAudio(form: FormData, uri: string) {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Could not read the recording');
    const blob = await response.blob();
    if (blob.size === 0) throw new Error('The recording is empty');
    form.append('file', blob, blob.type.includes('webm') ? 'recording.webm' : 'recording.m4a');
    return;
  }
  // React Native's FormData streams the file from disk when given a { uri, name, type } part.
  form.append('file', { uri, name: 'recording.m4a', type: 'audio/m4a' } as unknown as Blob);
}

export async function transcribeRecording(audioUri: string, onPhase?: (phase: TranscribePhase) => void): Promise<string> {
  if (!audioUri) return '';
  if (!API_KEY) throw new Error('EXPO_PUBLIC_ELEVENLABS_API_KEY is not set');
  onPhase?.('preparing');
  const form = new FormData();
  form.append('model_id', MODEL);
  form.append('tag_audio_events', 'false');
  await appendAudio(form, audioUri);
  onPhase?.('transcribing');
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY },
    body: form,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Transcription failed (${response.status}): ${detail}`);
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
