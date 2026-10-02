import {
  AudioEncodingAndroid,
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionOptions,
} from 'expo-speech-recognition';
import { Platform } from 'react-native';
import {
  applyRecognitionResult,
  chooseRecognitionLanguage,
  emptyDraft,
  languageSwitchLocales,
  readDraft,
  type TranscriptDraft,
} from './lib/speechText';

export type CapturedSpeech = {
  transcript: string;
  audioUri?: string;
};

export type Dictation = {
  stop: () => Promise<CapturedSpeech>;
  finished: Promise<CapturedSpeech>;
};

type Subscription = { remove: () => void };
type RecognitionSettings = { lang: string; onDevice: boolean; installedLocales: string[] };
type CaptureMode = { persist?: boolean; fileUri?: string };

type Session = {
  started: Promise<boolean>;
  finished: Promise<CapturedSpeech>;
  begin: () => void;
  stop: () => Promise<CapturedSpeech>;
  abort: () => void;
};

let ticket = 0;
let active: Session | null = null;

export function stopActiveDictation() {
  ticket += 1;
  const session = active;
  active = null;
  session?.abort();
}

export function usesRecognizerRecording(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable() && ExpoSpeechRecognitionModule.supportsRecording();
  } catch {
    return false;
  }
}

export function canTranscribeFile(): boolean {
  return usesRecognizerRecording();
}

export async function startDictation(onText: (text: string) => void, mode?: CaptureMode): Promise<Dictation | null> {
  await releaseActive();
  const mine = ticket;
  if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) return null;
  const settings = await recognitionSettings();
  if (mine !== ticket) return null;
  if (!(await ensurePermission(settings.onDevice))) return null;
  if (mine !== ticket) return null;

  const session = openSession(onText, recognitionOptions(settings, mode), mode);
  active = session;
  session.begin();
  const started = await session.started;
  if (!started || mine !== ticket || active !== session) {
    if (active === session) active = null;
    session.abort();
    return null;
  }

  return {
    finished: session.finished,
    stop: () => session.stop().then((result) => {
      if (active === session) active = null;
      return result;
    }),
  };
}

export async function transcribeFile(uri: string): Promise<string> {
  if (!uri || !canTranscribeFile()) return '';
  const dictation = await startDictation(() => undefined, { fileUri: uri });
  if (!dictation) return '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      dictation.finished,
      new Promise<CapturedSpeech>((resolve) => {
        timer = setTimeout(() => {
          dictation.stop().then(resolve);
        }, 45000);
      }),
    ]);
    return result.transcript;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function openSession(onText: (text: string) => void, options: ExpoSpeechRecognitionOptions, mode?: CaptureMode): Session {
  let draft: TranscriptDraft = emptyDraft();
  let audioUri: string | undefined;
  let ended = false;
  let didStart = false;
  let stopping = false;
  let fatal = false;
  let burst = 0;
  let lastRestart = 0;
  // Restarting would open a second recording file, so only the live preview does this.
  const restartable = !mode?.fileUri && !mode?.persist;
  const subscriptions: Subscription[] = [];
  let forceTimer: ReturnType<typeof setTimeout> | undefined;
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  let resolveDone: (result: CapturedSpeech) => void = () => undefined;
  let resolveStarted: (started: boolean) => void = () => undefined;
  const finished = new Promise<CapturedSpeech>((resolve) => {
    resolveDone = resolve;
  });
  const started = new Promise<boolean>((resolve) => {
    resolveStarted = resolve;
  });

  const current = (): CapturedSpeech => ({
    transcript: readDraft(draft),
    audioUri,
  });

  const release = () => {
    if (forceTimer) clearTimeout(forceTimer);
    if (startTimer) clearTimeout(startTimer);
    forceTimer = undefined;
    startTimer = undefined;
    for (const subscription of subscriptions) subscription.remove();
    subscriptions.length = 0;
  };

  const close = () => {
    if (ended) return;
    ended = true;
    const result = current();
    release();
    resolveStarted(didStart);
    resolveDone(result);
  };

  const silence = () => {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      /* The recognizer is already idle. */
    }
  };

  subscriptions.push(ExpoSpeechRecognitionModule.addListener('result', (event) => {
    burst = 0;
    draft = applyRecognitionResult(draft, {
      isFinal: event.isFinal,
      transcript: event.results[0]?.transcript ?? '',
    });
    onText(readDraft(draft));
  }));
  subscriptions.push(ExpoSpeechRecognitionModule.addListener('audioend', (event) => {
    if (event.uri && !audioUri) audioUri = event.uri;
  }));
  subscriptions.push(ExpoSpeechRecognitionModule.addListener('start', () => {
    didStart = true;
    if (startTimer) clearTimeout(startTimer);
    startTimer = undefined;
    resolveStarted(true);
  }));
  subscriptions.push(ExpoSpeechRecognitionModule.addListener('error', (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'language-not-supported' || event.error === 'audio-capture') {
      fatal = true;
      if (!didStart) close();
    }
  }));
  subscriptions.push(ExpoSpeechRecognitionModule.addListener('end', () => {
    if (ended || stopping || !restartable || fatal || !didStart) {
      close();
      return;
    }
    const now = Date.now();
    burst = now - lastRestart < 1000 ? burst + 1 : 0;
    lastRestart = now;
    if (burst > 5) {
      close();
      return;
    }
    try {
      ExpoSpeechRecognitionModule.start(options);
    } catch {
      close();
    }
  }));

  return {
    started,
    finished,
    begin: () => {
      if (ended) return;
      startTimer = setTimeout(() => {
        silence();
        close();
      }, 4000);
      try {
        ExpoSpeechRecognitionModule.start(options);
      } catch {
        close();
      }
    },
    stop: () => {
      if (!ended) {
        stopping = true;
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {
          close();
          return finished;
        }
        forceTimer = setTimeout(() => {
          silence();
          close();
        }, 2500);
      }
      return finished;
    },
    abort: () => {
      if (ended) return;
      stopping = true;
      ended = true;
      const result = current();
      release();
      resolveStarted(false);
      resolveDone(result);
      silence();
    },
  };
}

