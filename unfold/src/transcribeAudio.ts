import { isAudible, mixToMono, resample } from './lib/pcm';
import { readTranscript } from './lib/transcriptText';

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const MODEL = 'onnx-community/whisper-tiny.en';
const SAMPLE_RATE = 16000;
const MIN_SAMPLES = SAMPLE_RATE * 0.3;

export type TranscribePhase = 'preparing' | 'transcribing';

type Transcriber = (audio: Float32Array, options?: Record<string, unknown>) => Promise<unknown>;

type TransformersModule = {
  pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<Transcriber>;
  env: {
    allowLocalModels: boolean;
    useBrowserCache?: boolean;
    backends?: {
      onnx?: {
        wasm?: {
          numThreads?: number;
          proxy?: boolean;
        };
      };
    };
  };
};

let transcriberPromise: Promise<Transcriber> | null = null;

function loadTransformers(): Promise<TransformersModule> {
  const load = new Function('url', 'return import(url)') as (url: string) => Promise<TransformersModule>;
  return load(TRANSFORMERS_URL);
}

function getTranscriber(): Promise<Transcriber> {
  if (!transcriberPromise) {
    transcriberPromise = loadTransformers()
      .then(({ pipeline, env }) => {
        env.allowLocalModels = false;
        env.useBrowserCache = true;
        if (env.backends?.onnx?.wasm) {
          env.backends.onnx.wasm.numThreads = 1;
          env.backends.onnx.wasm.proxy = false;
        }
        return pipeline('automatic-speech-recognition', MODEL, {
          device: 'wasm',
          dtype: 'q8',
        });
      })
      .catch((error: unknown) => {
        transcriberPromise = null;
        throw error;
      });
  }
  return transcriberPromise;
}

async function audioUriTo16kMono(uri: string): Promise<Float32Array> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Could not read the recording');
  const bytes = await response.arrayBuffer();
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(bytes.slice(0));
    const channels: Float32Array[] = [];
    for (let index = 0; index < decoded.numberOfChannels; index += 1) {
      channels.push(decoded.getChannelData(index));
    }
    return resample(mixToMono(channels), decoded.sampleRate, SAMPLE_RATE);
  } finally {
    await context.close().catch(() => undefined);
  }
}

function yieldFrame() {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

export async function transcribeRecording(audioUri: string, onPhase?: (phase: TranscribePhase) => void): Promise<string> {
  if (!audioUri || typeof window === 'undefined' || typeof AudioContext === 'undefined') return '';
  onPhase?.('preparing');
  const samples = await audioUriTo16kMono(audioUri);
  if (samples.length < MIN_SAMPLES || !isAudible(samples)) return '';
  const transcriber = await getTranscriber();
  onPhase?.('transcribing');
  await yieldFrame();
  const output = await transcriber(samples);
  return readTranscript(output);
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
