import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Back, Button, Card, Field, Screen, T } from '../src/components/ui';
import { nextComposerText } from '../src/lib/transcriptText';
import { clearRecording, currentRecording, type RecordingDraft } from '../src/recordingDraft';
import { useStore } from '../src/store';
import { colors } from '../src/theme';
import { canTranscribe, transcribeRecording, type TranscribePhase } from '../src/transcribeAudio';

type Phase = 'idle' | TranscribePhase | 'ready' | 'failed';

function guidance(
  reason: string | undefined,
  recording: RecordingDraft | null,
  phase: Phase,
  progress: number | undefined,
): string {
  if (!recording) {
    return reason === 'mic'
      ? 'The microphone is not available. Type it instead. It still stays on this phone.'
      : 'Type it here. It stays on this phone, just like a recording.';
  }
  if (phase === 'preparing') return 'Preparing speech recognition on this phone. Your recording stays here.';
  if (phase === 'downloading') {
    const percent = progress === undefined ? '' : ` ${Math.round(progress * 100)}%`;
    return `Downloading the speech model to this phone. This happens once.${percent} Your recording stays here.`;
  }
  if (phase === 'transcribing') return 'Turning your recording into text. Cantonese and English both work. You can edit it before saving.';
  if (phase === 'failed' && !canTranscribe()) {
    return 'This version of the app cannot turn recordings into text. Expo Go cannot run the speech model, so use the Unfold app build. Write your note in the box for now.';
  }
  if (phase === 'failed') return 'Write your note in the box. It stays on this phone.';
  return 'This text came from your recording. You can edit it. It stays on this phone.';
}

export default function WriteScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [recording] = useState(() => currentRecording());
  const [text, setText] = useState(recording?.audioUri ? '' : (recording?.transcript ?? ''));
  const [phase, setPhase] = useState<Phase>(recording?.audioUri ? 'preparing' : recording ? 'ready' : 'idle');
  const [progress, setProgress] = useState<number | undefined>();
  const edited = useRef(false);
  const store = useStore();
  const router = useRouter();
  const waiting = phase === 'preparing' || phase === 'downloading' || phase === 'transcribing';

  useEffect(() => {
    const audioUri = recording?.audioUri;
    if (!audioUri) return;
    let cancelled = false;
    transcribeRecording(audioUri, (next, fraction) => {
      if (cancelled) return;
      setPhase(next);
      setProgress(fraction);
    })
      .then((transcript) => {
        if (cancelled) return;
        const incoming = transcript.trim() || recording.transcript.trim();
        setText((current) => nextComposerText(current, incoming, edited.current));
        if (edited.current || incoming) setPhase('ready');
        else setPhase('failed');
      })
      .catch(() => {
        if (cancelled) return;
        setPhase(recording.transcript ? 'ready' : 'failed');
      });
    return () => {
      cancelled = true;
    };
  }, [recording]);

  function save() {
    const entry = store.addEntry(text, recording?.audioUri);
    if (!entry) return;
    clearRecording();
    router.replace({ pathname: '/saved', params: { id: entry.id } });
  }

  return (
    <Screen
      keyboard
      scroll
      footer={<Button label="Save on this phone" onPress={save} disabled={text.trim().length === 0} />}
    >
      <Back label="Home" href="/" />
      <T size={14} weight="semibold" color={colors.teal}>
        Step 1 · Record
      </T>
      <T weight="extrabold" size={30} style={{ marginTop: 8 }}>
        What did you want to say?
      </T>
      <T size={16} color={colors.muted} style={{ marginTop: 8, marginBottom: 18 }}>
        {guidance(typeof reason === 'string' ? reason : undefined, recording, phase, progress)}
      </T>
      <Card title="Your note">
        <Field
          accessibilityLabel="What did you want to say?"
          value={text}
          onChangeText={(value) => {
            edited.current = true;
            setText(value);
          }}
          placeholder={waiting && text.length === 0 ? 'Transcribing your recording…' : 'Start writing…'}
          multiline
        />
      </Card>
      <View />
    </Screen>
  );
}
