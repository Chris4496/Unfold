type SpeechResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
};

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRec;
  webkitSpeechRecognition?: new () => SpeechRec;
};

export type Dictation = {
  stop: () => string;
};

export function startDictation(onText: (text: string) => void): Dictation | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as SpeechWindow;
  const Ctor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-HK';

  let finalText = '';
  let stopped = false;

  recognition.onresult = (event) => {
    let interim = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const piece = event.results[index][0]?.transcript ?? '';
      if (event.results[index].isFinal) finalText = `${finalText} ${piece}`.trim();
      else interim = `${interim} ${piece}`.trim();
    }
    onText(`${finalText} ${interim}`.trim());
  };

  recognition.onerror = () => {
    stopped = true;
  };

  recognition.onend = () => {
    if (!stopped) {
      try {
        recognition.start();
      } catch {
        stopped = true;
      }
    }
  };

  try {
    recognition.start();
  } catch {
    return null;
  }

  return {
    stop: () => {
      stopped = true;
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
      return finalText.trim();
    },
  };
}
