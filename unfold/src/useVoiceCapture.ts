import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { startDictation, type Dictation } from './speech';

export function useVoiceCapture() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [partial, setPartial] = useState('');
  const partialRef = useRef('');
  const dictationRef = useRef<Dictation | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef(false);
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      dictationRef.current?.stop();
      if (recordingRef.current) {
        recorderRef.current.stop().catch(() => undefined);
      }
    };
  }, []);

  function remember(text: string) {
    partialRef.current = text;
    setPartial(text);
  }

  async function start(): Promise<boolean> {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) return false;
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      remember('');
      dictationRef.current = startDictation(remember);
      recordingRef.current = true;
      setRecording(true);
      setSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setSeconds((value) => value + 1), 1000);
      return true;
    } catch {
      recordingRef.current = false;
      setRecording(false);
      return false;
    }
  }

  async function stop(): Promise<{ transcript: string; audioUri?: string }> {
    if (timerRef.current) clearInterval(timerRef.current);
    recordingRef.current = false;
    setRecording(false);
    const spoken = dictationRef.current?.stop() ?? '';
    dictationRef.current = null;
    try {
      await recorder.stop();
    } catch {
      /* keep the transcript even if the file is missing */
    }
    const transcript = (spoken || partialRef.current).trim();
    remember('');
    return { transcript, audioUri: recorder.uri ?? undefined };
  }

  return { recording, seconds, partial, start, stop };
}
