import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { retainRecording } from './transcribeAudio';

export function useVoiceCapture() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef(false);
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recorderRef.current.stop().catch(() => undefined);
      }
    };
  }, []);

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
    try {
      await recorder.stop();
    } catch {
      /* the file may be missing; the write screen falls back to typing */
    }
    const audioUri = await retainRecording(recorder.uri ?? undefined);
    return { transcript: '', audioUri };
  }

  return { recording, seconds, start, stop };
}
