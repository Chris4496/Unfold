import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { retainRecording } from './transcribeAudio';
import { startDictation, stopActiveDictation, usesRecognizerRecording, type Dictation } from './speech';

export function useVoiceCapture() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [partial, setPartial] = useState('');
  const partialRef = useRef('');
  const dictationRef = useRef<Dictation | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef(false);
  const captureAudioRef = useRef(false);
  const aliveRef = useRef(true);
  const startRequest = useRef<Promise<boolean> | null>(null);
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (dictationRef.current) void dictationRef.current.stop();
      else stopActiveDictation();
      if (captureAudioRef.current) recorderRef.current.stop().catch(() => undefined);
    };
  }, []);

  function remember(text: string) {
    partialRef.current = text;
    setPartial(text);
  }

  async function stopRecorder() {
    if (!captureAudioRef.current) return undefined;
    captureAudioRef.current = false;
    try {
      await recorderRef.current.stop();
    } catch {
      /* keep the transcript even if the file is missing */
    }
    return recorderRef.current.uri ?? undefined;
  }

  async function begin(): Promise<boolean> {
    const persist = usesRecognizerRecording();
    try {
      if (!persist) {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted || !aliveRef.current) return false;
        try {
          await setAudioModeAsync({
            allowsRecording: true,
            playsInSilentMode: true,
            interruptionMode: 'mixWithOthers',
            shouldPlayInBackground: false,
            shouldRouteThroughEarpiece: false,
          });
          await recorderRef.current.prepareToRecordAsync();
          recorderRef.current.record();
          captureAudioRef.current = true;
        } catch {
          captureAudioRef.current = false;
        }
      }
      if (!aliveRef.current) {
        await stopRecorder();
        return false;
      }
      remember('');
      const dictation = await startDictation(remember, { persist });
      if (!aliveRef.current) {
        await dictation?.stop();
        await stopRecorder();
        return false;
      }
      if (!dictation && !captureAudioRef.current) return false;
      dictationRef.current = dictation;
      recordingRef.current = true;
      setRecording(true);
      setSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setSeconds((value) => value + 1), 1000);
      return true;
    } catch {
      await stopRecorder();
      stopActiveDictation();
      dictationRef.current = null;
      recordingRef.current = false;
      setRecording(false);
      return false;
    }
  }

  function start(): Promise<boolean> {
    if (recordingRef.current) return Promise.resolve(true);
    if (startRequest.current) return startRequest.current;
    const request = begin().finally(() => {
      if (startRequest.current === request) startRequest.current = null;
    });
    startRequest.current = request;
    return request;
  }

  async function stop(): Promise<{ transcript: string; audioUri?: string }> {
    if (startRequest.current) await startRequest.current;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recordingRef.current = false;
    setRecording(false);
    const dictation = dictationRef.current;
    dictationRef.current = null;
    const spokenPromise = dictation?.stop() ?? Promise.resolve({ transcript: '', audioUri: undefined as string | undefined });
    const recorderUri = await stopRecorder();
    const spoken = await spokenPromise;
    const transcript = (spoken.transcript || partialRef.current).trim();
    const audioUri = spoken.audioUri ?? await retainRecording(recorderUri);
    remember('');
    return { transcript, audioUri };
  }

  return { recording, seconds, partial, start, stop };
}