async function releaseActive() {
  ticket += 1;
  const session = active;
  active = null;
  if (!session) return;
  session.abort();
  await waitUntilIdle();
}

async function waitUntilIdle() {
  if (Platform.OS !== 'web') {
    const state = await ExpoSpeechRecognitionModule.getStateAsync().catch(() => 'inactive' as const);
    if (state === 'inactive') return;
  }
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      subscription.remove();
      resolve();
    }, Platform.OS === 'web' ? 300 : 600);
    const subscription = ExpoSpeechRecognitionModule.addListener('end', () => {
      clearTimeout(timeout);
      subscription.remove();
      resolve();
    });
  });
}

async function ensurePermission(onDevice: boolean): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    const result = onDevice
      ? await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync()
      : await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return result.granted;
  } catch {
    return false;
  }
}

async function recognitionSettings(): Promise<RecognitionSettings> {
  const fallback = Platform.OS === 'web' ? 'yue-Hant-HK' : 'zh-HK';
  if (Platform.OS === 'web') return { ...chooseRecognitionLanguage([], [], fallback), installedLocales: [] };
  try {
    const supported = await ExpoSpeechRecognitionModule.getSupportedLocales({});
    const choice = chooseRecognitionLanguage(supported.locales, supported.installedLocales, fallback);
    return {
      lang: choice.lang,
      onDevice: choice.onDevice && ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
      installedLocales: supported.installedLocales,
    };
  } catch {
    return { ...chooseRecognitionLanguage([], [], fallback), installedLocales: [] };
  }
}

function recognitionOptions(settings: RecognitionSettings, mode?: CaptureMode): ExpoSpeechRecognitionOptions {
  const options: ExpoSpeechRecognitionOptions = {
    lang: settings.lang,
    interimResults: true,
    continuous: true,
    addsPunctuation: true,
    maxAlternatives: 1,
    requiresOnDeviceRecognition: settings.onDevice,
    iosTaskHint: 'dictation',
  };
  const switchLocales = settings.onDevice ? languageSwitchLocales(settings.installedLocales) : null;
  if (switchLocales && androidOnDevicePackage()) {
    options.androidRecognitionServicePackage = 'com.google.android.as';
    options.androidIntentOptions = {
      EXTRA_ENABLE_LANGUAGE_DETECTION: true,
      EXTRA_ENABLE_LANGUAGE_SWITCH: 'balanced',
      EXTRA_LANGUAGE_DETECTION_ALLOWED_LANGUAGES: switchLocales,
      EXTRA_LANGUAGE_SWITCH_ALLOWED_LANGUAGES: switchLocales,
    };
  }
  if (mode?.persist) {
    options.recordingOptions = {
      persist: true,
      outputSampleRate: 16000,
      outputEncoding: 'pcmFormatInt16',
      outputFileName: `unfold-${Date.now()}.wav`,
    };
  }
  if (mode?.fileUri) options.audioSource = audioSourceFor(mode.fileUri);
  return options;
}

function androidOnDevicePackage(): boolean {
  if (Platform.OS !== 'android') return false;
  try {
    return ExpoSpeechRecognitionModule.getSpeechRecognitionServices().includes('com.google.android.as');
  } catch {
    return false;
  }
}

function audioSourceFor(uri: string) {
  const path = uri.split('?')[0].toLowerCase();
  if (path.endsWith('.wav')) {
    return {
      uri,
      audioChannels: 1,
      sampleRate: 16000,
      audioEncoding: AudioEncodingAndroid.ENCODING_PCM_16BIT,
    };
  }
  return { uri };
}
