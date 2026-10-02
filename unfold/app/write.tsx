import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Back, Button, Card, Field, Screen, T } from '../src/components/ui';
import { nextComposerText } from '../src/lib/transcriptText';
import { clearRecording, currentRecording, type RecordingDraft } from '../src/recordingDraft';
import { useStore } from '../src/store';
import { colors } from '../src/theme';
import { stopActiveDictation } from '../src/speech';
import { canTranscribeFile, transcribeRecording, type TranscribePhase } from '../src/transcribeAudio';

type Phase = 'idle' | TranscribePhase | 'ready' | 'failed';

function guidance(reason: string | undefined, recording: RecordingDraft | null, phase: Phase): string {
  if (!recording) {
    return reason === 'mic'
      ? 'The microphone is not available. Type it instead. It still stays on this phone.'
      : 'Type it here. It stays on this phone, just like a recording.';
  }
  if (phase === 'preparing') return 'Preparing speech recognition on this phone. Your recording stays here.';
  if (phase === 'transcribing') return 'Turning your recording into text. Cantonese and English both work. You can edit it before saving.';
  if (phase === 'failed') return 'Write your note in the box. It stays on this phone.';
  return 'This text came from your recording. You can edit it. It stays on this phone.';
}

function openingPhase(recording: RecordingDraft | null): Phase {
  if (!recording) return 'idle';
  if (recording.transcript.trim()) return 'ready';
  if (recording.audioUri && canTranscribeFile()) return 'preparing';
  return 'failed';
}

export default function WriteScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [recording] = useState(() => currentRecording());
  const [text, setText] = useState(recording?.transcript ?? '');
  const [phase, setPhase] = useState<Phase>(() => openingPhase(recording));
  const edited = useRef(false);
  const store = useStore();
  const router = useRouter();
  const waiting = phase === 'preparing' || phase === 'transcribing';

  useEffect(() => {
    const audioUri = recording?.audioUri;
    if (!audioUri || recording.transcript.trim() || !canTranscribeFile()) return;
    let cancelled = false;
    transcribeRecording(audioUri, (next) => {
      if (!cancelled) setPhase(next);
    })
      .then((transcript) => {
        if (cancelled) return;
        const incoming = transcript.trim();
        setText((current) => nextComposerText(current, incoming, edited.current));
        setPhase(edited.current || incoming ? 'ready' : 'failed');
      })
      .catch(() => {
        if (!cancelled) setPhase('failed');
      });
    return () => {
      cancelled = true;
      stopActiveDictation();
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
        {guidance(typeof reason === 'string' ? reason : undefined, recording, phase)}
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
