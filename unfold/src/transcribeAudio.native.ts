import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { TurboModuleRegistry } from 'react-native';
import type { WhisperContext } from 'whisper.rn/index';
import { isAudible, mixToMono, toPcm16 } from './lib/pcm';
import { readTranscript } from './lib/transcriptText';
import type { TranscribePhase } from './transcribeAudio';

export type { TranscribePhase } from './transcribeAudio';

// GGML build of the same Cantonese fine-tune the web app runs. It still transcribes English.
const MODEL_URL = 'https://huggingface.co/alvanlii/whisper-small-cantonese/resolve/main/ggml-model.bin';
const MODEL_BYTES = 487601967;
const MODEL_NAME = 'whisper-small-cantonese.bin';
const SAMPLE_RATE = 16000;
const MIN_SAMPLES = SAMPLE_RATE * 0.3;

let contextPromise: Promise<WhisperContext> | null = null;

export function canTranscribe(): boolean {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  return TurboModuleRegistry.get('RNWhisper') != null && TurboModuleRegistry.get('AudioAPIModule') != null;
}

function modelFile(): File {
  return new File(Paths.document, 'speech', MODEL_NAME);
}

async function ensureModel(onProgress: (fraction: number) => void): Promise<File> {
  const model = modelFile();
  if (model.exists && model.size === MODEL_BYTES) return model;

  const folder = new Directory(Paths.document, 'speech');
  folder.create({ idempotent: true, intermediates: true });
  const partial = new File(folder, `${MODEL_NAME}.part`);
  if (partial.exists) partial.delete();
  if (model.exists) model.delete();

  onProgress(0);
  await File.downloadFileAsync(MODEL_URL, partial, {
    idempotent: true,
    onProgress: ({ bytesWritten, totalBytes }) => {
      const total = totalBytes > 0 ? totalBytes : MODEL_BYTES;
      onProgress(Math.min(1, bytesWritten / total));
    },
  });
  if (partial.size !== MODEL_BYTES) {
    partial.delete();
    throw new Error('The speech model download was incomplete');
  }
  await partial.move(model);
  return model;
}

function getContext(onProgress: (fraction: number) => void): Promise<WhisperContext> {
  if (!contextPromise) {
    contextPromise = (async () => {
      const model = await ensureModel(onProgress);
      const { initWhisper } = await import('whisper.rn/index');
      return initWhisper({ filePath: model.uri, useGpu: true });
    })().catch((error: unknown) => {
      contextPromise = null;
      throw error;
    });
  }
  return contextPromise;
}

async function decodeFile(uri: string) {
  const { decodeAudioData } = await import('react-native-audio-api');
  if (!uri.startsWith('content://')) return decodeAudioData(uri, SAMPLE_RATE);
  // The decoder reads file paths only, so Android content URIs are copied first.
  const copy = new File(Paths.cache, `recording-${Date.now()}.m4a`);
  await new File(uri).copy(copy);
  try {
    return await decodeAudioData(copy.uri, SAMPLE_RATE);
  } finally {
    copy.delete();
  }
}

async function recordingTo16kMono(uri: string): Promise<Float32Array> {
  const decoded = await decodeFile(uri);
  const channels: Float32Array[] = [];
  for (let index = 0; index < decoded.numberOfChannels; index += 1) {
    channels.push(decoded.getChannelData(index));
  }
  return mixToMono(channels);
}

export async function transcribeRecording(
  audioUri: string,
  onPhase?: (phase: TranscribePhase, progress?: number) => void,
): Promise<string> {
  if (!audioUri || !canTranscribe()) return '';
  onPhase?.('preparing');
  const samples = await recordingTo16kMono(audioUri);
  if (samples.length < MIN_SAMPLES || !isAudible(samples)) return '';
  const context = await getContext((fraction) => onPhase?.('downloading', fraction));
  onPhase?.('transcribing');
  // The fine-tune was trained without timestamp tokens. With them it drops most of the
  // Cantonese clip and adds stray words to English, so they stay off.
  const { promise } = context.transcribeData(toPcm16(samples), { language: 'auto', noTimestamps: true });
  const { result, isAborted } = await promise;
  if (isAborted) return '';
  return readTranscript(result);
}

export async function retainRecording(uri?: string): Promise<string | undefined> {
  return uri;
}
