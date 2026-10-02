import { canTranscribeFile, transcribeFile } from './speech';

export type TranscribePhase = 'preparing' | 'transcribing';

export { canTranscribeFile };

export async function transcribeRecording(audioUri: string, onPhase?: (phase: TranscribePhase) => void): Promise<string> {
  if (!audioUri) return '';
  onPhase?.('preparing');
  onPhase?.('transcribing');
  return transcribeFile(audioUri);
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
